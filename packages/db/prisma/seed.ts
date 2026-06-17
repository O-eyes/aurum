/**
 * Seed script — creates initial admin accounts if they don't exist.
 * Run: pnpm --filter @aurum/db db:seed
 * Or:  npx ts-node prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

interface SeedAdmin {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: "ADMIN" | "COMPLIANCE" | "TREASURY";
}

const ADMINS: SeedAdmin[] = [
  {
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@aurum.finance",
    password: process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!2025",
    firstName: "Platform",
    lastName: "Admin",
    role: "ADMIN",
  },
];

async function main() {
  console.log("Seeding database…");

  for (const admin of ADMINS) {
    const existing = await prisma.user.findUnique({
      where: { email: admin.email },
    });

    if (existing) {
      if (existing.role !== admin.role) {
        await prisma.user.update({
          where: { email: admin.email },
          data: { role: admin.role },
        });
        console.log(`Updated role for ${admin.email} → ${admin.role}`);
      } else {
        console.log(`Skipping ${admin.email} (already exists)`);
      }
      continue;
    }

    const passwordHash = await bcrypt.hash(admin.password, 12);

    const user = await prisma.user.create({
      data: {
        email: admin.email,
        passwordHash,
        firstName: admin.firstName ?? null,
        lastName: admin.lastName ?? null,
        role: admin.role,
        emailVerified: true,
        kycProfile: { create: { status: "APPROVED" } },
      },
    });

    console.log(`Created ${admin.role} → ${user.email} (id: ${user.id})`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
