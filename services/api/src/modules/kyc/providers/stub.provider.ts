import { Injectable, Logger } from "@nestjs/common";
import {
  KycProvider,
  KycApplicantData,
  KycProviderResult,
  KycProviderStatus,
} from "../kyc.provider.interface";
import { v4 as uuid } from "uuid";

/**
 * Stub KYC provider for local development and testing.
 * Auto-approves all applicants after a 2-second simulated delay.
 * Switch to a real provider by setting KYC_PROVIDER=sumsub|onfido|persona.
 */
@Injectable()
export class StubKycProvider implements KycProvider {
  readonly name = "stub";
  private readonly logger = new Logger(StubKycProvider.name);
  private readonly applicants = new Map<string, KycProviderResult>();

  async createApplicant(
    userId: string,
    data: KycApplicantData,
  ): Promise<{ applicantId: string; sdkToken?: string }> {
    const applicantId = `stub_${uuid()}`;
    this.applicants.set(applicantId, {
      applicantId,
      status: "under_review",
      riskScore: 10,
    });
    this.logger.debug(
      `Stub KYC applicant created: ${applicantId} for user ${userId}`,
    );
    return { applicantId, sdkToken: `stub_sdk_token_${applicantId}` };
  }

  async getApplicantStatus(applicantId: string): Promise<KycProviderResult> {
    const result = this.applicants.get(applicantId);
    if (!result) {
      return { applicantId, status: "pending" };
    }
    return result;
  }

  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    return true;
  }

  parseWebhookEvent(payload: unknown): {
    applicantId: string;
    status: KycProviderStatus;
    riskScore?: number;
    rejectionReason?: string;
  } {
    const event = payload as {
      applicantId: string;
      reviewResult?: { reviewAnswer: string };
    };
    return {
      applicantId: event.applicantId,
      status: "approved",
      riskScore: 10,
    };
  }
}
