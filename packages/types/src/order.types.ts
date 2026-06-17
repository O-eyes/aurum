export enum OrderType {
  BUY = "BUY",
  SELL = "SELL",
  REDEEM = "REDEEM",
}

export enum OrderStatus {
  PENDING = "PENDING",
  COMPLIANCE_HOLD = "COMPLIANCE_HOLD",
  PAYMENT_PENDING = "PAYMENT_PENDING",
  PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED",
  RESERVE_ALLOCATED = "RESERVE_ALLOCATED",
  MINTING = "MINTING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export enum MintBurnStatus {
  PENDING = "PENDING",
  SUBMITTED = "SUBMITTED",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
}

export enum LedgerType {
  MINT = "MINT",
  BURN = "BURN",
  FEE = "FEE",
  ADJUSTMENT = "ADJUSTMENT",
}

export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [
    OrderStatus.COMPLIANCE_HOLD,
    OrderStatus.PAYMENT_PENDING,
    OrderStatus.MINTING,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.COMPLIANCE_HOLD]: [
    OrderStatus.PAYMENT_PENDING,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAYMENT_PENDING]: [
    OrderStatus.PAYMENT_CONFIRMED,
    OrderStatus.FAILED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAYMENT_CONFIRMED]: [
    OrderStatus.RESERVE_ALLOCATED,
    OrderStatus.MINTING,
  ],
  [OrderStatus.RESERVE_ALLOCATED]: [OrderStatus.MINTING],
  [OrderStatus.MINTING]: [OrderStatus.COMPLETED, OrderStatus.FAILED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.FAILED]: [],
  [OrderStatus.CANCELLED]: [],
};

export interface Order {
  id: string;
  userId: string;
  type: OrderType;
  status: OrderStatus;
  amountUsd: string;
  goldOunces: string;
  tokenAmount: string;
  goldPriceUsd: string;
  walletAddress: string;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}
