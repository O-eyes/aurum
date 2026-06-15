import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type {
  KycProvider,
  KycApplicantData,
  KycProviderResult,
  KycProviderStatus,
} from '../kyc.provider.interface';

@Injectable()
export class SumsubProvider implements KycProvider {
  readonly name = 'sumsub';
  private readonly logger = new Logger(SumsubProvider.name);

  constructor(
    private readonly appToken: string,
    private readonly secretKey: string,
    private readonly baseUrl: string,
    private readonly levelName: string,
  ) {}

  // ── Applicant ──────────────────────────────────────────────────────────────

  async createApplicant(
    userId: string,
    data: KycApplicantData,
  ): Promise<{ applicantId: string; sdkToken: string }> {
    const applicant = await this.post<{ id: string }>(
      `/resources/applicants?levelName=${encodeURIComponent(this.levelName)}`,
      {
        externalUserId: userId,
        email: data.email,
        fixedInfo: {
          firstName: data.firstName,
          lastName: data.lastName,
          dob: data.dateOfBirth,
          country: data.nationality,
        },
      },
    );

    const tokenResponse = await this.post<{ token: string }>(
      `/resources/accessTokens?userId=${encodeURIComponent(userId)}&levelName=${encodeURIComponent(this.levelName)}`,
      {},
    );

    this.logger.debug(`Sumsub applicant created: ${applicant.id} for user ${userId}`);
    return { applicantId: applicant.id, sdkToken: tokenResponse.token };
  }

  async getApplicantStatus(applicantId: string): Promise<KycProviderResult> {
    const applicant = await this.get<{
      id: string;
      review?: {
        reviewStatus: string;
        reviewResult?: { reviewAnswer: string; rejectLabels?: string[] };
      };
    }>(`/resources/applicants/${applicantId}/requiredIdDocsStatus`);

    const status = this.mapReviewStatus(
      applicant.review?.reviewStatus ?? 'init',
      applicant.review?.reviewResult?.reviewAnswer,
    );

    return {
      applicantId,
      status,
      rejectionReason: applicant.review?.reviewResult?.rejectLabels?.join(', '),
    };
  }

  // ── Webhook ────────────────────────────────────────────────────────────────

  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!signature) return false;
    const hash = createHmac('sha256', this.secretKey).update(payload).digest('hex');
    const expected = Buffer.from(hash, 'utf8');
    const received = Buffer.from(signature, 'utf8');
    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
  }

  parseWebhookEvent(payload: unknown): {
    applicantId: string;
    status: KycProviderStatus;
    riskScore?: number;
    rejectionReason?: string;
  } {
    const event = payload as {
      applicantId: string;
      type: string;
      reviewStatus?: string;
      reviewResult?: { reviewAnswer: string; rejectLabels?: string[]; moderationComment?: string };
    };

    const status = this.mapReviewStatus(
      event.reviewStatus ?? event.type,
      event.reviewResult?.reviewAnswer,
    );

    const rejectionReason =
      event.reviewResult?.moderationComment ??
      event.reviewResult?.rejectLabels?.join(', ');

    return { applicantId: event.applicantId, status, rejectionReason };
  }

  // ── HTTP helpers ───────────────────────────────────────────────────────────

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path, undefined);
  }

  private async request<T>(method: string, path: string, body: unknown): Promise<T> {
    const ts = Math.floor(Date.now() / 1000).toString();
    const bodyStr = body !== undefined ? JSON.stringify(body) : '';
    const sigData = ts + method.toUpperCase() + path + bodyStr;
    const signature = createHmac('sha256', this.secretKey).update(sigData).digest('hex');

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'X-App-Token': this.appToken,
        'X-App-Access-Sig': signature,
        'X-App-Access-Ts': ts,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: bodyStr || undefined,
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Sumsub ${method} ${path} → ${response.status}: ${text}`);
      throw new Error(`Sumsub error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  // ── Mapping ────────────────────────────────────────────────────────────────

  private mapReviewStatus(
    reviewStatus: string,
    reviewAnswer?: string,
  ): KycProviderStatus {
    if (reviewAnswer === 'GREEN') return 'approved';
    if (reviewAnswer === 'RED') return 'rejected';

    const map: Record<string, KycProviderStatus> = {
      completed: 'needs_review',
      pending: 'under_review',
      prechecked: 'under_review',
      queued: 'under_review',
      onHold: 'needs_review',
      init: 'pending',
      applicantReviewed: 'needs_review',
      applicantPending: 'under_review',
    };

    return map[reviewStatus] ?? 'under_review';
  }
}
