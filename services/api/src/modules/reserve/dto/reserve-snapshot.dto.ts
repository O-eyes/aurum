import { z } from "zod";

export const ManualSnapshotSchema = z.object({
  goldHeldOz: z
    .string()
    .regex(/^\d+(\.\d{1,8})?$/, "Must be a positive decimal")
    .refine((v) => parseFloat(v) > 0, {
      message: "Gold held must be greater than 0",
    }),
  vaultReference: z.string().max(255).optional(),
});

export type ManualSnapshotDto = z.infer<typeof ManualSnapshotSchema>;
