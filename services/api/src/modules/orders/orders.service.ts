import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { KafkaService } from '../../infrastructure/kafka/kafka.service';
import { AuditService } from '../audit/audit.service';
import { GoldPriceService } from '../../infrastructure/gold-price/gold-price.service';
import { LedgerService } from '../ledger/ledger.service';
import { KafkaTopic } from '../../infrastructure/kafka/kafka.topics';
import { assertValidOrderTransition } from './orders-state-machine';
import { computeBuyBreakdown, type FeeConfig } from './pricing';
import { AuditAction, KycStatus, OrderStatus, OrderType, LedgerType } from '@aurum/types';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { CreateRedeemDto } from './dto/create-redeem.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly kafka: KafkaService,
    private readonly audit: AuditService,
    private readonly goldPrice: GoldPriceService,
    private readonly ledger: LedgerService,
    private readonly config: ConfigService,
  ) {}

  private get feeConfig(): FeeConfig {
    return {
      platformPercent: this.config.get<number>('fees.platformPercent') ?? 1.5,
      platformFlatUsd: this.config.get<number>('fees.platformFlatUsd') ?? 0,
      taxPercent: this.config.get<number>('fees.taxPercent') ?? 0,
    };
  }

  // ── User-facing ────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateOrderDto, requestId: string) {
    // Idempotency — return existing order if key already used
    const existing = await this.db.order.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      if (existing.userId !== userId) throw new ConflictException('Idempotency key already used');
      return existing;
    }

    const amountUsd = new Prisma.Decimal(dto.amountUsd);
    const type = dto.type as OrderType;

    const goldPriceUsd = await this.goldPrice.getCurrentPriceUsd();

    // BUY is fee-inclusive: the buyer's gross pays platform fee + tax, and the
    // remainder (goldCost) buys gold. SELL has no buy-side fee here — the entered
    // amount maps directly to the tokens being sold.
    let goldOunces: Prisma.Decimal;
    let goldCostUsd: Prisma.Decimal | null = null;
    let platformFeeUsd: Prisma.Decimal | null = null;
    let taxUsd: Prisma.Decimal | null = null;

    if (type === OrderType.BUY) {
      const breakdown = computeBuyBreakdown(amountUsd, goldPriceUsd, this.feeConfig);
      goldOunces = breakdown.goldOunces;
      goldCostUsd = breakdown.goldCostUsd;
      platformFeeUsd = breakdown.platformFeeUsd;
      taxUsd = breakdown.taxUsd;
    } else {
      goldOunces = amountUsd.div(goldPriceUsd);
    }

    const tokenAmount = goldOunces; // 1 AURUM = 1 troy ounce

    if (type === OrderType.SELL) {
      const balance = await this.ledger.getBalance(userId);
      if (balance.lessThan(tokenAmount)) {
        throw new BadRequestException(
          `Insufficient token balance. Have ${balance.toFixed(8)}, need ${tokenAmount.toFixed(8)}.`,
        );
      }
    }

    // KYC gate
    const kycProfile = await this.db.kycProfile.findUnique({ where: { userId } });
    const kycApproved = kycProfile?.status === KycStatus.APPROVED;

    const initialStatus = kycApproved
      ? type === OrderType.BUY
        ? OrderStatus.PAYMENT_PENDING
        : OrderStatus.PENDING
      : OrderStatus.COMPLIANCE_HOLD;

    const order = await this.db.order.create({
      data: {
        userId,
        type,
        status: initialStatus,
        amountUsd,
        goldOunces,
        tokenAmount,
        goldPriceUsd,
        goldCostUsd,
        platformFeeUsd,
        taxUsd,
        walletAddress: dto.walletAddress,
        idempotencyKey: dto.idempotencyKey,
      },
    });

    await this.emitOrderEvent(order.id, userId, null, initialStatus, requestId, userId);

    return order;
  }

  async findOne(orderId: string, userId: string) {
    const order = await this.db.order.findFirst({
      where: { id: orderId, userId },
      include: { payment: true, mintRequest: true, burnRequest: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async listByUser(userId: string, limit = 20, offset = 0) {
    return this.db.order.findMany({
      where: { userId },
      include: { payment: true },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      skip: offset,
    });
  }

  async cancel(orderId: string, userId: string, requestId: string) {
    const order = await this.db.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');

    assertValidOrderTransition(order.status as OrderStatus, OrderStatus.CANCELLED);

    const updated = await this.db.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    });

    await this.emitOrderEvent(orderId, userId, order.status as OrderStatus, OrderStatus.CANCELLED, requestId, userId);
    return updated;
  }

  // ── Redemptions ───────────────────────────────────────────────────────────

  async createRedemption(userId: string, dto: CreateRedeemDto, requestId: string) {
    const existing = await this.db.order.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      if (existing.userId !== userId) throw new ConflictException('Idempotency key already used');
      return existing;
    }

    // KYC gate
    const kycProfile = await this.db.kycProfile.findUnique({ where: { userId } });
    if (kycProfile?.status !== KycStatus.APPROVED) {
      throw new BadRequestException('KYC approval required to redeem physical gold');
    }

    // 1 oz per standard denominator mapped from weightG
    const OZ_PER_GRAM = 0.0321507;
    const ozEach = new Prisma.Decimal(dto.denomination.weightG).mul(OZ_PER_GRAM);
    const goldOunces = ozEach.mul(dto.quantity);
    const tokenAmount = goldOunces;

    // Validate balance
    const balance = await this.ledger.getBalance(userId);
    if (balance.lessThan(tokenAmount)) {
      throw new BadRequestException(
        `Insufficient token balance. Have ${balance.toFixed(8)}, need ${tokenAmount.toFixed(8)}.`,
      );
    }

    const goldPriceUsd = await this.goldPrice.getCurrentPriceUsd();
    const amountUsd = goldOunces.mul(goldPriceUsd);

    const redemptionMetadata = {
      denomination: dto.denomination,
      quantity: dto.quantity,
      totalWeightG: dto.denomination.weightG * dto.quantity,
      collectionMethod: dto.collectionMethod,
      preferredPickupDate: dto.preferredPickupDate,
      idType: dto.idType,
      idNumber: dto.idNumber,
      deliveryAddress: dto.deliveryAddress,
    };

    const order = await this.db.order.create({
      data: {
        userId,
        type: OrderType.REDEEM,
        status: OrderStatus.PENDING,
        amountUsd,
        goldOunces,
        tokenAmount,
        goldPriceUsd,
        walletAddress: dto.walletAddress,
        idempotencyKey: dto.idempotencyKey,
        redemptionMetadata,
      },
    });

    await this.emitOrderEvent(order.id, userId, null, OrderStatus.PENDING, requestId, userId);
    return order;
  }

  // ── Internal — called by PaymentsService ──────────────────────────────────

  async onPaymentConfirmed(orderId: string, requestId: string) {
    const order = await this.db.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    assertValidOrderTransition(order.status as OrderStatus, OrderStatus.PAYMENT_CONFIRMED);

    await this.db.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PAYMENT_CONFIRMED },
    });

    await this.emitOrderEvent(
      orderId,
      order.userId,
      order.status as OrderStatus,
      OrderStatus.PAYMENT_CONFIRMED,
      requestId,
      'system:payments',
    );
  }

  async onPaymentFailed(orderId: string, requestId: string) {
    const order = await this.db.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    assertValidOrderTransition(order.status as OrderStatus, OrderStatus.FAILED);

    await this.db.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.FAILED },
    });

    await this.emitOrderEvent(
      orderId,
      order.userId,
      order.status as OrderStatus,
      OrderStatus.FAILED,
      requestId,
      'system:payments',
    );
  }

  // ── Internal — called by MintService ──────────────────────────────────────

  async onMintSubmitted(orderId: string, requestId: string) {
    const order = await this.db.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    assertValidOrderTransition(order.status as OrderStatus, OrderStatus.MINTING);

    await this.db.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.MINTING },
    });

    await this.emitOrderEvent(
      orderId,
      order.userId,
      order.status as OrderStatus,
      OrderStatus.MINTING,
      requestId,
      'system:mint',
    );
  }

  async onMintConfirmed(orderId: string, requestId: string) {
    const order = await this.db.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    assertValidOrderTransition(order.status as OrderStatus, OrderStatus.COMPLETED);

    await this.db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED },
      });

      // Credit user's token balance in the ledger
      await this.ledger.credit(
        order.userId,
        order.tokenAmount as Prisma.Decimal,
        LedgerType.MINT,
        orderId,
        tx,
      );
    });

    await this.emitOrderEvent(
      orderId,
      order.userId,
      order.status as OrderStatus,
      OrderStatus.COMPLETED,
      requestId,
      'system:mint',
    );
  }

  // ── Ops ────────────────────────────────────────────────────────────────────

  async listAll(status?: OrderStatus, limit = 50, offset = 0) {
    return this.db.order.findMany({
      where: status ? { status } : undefined,
      include: { payment: true, mintRequest: true },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      skip: offset,
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async emitOrderEvent(
    orderId: string,
    userId: string,
    fromStatus: OrderStatus | null,
    toStatus: OrderStatus,
    requestId: string,
    actorId: string,
  ) {
    const action = fromStatus === null ? AuditAction.ORDER_CREATED : AuditAction.ORDER_STATUS_CHANGED;

    await this.audit.emit({
      actorId,
      action,
      resource: 'order',
      resourceId: orderId,
      before: fromStatus ? { status: fromStatus } : null,
      after: { status: toStatus },
      requestId,
    });

    await this.kafka.publish(
      fromStatus === null ? KafkaTopic.ORDER_CREATED : KafkaTopic.ORDER_STATUS_CHANGED,
      fromStatus === null ? 'ORDER_CREATED' : 'ORDER_STATUS_CHANGED',
      { orderId, userId, fromStatus, toStatus },
      { requestId, actorId },
    );
  }
}
