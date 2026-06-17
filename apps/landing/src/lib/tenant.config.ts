// Single source of truth for brand/product config.
// To white-label: update these values + CSS variables in globals.css.

export const TENANT = {
  name: "Aurum",
  ticker: "AUR",
  tagline: "Physical gold, digitally owned.",
  description:
    "Buy, hold, and redeem physical gold — backed by real vault holdings, on-chain transparent.",

  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  investorPortalUrl:
    process.env.NEXT_PUBLIC_INVESTOR_URL ?? "http://localhost:3001",
  institutionalPortalUrl:
    process.env.NEXT_PUBLIC_INSTITUTIONAL_URL ?? "http://localhost:3002",

  custodian: {
    name: "Goldbod",
    jurisdiction: "Ghana",
    insuranceNote: "Vault holdings are insured against theft and loss.",
  },

  minimumUsd: 10,
  minimumGhs: 15,

  paymentMethods: [
    "MTN Mobile Money",
    "Telecel Cash",
    "AT Money (AirtelTigo)",
    "Card via Paystack",
  ],

  social: {
    twitter: "#",
    telegram: "#",
    email: "hello@aurum.gold",
  },
} as const;
