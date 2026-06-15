import { z } from 'zod';

export const CreateRedeemSchema = z.object({
  denomination: z.object({
    weightG: z.number().positive(),
    label: z.string().min(1),
  }),
  quantity: z.number().int().min(1).max(100),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  collectionMethod: z.enum(['pickup', 'delivery']),
  preferredPickupDate: z.string().optional(),
  idType: z.enum(['passport', 'national_id', 'drivers_licence']),
  idNumber: z.string().min(3),
  deliveryAddress: z
    .object({
      fullName: z.string().min(2),
      phone: z.string().min(9),
      street: z.string().min(3),
      city: z.string().min(2),
      country: z.string().min(2),
      postalCode: z.string().optional(),
    })
    .optional(),
  idempotencyKey: z.string().uuid(),
});

export type CreateRedeemDto = z.infer<typeof CreateRedeemSchema>;
