import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { LedgerType } from '@aurum/types';

@Injectable()
export class LedgerService {
  constructor(private readonly db: DatabaseService) {}

  async credit(
    userId: string,
    amount: Prisma.Decimal,
    type: LedgerType,
    reference: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (tx) return this.writeEntry(tx, userId, amount, type, reference);
    return this.db.$transaction((t) => this.writeEntry(t, userId, amount, type, reference));
  }

  async debit(
    userId: string,
    amount: Prisma.Decimal,
    type: LedgerType,
    reference: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (tx) return this.writeEntry(tx, userId, amount.neg(), type, reference);
    return this.db.$transaction((t) => this.writeEntry(t, userId, amount.neg(), type, reference));
  }

  async getBalance(userId: string): Promise<Prisma.Decimal> {
    return this.aggregateBalance(userId, this.db);
  }

  async getHistory(userId: string, limit = 50, offset = 0) {
    return this.db.ledgerEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      skip: offset,
    });
  }

  /**
   * All balance mutations run inside a transaction holding a per-user advisory
   * lock, so concurrent credits/debits for the same user are serialized and the
   * balance check + insert is race-free.
   */
  private async writeEntry(
    tx: Prisma.TransactionClient,
    userId: string,
    signedAmount: Prisma.Decimal,
    type: LedgerType,
    reference: string,
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const current = await this.aggregateBalance(userId, tx);
    const after = current.add(signedAmount);

    if (after.isNegative()) {
      throw new BadRequestException('Insufficient balance');
    }

    return tx.ledgerEntry.create({
      data: {
        userId,
        type,
        amount: signedAmount,
        balanceBefore: current,
        balanceAfter: after,
        reference,
      },
    });
  }

  private async aggregateBalance(
    userId: string,
    client: Prisma.TransactionClient | DatabaseService,
  ): Promise<Prisma.Decimal> {
    const result = await client.ledgerEntry.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    return (result._sum.amount as Prisma.Decimal | null) ?? new Prisma.Decimal(0);
  }
}
