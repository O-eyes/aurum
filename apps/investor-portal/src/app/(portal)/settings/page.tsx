"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { users, auth, request, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { useToast } from "@/contexts/toast-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, shortenAddress, pickWalletConnector } from "@/lib/utils";
import {
  Sun,
  Moon,
  Trash2,
  Wallet,
  Plus,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useAccount, useConnect, useSignMessage } from "wagmi";

const MAX_WALLETS = 3;

const KYC_BADGE: Record<string, { label: string; cls: string }> = {
  APPROVED: {
    label: "Verified",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  UNDER_REVIEW: {
    label: "In review",
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  REJECTED: {
    label: "Rejected",
    cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  NEEDS_REVIEW: {
    label: "Action needed",
    cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  PENDING: {
    label: "Not started",
    cls: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
  },
};

// Profile update
const profileSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
});
type ProfileForm = z.infer<typeof profileSchema>;

// Password change
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Required"),
    newPassword: z.string().min(8, "Min 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });
type PasswordForm = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [addingWallet, setAddingWallet] = useState(false);

  const { address, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { signMessageAsync } = useSignMessage();

  const { data: wallets } = useQuery({
    queryKey: ["wallets"],
    queryFn: users.wallets,
  });

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
    },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const profileMutation = useMutation({
    mutationFn: (data: ProfileForm) =>
      request("/users/me", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: async () => {
      await refresh();
      toast.success("Profile updated successfully.");
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Update failed"),
  });

  const passwordMutation = useMutation({
    mutationFn: (data: PasswordForm) =>
      request("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      }),
    onSuccess: () => {
      passwordForm.reset();
      toast.success("Password changed successfully.");
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Password change failed"),
  });

  const removeWalletMutation = useMutation({
    mutationFn: (walletId: string) => users.removeWallet(walletId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      toast.success("Wallet removed.");
    },
    onError: () => toast.error("Failed to remove wallet"),
  });

  const handleAddWallet = async () => {
    setAddingWallet(true);
    try {
      let walletAddress = address;

      // Single-click connect: if not already connected, open the wallet now and
      // use the address it returns — no "click again" second step.
      if (!isConnected || !walletAddress) {
        const connector = pickWalletConnector(connectors);
        if (!connector) {
          toast.error(
            "No wallet connector available. Please try again.",
            "Wallet not found",
          );
          return;
        }
        const result = await connectAsync({ connector });
        walletAddress = result.accounts[0];
      }

      if (!walletAddress) {
        toast.error("Could not read your wallet address. Please try again.");
        return;
      }

      const alreadyLinked = wallets?.some(
        (w) => w.address.toLowerCase() === walletAddress!.toLowerCase(),
      );
      if (alreadyLinked) {
        toast.warning("This wallet is already linked to your account.");
        return;
      }

      const { message } = await auth.walletChallenge(walletAddress);
      const signature = await signMessageAsync({ message });
      await auth.walletLink({ signature, message });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      toast.success("Wallet added successfully.");
    } catch (e) {
      const rejected =
        (e as any)?.code === 4001 ||
        String(e).toLowerCase().includes("user rejected");
      if (rejected) {
        toast.info("Wallet connection cancelled.");
      } else {
        toast.error(e instanceof ApiError ? e.message : "Failed to add wallet");
      }
    } finally {
      setAddingWallet(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">
      <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
        Settings
      </h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={profileForm.handleSubmit((d) =>
              profileMutation.mutate(d),
            )}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First name"
                error={profileForm.formState.errors.firstName?.message}
                {...profileForm.register("firstName")}
              />
              <Input
                label="Last name"
                error={profileForm.formState.errors.lastName?.message}
                {...profileForm.register("lastName")}
              />
            </div>
            <Input
              label="Email"
              value={user?.email ?? ""}
              disabled
              hint="Email cannot be changed"
            />
            <Button type="submit" size="sm" loading={profileMutation.isPending}>
              Save Profile
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Identity Verification (KYC) */}
      <Card>
        <CardHeader>
          <CardTitle>Identity Verification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-50 dark:bg-gold-900/20">
                <ShieldCheck className="h-4.5 w-4.5 text-gold-600 dark:text-gold-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    KYC status
                  </p>
                  {(() => {
                    const badge =
                      KYC_BADGE[user?.kycStatus ?? "PENDING"] ??
                      KYC_BADGE.PENDING;
                    return (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {user?.kycStatus === "APPROVED"
                    ? "Your identity is verified — you can buy, sell, and redeem."
                    : "Verify your identity to unlock buying, selling, and redemption."}
                </p>
              </div>
            </div>
            {user?.kycStatus !== "APPROVED" && (
              <Link
                href="/kyc"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gold-500 hover:bg-gold-600 text-white text-sm font-medium px-3.5 py-2 transition-colors"
              >
                {user?.kycStatus === "PENDING" ? "Verify now" : "Continue"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={passwordForm.handleSubmit((d) =>
              passwordMutation.mutate(d),
            )}
            className="space-y-4"
          >
            <Input
              label="Current password"
              type="password"
              error={passwordForm.formState.errors.currentPassword?.message}
              {...passwordForm.register("currentPassword")}
            />
            <Input
              label="New password"
              type="password"
              hint="Minimum 8 characters"
              error={passwordForm.formState.errors.newPassword?.message}
              {...passwordForm.register("newPassword")}
            />
            <Input
              label="Confirm new password"
              type="password"
              error={passwordForm.formState.errors.confirm?.message}
              {...passwordForm.register("confirm")}
            />
            <Button
              type="submit"
              size="sm"
              loading={passwordMutation.isPending}
            >
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Connected Wallets */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connected Wallets</CardTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Up to {MAX_WALLETS} wallets · Requires wallet signature to
                verify ownership
              </p>
            </div>
            {(wallets?.length ?? 0) < MAX_WALLETS && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleAddWallet}
                loading={addingWallet}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Wallet
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!wallets?.length ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No wallets connected. Use "Connect Wallet" on the login screen to
              link one.
            </p>
          ) : (
            <ul className="space-y-3">
              {wallets.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-mono text-gray-900 dark:text-gray-100">
                      {shortenAddress(w.address)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(w.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {w.isPrimary && (
                      <span className="text-xs bg-gold-100 dark:bg-gold-900/30 text-gold-700 dark:text-gold-400 rounded-full px-2 py-0.5">
                        Primary
                      </span>
                    )}
                    {!w.isPrimary && (
                      <button
                        onClick={() => removeWalletMutation.mutate(w.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        disabled={removeWalletMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Theme
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Currently: {theme === "dark" ? "Dark" : "Light"} mode
              </p>
            </div>
            <button
              onClick={toggle}
              className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              Switch to {theme === "dark" ? "light" : "dark"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
