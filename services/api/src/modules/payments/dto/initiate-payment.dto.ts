import { z } from 'zod';

// Supported currencies for card payments
const CARD_CURRENCIES = ['USD', 'GHS', 'NGN', 'ZAR', 'KES'] as const;

// Supported mobile money networks (Paystack)
const MOBILE_MONEY_NETWORKS = ['mtn', 'vodafone', 'tigo', 'airtel'] as const;

// Currencies that support mobile money on Paystack
const MOBILE_MONEY_CURRENCIES = ['GHS', 'NGN'] as const;

export const InitiateCardPaymentSchema = z.object({
  currency: z.enum(CARD_CURRENCIES).default('USD'),
  callbackUrl: z.string().url('Must be a valid URL').optional(),
});

export const InitiateMobileMoneySchema = z.object({
  phone: z
    .string()
    .min(9)
    .max(15)
    .regex(/^\+?[0-9]+$/, 'Must be a valid phone number'),
  network: z.enum(MOBILE_MONEY_NETWORKS),
  currency: z.enum(MOBILE_MONEY_CURRENCIES),
  // Amount in local currency (e.g. GHS 120.00 → "120.00")
  localAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal with up to 2 places')
    .refine((v) => parseFloat(v) > 0, { message: 'Amount must be greater than 0' }),
});

export type InitiateCardPaymentDto = z.infer<typeof InitiateCardPaymentSchema>;
export type InitiateMobileMoneyDto = z.infer<typeof InitiateMobileMoneySchema>;
