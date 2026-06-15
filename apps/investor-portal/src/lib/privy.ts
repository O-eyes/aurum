/**
 * Privy embedded-wallet configuration.
 *
 * Activation is gated on NEXT_PUBLIC_PRIVY_APP_ID. When it is unset (e.g. local
 * dev without a Privy account), the app falls back to the bring-your-own-wallet
 * flow so nothing breaks. Set the env var to switch on auto-created embedded
 * wallets for mainstream users.
 */
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

export const isPrivyEnabled = (): boolean => PRIVY_APP_ID.length > 0;

// Chain the embedded wallet operates on (must match NEXT_PUBLIC_CHAIN_ID).
export const PRIVY_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? '11155111', 10);
