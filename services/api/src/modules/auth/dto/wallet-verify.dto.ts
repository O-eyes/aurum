import { z } from "zod";

export const WalletVerifySchema = z.object({
  message: z.string().min(1, "SIWE message required"),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, "Invalid signature format"),
});

export type WalletVerifyDto = z.infer<typeof WalletVerifySchema>;
