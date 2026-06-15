export enum KycStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
}

export interface KycProfile {
  id: string;
  userId: string;
  status: KycStatus;
  riskScore: number | null;
  providerReference: string | null;
  providerName: string | null;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KycHistoryEntry {
  id: string;
  kycProfileId: string;
  fromStatus: KycStatus;
  toStatus: KycStatus;
  reason: string | null;
  actorId: string | null;
  createdAt: Date;
}

export interface KycStatusTransition {
  from: KycStatus;
  to: KycStatus;
  actorId: string;
  reason?: string;
}

export const VALID_KYC_TRANSITIONS: Record<KycStatus, KycStatus[]> = {
  [KycStatus.PENDING]: [KycStatus.UNDER_REVIEW],
  [KycStatus.UNDER_REVIEW]: [
    KycStatus.APPROVED,
    KycStatus.REJECTED,
    KycStatus.NEEDS_REVIEW,
  ],
  [KycStatus.NEEDS_REVIEW]: [KycStatus.APPROVED, KycStatus.REJECTED],
  [KycStatus.REJECTED]: [KycStatus.PENDING],
  [KycStatus.APPROVED]: [],
};
