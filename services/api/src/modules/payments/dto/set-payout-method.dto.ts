import { z } from "zod";

const BankPayoutSchema = z.object({
  type: z.literal("bank"),
  name: z.string().min(2).max(100),
  currency: z.enum(["NGN", "GHS", "ZAR", "KES"]),
  accountNumber: z.string().min(6).max(20),
  bankCode: z.string().min(3).max(10),
});

const MobileMoneyPayoutSchema = z.object({
  type: z.literal("mobile_money"),
  name: z.string().min(2).max(100),
  currency: z.enum(["GHS", "NGN"]),
  phone: z
    .string()
    .min(9)
    .max(15)
    .regex(/^\+?[0-9]+$/),
  network: z.enum(["mtn", "vodafone", "tigo", "airtel"]),
});

export const SetPayoutMethodSchema = z.discriminatedUnion("type", [
  BankPayoutSchema,
  MobileMoneyPayoutSchema,
]);

export type SetPayoutMethodDto = z.infer<typeof SetPayoutMethodSchema>;
