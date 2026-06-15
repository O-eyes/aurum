import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { RedisService } from '../redis/redis.service';

const CACHE_KEY = 'gold:price:usd';
const CACHE_TTL_SECONDS = 300; // 5-minute cache — stale price would cause loss

@Injectable()
export class GoldPriceService {
  private readonly logger = new Logger(GoldPriceService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.apiUrl = config.get<string>('goldbod.apiUrl') ?? '';
    this.apiKey = config.get<string>('goldbod.apiKey') ?? '';
  }

  async getCurrentPriceUsd(): Promise<Prisma.Decimal> {
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) return new Prisma.Decimal(cached);

    const price = await this.fetchFromGoldbod();
    await this.redis.set(CACHE_KEY, price.toFixed(8), CACHE_TTL_SECONDS);
    this.logger.log(`Gold price refreshed: $${price.toFixed(2)}/oz`);
    return price;
  }

  // Force a cache refresh — call from ops endpoints or scheduled tasks
  async refresh(): Promise<Prisma.Decimal> {
    await this.redis.del(CACHE_KEY);
    return this.getCurrentPriceUsd();
  }

  private async fetchFromGoldbod(): Promise<Prisma.Decimal> {
    if (!this.apiUrl || !this.apiKey) {
      throw new ServiceUnavailableException(
        'Gold price feed not configured. Set GOLDBOD_API_URL and GOLDBOD_API_KEY.',
      );
    }

    const response = await fetch(`${this.apiUrl}/spot/XAU/USD`, {
      headers: { 'x-api-key': this.apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Gold price feed returned HTTP ${response.status}. Contact ops.`,
      );
    }

    const data = (await response.json()) as { price: string | number };
    return new Prisma.Decimal(String(data.price));
  }
}
