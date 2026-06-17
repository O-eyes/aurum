import { z } from "zod";

export const KycWebhookSchema = z.object({
  applicantId: z.string(),
  type: z.string(),
  reviewResult: z
    .object({
      reviewAnswer: z.string(),
      rejectLabels: z.array(z.string()).optional(),
    })
    .optional(),
  riskScore: z.number().optional(),
});

export type KycWebhookDto = z.infer<typeof KycWebhookSchema>;
