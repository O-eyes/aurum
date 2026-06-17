import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { createPublicClient, http, parseAbi, type Chain } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { DatabaseService } from "../../infrastructure/database/database.service";
import { KafkaService } from "../../infrastructure/kafka/kafka.service";
import { AuditService } from "../audit/audit.service";
import { GoldPriceService } from "../../infrastructure/gold-price/gold-price.service";
import { KafkaTopic } from "../../infrastructure/kafka/kafka.topics";
import { AuditAction } from "@aurum/types";
import type { ManualSnapshotDto } from "./dto/reserve-snapshot.dto";

const BACKING_RATIO_ALERT_THRESHOLD = new Prisma.Decimal("0.98");

const ERC20_ABI = parseAbi(["function totalSupply() view returns (uint256)"]);

@Injectable()
export class ReserveService {
  private readonly logger = new Logger(ReserveService.name);
  private readonly rpcUrl: string;
  private readonly chainId: number;
  private readonly tokenAddress: `0x${string}`;

  constructor(
    private readonly db: DatabaseService,
    private readonly kafka: KafkaService,
    private readonly audit: AuditService,
    private readonly goldPrice: GoldPriceService,
    private readonly config: ConfigService,
  ) {
    this.rpcUrl = config.get<string>("blockchain.rpcUrl") ?? "";
    this.chainId = config.get<number>("blockchain.chainId") ?? 1;
    this.tokenAddress = (config.get<string>("blockchain.aurumTokenAddress") ??
      "0x0000000000000000000000000000000000000000") as `0x${string}`;
  }

  // ── Scheduled snapshot — runs hourly when blockchain is configured ─────────

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledSnapshot() {
    if (
      !this.rpcUrl ||
      this.tokenAddress === "0x0000000000000000000000000000000000000000"
    ) {
      return; // blockchain not configured — skip
    }

    try {
      const tokenSupply = await this.getOnChainTokenSupply();
      const goldPriceUsd = await this.goldPrice.getCurrentPriceUsd();

      // Automated snapshots derive goldHeldOz from GoldBod vault endpoint
      const goldHeldOz = await this.fetchVaultHoldings();
      if (!goldHeldOz) {
        this.logger.warn(
          "Skipping scheduled snapshot: vault holdings unavailable",
        );
        return;
      }

      await this.saveSnapshot({
        goldHeldOz,
        tokenSupply,
        goldPriceUsd,
        source: "automated",
      });
    } catch (err: unknown) {
      this.logger.error(
        "Scheduled reserve snapshot failed",
        (err as Error).message,
      );
    }
  }

  // ── Manual snapshot — operator-provided gold amount ────────────────────────

