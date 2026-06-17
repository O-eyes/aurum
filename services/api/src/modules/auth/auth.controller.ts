import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  Req,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { AuthService } from "./auth.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Public, OptionalAuth } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Audit } from "../../common/decorators/audit.decorator";
import { AuditAction, AuthenticatedUser } from "@aurum/types";
import { RegisterSchema, type RegisterDto } from "./dto/register.dto";
import { LoginSchema, type LoginDto } from "./dto/login.dto";
import {
  WalletChallengeSchema,
  type WalletChallengeDto,
} from "./dto/wallet-challenge.dto";
import {
  WalletVerifySchema,
  type WalletVerifyDto,
} from "./dto/wallet-verify.dto";
import { VerifyEmailSchema, type VerifyEmailDto } from "./dto/verify-email.dto";
import {
  RequestOtpSchema,
  VerifyOtpSchema,
  type RequestOtpDto,
  type VerifyOtpDto,
} from "./dto/otp.dto";
import { REQUEST_ID_HEADER } from "../../common/middleware/request-id.middleware";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  @Audit(AuditAction.USER_REGISTERED, "user")
  @ApiOperation({ summary: "Register a new user account" })
  async register(
    @Body(ZodValidationPipe.for(RegisterSchema)) dto: RegisterDto,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.authService.register(dto, requestId, req.ip);
  }

  @Public()
  @Get("verify-email")
  @ApiOperation({ summary: "Verify email address with token from email" })
  async verifyEmail(
    @Query(ZodValidationPipe.for(VerifyEmailSchema)) dto: VerifyEmailDto,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.authService.verifyEmail(dto.token, requestId);
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login with email and password" })
  async login(
    @Body(ZodValidationPipe.for(LoginSchema)) dto: LoginDto,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.authService.login(dto, requestId, req.ip);
  }

  // ── Phone OTP (unified sign-up / sign-in) ──────────────────────────────────

  @Public()
  @Post("otp/request")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Send a 6-digit verification code to a phone number",
  })
  async requestOtp(
    @Body(ZodValidationPipe.for(RequestOtpSchema)) dto: RequestOtpDto,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.authService.requestOtp(dto.phone, requestId);
  }

  @Public()
  @Post("otp/verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Verify the code — signs in, creating the account on first use",
  })
  async verifyOtp(
    @Body(ZodValidationPipe.for(VerifyOtpSchema)) dto: VerifyOtpDto,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.authService.verifyOtp(dto.phone, dto.code, requestId, req.ip);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Logout and revoke current session" })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    const token = req.headers.authorization?.split(" ")[1] ?? "";
    // jti is embedded in the token; the JWT strategy already validated it
    // We decode here without verification (already verified by guard)
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    ) as { jti: string };
    return this.authService.logout(
      user.id,
      payload.jti,
      user.sessionId,
      requestId,
    );
  }

  // ── Wallet ────────────────────────────────────────────────────────────────

  @Public()
  @Post("wallet/challenge")
  @ApiOperation({ summary: "Request a SIWE challenge for a wallet address" })
  async walletChallenge(
    @Body(ZodValidationPipe.for(WalletChallengeSchema)) dto: WalletChallengeDto,
    @Req() req: FastifyRequest,
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.authService.walletChallenge(dto, requestId);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Exchange a refresh token for a new access + refresh token pair",
  })
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() req: FastifyRequest,
  ) {
    if (!body.refreshToken)
      throw new BadRequestException("refreshToken is required");
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.authService.refresh(body.refreshToken, requestId, req.ip);
  }

  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Change password for the authenticated user" })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { currentPassword?: string; newPassword?: string },
    @Req() req: FastifyRequest,
  ) {
    if (!body.currentPassword || !body.newPassword) {
      throw new BadRequestException(
        "currentPassword and newPassword are required",
      );
    }
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.authService.changePassword(
      user.id,
      body.currentPassword,
      body.newPassword,
      requestId,
      req.ip,
      user.sessionId,
    );
  }

  /**
   * Two modes:
   * - Authenticated (token present): links wallet to the current user account.
   * - Unauthenticated (no token): signs in with a previously-linked wallet.
   */
  @OptionalAuth()
  @Post("wallet/verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verify wallet signature (sign-in or link)" })
  async walletVerify(
    @Body(ZodValidationPipe.for(WalletVerifySchema)) dto: WalletVerifyDto,
    @Req() req: FastifyRequest & { user?: AuthenticatedUser },
  ) {
    const requestId = req.headers[REQUEST_ID_HEADER] as string;
    return this.authService.walletVerify(dto, requestId, req.ip, req.user?.id);
  }
}
