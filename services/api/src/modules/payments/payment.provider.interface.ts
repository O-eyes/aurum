export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");

/**
 * Split-at-source instruction. The subaccount (GoldBod) receives the remainder
 * of the charge; `transactionChargeSmallestUnit` is the flat amount routed to
 * the main account (Aurum's fee + tax). `bearer: 'account'` means the main
 * account absorbs the provider's processing fee, so the subaccount receives the
 * exact gold cost.
 */
export interface PaymentSplit {
  subaccountCode: string;
  transactionChargeSmallestUnit: number;
  bearer: "account" | "subaccount";
}

export interface CardInitResult {
  reference: string;
  authorizationUrl: string;
  accessCode: string;
}

export interface MobileMoneyInitResult {
  reference: string;
  status: "pay_offline" | "send_otp" | "success";
  displayText: string;
  requiresOtp: boolean;
}

export interface PaymentWebhookEvent {
  reference: string;
  status: "success" | "failed" | "reversed";
  amount: number;
  currency: string;
  channel: string;
  metadata: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;

  initializeCard(params: {
    email: string;
    amountCents: number;
    currency: string;
    reference: string;
    callbackUrl: string;
    metadata?: Record<string, unknown>;
    split?: PaymentSplit;
  }): Promise<CardInitResult>;

  initializeMobileMoney(params: {
    email: string;
    phone: string;
    network: string;
    currency: string;
    amountSmallestUnit: number;
    reference: string;
    metadata?: Record<string, unknown>;
    split?: PaymentSplit;
  }): Promise<MobileMoneyInitResult>;

  verifyWebhookSignature(rawBody: string, signature: string): boolean;

  parseWebhookEvent(payload: unknown): PaymentWebhookEvent;

  verifyTransaction(reference: string): Promise<PaymentWebhookEvent>;
}
