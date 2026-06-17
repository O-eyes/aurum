import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  keccak256,
  toBytes,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, sepolia } from "viem/chains";
import { Prisma } from "@prisma/client";
import { DatabaseService } from "../../infrastructure/database/database.service";
import { KafkaService } from "../../infrastructure/kafka/kafka.service";
import { AuditService } from "../audit/audit.service";
import { OrdersService } from "../orders/orders.service";
import { KafkaTopic } from "../../infrastructure/kafka/kafka.topics";
import { AuditAction, MintBurnStatus, OrderStatus } from "@aurum/types";

const AURUM_TOKEN_ABI = parseAbi([
  "function mint(address to, uint256 amount, bytes32 orderId) external",
  "function burnForRedemption(uint256 amount, bytes32 orderId) external",
  "function paused() view returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

@Injectable()
export class MintService {
  private readonly logger = new Logger(MintService.name);
  private readonly rpcUrl: string;
  private readonly chainId: number;
  private readonly tokenAddress: `0x${string}`;
  private readonly minterPrivateKey: string;

  constructor(
    private readonly db: DatabaseService,
    private readonly kafka: KafkaService,
    private readonly audit: AuditService,
    private readonly ordersService: OrdersService,
    private readonly config: ConfigService,
  ) {
    this.rpcUrl = config.get<string>("blockchain.rpcUrl") ?? "";
    this.chainId = config.get<number>("blockchain.chainId") ?? 1;
    this.tokenAddress = (config.get<string>("blockchain.aurumTokenAddress") ??
      "0x0000000000000000000000000000000000000000") as `0x${string}`;
    this.minterPrivateKey =
      config.get<string>("blockchain.minterPrivateKey") ?? "";
  }

  // ── Mint (called after payment confirmed) ─────────────────────────────────

  async requestMint(orderId: string, requestId: string) {
    this.assertBlockchainConfigured();

    const order = await this.db.order.findUnique({
      where: { id: orderId },
      include: { mintRequest: true },
    });

    if (!order) throw new NotFoundException("Order not found");

    if (order.status !== OrderStatus.PAYMENT_CONFIRMED) {
      throw new BadRequestException(
        `Cannot mint for order in status: ${order.status}. Expected PAYMENT_CONFIRMED.`,
      );
    }

    if (order.mintRequest) {
      // Already submitted — idempotent
      return {
        txHash: order.mintRequest.txHash,
        status: order.mintRequest.status,
      };
    }

    const tokenAmountWei = this.toWei(order.tokenAmount as Prisma.Decimal);
    const orderIdBytes32 = this.uuidToBytes32(orderId);

    const { walletClient, publicClient } = this.buildClients();

    this.logger.log(
      `Submitting mint for order ${orderId}: ${order.tokenAmount} AURUM → ${order.walletAddress}`,
    );

    const txHash = await walletClient.writeContract({
      address: this.tokenAddress,
      abi: AURUM_TOKEN_ABI,
      functionName: "mint",
      args: [
        order.walletAddress as `0x${string}`,
        tokenAmountWei,
        orderIdBytes32,
      ],
    });

    this.logger.log(`Mint tx submitted: ${txHash}`);

    const mintRequest = await this.db.mintRequest.create({
      data: {
        orderId,
        walletAddress: order.walletAddress,
        tokenAmount: order.tokenAmount as Prisma.Decimal,
        status: MintBurnStatus.SUBMITTED,
        txHash,
        submittedAt: new Date(),
      },
    });

    await this.ordersService.onMintSubmitted(orderId, requestId);

    await this.audit.emit({
      actorId: "system:mint",
      action: AuditAction.MINT_REQUESTED,
      resource: "mint_request",
      resourceId: mintRequest.id,
      after: {
        txHash,
        walletAddress: order.walletAddress,
        tokenAmount: order.tokenAmount,
      },
      requestId,
    });

    await this.kafka.publish(
      KafkaTopic.MINT_REQUESTED,
      "MINT_REQUESTED",
      {
        orderId,
        mintRequestId: mintRequest.id,
        txHash,
        walletAddress: order.walletAddress,
      },
      { requestId, actorId: "system:mint" },
    );

    return { txHash, mintRequestId: mintRequest.id };
  }

  // ── Confirm mint (called once tx is mined) ─────────────────────────────────

  async confirmMint(mintRequestId: string, requestId: string) {
    const mintRequest = await this.db.mintRequest.findUnique({
      where: { id: mintRequestId },
    });

    if (!mintRequest) throw new NotFoundException("Mint request not found");

    if (mintRequest.status === MintBurnStatus.CONFIRMED) {
      return { status: MintBurnStatus.CONFIRMED };
    }

    if (mintRequest.status !== MintBurnStatus.SUBMITTED) {
      throw new BadRequestException(
        `Mint request is in status ${mintRequest.status}, cannot confirm.`,
      );
    }

    // Verify on-chain if RPC is configured
    let blockNumber: bigint | null = null;
    if (this.rpcUrl && mintRequest.txHash) {
      try {
        const { publicClient } = this.buildClients();
        const receipt = await publicClient.getTransactionReceipt({
          hash: mintRequest.txHash as `0x${string}`,
        });
        if (receipt.status !== "success") {
          throw new BadRequestException("Transaction reverted on-chain");
        }
        blockNumber = receipt.blockNumber;
      } catch (err: unknown) {
        if (err instanceof BadRequestException) throw err;
        this.logger.warn(
          `Could not verify tx on-chain: ${(err as Error).message}`,
        );
      }
    }

    await this.db.mintRequest.update({
      where: { id: mintRequestId },
      data: {
        status: MintBurnStatus.CONFIRMED,
        confirmedAt: new Date(),
        ...(blockNumber !== null && { blockNumber }),
      },
    });

    await this.ordersService.onMintConfirmed(mintRequest.orderId, requestId);

    await this.audit.emit({
      actorId: "system:mint",
      action: AuditAction.MINT_CONFIRMED,
      resource: "mint_request",
      resourceId: mintRequestId,
      after: {
        txHash: mintRequest.txHash,
        blockNumber: blockNumber?.toString(),
      },
      requestId,
    });

    await this.kafka.publish(
      KafkaTopic.MINT_CONFIRMED,
      "MINT_CONFIRMED",
      {
        orderId: mintRequest.orderId,
        mintRequestId,
        txHash: mintRequest.txHash,
      },
      { requestId, actorId: "system:mint" },
    );

    return { status: MintBurnStatus.CONFIRMED, txHash: mintRequest.txHash };
  }

  // ── Burn request (SELL order — user burns from their wallet) ───────────────

  async createBurnRequest(orderId: string, requestId: string) {
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      include: { burnRequest: true },
    });

    if (!order) throw new NotFoundException("Order not found");
    if (order.burnRequest) return order.burnRequest;

    const burnRequest = await this.db.burnRequest.create({
      data: {
        orderId,
        walletAddress: order.walletAddress,
        tokenAmount: order.tokenAmount as Prisma.Decimal,
        status: MintBurnStatus.PENDING,
      },
    });

    await this.audit.emit({
      actorId: order.userId,
      action: AuditAction.BURN_REQUESTED,
      resource: "burn_request",
      resourceId: burnRequest.id,
      after: {
        walletAddress: order.walletAddress,
        tokenAmount: order.tokenAmount,
      },
      requestId,
    });

    await this.kafka.publish(
      KafkaTopic.BURN_REQUESTED,
      "BURN_REQUESTED",
      {
        orderId,
        burnRequestId: burnRequest.id,
        walletAddress: order.walletAddress,
      },
      { requestId, actorId: order.userId },
    );

    // Return the on-chain call the user must execute from their wallet
    return {
      burnRequest,
      onChainCall: {
        contractAddress: this.tokenAddress,
        functionName: "burnForRedemption",
        args: {
          amount: this.toWei(order.tokenAmount as Prisma.Decimal).toString(),
          orderId: this.uuidToBytes32(orderId),
        },
      },
    };
  }

  async confirmBurn(burnRequestId: string, txHash: string, requestId: string) {
    const burnRequest = await this.db.burnRequest.findUnique({
      where: { id: burnRequestId },
    });
    if (!burnRequest) throw new NotFoundException("Burn request not found");
    if (burnRequest.status === MintBurnStatus.CONFIRMED)
      return { status: MintBurnStatus.CONFIRMED };

    await this.db.burnRequest.update({
      where: { id: burnRequestId },
      data: {
        status: MintBurnStatus.SUBMITTED,
        txHash,
        submittedAt: new Date(),
      },
    });

    await this.ordersService.onMintSubmitted(burnRequest.orderId, requestId);

    await this.audit.emit({
      actorId: "system:burn",
      action: AuditAction.BURN_CONFIRMED,
      resource: "burn_request",
      resourceId: burnRequestId,
      after: { txHash },
      requestId,
    });

    await this.kafka.publish(
      KafkaTopic.BURN_CONFIRMED,
      "BURN_CONFIRMED",
      { orderId: burnRequest.orderId, burnRequestId, txHash },
      { requestId, actorId: "system:burn" },
    );

    return { status: MintBurnStatus.SUBMITTED, txHash };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private buildClients() {
    const chain = this.resolveChain();
    const account = privateKeyToAccount(this.minterPrivateKey as `0x${string}`);

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(this.rpcUrl),
    });

    const publicClient = createPublicClient({
      chain,
      transport: http(this.rpcUrl),
    });

    return { walletClient, publicClient };
  }

  private resolveChain(): Chain {
    return this.chainId === 11155111 ? sepolia : mainnet;
  }

  private assertBlockchainConfigured() {
    if (
      !this.rpcUrl ||
      !this.minterPrivateKey ||
      this.tokenAddress === "0x0000000000000000000000000000000000000000"
    ) {
      throw new ServiceUnavailableException(
        "Blockchain is not configured. Set RPC_URL, MINTER_PRIVATE_KEY, and AURUM_TOKEN_ADDRESS.",
      );
    }
  }

  private toWei(amount: Prisma.Decimal): bigint {
    // amount has up to 8 decimal places; token uses 18 decimals
    return BigInt(amount.times(new Prisma.Decimal("1e18")).toFixed(0));
  }

  private uuidToBytes32(orderId: string): `0x${string}` {
    // UUID is 16 bytes; encode as UTF-8 bytes and left-pad to 32 bytes
    const hex = orderId.replace(/-/g, ""); // 32 hex chars = 16 bytes
    return `0x${hex.padStart(64, "0")}` as `0x${string}`;
  }
}
