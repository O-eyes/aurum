import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { createPublicClient, http, parseAbi, parseEventLogs, type Chain } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { MintService } from './mint.service';
import { MintBurnStatus } from '@aurum/types';

const POLL_BATCH_SIZE = 20;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const TRANSFER_EVENT_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

@Injectable()
export class MintConfirmatorService {
  private readonly logger = new Logger(MintConfirmatorService.name);
  private readonly rpcUrl: string;
  private readonly chainId: number;
  private readonly tokenAddress: string;

  constructor(
    private readonly db: DatabaseService,
    private readonly mintService: MintService,
    config: ConfigService,
  ) {
    this.rpcUrl = config.get<string>('blockchain.rpcUrl') ?? '';
    this.chainId = config.get<number>('blockchain.chainId') ?? 1;
    this.tokenAddress = (config.get<string>('blockchain.aurumTokenAddress') ?? '').toLowerCase();
  }

  // ── Poll pending mints every 30 seconds ───────────────────────────────────

  @Cron('*/30 * * * * *')
  async pollSubmittedMints() {
    if (!this.rpcUrl) return;

    const submitted = await this.db.mintRequest.findMany({
      where: { status: MintBurnStatus.SUBMITTED, txHash: { not: null } },
      take: POLL_BATCH_SIZE,
      orderBy: { submittedAt: 'asc' },
    });

    if (submitted.length === 0) return;

    const client = this.buildClient();

    await Promise.allSettled(
      submitted.map((req) => this.checkMint(req, client)),
    );
  }

  // ── Poll pending burns every 30 seconds ───────────────────────────────────

  @Cron('*/30 * * * * *')
  async pollSubmittedBurns() {
    if (!this.rpcUrl) return;

    const submitted = await this.db.burnRequest.findMany({
      where: { status: MintBurnStatus.SUBMITTED, txHash: { not: null } },
      take: POLL_BATCH_SIZE,
      orderBy: { submittedAt: 'asc' },
    });

    if (submitted.length === 0) return;

    const client = this.buildClient();

    await Promise.allSettled(
      submitted.map((req) => this.checkBurn(req, client)),
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async checkMint(
    req: { id: string; txHash: string | null; orderId: string },
    client: ReturnType<typeof createPublicClient>,
  ) {
    if (!req.txHash) return;

    try {
      const receipt = await client.getTransactionReceipt({
        hash: req.txHash as `0x${string}`,
      });

      if (!receipt) return; // not yet mined

      if (receipt.status === 'success') {
        this.logger.log(`Mint confirmed on-chain: ${req.txHash} (order ${req.orderId})`);
        await this.mintService.confirmMint(req.id, 'system:confirmator');
      } else {
        this.logger.warn(`Mint reverted on-chain: ${req.txHash}`);
        await this.db.mintRequest.update({
          where: { id: req.id },
          data: { status: MintBurnStatus.FAILED },
        });
      }
    } catch (err: unknown) {
      // Transaction not found yet — will retry next poll
      const msg = (err as Error).message ?? '';
      if (!msg.includes('TransactionReceiptNotFoundError')) {
        this.logger.warn(`Mint poll error for ${req.txHash}: ${msg}`);
      }
    }
  }

  private async checkBurn(
    req: {
      id: string;
      txHash: string | null;
      orderId: string;
      walletAddress: string;
      tokenAmount: Prisma.Decimal;
    },
    client: ReturnType<typeof createPublicClient>,
  ) {
    if (!req.txHash) return;

    try {
      const receipt = await client.getTransactionReceipt({
        hash: req.txHash as `0x${string}`,
      });

      if (!receipt) return;

      if (receipt.status !== 'success') {
        this.logger.warn(`Burn reverted on-chain: ${req.txHash}`);
        await this.db.burnRequest.update({
          where: { id: req.id },
          data: { status: MintBurnStatus.FAILED },
        });
        return;
      }

      // The tx hash is user-supplied: a successful receipt alone proves nothing.
      // It must contain a Transfer(walletAddress → 0x0) of at least the expected
      // amount, emitted by OUR token contract, before any payout can follow.
      if (!this.receiptProvesBurn(receipt, req.walletAddress, req.tokenAmount)) {
        this.logger.warn(
          `Burn tx ${req.txHash} succeeded but contains no matching burn event — marking FAILED (order ${req.orderId})`,
        );
        await this.db.burnRequest.update({
          where: { id: req.id },
          data: { status: MintBurnStatus.FAILED },
        });
        return;
      }

      this.logger.log(`Burn confirmed on-chain: ${req.txHash} (order ${req.orderId})`);
      await this.db.burnRequest.update({
        where: { id: req.id },
        data: {
          status: MintBurnStatus.CONFIRMED,
          confirmedAt: new Date(),
          blockNumber: receipt.blockNumber,
        },
      });
      // Payout is triggered separately by PayoutsService once it observes CONFIRMED burn
    } catch (err: unknown) {
      const msg = (err as Error).message ?? '';
      if (!msg.includes('TransactionReceiptNotFoundError')) {
        this.logger.warn(`Burn poll error for ${req.txHash}: ${msg}`);
      }
    }
  }

  private receiptProvesBurn(
    receipt: { logs: any[] },
    walletAddress: string,
    tokenAmount: Prisma.Decimal,
  ): boolean {
    if (!this.tokenAddress) return false;

    const expectedWei = BigInt(
      tokenAmount.times(new Prisma.Decimal('1e18')).toFixed(0),
    );

    try {
      const transfers = parseEventLogs({
        abi: TRANSFER_EVENT_ABI,
        logs: receipt.logs,
        eventName: 'Transfer',
      });

      return transfers.some(
        (log) =>
          log.address.toLowerCase() === this.tokenAddress &&
          log.args.from.toLowerCase() === walletAddress.toLowerCase() &&
          log.args.to.toLowerCase() === ZERO_ADDRESS &&
          log.args.value >= expectedWei,
      );
    } catch {
      return false;
    }
  }

  private buildClient() {
    const chain: Chain = this.chainId === 11155111 ? sepolia : mainnet;
    return createPublicClient({ chain, transport: http(this.rpcUrl) });
  }
}
