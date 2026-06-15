export interface KycApplicantData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  email: string;
}

export type KycProviderStatus =
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'needs_review';

export interface KycProviderResult {
  applicantId: string;
  status: KycProviderStatus;
  riskScore?: number;
  rejectionReason?: string;
  sdkToken?: string;
}

export interface KycProvider {
  readonly name: string;

  createApplicant(
    userId: string,
    data: KycApplicantData,
  ): Promise<{ applicantId: string; sdkToken?: string }>;

  getApplicantStatus(applicantId: string): Promise<KycProviderResult>;

  verifyWebhookSignature(payload: string, signature: string): boolean;

  parseWebhookEvent(payload: unknown): {
    applicantId: string;
    status: KycProviderStatus;
    riskScore?: number;
    rejectionReason?: string;
  };
}

export const KYC_PROVIDER = Symbol('KYC_PROVIDER');
