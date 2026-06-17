export interface AuditEvent {
  id: string;
  eventId: string;
  actorId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditEventInput {
  actorId: string;
  action: string;
  resource: string;
  resourceId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

// Well-known action constants — extend as modules grow
export const AuditAction = {
  // Auth
  USER_REGISTERED: "USER_REGISTERED",
  USER_EMAIL_VERIFIED: "USER_EMAIL_VERIFIED",
  USER_LOGIN: "USER_LOGIN",
  USER_LOGOUT: "USER_LOGOUT",
  USER_PASSWORD_CHANGED: "USER_PASSWORD_CHANGED",
  USER_PROFILE_UPDATED: "USER_PROFILE_UPDATED",
  WALLET_CHALLENGE_ISSUED: "WALLET_CHALLENGE_ISSUED",
  WALLET_LINKED: "WALLET_LINKED",
  WALLET_REMOVED: "WALLET_REMOVED",
  // KYC
  KYC_SUBMITTED: "KYC_SUBMITTED",
  KYC_STATUS_CHANGED: "KYC_STATUS_CHANGED",
  KYC_APPROVED: "KYC_APPROVED",
  KYC_REJECTED: "KYC_REJECTED",
  // Orders
  ORDER_CREATED: "ORDER_CREATED",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  ORDER_STATUS_CHANGED: "ORDER_STATUS_CHANGED",
  // Payments
  PAYMENT_INITIATED: "PAYMENT_INITIATED",
  PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  // Payouts
  PAYOUT_INITIATED: "PAYOUT_INITIATED",
  PAYOUT_CONFIRMED: "PAYOUT_CONFIRMED",
  PAYOUT_FAILED: "PAYOUT_FAILED",
  // Tokens
  MINT_REQUESTED: "MINT_REQUESTED",
  MINT_CONFIRMED: "MINT_CONFIRMED",
  BURN_REQUESTED: "BURN_REQUESTED",
  BURN_CONFIRMED: "BURN_CONFIRMED",
  // Reserve
  RESERVE_SNAPSHOT_TAKEN: "RESERVE_SNAPSHOT_TAKEN",
} as const;

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];
