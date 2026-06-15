import { z } from 'zod';

export const WalletChallengeSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  chainId: z.number().int().positive().default(1),
});

export type WalletChallengeDto = z.infer<typeof WalletChallengeSchema>;
