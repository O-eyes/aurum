import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { KafkaService } from '../../infrastructure/kafka/kafka.service';
import { AuditService } from '../audit/audit.service';
import { FxService } from '../../infrastructure/fx/fx.service';
import { OrdersService } from '../orders/orders.service';
import { KafkaTopic } from '../../infrastructure/kafka/kafka.topics';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
  type PaymentSplit,
} from './payment.provider.interface';
import { AuditAction, OrderStatus, OrderType, PaymentStatus } from '@aurum/types';
import type { InitiateCardPaymentDto, InitiateMobileMoneyDto } from './dto/initiate-payment.dto';

// Placeholder subaccount code — when this is the configured value, the split is
// skipped so local/dev charges don't fail against a non-existent subaccount.
const PLACEHOLDER_SUBACCOUNT = 'ACCT_goldbod_placeholder';

// Smallest currency unit multipliers (e.g. GHS → pesewas × 100)
const CURRENCY_MULTIPLIERS: Record<string, number> = {
  USD: 100,
  GHS: 100,
  NGN: 100,
  ZAR: 100,
  KES: 100,
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly kafka: KafkaService,
    private readonly audit: AuditService,
    private readonly fx: FxService,
    private readonly config: ConfigService,
    private readonly ordersService: OrdersService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /**
   * Build the split-at-source instruction for a BUY order: GoldBod's subaccount
   * receives the gold cost, Aurum's main account receives fee + tax as a flat
   * transaction charge. Returns undefined when not applicable (non-BUY, no
   * configured subaccount, or the placeholder) so the charge proceeds un-split.
   */
  private async buildSplit(
    order: { type: string; platformFeeUsd: Prisma.Decimal | null; taxUsd: Prisma.Decimal | null },
    currency: string,
    multiplier: number,
  ): Promise<PaymentSplit | undefined> {
    if (order.type !== OrderType.BUY) return undefined;

    const subaccountCode = this.config.get<string>('goldbod.paystackSubaccount') ?? '';
    if (!subaccountCode || subaccountCode === PLACEHOLDER_SUBACCOUNT) {
      this.logger.debug('GoldBod subaccount not configured — skipping payment split');
      return undefined;
    }

    const aurumChargeUsd = (order.platformFeeUsd ?? new Prisma.Decimal(0)).add(
      order.taxUsd ?? new Prisma.Decimal(0),
    );
    const transactionChargeSmallestUnit = await this.fx.usdToSmallestUnit(
      aurumChargeUsd,
      currency,
      multiplier,
    );

    return {
      subaccountCode,
      transactionChargeSmallestUnit,
      bearer: 'account', // Aurum absorbs Paystack fees so GoldBod gets exact gold cost
    };
  }

  // ── Card payment ───────────────────────────────────────────────────────────

  async initiateCard(
    orderId: string,
    userId: string,
    dto: InitiateCardPaymentDto,
    requestId: string,
  ) {
    const order = await this.requireOrderForPayment(orderId, userId);
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });

    const reference = `AUR-${uuid().replace(/-/g, '').substring(0, 16).toUpperCase()}`;
    const currency = dto.currency ?? 'USD';
    const multiplier = CURRENCY_MULTIPLIERS[currency] ?? 100;
    // Convert the USD order value into the charge currency server-side.
    const amountCents = await this.fx.usdToSmallestUnit(
      order.amountUsd as Prisma.Decimal,
      currency,
      multiplier,
    );

    const split = await this.buildSplit(order, currency, multiplier);

    const result = await this.provider.initializeCard({
      email: user.email,
      amountCents,
      currency,
      reference,
      callbackUrl: dto.callbackUrl ?? '',
      metadata: { orderId, userId },
      split,
    });

    // payment.amount is stored in major units of the charged currency
    const chargedAmount = new Prisma.Decimal(amountCents).div(multiplier);

    await this.db.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        provider: this.provider.name,
        providerRef: result.reference,
        status: PaymentStatus.PENDING,
        amount: chargedAmount,
        currency,
        authorizationUrl: result.authorizationUrl,
        metadata: { accessCode: result.accessCode, channel: 'card', amountSmallestUnit: amountCents },
      },
      update: {
        providerRef: result.reference,
        amount: chargedAmount,
        currency,
        authorizationUrl: result.authorizationUrl,
        metadata: { accessCode: result.accessCode, channel: 'card', amountSmallestUnit: amountCents },
      },
    });

    await this.audit.emit({
      actorId: userId,
      action: AuditAction.PAYMENT_INITIATED,
      resource: 'payment',
      resourceId: orderId,
      after: { reference: result.reference, channel: 'card', currency },
      requestId,
    });

    return {
      reference: result.reference,
      authorizationUrl: result.authorizationUrl,
      accessCode: result.accessCode,
    };
  }

  // ── Mobile money ───────────────────────────────────────────────────────────

  async initiateMobileMoney(
    orderId: string,
    userId: string,
    dto: InitiateMobileMoneyDto,
    requestId: string,
  ) {
    const order = await this.requireOrderForPayment(orderId, userId);
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });

    const reference = `AUR-MM-${uuid().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
    const multiplier = CURRENCY_MULTIPLIERS[dto.currency] ?? 100;
    // The charge amount is always computed server-side from the USD order value.
    // dto.localAmount is only the client-displayed quote — reject if it drifted
    // more than 2% from the live rate so the user isn't charged a surprise amount.
    const amountSmallestUnit = await this.fx.usdToSmallestUnit(
      order.amountUsd as Prisma.Decimal,
      dto.currency,
      multiplier,
    );

    if (dto.localAmount) {
      const quoted = Math.round(parseFloat(dto.localAmount) * multiplier);
      const drift = Math.abs(quoted - amountSmallestUnit) / amountSmallestUnit;
      if (drift > 0.02) {
        throw new BadRequestException(
          'Exchange rate has changed since this quote was displayed. Please refresh and try again.',
        );
      }
    }

    const split = await this.buildSplit(order, dto.currency, multiplier);

    const result = await this.provider.initializeMobileMoney({
      email: user.email,
      phone: dto.phone,
      network: dto.network,
      currency: dto.currency,
      amountSmallestUnit,
      reference,
      metadata: { orderId, userId },
      split,
    });

    const chargedAmount = new Prisma.Decimal(amountSmallestUnit).div(multiplier);

    await this.db.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        provider: this.provider.name,
        providerRef: result.reference,
        status: PaymentStatus.PENDING,
        amount: chargedAmount,
        currency: dto.currency,
        metadata: {
          channel: 'mobile_money',
          network: dto.network,
          phone: dto.phone,
          paystackStatus: result.status,
          amountSmallestUnit,
        },
      },
      update: {
        providerRef: result.reference,
        amount: chargedAmount,
        currency: dto.currency,
        metadata: {
          channel: 'mobile_money',
          network: dto.network,
          phone: dto.phone,
          paystackStatus: result.status,
          amountSmallestUnit,
        },
      },
    });

    await this.audit.emit({
      actorId: userId,
      action: AuditAction.PAYMENT_INITIATED,
      resource: 'payment',
      resourceId: orderId,
      after: { reference: result.reference, channel: 'mobile_money', network: dto.network, currency: dto.currency },
      requestId,
    });

    return {
      reference: result.reference,
      status: result.status,
      displayText: result.displayText,
      requiresOtp: result.requiresOtp,
      chargedAmount: chargedAmount.toFixed(2),
      currency: dto.currency,
    };
  }

  // ── Paystack webhook ───────────────────────────────────────────────────────

  async handleWebhook(rawBody: string, signature: string, requestId: string) {
    if (!this.provider.verifyWebhookSignature(rawBody, signature)) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const event = (payload.event as string) ?? '';

    // Only process payment events
    if (!['charge.success', 'charge.failed', 'charge.dispute.create'].includes(event)) {
      return { received: true };
    }

    const webhookEvent = this.provider.parseWebhookEvent(payload);
    if (!webhookEvent.reference) {
      this.logger.warn('Webhook received with no reference');
      return { received: true };
    }

    const payment = await this.db.payment.findFirst({
      where: { providerRef: webhookEvent.reference },
      include: { order: true },
    });

    if (!payment) {
      this.logger.warn(`Webhook for unknown reference: ${webhookEvent.reference}`);
      return { received: true };
    }

    if (payment.status !== PaymentStatus.PENDING) {
      // Already processed — idempotent response
      return { received: true };
    }

    if (webhookEvent.status === 'success') {
      // Verify the amount actually charged matches what we initialized.
      // A success webhook for the wrong amount/currency must never confirm the order.
      const expectedSmallestUnit =
        (payment.metadata as { amountSmallestUnit?: number } | null)?.amountSmallestUnit ??
        Math.round(
          (payment.amount as Prisma.Decimal).toNumber() *
            (CURRENCY_MULTIPLIERS[payment.currency] ?? 100),
        );

      const amountMatches = webhookEvent.amount === expectedSmallestUnit;
      const currencyMatches =
        webhookEvent.currency.toUpperCase() === payment.currency.toUpperCase();

      if (!amountMatches || !currencyMatches) {
        this.logger.error(
          `Webhook amount mismatch for ${webhookEvent.reference}: ` +
            `expected ${expectedSmallestUnit} ${payment.currency}, ` +
            `got ${webhookEvent.amount} ${webhookEvent.currency}`,
        );
        await this.audit.emit({
          actorId: 'system:paystack',
          action: AuditAction.PAYMENT_FAILED,
          resource: 'payment',
          resourceId: payment.orderId,
          after: {
            reason: 'amount_mismatch',
            expected: `${expectedSmallestUnit} ${payment.currency}`,
            received: `${webhookEvent.amount} ${webhookEvent.currency}`,
          },
          requestId,
        });
        await this.failPayment(payment, webhookEvent, requestId);
        return { received: true };
      }

      await this.confirmPayment(payment, webhookEvent, requestId);
    } else {
      await this.failPayment(payment, webhookEvent, requestId);
    }

    return { received: true };
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private async confirmPayment(
    payment: Awaited<ReturnType<typeof this.db.payment.findFirst>> & { order: any },
    webhookEvent: { reference: string; amount: number; currency: string },
    requestId: string,
  ) {
    // Atomic claim — guards against concurrent webhook deliveries both confirming
    const { count } = await this.db.payment.updateMany({
      where: { id: payment!.id, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.CONFIRMED, confirmedAt: new Date() },
    });
    if (count === 0) return; // another delivery won the race

    await this.audit.emit({
      actorId: 'system:paystack',
      action: AuditAction.PAYMENT_CONFIRMED,
      resource: 'payment',
      resourceId: payment!.orderId,
      before: { status: PaymentStatus.PENDING },
      after: { status: PaymentStatus.CONFIRMED, reference: webhookEvent.reference },
      requestId,
    });

    await this.kafka.publish(
      KafkaTopic.PAYMENT_CONFIRMED,
      'PAYMENT_CONFIRMED',
      { orderId: payment!.orderId, userId: payment!.order.userId, reference: webhookEvent.reference },
      { requestId, actorId: 'system:paystack' },
    );

    // Advance the order state
    await this.ordersService.onPaymentConfirmed(payment!.orderId, requestId);
  }

  private async failPayment(
    payment: Awaited<ReturnType<typeof this.db.payment.findFirst>> & { order: any },
    webhookEvent: { reference: string },
    requestId: string,
  ) {
    const { count } = await this.db.payment.updateMany({
      where: { id: payment!.id, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.FAILED },
    });
    if (count === 0) return; // already processed by a concurrent delivery

    await this.audit.emit({
      actorId: 'system:paystack',
      action: AuditAction.PAYMENT_FAILED,
      resource: 'payment',
      resourceId: payment!.orderId,
      before: { status: PaymentStatus.PENDING },
      after: { status: PaymentStatus.FAILED, reference: webhookEvent.reference },
      requestId,
    });

    await this.kafka.publish(
      KafkaTopic.PAYMENT_FAILED,
      'PAYMENT_FAILED',
      { orderId: payment!.orderId, userId: payment!.order.userId, reference: webhookEvent.reference },
      { requestId, actorId: 'system:paystack' },
    );

    await this.ordersService.onPaymentFailed(payment!.orderId, requestId);
  }

  private async requireOrderForPayment(orderId: string, userId: string) {
    const order = await this.db.order.findFirst({ where: { id: orderId, userId } });

    if (!order) throw new NotFoundException('Order not found');

    const payableStatuses = [OrderStatus.PAYMENT_PENDING, OrderStatus.COMPLIANCE_HOLD];
    if (!payableStatuses.includes(order.status as OrderStatus)) {
      throw new BadRequestException(
        `Order is not in a payable state (current: ${order.status})`,
      );
    }

    return order;
  }
}
