export const KafkaTopic = {
  // User lifecycle
  USER_CREATED: "aurum.user.created",
  USER_EMAIL_VERIFIED: "aurum.user.email-verified",

  // Wallet
  WALLET_LINKED: "aurum.wallet.linked",

  // KYC
  KYC_STATUS_CHANGED: "aurum.kyc.status-changed",
  KYC_APPROVED: "aurum.kyc.approved",

  // Orders
  ORDER_CREATED: "aurum.order.created",
  ORDER_STATUS_CHANGED: "aurum.order.status-changed",

  // Token ops
  MINT_REQUESTED: "aurum.mint.requested",
  MINT_CONFIRMED: "aurum.mint.confirmed",
  BURN_REQUESTED: "aurum.burn.requested",
  BURN_CONFIRMED: "aurum.burn.confirmed",

  // Payments
  PAYMENT_CONFIRMED: "aurum.payment.confirmed",
  PAYMENT_FAILED: "aurum.payment.failed",

  // Payouts
  PAYOUT_INITIATED: "aurum.payout.initiated",
  PAYOUT_CONFIRMED: "aurum.payout.confirmed",
  PAYOUT_FAILED: "aurum.payout.failed",

  // Reserve
  RESERVE_SNAPSHOT: "aurum.reserve.snapshot",
  RESERVE_ALERT: "aurum.reserve.alert",

  // Audit (fan-out for external SIEM, etc.)
  AUDIT_EVENT: "aurum.audit.event",
} as const;

export type KafkaTopicValue = (typeof KafkaTopic)[keyof typeof KafkaTopic];
