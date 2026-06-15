import { BadRequestException } from '@nestjs/common';
import { OrderStatus, VALID_ORDER_TRANSITIONS } from '@aurum/types';

export function assertValidOrderTransition(from: OrderStatus, to: OrderStatus): void {
  const allowed = VALID_ORDER_TRANSITIONS[from];
  if (!allowed?.includes(to)) {
    throw new BadRequestException(
      `Order transition ${from} → ${to} is not permitted.`,
    );
  }
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}
