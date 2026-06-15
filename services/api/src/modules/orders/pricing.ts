import { Prisma } from '@prisma/client';

export interface FeeConfig {
  platformPercent: number;
  platformFlatUsd: number;
  taxPercent: number;
}

export interface BuyBreakdown {
  grossUsd: Prisma.Decimal;
  platformFeeUsd: Prisma.Decimal;
  taxUsd: Prisma.Decimal;
  goldCostUsd: Prisma.Decimal;
  goldOunces: Prisma.Decimal;
}

/**
 * Fee-inclusive BUY pricing: the buyer pays `grossUsd`. Aurum's platform fee
 * (percentage of gross + optional flat) and tax (on the fee) come out of it;
 * the remainder is the gold cost settled to GoldBod, which determines how much
 * gold — and therefore how many tokens — the buyer receives.
 */
export function computeBuyBreakdown(
  grossUsd: Prisma.Decimal,
  goldPriceUsd: Prisma.Decimal,
  fees: FeeConfig,
): BuyBreakdown {
  const pct = new Prisma.Decimal(fees.platformPercent).div(100);
  const flat = new Prisma.Decimal(fees.platformFlatUsd);

  let platformFeeUsd = grossUsd.mul(pct).add(flat);
  // Never let fee exceed gross (e.g. tiny order + large flat fee).
  if (platformFeeUsd.greaterThan(grossUsd)) platformFeeUsd = grossUsd;

  const taxUsd = platformFeeUsd.mul(new Prisma.Decimal(fees.taxPercent).div(100));

  let goldCostUsd = grossUsd.sub(platformFeeUsd).sub(taxUsd);
  if (goldCostUsd.isNegative()) goldCostUsd = new Prisma.Decimal(0);

  const goldOunces = goldPriceUsd.isZero()
    ? new Prisma.Decimal(0)
    : goldCostUsd.div(goldPriceUsd);

  return {
    grossUsd,
    platformFeeUsd: platformFeeUsd.toDecimalPlaces(8),
    taxUsd: taxUsd.toDecimalPlaces(8),
    goldCostUsd: goldCostUsd.toDecimalPlaces(8),
    goldOunces: goldOunces.toDecimalPlaces(8),
  };
}
