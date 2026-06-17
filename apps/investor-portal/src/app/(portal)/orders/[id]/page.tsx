"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  orders as ordersApi,
  payments,
  mint,
  ApiError,
  type RedemptionMetadata,
} from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/contexts/toast-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  formatUsd,
  formatDate,
  formatGhs,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from "@/lib/utils";
import { Select, type SelectOption } from "@/components/ui/select";
import { useGhsRate } from "@/hooks/useGhsRate";
import { CUSTODIAN } from "@/lib/gold";
import Link from "next/link";
import {
  ArrowLeft,
  Flame,
  ExternalLink,
  CheckCircle2,
  Circle,
  Package,
  MapPin,
} from "lucide-react";
import {
  useSendTransaction,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { cn } from "@/lib/utils";

const BURN_NEEDED = new Set(["PENDING", "BURN_PENDING"]);
const BURN_PROCESSING = new Set(["BURN_CONFIRMED", "PAYOUT_PROCESSING"]);

// Timeline steps per collection method
const PICKUP_STEPS = [
  "BURN_CONFIRMED",
  "PROCESSING",
  "READY_FOR_PICKUP",
  "COMPLETED",
] as const;
const DELIVERY_STEPS = [
  "BURN_CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
] as const;

const CANCELLABLE = new Set(["PAYMENT_PENDING", "PENDING"]);

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();

  // Buy payment state
  const [payError, setPayError] = useState("");
  const [phone, setPhone] = useState("");
  const [mobileProvider, setMobileProvider] = useState<
    "mtn" | "telecel" | "at"
  >("mtn");

  const MOBILE_OPTIONS: SelectOption[] = [
    { value: "mtn", label: "MTN Mobile Money" },
    { value: "telecel", label: "Telecel Cash" },
    { value: "at", label: "AT Money (AirtelTigo)" },
  ];

  // Cancel state
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Burn state (shared by SELL and REDEEM)
  const [burnTxHash, setBurnTxHash] = useState<`0x${string}` | undefined>();
  const hasConfirmedRef = useRef(false);

  const ghsRate = useGhsRate();

  const { data: order, isLoading } = useQuery({
    queryKey: ["orders", id],
    queryFn: () => ordersApi.get(id),
    refetchInterval: 10_000,
  });

  const { sendTransactionAsync, isPending: isSending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: txConfirmed } =
    useWaitForTransactionReceipt({ hash: burnTxHash });

  const confirmBurnMutation = useMutation({
    mutationFn: (txHash: string) => mint.confirmBurn({ orderId: id, txHash }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", id] });
      const msg =
        order?.type === "REDEEM"
          ? "Burn confirmed. Goldbod will prepare your gold — check back for status updates."
          : "Burn confirmed. Your payout will be processed within 1–2 business days.";
      toast.success(msg);
    },
    onError: (e) =>
      toast.error(
        e instanceof ApiError
          ? e.message
          : `Burn confirmed on-chain but notification failed. Contact support with tx hash: ${burnTxHash}`,
        "Confirmation error",
      ),
  });

  useEffect(() => {
    if (txConfirmed && burnTxHash && !hasConfirmedRef.current) {
      hasConfirmedRef.current = true;
      confirmBurnMutation.mutate(burnTxHash);
    }
  }, [txConfirmed, burnTxHash]);

  const burnRequestMutation = useMutation({
    mutationFn: () => mint.createBurnRequest(id),
    onSuccess: async (txData) => {
      try {
        const hash = await sendTransactionAsync({
          to: txData.to as `0x${string}`,
          data: txData.data as `0x${string}`,
          value: BigInt(txData.value || "0"),
        });
        setBurnTxHash(hash);
        toast.info("Transaction submitted. Waiting for on-chain confirmation…");
      } catch (e: any) {
        const rejected =
          e?.code === 4001 ||
          e?.message?.toLowerCase().includes("user rejected");
        toast[rejected ? "warning" : "error"](
          rejected
            ? "Transaction cancelled."
            : "Transaction failed. Check your wallet balance and try again.",
        );
      }
    },
    onError: (e) =>
      toast.error(
        e instanceof ApiError
          ? e.message
          : "Failed to prepare burn transaction",
      ),
  });

  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancel(id),
    onSuccess: () => {
      toast.success("Order cancelled.");
      router.replace("/orders");
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Failed to cancel order"),
  });

  // Buy payment mutations
  const cardPayMutation = useMutation({
    mutationFn: () =>
      payments.initiateCard(id, {
        email: user?.email ?? "",
        callbackUrl: `${window.location.origin}/dashboard`,
      }),
    onSuccess: (data) => {
      window.location.href = data.authorizationUrl;
    },
    onError: (e) =>
      setPayError(e instanceof ApiError ? e.message : "Card payment failed"),
  });

  const mobilePayMutation = useMutation({
    mutationFn: () =>
      payments.initiateMobileMoney(id, { phone, provider: mobileProvider }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", id] });
      toast.success(
        "Mobile money prompt sent. Approve it on your phone to complete payment.",
      );
    },
    onError: (e) =>
      setPayError(
        e instanceof ApiError ? e.message : "Mobile money payment failed",
      ),
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  if (!order)
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-gray-500">Order not found.</p>
      </div>
    );

  const statusColor =
    ORDER_STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700";
  const explorerBase =
    process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://etherscan.io";
  const walletMatches =
    !!address && address.toLowerCase() === order.walletAddress.toLowerCase();
  const isBurnPending = burnRequestMutation.isPending || isSending;
  const rm = order.redemptionMetadata;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href="/orders"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Order Details
        </h1>
      </div>

      {/* ── Order summary ── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>
            {order.type === "BUY"
              ? "Buy"
              : order.type === "SELL"
                ? "Sell"
                : "Redemption"}{" "}
            Order
          </CardTitle>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusColor}`}
          >
            {ORDER_STATUS_LABELS[order.status] ?? order.status}
          </span>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Order ID</dt>
              <dd className="font-mono text-xs text-gray-700 dark:text-gray-300 mt-1 break-all">
                {order.id}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Created</dt>
              <dd className="text-gray-900 dark:text-gray-100 mt-1">
                {formatDate(order.createdAt)}
              </dd>
            </div>

            {/* Redemption-specific fields */}
            {order.type === "REDEEM" && rm ? (
              <>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Gold bar</dt>
                  <dd className="text-gray-900 dark:text-gray-100 font-semibold mt-1">
                    {rm.quantity} × {rm.denomination.label}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">
                    Total weight
                  </dt>
                  <dd className="text-gray-900 dark:text-gray-100 mt-1">
                    {rm.totalWeightG.toFixed(rm.totalWeightG < 1 ? 3 : 1)}g /{" "}
                    {parseFloat(order.goldOunces).toFixed(4)} oz
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">
                    AUR to burn
                  </dt>
                  <dd className="text-gray-900 dark:text-gray-100 font-semibold mt-1">
                    {parseFloat(order.tokenAmount).toFixed(4)} AUR
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">
                    Collection
                  </dt>
                  <dd className="text-gray-900 dark:text-gray-100 mt-1 flex items-center gap-1">
                    {rm.collectionMethod === "pickup" ? (
                      <>
                        <MapPin className="h-3 w-3 text-gray-400" /> Vault
                        pickup
                      </>
                    ) : (
                      <>
                        <Package className="h-3 w-3 text-gray-400" /> Home
                        delivery
                      </>
                    )}
                  </dd>
                </div>
              </>
            ) : (
              <>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Amount</dt>
                  <dd className="text-gray-900 dark:text-gray-100 font-semibold mt-1">
                    {ghsRate
                      ? formatGhs(order.amountUsd, ghsRate)
                      : formatUsd(order.amountUsd)}
                    <p className="text-xs text-gray-400 font-normal mt-0.5">
                      {formatUsd(order.amountUsd)}
                    </p>
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">
                    Gold ounces
                  </dt>
                  <dd className="text-gray-900 dark:text-gray-100 mt-1">
                    {parseFloat(order.goldOunces).toFixed(6)} oz
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Tokens</dt>
                  <dd className="text-gray-900 dark:text-gray-100 font-semibold mt-1">
                    {parseFloat(order.tokenAmount).toFixed(4)} AUR
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">
                    Gold price at order
                  </dt>
                  <dd className="text-gray-900 dark:text-gray-100 mt-1">
                    {formatUsd(order.goldPriceUsd)}/oz
                  </dd>
                </div>
              </>
            )}

            <div className="col-span-2">
              <dt className="text-gray-500 dark:text-gray-400">
                Wallet address
              </dt>
              <dd className="font-mono text-xs text-gray-700 dark:text-gray-300 mt-1 break-all">
                {order.walletAddress}
              </dd>
            </div>

            {/* Delivery address if applicable */}
            {rm?.collectionMethod === "delivery" && rm.deliveryAddress && (
              <div className="col-span-2">
                <dt className="text-gray-500 dark:text-gray-400">
                  Delivery address
                </dt>
                <dd className="text-gray-900 dark:text-gray-100 mt-1 text-xs">
                  {rm.deliveryAddress.fullName}, {rm.deliveryAddress.street},{" "}
                  {rm.deliveryAddress.city}, {rm.deliveryAddress.country}
                </dd>
              </div>
            )}

            {rm?.collectionMethod === "pickup" && rm.preferredPickupDate && (
              <div className="col-span-2">
                <dt className="text-gray-500 dark:text-gray-400">
                  Preferred pickup date
                </dt>
                <dd className="text-gray-900 dark:text-gray-100 mt-1">
                  {rm.preferredPickupDate}
                </dd>
              </div>
            )}

            {/* Tracking */}
            {rm?.trackingNumber && (
              <div className="col-span-2">
                <dt className="text-gray-500 dark:text-gray-400">
                  Tracking number
                </dt>
                <dd className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                    {rm.trackingNumber}
                  </span>
                  {rm.trackingUrl && (
                    <a
                      href={rm.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold-600 hover:text-gold-700"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* ── BUY: payment panel ── */}
      {order.type === "BUY" && order.status === "PAYMENT_PENDING" && (
        <Card>
          <CardHeader>
            <CardTitle>Complete Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {payError && <Alert variant="error">{payError}</Alert>}
            <Button
              className="w-full"
              onClick={() => cardPayMutation.mutate()}
              loading={cardPayMutation.isPending}
            >
              Pay with Card (Paystack)
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-xs text-gray-500">
                <span className="bg-white dark:bg-gray-800 px-2">
                  or pay via mobile money
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Network
                </label>
                <Select
                  options={MOBILE_OPTIONS}
                  value={mobileProvider}
                  onChange={(v) =>
                    setMobileProvider(v as typeof mobileProvider)
                  }
                  className="mt-1"
                />
              </div>
              <Input
                label="Phone number"
                type="tel"
                placeholder="0244000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => mobilePayMutation.mutate()}
                loading={mobilePayMutation.isPending}
                disabled={!phone}
              >
                Pay with Mobile Money
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── SELL / REDEEM: burn panel ── */}
      {(order.type === "SELL" || order.type === "REDEEM") &&
        BURN_NEEDED.has(order.status) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                {order.type === "REDEEM"
                  ? "Burn Tokens to Claim Gold"
                  : "Burn Tokens to Complete Sale"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="info">
                Burn{" "}
                <strong>{parseFloat(order.tokenAmount).toFixed(4)} AUR</strong>{" "}
                from{" "}
                <span className="font-mono text-xs">
                  {order.walletAddress.slice(0, 8)}…
                  {order.walletAddress.slice(-6)}
                </span>{" "}
                to{" "}
                {order.type === "REDEEM" ? (
                  `claim your ${rm ? `${rm.quantity} × ${rm.denomination.label}` : "gold"}.`
                ) : (
                  <>
                    receive your payout of{" "}
                    {ghsRate
                      ? formatGhs(order.amountUsd, ghsRate)
                      : formatUsd(order.amountUsd)}
                    {ghsRate ? ` (${formatUsd(order.amountUsd)})` : ""}.
                  </>
                )}
              </Alert>

              {!isConnected && (
                <Alert variant="warning">
                  No wallet connected. Connect the wallet holding your AUR
                  tokens to continue.
                </Alert>
              )}
              {isConnected && !walletMatches && (
                <Alert variant="warning">
                  Wrong wallet — MetaMask shows{" "}
                  <span className="font-mono text-xs">
                    {address?.slice(0, 6)}…{address?.slice(-4)}
                  </span>
                  . Switch to{" "}
                  <span className="font-mono text-xs">
                    {order.walletAddress.slice(0, 6)}…
                    {order.walletAddress.slice(-4)}
                  </span>
                  .
                </Alert>
              )}

              {!burnTxHash && (
                <Button
                  className="w-full"
                  onClick={() => burnRequestMutation.mutate()}
                  loading={isBurnPending}
                  disabled={!isConnected || !walletMatches}
                >
                  <Flame className="mr-2 h-4 w-4" />
                  Burn {parseFloat(order.tokenAmount).toFixed(4)} AUR
                </Button>
              )}

              {burnTxHash && (
                <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    {isConfirming || confirmBurnMutation.isPending ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {isConfirming
                        ? "Waiting for block confirmation…"
                        : confirmBurnMutation.isPending
                          ? "Notifying server…"
                          : "Burn confirmed on-chain"}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <p className="font-mono text-xs text-gray-500 dark:text-gray-400 break-all flex-1">
                      {burnTxHash}
                    </p>
                    <a
                      href={`${explorerBase}/tx/${burnTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-gold-600 hover:text-gold-700 mt-0.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  {confirmBurnMutation.isSuccess && (
                    <Alert variant="success" title="Confirmed">
                      {order.type === "REDEEM"
                        ? `${CUSTODIAN.name} has been notified. Your gold will be prepared within ${CUSTODIAN.processingDays[rm?.collectionMethod ?? "pickup"]} business days.`
                        : `Payout of ${ghsRate ? formatGhs(order.amountUsd, ghsRate) : formatUsd(order.amountUsd)} will be processed within 1–2 business days.`}
                    </Alert>
                  )}
                </div>
              )}

              <p className="text-xs text-gray-400 text-center">
                Burning tokens is irreversible. Only proceed when ready to
                complete this {order.type === "REDEEM" ? "redemption" : "sale"}.
              </p>
            </CardContent>
          </Card>
        )}

      {/* ── SELL: payout processing ── */}
      {order.type === "SELL" && BURN_PROCESSING.has(order.status) && (
        <Alert variant="info" title="Payout processing">
          Your burn has been verified. Payout of{" "}
          <strong>
            {ghsRate
              ? formatGhs(order.amountUsd, ghsRate)
              : formatUsd(order.amountUsd)}
          </strong>
          {ghsRate ? ` (${formatUsd(order.amountUsd)})` : ""} is being processed
          and will arrive within 1–2 business days.
        </Alert>
      )}
      {order.type === "SELL" && order.status === "COMPLETED" && (
        <Alert variant="success" title="Payout sent">
          Your payout of{" "}
          <strong>
            {ghsRate
              ? formatGhs(order.amountUsd, ghsRate)
              : formatUsd(order.amountUsd)}
          </strong>
          {ghsRate ? ` (${formatUsd(order.amountUsd)})` : ""} has been sent.
        </Alert>
      )}

      {/* ── Cancel order ── */}
      {CANCELLABLE.has(order.status) && order.status !== "CANCELLED" && (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
            onClick={() => setConfirmCancel(true)}
          >
            Cancel Order
          </Button>
        </div>
      )}

      {/* ── REDEEM: delivery timeline ── */}
      {order.type === "REDEEM" &&
        !BURN_NEEDED.has(order.status) &&
        order.status !== "CANCELLED" && (
          <Card>
            <CardHeader>
              <CardTitle>
                {rm?.collectionMethod === "delivery"
                  ? "Delivery Status"
                  : "Collection Status"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RedemptionTimeline
                currentStatus={order.status}
                collectionMethod={rm?.collectionMethod ?? "pickup"}
              />
            </CardContent>
          </Card>
        )}
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this order?"
        description="This action cannot be undone. The order will be permanently cancelled."
        confirmLabel="Yes, cancel order"
        onConfirm={() => {
          setConfirmCancel(false);
          cancelMutation.mutate();
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}

// ── Status timeline ────────────────────────────────────────────────────────────

const STEP_LABELS: Record<string, string> = {
  BURN_CONFIRMED: "Burn verified",
  PROCESSING: "Gold being prepared",
  READY_FOR_PICKUP: "Ready for collection",
  COMPLETED: "Collected",
  SHIPPED: "In transit",
  DELIVERED: "Delivered",
};

function RedemptionTimeline({
  currentStatus,
  collectionMethod,
}: {
  currentStatus: string;
  collectionMethod: "pickup" | "delivery";
}) {
  const steps =
    collectionMethod === "delivery" ? [...DELIVERY_STEPS] : [...PICKUP_STEPS];
  const currentIdx = steps.indexOf(currentStatus as never);

  return (
    <ol className="space-y-4">
      {steps.map((step, i) => {
        const done =
          i < currentIdx ||
          (currentStatus === step && ["COMPLETED", "DELIVERED"].includes(step));
        const current = step === currentStatus && !done;
        const future = i > currentIdx;

        return (
          <li key={step} className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {done ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : current ? (
                <div className="h-5 w-5 rounded-full border-2 border-gold-500 bg-gold-100 dark:bg-gold-900/30 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-gold-500 animate-pulse" />
                </div>
              ) : (
                <Circle className="h-5 w-5 text-gray-300 dark:text-gray-600" />
              )}
            </div>
            <div>
              <p
                className={cn(
                  "text-sm font-medium",
                  done
                    ? "text-green-700 dark:text-green-400"
                    : current
                      ? "text-gold-700 dark:text-gold-400"
                      : "text-gray-400 dark:text-gray-500",
                )}
              >
                {STEP_LABELS[step] ?? step}
              </p>
              {current && step === "READY_FOR_PICKUP" && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Bring your ID to {CUSTODIAN.vaultAddress} (
                  {CUSTODIAN.pickupHours})
                </p>
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "ml-2.5 mt-5 h-4 w-px",
                  done
                    ? "bg-green-300 dark:bg-green-700"
                    : "bg-gray-200 dark:bg-gray-700",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
