"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { ToastProvider } from "@/contexts/toast-context";
import { useState } from "react";
import { createConfig, http } from "wagmi";
import { sepolia, mainnet } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const wagmiConfig = createConfig({
  chains: [sepolia, mainnet],
  connectors: [
    injected(),
    // Enables mobile wallets (QR / deep-link) where there is no injected provider
    walletConnect({
      projectId:
        process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "aurum-dev",
      showQrModal: true,
    }),
  ],
  transports: { [sepolia.id]: http(), [mainnet.id]: http() },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  );
  return (
    <ThemeProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
