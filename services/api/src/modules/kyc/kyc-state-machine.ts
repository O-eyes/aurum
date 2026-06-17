import { BadRequestException } from "@nestjs/common";
import { KycStatus, VALID_KYC_TRANSITIONS } from "@aurum/types";

export function assertValidTransition(from: KycStatus, to: KycStatus): void {
  const allowed = VALID_KYC_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new BadRequestException(
      `KYC transition ${from} → ${to} is not permitted. Allowed: [${allowed.join(", ")}]`,
    );
  }
}

export function canTransition(from: KycStatus, to: KycStatus): boolean {
  return VALID_KYC_TRANSITIONS[from].includes(to);
}
