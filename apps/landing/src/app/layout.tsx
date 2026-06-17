import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Aurum — Physical Gold, Digitally Owned",
  description:
    "Buy, hold, and redeem physical gold — backed by real vault holdings at Goldbod, verifiable on-chain. Pay with Mobile Money from GH₵15.",
  openGraph: {
    title: "Aurum — Physical Gold, Digitally Owned",
    description:
      "Gold-backed tokens for everyone. Buy from GH₵15 with MTN Mobile Money.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