  async manualSnapshot(
    dto: ManualSnapshotDto,
    actorId: string,
    requestId: string,
  ) {
    const goldHeldOz = new Prisma.Decimal(dto.goldHeldOz);
    const goldPriceUsd = await this.goldPrice.getCurrentPriceUsd();
    const tokenSupply = await this.getTokenSupply();

    const snapshot = await this.saveSnapshot({
      goldHeldOz,
      tokenSupply,
      goldPriceUsd,
      vaultReference: dto.vaultReference,
      source: "manual",
    });

    await this.audit.emit({
      actorId,
      action: AuditAction.RESERVE_SNAPSHOT_TAKEN,
      resource: "reserve_snapshot",
      resourceId: snapshot.id,
      after: {
        goldHeldOz: goldHeldOz.toFixed(8),
        tokenSupply: tokenSupply.toFixed(8),
        backingRatio: snapshot.backingRatio.toFixed(8),
        goldPriceUsd: goldPriceUsd.toFixed(2),
      },
      requestId,
    });

    return { ...snapshot, snapshotedAt: snapshot.createdAt.toISOString() };
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  async getLatest() {
    const snap = await this.db.reserveSnapshot.findFirst({
      orderBy: { createdAt: "desc" },
    });
    return snap
      ? { ...snap, snapshotedAt: snap.createdAt.toISOString() }
      : null;
  }

  async getHistory(limit = 30, offset = 0) {
    const snaps = await this.db.reserveSnapshot.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
      skip: offset,
    });
    return snaps.map((s) => ({
      ...s,
      snapshotedAt: s.createdAt.toISOString(),
    }));
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private async saveSnapshot(params: {
    goldHeldOz: Prisma.Decimal;
    tokenSupply: Prisma.Decimal;
    goldPriceUsd: Prisma.Decimal;
    vaultReference?: string;
    source: string;
  }) {
    const { goldHeldOz, tokenSupply, goldPriceUsd, vaultReference, source } =
      params;

    const backingRatio = tokenSupply.isZero()
      ? new Prisma.Decimal(1)
      : goldHeldOz.div(tokenSupply);

    const snapshot = await this.db.reserveSnapshot.create({
      data: {
        goldHeldOz,
        tokenSupply,
        backingRatio,
        goldPriceUsd,
        vaultReference: vaultReference ?? null,
        source,
      },
    });

    await this.kafka.publish(
      KafkaTopic.RESERVE_SNAPSHOT,
      "RESERVE_SNAPSHOT",
      {
        snapshotId: snapshot.id,
        goldHeldOz: goldHeldOz.toFixed(8),
        tokenSupply: tokenSupply.toFixed(8),
        backingRatio: backingRatio.toFixed(8),
        goldPriceUsd: goldPriceUsd.toFixed(2),
        source,
      },
      { requestId: "system", actorId: "system:reserve" },
    );

    // Alert if backing ratio drops below threshold
    if (backingRatio.lessThan(BACKING_RATIO_ALERT_THRESHOLD)) {
      this.logger.warn(
        `⚠️  Backing ratio below threshold: ${backingRatio.toFixed(4)}`,
      );
      await this.kafka.publish(
        KafkaTopic.RESERVE_ALERT,
        "RESERVE_ALERT",
        {
          type: "backing_ratio_low",
          backingRatio: backingRatio.toFixed(8),
          threshold: BACKING_RATIO_ALERT_THRESHOLD.toFixed(8),
        },
        { requestId: "system", actorId: "system:reserve" },
      );
    }

    return snapshot;
  }

  private async getTokenSupply(): Promise<Prisma.Decimal> {
    if (
      this.rpcUrl &&
      this.tokenAddress !== "0x0000000000000000000000000000000000000000"
    ) {
      try {
        return await this.getOnChainTokenSupply();
      } catch {
        this.logger.warn("On-chain totalSupply failed, falling back to ledger");
      }
    }
    return this.getLedgerTokenSupply();
  }

  private async getOnChainTokenSupply(): Promise<Prisma.Decimal> {
    const client = createPublicClient({
      chain: this.resolveChain(),
      transport: http(this.rpcUrl),
    });
    const raw = await client.readContract({
      address: this.tokenAddress,
      abi: ERC20_ABI,
      functionName: "totalSupply",
    });
    return new Prisma.Decimal(raw.toString()).div(new Prisma.Decimal("1e18"));
  }

  private async getLedgerTokenSupply(): Promise<Prisma.Decimal> {
    const result = await this.db.ledgerEntry.aggregate({
      _sum: { amount: true },
    });
    const raw =
      (result._sum.amount as Prisma.Decimal | null) ?? new Prisma.Decimal(0);
    return raw.isNegative() ? new Prisma.Decimal(0) : raw;
  }

  private async fetchVaultHoldings(): Promise<Prisma.Decimal | null> {
    const apiUrl = this.config.get<string>("goldbod.apiUrl");
    const apiKey = this.config.get<string>("goldbod.apiKey");
    if (!apiUrl || !apiKey) return null;

    try {
      const response = await fetch(`${apiUrl}/vault/holdings`, {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { goldOunces: string | number };
      return new Prisma.Decimal(String(data.goldOunces));
    } catch {
      return null;
    }
  }

  private resolveChain(): Chain {
    return this.chainId === 11155111 ? sepolia : mainnet;
  }
}
