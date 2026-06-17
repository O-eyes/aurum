"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { orders as ordersApi, users, reserve, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/contexts/toast-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  formatUsd,
  formatOz,
  formatGhs,
  formatGhsDirect,
  generateIdempotencyKey,
} from "@/lib/utils";
import { useGhsRate } from "@/hooks/useGhsRate";
import { useEmbeddedWallet } from "@/contexts/embedded-wallet-context";
import { TENANT } from "@/lib/tenant.config";
import { useAccount } from "wagmi";
import Link from "next/link";
import { ArrowLeft, Wallet, ShieldCheck } from "lucide-react";

const GHS_PRESETS = [100, 500, 1_000, 2_500, 5_000];

const schema = z.object({
  amountGhs: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid cedis amount (e.g. 250.00)")
    .refine(
      (v) => parseFloat(v) >= TENANT.minimumGhs,
      `Minimum is GH₵${TENANT.minimumGhs}`,
    ),
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Enter a valid Ethereum wallet address"),
});

type FormData = z.infer<typeof schema>;

export default function BuyPage() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const { address } = useAccount();
  const [pendingOrder, setPendingOrder] = useState<FormData | null>(null);

  const { data: balance } = useQuery({
    queryKey: ["balance"],
    queryFn: users.balance,
  });
  const { data: snapshot } = useQuery({
    queryKey: ["reserve-snapshot"],
    queryFn: reserve.latest,
    staleTime: 55_000,
  });

  const goldPriceUsd = parseFloat(balance?.goldPriceUsd ?? "0");
  const ghsRate = useGhsRate();
  const embeddedWallet = useEmbeddedWallet();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { walletAddress: address ?? "" },
  });

  // With embedded wallets on, the user's auto-created wallet is the mint target —
  // keep the form field in sync so they never type or paste an address.
  useEffect(() => {
    if (embeddedWallet.enabled && embeddedWallet.address) {
      setValue("walletAddress", embeddedWallet.address, {
        shouldValidate: true,
      });
    }
  }, [embeddedWallet.enabled, embeddedWallet.address, setValue]);

  const amountGhs = watch("amountGhs");
  const amountUsd =
    ghsRate && amountGhs ? parseFloat(amountGhs) / ghsRate : null;

  // Fee-inclusive quote: platform fee + tax come out of the amount paid; the
  // remainder is the gold cost. Mirrors the API's computeBuyBreakdown.
  const grossGhs = amountGhs ? parseFloat(amountGhs) : 0;
  const platformFeeGhs = grossGhs
    ? grossGhs * (TENANT.fees.platformPercent / 100) +
      (ghsRate ? TENANT.fees.platformFlatUsd * ghsRate : 0)
    : 0;
  const taxGhs = platformFeeGhs * (TENANT.fees.taxPercent / 100);
  const goldCostGhs = Math.max(grossGhs - platformFeeGhs - taxGhs, 0);
  const goldCostUsd = ghsRate ? goldCostGhs / ghsRate : null;
  const estimatedOz =
    goldPriceUsd && goldCostUsd ? goldCostUsd / goldPriceUsd : null;

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      if (!ghsRate)
        throw new Error("Exchange rate unavailable. Please try again shortly.");
      const usd = (parseFloat(data.amountGhs) / ghsRate).toFixed(2);
      return ordersApi.create({
        type: "BUY",
        amountUsd: usd,
        walletAddress: data.walletAddress,
        idempotencyKey: generateIdempotencyKey(),
      });
    },
    onSuccess: (order) => {
      toast.success("Order created — proceed to payment.", "Buy order placed");
      router.push(`/orders/${order.id}`);
    },
    onError: (e) => {
      toast.error(
        e instanceof ApiError
          ? e.message
          : (e as Error).message || "Failed to create order",
        "Order failed",
      );
    },
  });

  const kycApproved = user?.kycStatus === "APPROVED";

  const confirmAmountGhs = pendingOrder
    ? parseFloat(pendingOrder.amountGhs)
    : 0;
  const confirmAmountUsd = ghsRate ? confirmAmountGhs / ghsRate : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Buy Gold Tokens
        </h1>
      </div>

      {!kycApproved && (
        <Alert variant="warning" title="KYC required">
          Complete identity verification before placing orders.{" "}
          <Link href="/kyc" className="font-medium underline">
            Verify now →
          </Link>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit((data) => setPendingOrder(data))}
              className="space-y-4"
            >
              <div>
                <Input
                  label="Amount (GH₵)"
                  type="number"
                  step="0.01"
                  min={TENANT.minimumGhs}
                  placeholder="250.00"
                  hint={
                    amountUsd
                      ? `≈ ${formatUsd(amountUsd)} · ${estimatedOz ? formatOz(estimatedOz, 4) : "—"}`
                      : !ghsRate
                        ? "Loading exchange rate…"
                        : `Minimum GH₵${TENANT.minimumGhs}`
                  }
                  error={errors.amountGhs?.message}
                  {...register("amountGhs")}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {GHS_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        setValue("amountGhs", String(p), {
                          shouldValidate: true,
                        })
                      }
                      className="rounded-md border border-gray-200 dark:border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:border-gold-400 hover:text-gold-600 dark:hover:border-gold-500 dark:hover:text-gold-400 transition-colors"
                    >
                      GH₵{p.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
              {embeddedWallet.enabled ? (
                embeddedWallet.address ? (
                  // Auto-created wallet — no address entry needed.
                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                          Your secure Aurum wallet
                        </p>
                        <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 font-mono truncate">
                          {embeddedWallet.address.slice(0, 10)}…
                          {embeddedWallet.address.slice(-6)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      Tokens are minted here automatically — no setup needed.
                    </p>
                  </div>
                ) : (
                  // Privy enabled but wallet not provisioned yet.
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-3 text-center">
                    <Wallet className="h-5 w-5 text-gold-500 mx-auto mb-1.5" />
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      Set up your secure wallet to receive gold tokens.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={embeddedWallet.setup}
                      disabled={!embeddedWallet.ready}
                    >
                      Set up wallet
                    </Button>
                  </div>
                )
              ) : (
                // Bring-your-own-wallet fallback (Privy not configured).
                <div>
                  <Input
                    label="Delivery wallet address"
                    placeholder="0x..."
                    hint="Tokens will be minted to this address"
                    error={errors.walletAddress?.message}
                    {...register("walletAddress")}
                  />
                  {address && (
                    <button
                      type="button"
                      className="mt-1 text-xs text-gold-600 hover:underline"
                      onClick={() => setValue("walletAddress", address)}
                    >
                      Use connected wallet ({address.slice(0, 6)}…
                      {address.slice(-4)})
                    </button>
                  )}
                </div>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={
                  !kycApproved ||
                  (embeddedWallet.enabled && !embeddedWallet.address)
                }
              >
                Review Order
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row
                label="Gold price"
                value={goldPriceUsd ? formatUsd(goldPriceUsd) + "/oz" : "—"}
              />
              <Row
                label="You pay"
                value={amountGhs ? formatGhsDirect(amountGhs) : "—"}
                sub={amountUsd ? `≈ ${formatUsd(amountUsd)}` : undefined}
                bold
              />
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
                <Row
                  label={`Platform fee (${TENANT.fees.platformPercent}%)`}
                  value={
                    grossGhs
                      ? `− ${formatGhsDirect(platformFeeGhs.toFixed(2))}`
                      : "—"
                  }
                />
                {TENANT.fees.taxPercent > 0 && (
                  <Row
                    label={`Tax (${TENANT.fees.taxPercent}%)`}
                    value={
                      grossGhs ? `− ${formatGhsDirect(taxGhs.toFixed(2))}` : "—"
                    }
                  />
                )}
                <Row
                  label="Gold cost"
                  value={
                    grossGhs ? formatGhsDirect(goldCostGhs.toFixed(2)) : "—"
                  }
                  sub={goldCostUsd ? `≈ ${formatUsd(goldCostUsd)}` : undefined}
                />
              </div>
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
                <Row
                  label="Gold (est.)"
                  value={estimatedOz ? formatOz(estimatedOz) : "—"}
                />
                <Row
                  label="AUR tokens"
                  value={estimatedOz ? `${estimatedOz.toFixed(6)} AUR` : "—"}
                  highlight
                  bold
                />
              </div>
            </CardContent>
          </Card>

          {snapshot && (
            <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
              <CardContent className="pt-4 space-y-3">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                  Live Proof of Reserve
                </p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    {
                      label: "Collateral Ratio",
                      value: `${(parseFloat(snapshot.backingRatio) * 100).toFixed(2)}%`,
                    },
                    {
                      label: "Gold in Reserve",
                      value: `${parseFloat(snapshot.goldHeldOz).toFixed(2)} oz`,
                    },
                    {
                      label: "Circulating",
                      value: `${parseFloat(snapshot.tokenSupply).toFixed(2)} AUR`,
                    },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="text-xs text-emerald-600 dark:text-emerald-500">
                        {s.label}
                      </p>
                      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-500 text-center">
                  Every token is backed by physical gold before it is minted.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingOrder}
        title="Confirm buy order"
        description={
          pendingOrder
            ? `Buy ${formatGhsDirect(pendingOrder.amountGhs)} of AUR tokens (≈ ${formatUsd(confirmAmountUsd)}, ~${estimatedOz?.toFixed(4) ?? "?"} AUR). You will be redirected to complete payment.`
            : ""
        }
        confirmLabel="Place Order"
        onConfirm={() => {
          if (pendingOrder) mutation.mutate(pendingOrder);
          setPendingOrder(null);
        }}
        onCancel={() => setPendingOrder(null)}
      />
    </div>
  );
}

function Row({
  label,
  value,
  sub,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <div className="text-right">
        <span
          className={`${bold ? "font-semibold" : ""} ${highlight ? "text-gold-600 dark:text-gold-400" : "text-gray-900 dark:text-gray-100"}`}
        >
          {value}
        </span>
        {sub && <p className="text-xs text-gray-400 mt-0">{sub}</p>}
      </div>
    </div>
  );
}
