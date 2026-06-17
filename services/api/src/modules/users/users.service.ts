import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../../infrastructure/database/database.service";
import { AuditService } from "../audit/audit.service";
import { GoldPriceService } from "../../infrastructure/gold-price/gold-price.service";
import { AuditAction } from "@aurum/types";

@Injectable()
export class UsersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly goldPrice: GoldPriceService,
  ) {}

  async findById(id: string) {
    const user = await this.db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        emailVerified: true,
        phoneVerified: true,
        role: true,
        createdAt: true,
        kycProfile: {
          select: { status: true },
        },
      },
    });

    if (!user) throw new NotFoundException("User not found");

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: [user.role],
      kycStatus: user.kycProfile?.status ?? "PENDING",
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateProfile(
    id: string,
    data: { firstName?: string; lastName?: string },
    requestId: string,
  ) {
    const user = await this.db.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");

    const updated = await this.db.user.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        kycProfile: { select: { status: true } },
      },
    });

    await this.audit.emit({
      actorId: id,
      action: AuditAction.USER_PROFILE_UPDATED,
      resource: "user",
      resourceId: id,
      before: { firstName: user.firstName, lastName: user.lastName },
      after: data,
      requestId,
    });

    return {
      id: updated.id,
      email: updated.email,
      phone: updated.phone,
      firstName: updated.firstName,
      lastName: updated.lastName,
      roles: [updated.role],
      kycStatus: updated.kycProfile?.status ?? "PENDING",
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async findByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  async listAll(limit = 50, offset = 0) {
    const users = await this.db.user.findMany({
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        kycProfile: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
      skip: offset,
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      phone: u.phone,
      firstName: u.firstName,
      lastName: u.lastName,
      roles: [u.role],
      kycStatus: u.kycProfile?.status ?? "PENDING",
      emailVerified: u.emailVerified,
      phoneVerified: u.phoneVerified,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  async listWallets(userId: string) {
    return this.db.wallet.findMany({
      where: { userId },
      select: {
        id: true,
        address: true,
        chainId: true,
        verified: true,
        isPrimary: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async removeWallet(
    userId: string,
    walletId: string,
    requestId: string,
    ipAddress?: string,
  ) {
    const wallet = await this.db.wallet.findFirst({
      where: { id: walletId, userId },
    });

    if (!wallet) throw new NotFoundException("Wallet not found");

    await this.db.wallet.delete({ where: { id: walletId } });

    await this.audit.emit({
      actorId: userId,
      action: AuditAction.WALLET_REMOVED,
      resource: "wallet",
      resourceId: walletId,
      before: { address: wallet.address },
      requestId,
      ipAddress,
    });

    return { removed: true, address: wallet.address };
  }

  async getBalance(userId: string) {
    const [entries, goldPriceDecimal] = await Promise.all([
      this.db.ledgerEntry.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { balanceAfter: true },
      }),
      this.goldPrice.getCurrentPriceUsd(),
    ]);

    const balance = entries[0]?.balanceAfter ?? 0;
    const goldPriceUsd = goldPriceDecimal.toFixed(2);
    const balanceUsd = goldPriceDecimal.mul(balance.toString()).toFixed(2);

    return {
      balance: balance.toString(),
      balanceUsd,
      goldPriceUsd,
    };
  }
}
