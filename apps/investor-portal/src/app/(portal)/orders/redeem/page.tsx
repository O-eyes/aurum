"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { orders as ordersApi, users, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/contexts/toast-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatUsd, generateIdempotencyKey } from "@/lib/utils";
import {
  GOLD_DENOMINATIONS,
  CUSTODIAN,
  ID_TYPES,
  type GoldDenomination,
} from "@/lib/gold";
import { Select, type SelectOption } from "@/components/ui/select";
import { useAccount } from "wagmi";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Min pickup date: 5 calendar days (covers 3–5 business days)
function minPickupDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  return d.toISOString().split("T")[0];
}

const schema = z
  .object({
    walletAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Enter a valid wallet address"),
    collectionMethod: z.enum(["pickup", "delivery"]),
    idType: z.enum(["passport", "national_id", "drivers_licence"], {
      required_error: "Select ID type",
    }),
    idNumber: z.string().min(3, "ID number required"),
    preferredPickupDate: z.string().optional(),
    fullName: z.string().optional(),
    phone: z.string().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.collectionMethod === "pickup") {
      if (!d.preferredPickupDate)
        ctx.addIssue({
          path: ["preferredPickupDate"],
          message: "Select a preferred pickup date",
          code: z.ZodIssueCode.custom,
        });
    }
    if (d.collectionMethod === "delivery") {
      if (!d.fullName || d.fullName.length < 2)
        ctx.addIssue({
          path: ["fullName"],
          message: "Full name required",
          code: z.ZodIssueCode.custom,
        });
      if (!d.phone || d.phone.length < 9)
        ctx.addIssue({
          path: ["phone"],
          message: "Phone number required",
          code: z.ZodIssueCode.custom,
        });
      if (!d.street || d.street.length < 3)
        ctx.addIssue({
          path: ["street"],
          message: "Street address required",
          code: z.ZodIssueCode.custom,
        });
      if (!d.city || d.city.length < 2)
        ctx.addIssue({
          path: ["city"],
          message: "City required",
          code: z.ZodIssueCode.custom,
        });
      if (!d.country || d.country.length < 2)
        ctx.addIssue({
          path: ["country"],
          message: "Country required",
          code: z.ZodIssueCode.custom,
        });
    }
  });

type FormData = z.infer<typeof schema>;

