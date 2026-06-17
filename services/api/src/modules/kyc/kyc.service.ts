import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { DatabaseService } from "../../infrastructure/database/database.service";
import { KafkaService } from "../../infrastructure/kafka/kafka.service";
import { AuditService } from "../audit/audit.service";
import { KafkaTopic } from "../../infrastructure/kafka/kafka.topics";
import { KycProvider, KYC_PROVIDER } from "./kyc.provider.interface";
import { assertValidTransition } from "./kyc-state-machine";
import { KycStatus, AuditAction, Role } from "@aurum/types";
import type { KycSubmitDto } from "./dto/kyc-submit.dto";
import type { KycApproveDto, KycRejectDto } from "./dto/kyc-review.dto";

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly kafka: KafkaService,
    private readonly audit: AuditService,
    @Inject(KYC_PROVIDER) private readonly provider: KycProvider,
  ) {}

  // ── User-facing ───────────────────────────────────────────────────────────

  async getStatus(userId: string) {
    const profile = await this.db.kycProfile.findUnique({
      where: { userId },
      include: { history: { orderBy: { createdAt: "desc" }, take: 5 } },
    });

    if (!profile) throw new NotFoundException("KYC profile not found");
    return profile;
  }

  async submit(userId: string, dto: KycSubmitDto, requestId: string) {
    const profile = await this.db.kycProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException("KYC profile not found");

    const allowedToSubmit = [KycStatus.PENDING, KycStatus.REJECTED].includes(
      profile.status as KycStatus,
    );

    if (!allowedToSubmit) {
      throw new BadRequestException(
        `Cannot submit KYC in current status: ${profile.status}`,
      );
    }

    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) throw new NotFoundException("User not found");

    const { applicantId, sdkToken } = await this.provider.createApplicant(
      userId,
      {
        ...dto,
        email: user.email,
      },
    );

    const fromStatus = profile.status as KycStatus;
    const toStatus = KycStatus.UNDER_REVIEW;

    await this.db.$transaction(async (tx) => {
      await tx.kycProfile.update({
        where: { userId },
        data: {
          status: toStatus,
          providerReference: applicantId,
          providerName: this.provider.name,
          submittedAt: new Date(),
          rejectionReason: null,
        },
      });

      await tx.kycHistory.create({
        data: {
          kycProfileId: profile.id,
          fromStatus,
          toStatus,
          actorId: userId,
        },
      });
    });

    await this.emitKycEvent(
      profile.id,
      userId,
      fromStatus,
      toStatus,
      requestId,
      userId,
    );

    return { status: toStatus, sdkToken };
  }

  // ── Ops-console / Compliance ──────────────────────────────────────────────

  async listPendingReview(actorRole: string) {
    this.requireComplianceOrAbove(actorRole);

    const profiles = await this.db.kycProfile.findMany({
      where: {
        status: { in: [KycStatus.NEEDS_REVIEW, KycStatus.UNDER_REVIEW] },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: "asc" },
    });

    return profiles.map((p) => ({
      id: p.id,
      userId: p.userId,
      status: p.status,
      externalId: p.providerReference,
      reviewNote: p.rejectionReason,
      updatedAt: p.updatedAt.toISOString(),
      user: {
        email: p.user.email,
        firstName: p.user.firstName,
        lastName: p.user.lastName,
      },
    }));
  }

  async approve(
    kycProfileId: string,
    actor: { id: string; role: string },
    dto: KycApproveDto,
    requestId: string,
  ) {
    this.requireComplianceOrAbove(actor.role);

    const profile = await this.db.kycProfile.findUnique({
      where: { id: kycProfileId },
    });

    if (!profile) throw new NotFoundException("KYC profile not found");

    assertValidTransition(profile.status as KycStatus, KycStatus.APPROVED);

    const fromStatus = profile.status as KycStatus;

    await this.db.$transaction(async (tx) => {
      await tx.kycProfile.update({
        where: { id: kycProfileId },
        data: {
          status: KycStatus.APPROVED,
          reviewedBy: actor.id,
          reviewedAt: new Date(),
          approvedAt: new Date(),
        },
      });

      await tx.kycHistory.create({
        data: {
          kycProfileId,
          fromStatus,
          toStatus: KycStatus.APPROVED,
          actorId: actor.id,
          reason: dto.reason ?? "Manually approved",
        },
      });
    });

    await this.emitKycEvent(
      kycProfileId,
      profile.userId,
      fromStatus,
      KycStatus.APPROVED,
      requestId,
      actor.id,
    );

    return { status: KycStatus.APPROVED };
  }

  async reject(
    kycProfileId: string,
    actor: { id: string; role: string },
    dto: KycRejectDto,
    requestId: string,
  ) {
    this.requireComplianceOrAbove(actor.role);

    const profile = await this.db.kycProfile.findUnique({
      where: { id: kycProfileId },
    });

    if (!profile) throw new NotFoundException("KYC profile not found");

    assertValidTransition(profile.status as KycStatus, KycStatus.REJECTED);

    const fromStatus = profile.status as KycStatus;

    await this.db.$transaction(async (tx) => {
      await tx.kycProfile.update({
        where: { id: kycProfileId },
        data: {
          status: KycStatus.REJECTED,
          reviewedBy: actor.id,
          reviewedAt: new Date(),
          rejectionReason: dto.reason,
        },
      });

      await tx.kycHistory.create({
        data: {
          kycProfileId,
          fromStatus,
          toStatus: KycStatus.REJECTED,
          actorId: actor.id,
          reason: dto.reason,
        },
      });
    });

    await this.emitKycEvent(
      kycProfileId,
      profile.userId,
      fromStatus,
      KycStatus.REJECTED,
      requestId,
      actor.id,
      dto.reason,
    );

    return { status: KycStatus.REJECTED };
  }

  // ── Provider Webhook ──────────────────────────────────────────────────────

  async handleWebhook(rawBody: string, signature: string, requestId: string) {
    if (!this.provider.verifyWebhookSignature(rawBody, signature)) {
      throw new ForbiddenException("Invalid webhook signature");
    }

    const event = this.provider.parseWebhookEvent(JSON.parse(rawBody));

    const profile = await this.db.kycProfile.findFirst({
      where: { providerReference: event.applicantId },
    });

    if (!profile) {
      this.logger.warn(`Webhook for unknown applicant: ${event.applicantId}`);
      return { received: true };
    }

    const toStatus = this.mapProviderStatus(event.status);
    const fromStatus = profile.status as KycStatus;

    if (!this.canTransitionSilently(fromStatus, toStatus)) {
      this.logger.debug(
        `Ignoring webhook transition ${fromStatus} → ${toStatus}`,
      );
      return { received: true };
    }

    await this.db.$transaction(async (tx) => {
      await tx.kycProfile.update({
        where: { id: profile.id },
        data: {
          status: toStatus,
          riskScore: event.riskScore ?? null,
          rejectionReason: event.rejectionReason ?? null,
          ...(toStatus === KycStatus.APPROVED && { approvedAt: new Date() }),
        },
      });

      await tx.kycHistory.create({
        data: {
          kycProfileId: profile.id,
          fromStatus,
          toStatus,
          actorId: "system:kyc-provider",
          reason: `Provider: ${this.provider.name}`,
        },
      });
    });

    await this.emitKycEvent(
      profile.id,
      profile.userId,
      fromStatus,
      toStatus,
      requestId,
      "system:kyc-provider",
      event.rejectionReason,
    );

    return { received: true };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async emitKycEvent(
    kycProfileId: string,
    userId: string,
    fromStatus: KycStatus,
    toStatus: KycStatus,
    requestId: string,
    actorId: string,
    reason?: string,
  ) {
    const action =
      toStatus === KycStatus.APPROVED
        ? AuditAction.KYC_APPROVED
        : toStatus === KycStatus.REJECTED
          ? AuditAction.KYC_REJECTED
          : AuditAction.KYC_STATUS_CHANGED;

    await this.audit.emit({
      actorId,
      action,
      resource: "kyc_profile",
      resourceId: kycProfileId,
      before: { status: fromStatus },
      after: { status: toStatus, reason },
      requestId,
    });

    await this.kafka.publish(
      KafkaTopic.KYC_STATUS_CHANGED,
      "KYC_STATUS_CHANGED",
      { kycProfileId, userId, fromStatus, toStatus, reason },
      { requestId, actorId },
    );

    if (toStatus === KycStatus.APPROVED) {
      await this.kafka.publish(
        KafkaTopic.KYC_APPROVED,
        "KYC_APPROVED",
        { kycProfileId, userId },
        { requestId, actorId },
      );
    }
  }

  private mapProviderStatus(status: string): KycStatus {
    const map: Record<string, KycStatus> = {
      approved: KycStatus.APPROVED,
      rejected: KycStatus.REJECTED,
      needs_review: KycStatus.NEEDS_REVIEW,
      under_review: KycStatus.UNDER_REVIEW,
      pending: KycStatus.PENDING,
    };
    return map[status] ?? KycStatus.NEEDS_REVIEW;
  }

  private canTransitionSilently(from: KycStatus, to: KycStatus): boolean {
    try {
      assertValidTransition(from, to);
      return true;
    } catch {
      return false;
    }
  }

  private requireComplianceOrAbove(role: string) {
    const allowed = [Role.COMPLIANCE, Role.ADMIN, Role.TREASURY];
    if (!allowed.includes(role as Role)) {
      throw new ForbiddenException("Compliance role required");
    }
  }
}
