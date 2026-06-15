import { createConfig, http } from 'wagmi';
import { mainnet, sepolia, polygon } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? '11155111', 10);

const activeChain = chainId === 1 ? mainnet : chainId === 137 ? polygon : sepolia;

export const wagmiConfig = createConfig({
  // Server-render safe: avoids touching localStorage/indexedDB during SSR
  // (the connector stores are browser-only) and hydrates on the client.
  ssr: true,
  chains: [activeChain],
  connectors: [
    injected(),
    // Enables mobile wallets (QR / deep-link) where there is no injected
    // provider. WalletConnect spins up an indexedDB-backed store on init,
    // which is browser-only — gate it so it never runs during SSR/export.
    ...(typeof window !== 'undefined'
      ? [
          walletConnect({
            projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'aurum-dev',
            showQrModal: true,
          }),
        ]
      : []),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [polygon.id]: http(),
  },
});
