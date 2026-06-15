import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SiweMessage } from 'siwe';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { addMinutes, addDays } from './auth.utils';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { KafkaService } from '../../infrastructure/kafka/kafka.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../../infrastructure/email/email.service';
import { SmsService } from '../../infrastructure/sms/sms.service';
import { KafkaTopic } from '../../infrastructure/kafka/kafka.topics';
import { AuditAction } from '@aurum/types';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { WalletChallengeDto } from './dto/wallet-challenge.dto';
import type { WalletVerifyDto } from './dto/wallet-verify.dto';

const WALLET_NONCE_TTL = 300; // 5 minutes
const EMAIL_VERIFY_TTL = 86400; // 24 hours
const BCRYPT_ROUNDS = 12;

const OTP_TTL = 600; // 10 minutes
const OTP_RESEND_COOLDOWN = 60; // 1 minute between sends
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly kafka: KafkaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
  ) {}

  // ── Register ─────────────────────────────────────────────────────────────

  async register(dto: RegisterDto, requestId: string, ipAddress?: string) {
    const existing = await this.db.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const verifyToken = uuid();

    const user = await this.db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName ?? null,
          lastName: dto.lastName ?? null,
        },
      });

      await tx.emailVerification.create({
        data: {
          userId: created.id,
          token: verifyToken,
          expiresAt: addDays(new Date(), 1),
        },
      });

      await tx.kycProfile.create({
        data: { userId: created.id },
      });

      return created;
    });

    await this.audit.emit({
      actorId: user.id,
      action: AuditAction.USER_REGISTERED,
      resource: 'user',
      resourceId: user.id,
      after: { email: user.email },
      requestId,
      ipAddress,
    });

    await this.kafka.publish(
      KafkaTopic.USER_CREATED,
      'USER_CREATED',
      { userId: user.id, email: user.email },
      { requestId, actorId: user.id },
    );

    await this.email.sendVerificationEmail(dto.email, verifyToken);

    return { message: 'Registration successful. Check your email to verify your account.' };
  }

  // ── Verify Email ─────────────────────────────────────────────────────────

  async verifyEmail(token: string, requestId: string) {
    const verification = await this.db.emailVerification.findUnique({
      where: { token },
      include: { user: true } as never,
    });

    const record = verification as typeof verification & { user: { id: string; email: string } } | null;

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.db.$transaction(async (tx) => {
      await tx.emailVerification.update({
        where: { token },
        data: { usedAt: new Date() },
      });
      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerified: true },
      });
    });

    await this.audit.emit({
      actorId: record.userId,
      action: AuditAction.USER_EMAIL_VERIFIED,
      resource: 'user',
      resourceId: record.userId,
      requestId,
    });

    await this.kafka.publish(
      KafkaTopic.USER_EMAIL_VERIFIED,
      'USER_EMAIL_VERIFIED',
      { userId: record.userId, email: record.user.email },
      { requestId, actorId: record.userId },
    );

    return { message: 'Email verified successfully.' };
  }

  // ── Login (email/password) ────────────────────────────────────────────────

  async login(dto: LoginDto, requestId: string, ipAddress?: string) {
    const user = await this.db.user.findUnique({
      where: { email: dto.email },
      include: { kycProfile: { select: { status: true } } },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.emailVerified) {
      throw new UnauthorizedException('Email not verified. Check your inbox.');
    }

    const { accessToken, refreshToken, sessionId } = await this.createSession(user.id, user.email ?? '', user.role);

    await this.audit.emit({
      actorId: user.id,
      action: AuditAction.USER_LOGIN,
      resource: 'session',
      resourceId: sessionId,
      requestId,
      ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      user: this.formatUserProfile(user),
    };
  }

  // ── Phone OTP (unified sign-up / sign-in) ─────────────────────────────────

  async requestOtp(phone: string, requestId: string) {
    const cooldownKey = `otp:cooldown:${phone}`;
    if (await this.redis.exists(cooldownKey)) {
      throw new BadRequestException('Please wait a moment before requesting another code.');
    }

    // Crypto-strong 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    await this.redis.setJson(`otp:${phone}`, { code, attempts: 0 }, OTP_TTL);
    await this.redis.set(cooldownKey, '1', OTP_RESEND_COOLDOWN);

    await this.sms.send(phone, `Your Aurum verification code is ${code}. Valid for 10 minutes.`);

    this.logger.debug(`OTP requested for ${phone} (request ${requestId})`);
    return { message: 'Verification code sent.', expiresInSeconds: OTP_TTL };
  }

  async verifyOtp(phone: string, code: string, requestId: string, ipAddress?: string) {
    const key = `otp:${phone}`;
    const stored = await this.redis.getJson<{ code: string; attempts: number }>(key);

    if (!stored) {
      throw new UnauthorizedException('Code expired or not requested. Request a new one.');
    }

    if (stored.attempts >= OTP_MAX_ATTEMPTS) {
      await this.redis.del(key);
      throw new UnauthorizedException('Too many attempts. Request a new code.');
    }

    if (stored.code !== code) {
      await this.redis.setJson(key, { ...stored, attempts: stored.attempts + 1 }, OTP_TTL);
      throw new UnauthorizedException('Incorrect code.');
    }

    await this.redis.del(key);

    // Sign-up-or-sign-in: create the account on first successful verification.
    let user = await this.db.user.findUnique({
      where: { phone },
      include: { kycProfile: { select: { status: true } } },
    });

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      user = await this.db.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { phone, phoneVerified: true },
        });
        await tx.kycProfile.create({ data: { userId: created.id } });
        return { ...created, kycProfile: { status: 'PENDING' } };
      });

      await this.audit.emit({
        actorId: user.id,
        action: AuditAction.USER_REGISTERED,
        resource: 'user',
        resourceId: user.id,
        after: { phone },
        requestId,
        ipAddress,
      });

      await this.kafka.publish(
        KafkaTopic.USER_CREATED,
        'USER_CREATED',
        { userId: user.id, phone },
        { requestId, actorId: user.id },
      );
    } else if (!user.phoneVerified) {
      await this.db.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
    }

    const { accessToken, refreshToken, sessionId } = await this.createSession(
      user.id,
      user.email ?? '',
      user.role,
    );

    await this.audit.emit({
      actorId: user.id,
      action: AuditAction.USER_LOGIN,
      resource: 'session',
      resourceId: sessionId,
      after: { method: 'phone_otp' },
      requestId,
      ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      isNewUser,
      user: this.formatUserProfile(user),
    };
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async logout(userId: string, jti: string, sessionId: string, requestId: string) {
    await this.db.session.updateMany({
      where: { userId, jti },
      data: { revokedAt: new Date() },
    });

    // Blacklist the specific JWT for immediate effect (until it naturally expires)
    const expiry = this.config.get<string>('jwt.expiry') ?? '15m';
    const ttl = this.parseTtlToSeconds(expiry);
    await this.redis.set(`jwt:blacklist:${jti}`, '1', ttl);

    await this.audit.emit({
      actorId: userId,
      action: AuditAction.USER_LOGOUT,
      resource: 'session',
      resourceId: sessionId,
      requestId,
    });

    return { message: 'Logged out successfully.' };
  }

  // ── Wallet Challenge ──────────────────────────────────────────────────────

  async walletChallenge(dto: WalletChallengeDto, requestId: string) {
    const nonce = uuid().replace(/-/g, '');
    const domain = new URL(this.config.get<string>('appUrl')!).hostname;
    const issuedAt = new Date().toISOString();
    const expirationTime = addMinutes(new Date(), 5).toISOString();

    const message = new SiweMessage({
      domain,
      address: dto.address,
      statement: 'Sign in to Aurum — trusted digital gold infrastructure.',
      uri: this.config.get<string>('appUrl')!,
      version: '1',
      chainId: dto.chainId,
      nonce,
      issuedAt,
      expirationTime,
    });

    const preparedMessage = message.prepareMessage();

    await this.redis.setJson(
      `wallet:nonce:${dto.address.toLowerCase()}`,
      { nonce, chainId: dto.chainId },
      WALLET_NONCE_TTL,
    );

    return { message: preparedMessage, nonce };
  }

  // ── Wallet Verify ─────────────────────────────────────────────────────────

  async walletVerify(
    dto: WalletVerifyDto,
    requestId: string,
    ipAddress?: string,
    authenticatedUserId?: string,
  ) {
    let siweMessage: SiweMessage;

    try {
      siweMessage = new SiweMessage(dto.message);
    } catch {
      throw new BadRequestException('Invalid SIWE message format');
    }

    const address = siweMessage.address.toLowerCase();

    const stored = await this.redis.getJson<{ nonce: string; chainId: number }>(
      `wallet:nonce:${address}`,
    );

    if (!stored) throw new BadRequestException('Challenge expired or not issued');

    const expectedDomain = new URL(this.config.get<string>('appUrl')!).hostname;
    const { data, success } = await siweMessage
      .verify({ signature: dto.signature, domain: expectedDomain, nonce: stored.nonce })
      .catch(() => ({ data: null as never, success: false }));
    if (!success) throw new UnauthorizedException('Invalid wallet signature');

    if (data.nonce !== stored.nonce) {
      throw new UnauthorizedException('Nonce mismatch');
    }

    await this.redis.del(`wallet:nonce:${address}`);

    // --- Link wallet to authenticated user ---
    if (authenticatedUserId) {
      const existing = await this.db.wallet.findUnique({ where: { address } });

      if (existing && existing.userId !== authenticatedUserId) {
        throw new ConflictException('Wallet already linked to another account');
      }

      if (!existing) {
        await this.db.wallet.create({
          data: { userId: authenticatedUserId, address, chainId: stored.chainId, verified: true },
        });
      }

      await this.audit.emit({
        actorId: authenticatedUserId,
        action: AuditAction.WALLET_LINKED,
        resource: 'wallet',
        after: { address },
        requestId,
        ipAddress,
      });

      await this.kafka.publish(
        KafkaTopic.WALLET_LINKED,
        'WALLET_LINKED',
        { userId: authenticatedUserId, address, chainId: stored.chainId },
        { requestId, actorId: authenticatedUserId },
      );

      return { linked: true, address };
    }

    // --- Wallet sign-in (wallet must already be linked) ---
    const wallet = await this.db.wallet.findUnique({
      where: { address },
      include: {
        user: {
          include: { kycProfile: { select: { status: true } } },
        },
      },
    });

    if (!wallet) throw new NotFoundException('No account linked to this wallet. Sign up first.');

    const user = wallet.user;

    // Account must be verified through at least one channel (email or phone OTP).
    if (!user.emailVerified && !user.phoneVerified) {
      throw new UnauthorizedException('Account not verified. Complete registration first.');
    }

    const { accessToken, refreshToken, sessionId } = await this.createSession(user.id, user.email ?? '', user.role);

    await this.audit.emit({
      actorId: user.id,
      action: AuditAction.USER_LOGIN,
      resource: 'session',
      resourceId: sessionId,
      after: { method: 'wallet', address },
      requestId,
      ipAddress,
    });

    return { accessToken, refreshToken, user: this.formatUserProfile(user) };
  }

  // ── Refresh ───────────────────────────────────────────────────────────────

  async refresh(refreshToken: string, requestId: string, ipAddress?: string) {
    const session = await this.db.session.findUnique({
      where: { refreshToken },
      include: {
        user: {
          include: { kycProfile: { select: { status: true } } },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    const user = session.user;
    const newRefreshToken = uuid();

    await this.db.session.update({
      where: { id: session.id },
      data: { refreshToken: newRefreshToken, expiresAt: addDays(new Date(), 7) },
    });

    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email ?? '',
      role: user.role,
      sessionId: session.id,
      jti: session.jti,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: this.formatUserProfile(user),
    };
  }

  // ── Change Password ───────────────────────────────────────────────────────

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    requestId: string,
    ipAddress?: string,
    currentSessionId?: string,
  ) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.db.user.update({ where: { id: userId }, data: { passwordHash } });

    // Revoke every other active session — a password change must lock out
    // anyone holding a stolen token or refresh token.
    await this.db.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(currentSessionId && { id: { not: currentSessionId } }),
      },
      data: { revokedAt: new Date() },
    });

    await this.audit.emit({
      actorId: userId,
      action: AuditAction.USER_PASSWORD_CHANGED,
      resource: 'user',
      resourceId: userId,
      requestId,
      ipAddress,
    });

    return { message: 'Password changed successfully.' };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async createSession(userId: string, email: string, role: string) {
    const jti = uuid();
    const refreshToken = uuid();
    const expiresAt = addDays(new Date(), 7);

    const session = await this.db.session.create({
      data: { userId, jti, refreshToken, expiresAt },
    });

    const accessToken = this.jwt.sign({
      sub: userId,
      email,
      role,
      sessionId: session.id,
      jti,
    });

    return { accessToken, refreshToken, sessionId: session.id };
  }

  private formatUserProfile(user: {
    id: string;
    email: string | null;
    phone?: string | null;
    firstName: string | null;
    lastName: string | null;
    role: string;
    createdAt: Date;
    kycProfile?: { status: string } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone ?? null,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: [user.role],
      kycStatus: user.kycProfile?.status ?? 'PENDING',
      createdAt: user.createdAt.toISOString(),
    };
  }

  private parseTtlToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] ?? 60);
  }
}
