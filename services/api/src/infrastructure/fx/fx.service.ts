import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { RedisService } from "../redis/redis.service";

const CACHE_KEY_PREFIX = "fx:usd:";
const CACHE_TTL_SECONDS = 3600; // 1 hour — FX drift within an hour is tolerable for retail

/**
 * USD → local currency exchange rates.
 * All order amounts are stored in USD; every charge or payout in a local
 * currency MUST be converted here, server-side. Never trust a client-supplied
 * local amount.
 */
@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private readonly apiUrl: string;

  constructor(
    config: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.apiUrl =
      config.get<string>("fx.apiUrl") ??
      "https://open.er-api.com/v6/latest/USD";
  }

  async getUsdRate(currency: string): Promise<Prisma.Decimal> {
    const upper = currency.toUpperCase();
    if (upper === "USD") return new Prisma.Decimal(1);

    const cached = await this.redis.get(`${CACHE_KEY_PREFIX}${upper}`);
    if (cached) return new Prisma.Decimal(cached);

    const rate = await this.fetchRate(upper);
    await this.redis.set(
      `${CACHE_KEY_PREFIX}${upper}`,
      rate.toFixed(8),
      CACHE_TTL_SECONDS,
    );
    this.logger.log(`FX rate refreshed: 1 USD = ${rate.toFixed(4)} ${upper}`);
    return rate;
  }

  /** Convert a USD amount to the smallest unit of the target currency (e.g. pesewas). */
  async usdToSmallestUnit(
    amountUsd: Prisma.Decimal,
    currency: string,
    multiplier = 100,
  ): Promise<number> {
    const rate = await this.getUsdRate(currency);
    return amountUsd
      .mul(rate)
      .mul(multiplier)
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
      .toNumber();
  }

  private async fetchRate(currency: string): Promise<Prisma.Decimal> {
    const response = await fetch(this.apiUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `FX rate feed returned HTTP ${response.status}`,
      );
    }

    const data = (await response.json()) as { rates?: Record<string, number> };
    const rate = data.rates?.[currency];

    if (typeof rate !== "number" || rate <= 0) {
      throw new ServiceUnavailableException(
        `FX rate for ${currency} unavailable`,
      );
    }

    return new Prisma.Decimal(rate);
  }
}
