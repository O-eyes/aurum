import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * SMS delivery. Providers:
 * - stub    — logs the message (development default)
 * - arkesel — Arkesel SMS API (Ghana-focused; good +233 deliverability)
 *
 * Switch with SMS_PROVIDER + ARKESEL_API_KEY / SMS_SENDER_ID.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: string;
  private readonly apiKey: string;
  private readonly senderId: string;

  constructor(config: ConfigService) {
    this.provider = config.get<string>('sms.provider') ?? 'stub';
    this.apiKey = config.get<string>('sms.apiKey') ?? '';
    this.senderId = config.get<string>('sms.senderId') ?? 'Aurum';
  }

  async send(phone: string, message: string): Promise<void> {
    if (this.provider === 'stub') {
      this.logger.log(`[DEV SMS → ${phone}] ${message}`);
      return;
    }

    if (this.provider === 'arkesel') {
      return this.sendViaArkesel(phone, message);
    }

    throw new ServiceUnavailableException(`Unknown SMS provider: ${this.provider}`);
  }

  private async sendViaArkesel(phone: string, message: string): Promise<void> {
    const response = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: this.senderId,
        message,
        recipients: [phone],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      this.logger.error(`Arkesel SMS failed: HTTP ${response.status}`);
      throw new ServiceUnavailableException('SMS delivery failed. Please try again.');
    }
  }
}
