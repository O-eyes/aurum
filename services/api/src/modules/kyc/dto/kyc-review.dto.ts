import { z } from "zod";

export const KycApproveSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const KycRejectSchema = z.object({
  reason: z.string().min(1, "Rejection reason required").max(500),
});

export type KycApproveDto = z.infer<typeof KycApproveSchema>;
export type KycRejectDto = z.infer<typeof KycRejectSchema>;
