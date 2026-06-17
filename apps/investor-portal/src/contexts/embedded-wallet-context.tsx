"use client";

import { createContext, useContext } from "react";

export interface EmbeddedWalletState {
  /** Embedded wallets are configured (Privy app ID present). */
  enabled: boolean;
  /** Privy finished initialising (always true when disabled). */
  ready: boolean;
  /** The user's embedded wallet address, once provisioned. */
  address: string | null;
  /** Trigger Privy login → auto-creates the embedded wallet. */
  setup: () => void;
}

const INERT: EmbeddedWalletState = {
  enabled: false,
  ready: true,
  address: null,
  setup: () => {},
};

export const EmbeddedWalletContext = createContext<EmbeddedWalletState>(INERT);

/**
 * Returns the user's auto-created embedded wallet state. Safe everywhere — when
 * Privy is disabled it yields an inert state and the app uses the
 * bring-your-own-wallet flow. The actual Privy hooks are only called inside the
 * provider (see PrivyWrapper), so this never throws out of context.
 */
export function useEmbeddedWallet(): EmbeddedWalletState {
  return useContext(EmbeddedWalletContext);
}
