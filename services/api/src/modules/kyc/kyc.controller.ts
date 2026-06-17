import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  Req,
  RawBodyRequest,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { KycService } from "./kyc.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Public } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthenticatedUser, Role } from "@aurum/types";
import { KycSubmitSchema, type KycSubmitDto } from "./dto/kyc-submit.dto";
import {
  KycApproveSchema,
  KycRejectSchema,
  type KycApproveDto,
  type KycRejectDto,
} from "./dto/kyc-review.dto";
import { REQUEST_ID_HEADER } from "../../common/middleware/request-id.middleware";

@ApiTags("kyc")
@Controller("kyc")
export class KycController {
  constructor(private readonly kycService: KycService) {}

  // ── User-facing ───────────────────────────────────────────────────────────

  @Get("status")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get current KYC status for the authenticated user",
  })
  async getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.kycService.getStatus(user.id);
  }

  @Post("submit")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Submit KYC application" })
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body(ZodValidationPipe.for(KycSubmitSchema)) dto: KycSubmitDto,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.kycService.submit(user.id, dto, requestId);
  }

  // ── Ops console / Compliance ──────────────────────────────────────────────

  @Get("review")
  @ApiBearerAuth()
  @Roles(Role.COMPLIANCE, Role.ADMIN)
  @ApiOperation({ summary: "[Ops] List KYC profiles pending review" })
  async listPendingReview(@CurrentUser() user: AuthenticatedUser) {
    return this.kycService.listPendingReview(user.role);
  }

  @Post(":kycProfileId/approve")
  @ApiBearerAuth()
  @Roles(Role.COMPLIANCE, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "[Ops] Approve a KYC profile" })
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("kycProfileId") kycProfileId: string,
    @Body(ZodValidationPipe.for(KycApproveSchema)) dto: KycApproveDto,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.kycService.approve(kycProfileId, user, dto, requestId);
  }

  @Post(":kycProfileId/reject")
  @ApiBearerAuth()
  @Roles(Role.COMPLIANCE, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "[Ops] Reject a KYC profile" })
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param("kycProfileId") kycProfileId: string,
    @Body(ZodValidationPipe.for(KycRejectSchema)) dto: KycRejectDto,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.kycService.reject(kycProfileId, user, dto, requestId);
  }

  // ── Provider webhook (unauthenticated, signature-verified) ───────────────

  @Public()
  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "KYC provider webhook endpoint" })
  async webhook(
    @Req() req: RawBodyRequest<FastifyRequest>,
    @Headers("x-signature") signature: string,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    const rawBody = req.rawBody?.toString() ?? JSON.stringify(req.body);
    return this.kycService.handleWebhook(rawBody, signature, requestId);
  }
}