export default function RedeemPage() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const { address } = useAccount();

  const [selectedDenom, setSelectedDenom] = useState<GoldDenomination | null>(
    null,
  );
  const [quantity, setQuantity] = useState(1);
  const [denomError, setDenomError] = useState("");
  const [pendingRequest, setPendingRequest] = useState<FormData | null>(null);

  const { data: balance } = useQuery({
    queryKey: ["balance"],
    queryFn: users.balance,
  });
  const goldPriceUsd = parseFloat(balance?.goldPriceUsd ?? "0");
  const tokenBalance = parseFloat(balance?.balance ?? "0");

  const totalOz = selectedDenom ? selectedDenom.ozEquiv * quantity : 0;
  const totalWeightG = selectedDenom ? selectedDenom.weightG * quantity : 0;
  const totalValueUsd = goldPriceUsd ? totalOz * goldPriceUsd : 0;
  const hasEnoughBalance = tokenBalance >= totalOz;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      walletAddress: address ?? "",
      collectionMethod: "pickup",
      country: "Ghana",
    },
  });

  const collectionMethod = watch("collectionMethod");
  const idType = watch("idType");

  const ID_TYPE_OPTIONS: SelectOption[] = ID_TYPES.map((t) => ({
    value: t.value,
    label: t.label,
  }));

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      if (!selectedDenom) throw new Error("No denomination selected");
      return ordersApi.createRedemption({
        denomination: {
          weightG: selectedDenom.weightG,
          label: selectedDenom.label,
        },
        quantity,
        walletAddress: data.walletAddress,
        collectionMethod: data.collectionMethod,
        preferredPickupDate: data.preferredPickupDate,
        idType: data.idType,
        idNumber: data.idNumber,
        deliveryAddress:
          data.collectionMethod === "delivery"
            ? {
                fullName: data.fullName!,
                phone: data.phone!,
                street: data.street!,
                city: data.city!,
                country: data.country!,
                postalCode: data.postalCode,
              }
            : undefined,
        idempotencyKey: generateIdempotencyKey(),
      });
    },
    onSuccess: (order) => {
      toast.success(
        "Redemption request submitted. Proceed to burn your tokens.",
      );
      router.push(`/orders/${order.id}`);
    },
    onError: (e) =>
      toast.error(
        e instanceof ApiError
          ? e.message
          : "Failed to submit redemption request",
      ),
  });

  function onSubmit(data: FormData) {
    if (!selectedDenom) {
      setDenomError("Select a denomination to continue");
      return;
    }
    if (!hasEnoughBalance) {
      return;
    }
    setPendingRequest(data);
  }

  const idTypeLabel =
    ID_TYPES.find((t) => t.value === watch("idType"))?.label ?? "";
  const confirmDescription =
    pendingRequest && selectedDenom
      ? [
          `Redeem ${quantity} × ${selectedDenom.label} (${totalWeightG.toFixed(1)}g / ${totalOz.toFixed(4)} oz).`,
          `AUR to burn: ${totalOz.toFixed(4)} from wallet ${pendingRequest.walletAddress.slice(0, 8)}…${pendingRequest.walletAddress.slice(-6)}.`,
          "",
          collectionMethod === "pickup"
            ? `Pickup at ${CUSTODIAN.vaultAddress} from ${pendingRequest.preferredPickupDate ?? "your selected date"}.`
            : `Delivery to ${pendingRequest.fullName}, ${pendingRequest.street}, ${pendingRequest.city}, ${pendingRequest.country}.`,
          "",
          `Processing: ${CUSTODIAN.processingDays[collectionMethod]} business days after burn is confirmed.`,
          `Bring your ${idTypeLabel} (${pendingRequest.idNumber}) for verification.`,
        ].join("\n")
      : "";

  const kycApproved = user?.kycStatus === "APPROVED";

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
          Redeem Physical Gold
        </h1>
      </div>

      {!kycApproved && (
        <Alert variant="warning" title="KYC required">
          Complete identity verification before redeeming.{" "}
          <Link href="/kyc" className="font-medium underline">
            Verify now →
          </Link>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-3">
            {/* Denomination selector */}
            <Card>
              <CardHeader>
                <CardTitle>Select Gold Bar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {GOLD_DENOMINATIONS.map((denom) => {
                    const approxUsd = goldPriceUsd
                      ? denom.ozEquiv * goldPriceUsd
                      : null;
                    const selected = selectedDenom?.weightG === denom.weightG;
                    return (
                      <button
                        key={denom.weightG}
                        type="button"
                        onClick={() => {
                          setSelectedDenom(denom);
                          setDenomError("");
                          setQuantity(1);
                        }}
                        className={cn(
                          "flex flex-col items-center rounded-xl border p-3 text-center transition-all",
                          selected
                            ? "border-gold-500 bg-gold-50 dark:bg-gold-900/20 ring-2 ring-gold-400"
                            : "border-gray-200 dark:border-gray-700 hover:border-gold-300 dark:hover:border-gold-700",
                        )}
                      >
                        <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                          {denom.weightG >= 1000
                            ? `${denom.weightG / 1000}kg`
                            : denom.weightG === 31.1035
                              ? "1oz"
                              : `${denom.weightG}g`}
                        </span>
                        <span className="text-xs text-gray-400 mt-0.5">
                          {denom.ozEquiv.toFixed(4)} oz
                        </span>
                        {approxUsd && (
                          <span className="text-xs font-medium text-gold-600 dark:text-gold-400 mt-1">
                            ≈{formatUsd(approxUsd, 0)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {denomError && (
                  <p className="text-sm text-red-500">{denomError}</p>
                )}

                {/* Quantity stepper */}
                {selectedDenom && (
                  <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {selectedDenom.label}
                      </p>
                      <p className="text-xs text-gray-400">
                        {selectedDenom.ozEquiv.toFixed(4)} troy oz each
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-base font-semibold text-gray-900 dark:text-gray-100">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => q + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {selectedDenom && !hasEnoughBalance && (
                  <Alert variant="warning">
                    Insufficient balance. You need {totalOz.toFixed(4)} AUR but
                    hold {tokenBalance.toFixed(4)} AUR.
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Collection details */}
            <Card>
              <CardHeader>
                <CardTitle>Collection Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Method toggle */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "pickup", label: "Vault Pickup", icon: MapPin },
                    {
                      value: "delivery",
                      label: "Home Delivery",
                      icon: Package,
                    },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setValue(
                          "collectionMethod",
                          value as "pickup" | "delivery",
                        )
                      }
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
                        collectionMethod === value
                          ? "border-gold-500 bg-gold-50 text-gold-700 dark:bg-gold-900/20 dark:text-gold-400"
                          : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Pickup details */}
                {collectionMethod === "pickup" && (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-4 py-3 text-sm">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {CUSTODIAN.vaultAddress}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 mt-0.5">
                        {CUSTODIAN.pickupHours}
                      </p>
                    </div>
                    <Input
                      label="Preferred pickup date"
                      type="date"
                      min={minPickupDate()}
                      error={errors.preferredPickupDate?.message}
                      {...register("preferredPickupDate")}
                    />
                  </div>
                )}

                {/* Delivery details */}
                {collectionMethod === "delivery" && (
                  <div className="space-y-3">
                    <Alert variant="info">
                      Delivery within Ghana. Gold is fully insured in transit.{" "}
                      {CUSTODIAN.processingDays.delivery} business days after
                      burn confirmation.
                    </Alert>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Full name"
                        placeholder="Name for delivery"
                        error={errors.fullName?.message}
                        {...register("fullName")}
                      />
                      <Input
                        label="Phone number"
                        type="tel"
                        placeholder="0244000000"
                        error={errors.phone?.message}
                        {...register("phone")}
                      />
                    </div>
                    <Input
                      label="Street address"
                      placeholder="House / road / area"
                      error={errors.street?.message}
                      {...register("street")}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="City"
                        error={errors.city?.message}
                        {...register("city")}
                      />
                      <Input
                        label="Country"
                        error={errors.country?.message}
                        {...register("country")}
                      />
                    </div>
                    <Input
                      label="Postal code"
                      hint="Optional"
                      {...register("postalCode")}
                    />
                  </div>
                )}

                {/* ID verification — always required */}
                <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-gray-400" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Identity verification at{" "}
                      {collectionMethod === "pickup"
                        ? "collection"
                        : "delivery"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        ID type
                      </label>
                      <Select
                        options={ID_TYPE_OPTIONS}
                        value={idType ?? ""}
                        onChange={(v) =>
                          setValue("idType", v as FormData["idType"], {
                            shouldValidate: true,
                          })
                        }
                        placeholder="Select…"
                        className="mt-0"
                      />
                      {errors.idType && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.idType.message}
                        </p>
                      )}
                    </div>
                    <Input
                      label="ID number"
                      placeholder="Document number"
                      error={errors.idNumber?.message}
                      {...register("idNumber")}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: summary */}
          <div className="lg:col-span-2">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Redemption Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {selectedDenom ? (
                  <>
                    <Row
                      label="Bar"
                      value={`${quantity} × ${selectedDenom.label}`}
                    />
                    <Row
                      label="Total weight"
                      value={`${totalWeightG.toFixed(totalWeightG < 1 ? 3 : 1)}g / ${totalOz.toFixed(4)} oz`}
                    />
                    <Row
                      label="AUR to burn"
                      value={`${totalOz.toFixed(4)} AUR`}
                      bold
                    />
                    {goldPriceUsd > 0 && (
                      <Row
                        label="Est. value"
                        value={formatUsd(totalValueUsd)}
                      />
                    )}
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                      <Row
                        label="Collection"
                        value={
                          collectionMethod === "pickup"
                            ? "Vault Pickup"
                            : "Home Delivery"
                        }
                      />
                      <Row
                        label="Processing"
                        value={`${CUSTODIAN.processingDays[collectionMethod]} business days`}
                      />
                      {collectionMethod === "delivery" && (
                        <Row label="Insurance" value="Included" />
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">
                    Select a denomination to see summary
                  </p>
                )}

                {/* Wallet to burn from */}
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
                  <Input
                    label="Wallet to burn from"
                    placeholder="0x…"
                    error={errors.walletAddress?.message}
                    {...register("walletAddress")}
                  />
                  {address && (
                    <button
                      type="button"
                      className="text-xs text-gold-600 hover:underline"
                      onClick={() => setValue("walletAddress", address)}
                    >
                      Use connected wallet ({address.slice(0, 6)}…
                      {address.slice(-4)})
                    </button>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full mt-2"
                  disabled={!kycApproved || !selectedDenom || !hasEnoughBalance}
                >
                  Review Request
                </Button>

                {selectedDenom && hasEnoughBalance && (
                  <p className="text-xs text-gray-400 text-center">
                    Your balance after redemption:{" "}
                    {(tokenBalance - totalOz).toFixed(4)} AUR
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={!!pendingRequest}
        title="Confirm redemption request"
        description={confirmDescription}
        confirmLabel="Submit Redemption"
        onConfirm={() => {
          if (pendingRequest) mutation.mutate(pendingRequest);
          setPendingRequest(null);
        }}
        onCancel={() => setPendingRequest(null)}
      />
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span
        className={cn(
          "text-gray-900 dark:text-gray-100",
          bold && "font-semibold",
        )}
      >
        {value}
      </span>
    </div>
  );
}
