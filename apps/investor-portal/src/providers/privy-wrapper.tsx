'use client';

import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
import { mainnet, polygon, polygonAmoy, sepolia } from 'viem/chains';
import { PRIVY_APP_ID, PRIVY_CHAIN_ID, isPrivyEnabled } from '@/lib/privy';
import {
  EmbeddedWalletContext,
  type EmbeddedWalletState,
} from '@/contexts/embedded-wallet-context';

function resolveChain() {
  switch (PRIVY_CHAIN_ID) {
    case 137:
      return polygon;
    case 80002:
      return polygonAmoy;
    case 1:
      return mainnet;
    default:
      return sepolia;
  }
}

/**
 * Lives inside PrivyProvider, so the Privy hooks are safe to call here. Bridges
 * the embedded wallet into our own EmbeddedWalletContext for the rest of the app.
 */
function PrivyWalletBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  const embedded = wallets.find((w) => w.walletClientType === 'privy') ?? wallets[0];

  const value: EmbeddedWalletState = {
    enabled: true,
    ready,
    address: authenticated && embedded ? embedded.address : null,
    setup: login,
  };

  return <EmbeddedWalletContext.Provider value={value}>{children}</EmbeddedWalletContext.Provider>;
}

/**
 * Wraps the app in Privy only when an app ID is configured. Embedded wallets are
 * auto-created for users who don't already have one, so mainstream users never
 * see a seed phrase. When disabled, children render unchanged (the context
 * defaults to inert and the bring-your-own-wallet flow is used).
 */
export function PrivyWrapper({ children }: { children: React.ReactNode }) {
  if (!isPrivyEnabled()) return <>{children}</>;

  const chain = resolveChain();

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['sms', 'email'],
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
          showWalletUIs: false,
        },
        appearance: {
          theme: 'light',
          accentColor: '#d97706', // gold-600
          logo: '/icon.svg',
        },
        defaultChain: chain,
        supportedChains: [chain],
      }}
    >
      <PrivyWalletBridge>{children}</PrivyWalletBridge>
    </PrivyProvider>
  );
}
