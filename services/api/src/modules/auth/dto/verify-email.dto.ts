import { z } from "zod";

export const VerifyEmailSchema = z.object({
  token: z.string().uuid("Invalid verification token"),
});

export type VerifyEmailDto = z.infer<typeof VerifyEmailSchema>;
