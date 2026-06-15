// Kafka message envelope — every message is wrapped in this
export interface KafkaMessage<T = unknown> {
  eventId: string;
  eventType: string;
  occurredAt: string;
  version: '1.0';
  payload: T;
  metadata: {
    requestId: string;
    actorId: string;
    source: string;
  };
}

// ── Topic payload types ───────────────────────────────────────────────────────

export interface UserCreatedPayload {
  userId: string;
  email: string;
}

export interface UserEmailVerifiedPayload {
  userId: string;
  email: string;
}

export interface KycStatusChangedPayload {
  kycProfileId: string;
  userId: string;
  fromStatus: string;
  toStatus: string;
  reason?: string;
}

export interface WalletLinkedPayload {
  userId: string;
  address: string;
  chainId: number;
}

export interface AuditEventPayload {
  eventId: string;
  actorId: string;
  action: string;
  resource: string;
  resourceId?: string;
  requestId: string;
}
