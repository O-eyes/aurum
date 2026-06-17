import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { v4 as uuid } from "uuid";
import { DatabaseService } from "../../infrastructure/database/database.service";
import { KafkaService } from "../../infrastructure/kafka/kafka.service";
import { AuditService } from "../audit/audit.service";
import { FxService } from "../../infrastructure/fx/fx.service";
import { LedgerService } from "../ledger/ledger.service";
import { KafkaTopic } from "../../infrastructure/kafka/kafka.topics";
import { PAYMENT_PROVIDER } from "./payment.provider.interface";
import { PaystackProvider } from "./providers/paystack.provider";
import {
  AuditAction,
  MintBurnStatus,
  OrderType,
  PayoutStatus,
  LedgerType,
} from "@aurum/types";
import type { SetPayoutMethodDto } from "./dto/set-payout-method.dto";

// Map currency codes to Paystack recipient types
const RECIPIENT_TYPE_MAP: Record<string, "nuban" | "mobile_money" | "ghipss"> =
  {
    NGN: "nuban", // Nigerian bank account
    GHS: "ghipss", // Ghana bank account (use 'mobile_money' for MoMo)
    ZAR: "nuban",
    KES: "nuban",
  };

const CURRENCY_MULTIPLIERS: Record<string, number> = {
  GHS: 100,
  NGN: 100,
  ZAR: 100,
  KES: 100,
};

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly kafka: KafkaService,
    private readonly audit: AuditService,
    private readonly fx: FxService,
    private readonly ledger: LedgerService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaystackProvider,
  ) {}

  // ── Set payout method on a SELL order ─────────────────────────────────────

  async setPayoutMethod(
    orderId: string,
    userId: string,
    dto: SetPayoutMethodDto,
  ) {
    const order = await this.db.order.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.type !== OrderType.SELL)
      throw new BadRequestException(
        "Payout method only applicable to SELL orders",
      );

    await this.db.order.update({
      where: { id: orderId },
      data: { payoutMetadata: dto as any },
    });

    return { orderId, payoutMethod: dto.type };
  }

  // ── Initiate payout after burn confirmed ──────────────────────────────────

  async initiatePayout(orderId: string, userId: string, requestId: string) {
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      include: { burnRequest: true, payout: true },
    });

    if (!order) throw new NotFoundException("Order not found");
    if (order.userId !== userId) throw new NotFoundException("Order not found");
    if (order.payout) return order.payout; // idempotent

    if (
      !order.burnRequest ||
      order.burnRequest.status !== MintBurnStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        "Burn must be confirmed before initiating payout",
      );
    }

    const payoutMeta = order.payoutMetadata as SetPayoutMethodDto | null;
    if (!payoutMeta) {
      throw new BadRequestException(
        "Payout method has not been set for this order",
      );
    }

    const user = await this.db.user.findUniqueOrThrow({
      where: { id: order.userId },
      select: { email: true },
    });

    // Create/look up Paystack transfer recipient
    const { recipientCode } = await this.createRecipient(
      payoutMeta,
      user.email,
    );

    const reference = `AUR-PAY-${uuid().replace(/-/g, "").substring(0, 14).toUpperCase()}`;
    const currency = payoutMeta.currency;
    const multiplier = CURRENCY_MULTIPLIERS[currency] ?? 100;
    // Convert the USD order value into the payout currency server-side.
    const amountSmallestUnit = await this.fx.usdToSmallestUnit(
      order.amountUsd as Prisma.Decimal,
      currency,
      multiplier,
    );

    const { transferCode, status } = await this.provider.initiateTransfer({
      amountSmallestUnit,
      recipientCode,
      reference,
      reason: `Aurum gold redemption — order ${orderId}`,
      currency,
    });

    // Debit the user's ledger balance
    await this.db.$transaction(async (tx) => {
      await this.ledger.debit(
        order.userId,
        order.tokenAmount as Prisma.Decimal,
        LedgerType.BURN,
        orderId,
        tx,
      );

      await (tx as any).payout.create({
        data: {
          orderId,
          provider: "paystack",
          recipientCode,
          transferCode,
          providerRef: reference,
          status:
            status === "success"
              ? PayoutStatus.CONFIRMED
              : PayoutStatus.INITIATED,
          amount: new Prisma.Decimal(amountSmallestUnit).div(multiplier),
          currency,
          ...(status === "success" && { confirmedAt: new Date() }),
        },
      });
    });

    await this.audit.emit({
      actorId: "system:payouts",
      action: AuditAction.PAYOUT_INITIATED,
      resource: "payout",
      resourceId: orderId,
      after: { transferCode, reference, currency, status },
      requestId,
    });

    await this.kafka.publish(
      KafkaTopic.PAYOUT_INITIATED,
      "PAYOUT_INITIATED",
      { orderId, userId: order.userId, transferCode, reference },
      { requestId, actorId: "system:payouts" },
    );

    return { transferCode, reference, status };
  }

  // ── Paystack transfer webhook ──────────────────────────────────────────────

  async handleTransferWebhook(
    rawBody: string,
    signature: string,
    requestId: string,
  ) {
    if (!this.provider.verifyWebhookSignature(rawBody, signature)) {
      throw new ForbiddenException("Invalid webhook signature");
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const event = (payload.event as string) ?? "";

    if (
      !["transfer.success", "transfer.failed", "transfer.reversed"].includes(
        event,
      )
    ) {
      return { received: true };
    }

    const parsed = this.provider.parseTransferWebhookEvent(payload);
    if (!parsed.transferCode) return { received: true };

    const payout = await this.db.payout.findFirst({
      where: { transferCode: parsed.transferCode },
      include: { order: true },
    });

    if (!payout || payout.status === PayoutStatus.CONFIRMED)
      return { received: true };

    const newStatus =
      parsed.status === "success"
        ? PayoutStatus.CONFIRMED
        : parsed.status === "reversed"
          ? PayoutStatus.REVERSED
          : PayoutStatus.FAILED;

    await this.db.payout.update({
      where: { id: payout.id },
      data: {
        status: newStatus,
        ...(newStatus === PayoutStatus.CONFIRMED && {
          confirmedAt: new Date(),
        }),
      },
    });

    const action =
      newStatus === PayoutStatus.CONFIRMED
        ? AuditAction.PAYOUT_CONFIRMED
        : AuditAction.PAYOUT_FAILED;
    const topic =
      newStatus === PayoutStatus.CONFIRMED
        ? KafkaTopic.PAYOUT_CONFIRMED
        : KafkaTopic.PAYOUT_FAILED;

    await this.audit.emit({
      actorId: "system:paystack",
      action,
      resource: "payout",
      resourceId: payout.orderId,
      before: { status: payout.status },
      after: { status: newStatus, transferCode: parsed.transferCode },
      requestId,
    });

    await this.kafka.publish(
      topic,
      action,
      {
        orderId: payout.orderId,
        userId: payout.order.userId,
        transferCode: parsed.transferCode,
      },
      { requestId, actorId: "system:paystack" },
    );

    return { received: true };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async createRecipient(dto: SetPayoutMethodDto, _email: string) {
    if (dto.type === "mobile_money") {
      // Mobile money uses Paystack's mobile_money recipient type
      const networkToBankCode: Record<string, string> = {
        mtn: "MTN",
        vodafone: "VOD",
        tigo: "TGO",
        airtel: "ATL",
      };
      return this.provider.createTransferRecipient({
        type: "mobile_money",
        name: dto.name,
        accountNumber: dto.phone,
        bankCode: networkToBankCode[dto.network] ?? dto.network.toUpperCase(),
        currency: dto.currency,
      });
    }

    // Bank account
    const recipientType = RECIPIENT_TYPE_MAP[dto.currency] ?? "nuban";
    return this.provider.createTransferRecipient({
      type: recipientType,
      name: dto.name,
      accountNumber: dto.accountNumber,
      bankCode: dto.bankCode,
      currency: dto.currency,
    });
  }
}
