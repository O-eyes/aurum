import { z } from 'zod';

export const CreateOrderSchema = z.object({
  type: z.enum(['BUY', 'SELL']),
  amountUsd: z
    .string()
    .regex(/^\d+(\.\d{1,8})?$/, 'Must be a positive decimal with up to 8 decimal places')
    .refine((v) => parseFloat(v) > 0, { message: 'Amount must be greater than 0' }),
  walletAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'Must be a valid Ethereum address'),
  idempotencyKey: z.string().uuid('Must be a valid UUID v4'),
});

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;
