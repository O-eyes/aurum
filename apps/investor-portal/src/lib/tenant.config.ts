// Brand/product config for the investor portal.
// To white-label: update these values.

export const TENANT = {
  name: 'Aurum',
  ticker: 'AUR',
  tagline: 'Physical gold, digitally owned.',

  custodian: {
    name: 'Goldbod',
    jurisdiction: 'Ghana',
    vaultAddress: '14 Independence Ave, Accra',
    pickupHours: 'Mon–Fri 9am–4pm',
    processingDays: { pickup: 3, delivery: '5–7' } as const,
    deliveryRegions: ['Greater Accra', 'Ashanti', 'Western Region'],
    insuranceNote: 'All vault holdings are insured against theft and loss.',
  },

  minimumUsd: 10,
  minimumGhs: 15,

  supportEmail: 'support@aurum.gold',

  // Fee schedule — must mirror the API (PLATFORM_FEE_PERCENT / TAX_PERCENT).
  // Used only to itemize the quote; the backend is the source of truth.
  fees: {
    platformPercent: parseFloat(process.env.NEXT_PUBLIC_PLATFORM_FEE_PERCENT ?? '1.5'),
    platformFlatUsd: parseFloat(process.env.NEXT_PUBLIC_PLATFORM_FEE_FLAT_USD ?? '0'),
    taxPercent: parseFloat(process.env.NEXT_PUBLIC_TAX_PERCENT ?? '0'),
  },
} as const;
