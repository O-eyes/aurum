import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Pick the best wallet connector for the current device:
 * - Desktop / wallet in-app browser with an injected provider → use injected (MetaMask, etc.)
 * - Mobile browser with no injected provider → use WalletConnect (QR scan / deep-link)
 */
export function pickWalletConnector<T extends { id: string; type: string }>(
  connectors: readonly T[],
): T | undefined {
  const hasInjected =
    typeof window !== 'undefined' && typeof (window as any).ethereum !== 'undefined';

  if (hasInjected) {
    return connectors.find((c) => c.id === 'injected' || c.type === 'injected') ?? connectors[0];
  }
  return (
    connectors.find((c) => c.id === 'walletConnect' || c.type === 'walletConnect') ??
    connectors[0]
  );
}

export function formatUsd(value: string | number, decimals = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatGhs(usdAmount: string | number, ghsPerUsd: number, decimals = 2): string {
  const usd = typeof usdAmount === 'string' ? parseFloat(usdAmount) : usdAmount;
  const ghs = usd * ghsPerUsd;
  return `GH₵${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(ghs)}`;
}

export function formatGhsDirect(ghsAmount: string | number, decimals = 2): string {
  const ghs = typeof ghsAmount === 'string' ? parseFloat(ghsAmount) : ghsAmount;
  return `GH₵${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(ghs)}`;
}

export function formatOz(value: string | number, decimals = 6): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `${num.toFixed(decimals)} oz`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  // Buy-side
  PENDING: 'Pending',
  PAYMENT_PENDING: 'Awaiting Payment',
  PAYMENT_CONFIRMED: 'Payment Confirmed',
  MINTING: 'Minting',
  // Sell-side
  BURN_PENDING: 'Awaiting Token Burn',
  BURN_CONFIRMED: 'Burn Confirmed',
  PAYOUT_PROCESSING: 'Payout Processing',
  // Redeem-side
  PROCESSING: 'Preparing Gold',
  READY_FOR_PICKUP: 'Ready for Pickup',
  SHIPPED: 'In Transit',
  DELIVERED: 'Delivered',
  // Common
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
  COMPLIANCE_HOLD: 'Compliance Hold',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  // Buy-side
  PENDING: 'bg-gray-100 text-gray-700',
  PAYMENT_PENDING: 'bg-yellow-100 text-yellow-800',
  PAYMENT_CONFIRMED: 'bg-blue-100 text-blue-800',
  MINTING: 'bg-purple-100 text-purple-800',
  // Sell-side
  BURN_PENDING: 'bg-orange-100 text-orange-800',
  BURN_CONFIRMED: 'bg-blue-100 text-blue-800',
  PAYOUT_PROCESSING: 'bg-purple-100 text-purple-800',
  // Redeem-side
  PROCESSING: 'bg-purple-100 text-purple-800',
  READY_FOR_PICKUP: 'bg-teal-100 text-teal-800',
  SHIPPED: 'bg-blue-100 text-blue-800',
  DELIVERED: 'bg-green-100 text-green-800',
  // Common
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-500',
  FAILED: 'bg-red-100 text-red-800',
  COMPLIANCE_HOLD: 'bg-orange-100 text-orange-800',
};

export const KYC_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Not Started',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  NEEDS_REVIEW: 'Additional Info Required',
};
