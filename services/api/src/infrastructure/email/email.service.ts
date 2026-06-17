import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly appUrl: string;
  private readonly isProduction: boolean;

  constructor(config: ConfigService) {
    const host = config.get<string>("email.host") ?? "localhost";
    const port = config.get<number>("email.port") ?? 1025;
    const user = config.get<string>("email.user");
    const pass = config.get<string>("email.pass");
    this.from = config.get<string>("email.from") ?? "noreply@aurum.finance";
    this.appUrl = config.get<string>("appUrl") ?? "http://localhost:3001";
    this.isProduction = config.get<string>("nodeEnv") === "production";

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verifyUrl = `${this.appUrl}/verify-email?token=${token}`;

    if (!this.isProduction) {
      this.logger.debug(`[DEV] Verify ${email} → ${verifyUrl}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: "Verify your Aurum account",
        text: `Click the link below to verify your email address:\n\n${verifyUrl}\n\nThis link expires in 24 hours.`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2 style="color:#1a1a1a">Verify your email</h2>
            <p>Click the button below to verify your Aurum account:</p>
            <a href="${verifyUrl}"
               style="display:inline-block;padding:12px 24px;background:#b8860b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
              Verify email address
            </a>
            <p style="color:#666;font-size:13px;margin-top:24px">
              This link expires in 24 hours. If you didn't create an account, you can ignore this email.
            </p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send verification email to ${email}`,
        (err as Error).message,
      );
    }
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${this.appUrl}/reset-password?token=${token}`;

    if (!this.isProduction) {
      this.logger.debug(`[DEV] Password reset for ${email} → ${resetUrl}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: "Reset your Aurum password",
        text: `Click the link below to reset your password:\n\n${resetUrl}\n\nThis link expires in 1 hour.`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2 style="color:#1a1a1a">Reset your password</h2>
            <p>Click the button below to set a new password:</p>
            <a href="${resetUrl}"
               style="display:inline-block;padding:12px 24px;background:#b8860b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
              Reset password
            </a>
            <p style="color:#666;font-size:13px;margin-top:24px">
              This link expires in 1 hour. If you didn't request this, you can ignore this email.
            </p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send password reset email to ${email}`,
        (err as Error).message,
      );
    }
  }
}
