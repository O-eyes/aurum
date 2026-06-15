import { z } from 'zod';

export const KycSubmitSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  nationality: z.string().length(2, 'ISO 3166-1 alpha-2 country code required'),
});

export type KycSubmitDto = z.infer<typeof KycSubmitSchema>;
