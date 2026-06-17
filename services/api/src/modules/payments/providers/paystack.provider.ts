import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import type {
  CardInitResult,
  MobileMoneyInitResult,
  PaymentWebhookEvent,
  PaymentProvider,
  PaymentSplit,
} from "../payment.provider.interface";

@Injectable()
export class PaystackProvider implements PaymentProvider {
  readonly name = "paystack";
  private readonly logger = new Logger(PaystackProvider.name);

  constructor(
    private readonly secretKey: string,
    private readonly baseUrl: string,
  ) {}

  // ── Card payment ───────────────────────────────────────────────────────────

  async initializeCard(params: {
    email: string;
    amountCents: number;
    currency: string;
    reference: string;
    callbackUrl: string;
    metadata?: Record<string, unknown>;
    split?: PaymentSplit;
  }): Promise<CardInitResult> {
    const body = {
      email: params.email,
      amount: params.amountCents,
      currency: params.currency,
      reference: params.reference,
      callback_url: params.callbackUrl,
      channels: ["card"],
      metadata: params.metadata ?? {},
      ...this.splitFields(params.split),
    };

    const data = await this.post<{
      authorization_url: string;
      access_code: string;
      reference: string;
    }>("/transaction/initialize", body);

    return {
      reference: data.reference,
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code,
    };
  }

  // ── Mobile money ───────────────────────────────────────────────────────────

  async initializeMobileMoney(params: {
    email: string;
    phone: string;
    network: string;
    currency: string;
    amountSmallestUnit: number;
    reference: string;
    metadata?: Record<string, unknown>;
    split?: PaymentSplit;
  }): Promise<MobileMoneyInitResult> {
    const body = {
      email: params.email,
      amount: params.amountSmallestUnit,
      currency: params.currency,
      reference: params.reference,
      mobile_money: {
        phone: params.phone,
        provider: params.network.toLowerCase(), // mtn | vodafone | tigo
      },
      metadata: params.metadata ?? {},
      ...this.splitFields(params.split),
    };

    const data = await this.post<{
      reference: string;
      status: string;
      display_text?: string;
    }>("/charge", body);

    const requiresOtp = data.status === "send_otp";
    const displayText =
      data.display_text ??
      (data.status === "pay_offline"
        ? "A payment prompt has been sent to your phone. Please approve to complete your purchase."
        : data.status === "send_otp"
          ? "Enter the OTP sent to your phone to confirm this payment."
          : "Payment initiated.");

    return {
      reference: data.reference ?? params.reference,
      status: data.status as MobileMoneyInitResult["status"],
      displayText,
      requiresOtp,
    };
  }

  // ── Webhook ────────────────────────────────────────────────────────────────

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!signature) return false;
    const hash = createHmac("sha512", this.secretKey)
      .update(rawBody)
      .digest("hex");
    const expected = Buffer.from(hash, "utf8");
    const received = Buffer.from(signature, "utf8");
    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
  }

  parseWebhookEvent(payload: unknown): PaymentWebhookEvent {
    const p = payload as Record<string, any>;
    const data = p.data ?? {};
    return {
      reference: data.reference ?? "",
      status: this.mapEventStatus(p.event as string, data.status as string),
      amount: data.amount ?? 0,
      currency: data.currency ?? "USD",
      channel: data.channel ?? "unknown",
      metadata: data.metadata ?? {},
    };
  }

  // ── Verify (use after webhook to confirm amount) ───────────────────────────

  async verifyTransaction(reference: string): Promise<PaymentWebhookEvent> {
    const data = await this.get<{
      reference: string;
      status: string;
      amount: number;
      currency: string;
      channel: string;
      metadata: Record<string, unknown>;
    }>(`/transaction/verify/${encodeURIComponent(reference)}`);

    return {
      reference: data.reference,
      status: data.status === "success" ? "success" : "failed",
      amount: data.amount,
      currency: data.currency,
      channel: data.channel,
      metadata: data.metadata ?? {},
    };
  }

  // ── Transfers (payouts) ────────────────────────────────────────────────────

  async createTransferRecipient(params: {
    type: "nuban" | "mobile_money" | "ghipss" | "basa";
    name: string;
    accountNumber: string;
    bankCode: string;
    currency: string;
  }): Promise<{ recipientCode: string }> {
    const data = await this.post<{ recipient_code: string }>(
      "/transferrecipient",
      {
        type: params.type,
        name: params.name,
        account_number: params.accountNumber,
        bank_code: params.bankCode,
        currency: params.currency,
      },
    );
    return { recipientCode: data.recipient_code };
  }

  async initiateTransfer(params: {
    amountSmallestUnit: number;
    recipientCode: string;
    reference: string;
    reason: string;
    currency: string;
  }): Promise<{ transferCode: string; status: string }> {
    const data = await this.post<{ transfer_code: string; status: string }>(
      "/transfer",
      {
        source: "balance",
        amount: params.amountSmallestUnit,
        recipient: params.recipientCode,
        reference: params.reference,
        reason: params.reason,
        currency: params.currency,
      },
    );
    return { transferCode: data.transfer_code, status: data.status };
  }

  parseTransferWebhookEvent(payload: unknown): {
    reference: string;
    transferCode: string;
    status: "success" | "failed" | "reversed";
  } {
    const p = payload as Record<string, any>;
    const data = p.data ?? {};
    const status: "success" | "failed" | "reversed" =
      p.event === "transfer.success"
        ? "success"
        : p.event === "transfer.reversed"
          ? "reversed"
          : "failed";
    return {
      reference: data.reference ?? "",
      transferCode: data.transfer_code ?? "",
      status,
    };
  }

  // ── Split-at-source ──────────────────────────────────────────────────────────

  /**
   * Paystack subaccount split: `subaccount` receives the remainder, the main
   * account receives the flat `transaction_charge`. `bearer` decides who pays
   * Paystack's processing fee.
   */
  private splitFields(split?: PaymentSplit): Record<string, unknown> {
    if (!split) return {};
    return {
      subaccount: split.subaccountCode,
      transaction_charge: split.transactionChargeSmallestUnit,
      bearer: split.bearer,
    };
  }

  // ── HTTP helpers ───────────────────────────────────────────────────────────

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path, undefined);
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });

    const json = (await response.json()) as {
      status: boolean;
      message: string;
      data: T;
    };

    if (!response.ok || !json.status) {
      this.logger.error(`Paystack ${method} ${path} failed: ${json.message}`);
      throw new ServiceUnavailableException(
        `Payment provider error: ${json.message}`,
      );
    }

    return json.data;
  }

  private mapEventStatus(
    event: string,
    dataStatus: string,
  ): PaymentWebhookEvent["status"] {
    if (event === "charge.success" || dataStatus === "success")
      return "success";
    if (event === "charge.dispute.create" || dataStatus === "reversed")
      return "reversed";
    return "failed";
  }
}
