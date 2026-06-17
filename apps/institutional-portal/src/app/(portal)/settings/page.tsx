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
import { Sun, Moon, Trash2, Plus, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";
import { pickWalletConnector } from "@/lib/utils";
import { useAccount, useConnect, useSignMessage } from "wagmi";

const MAX_WALLETS = 5;

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

const profileSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
});
type ProfileForm = z.infer<typeof profileSchema>;

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
    queryKey: ["inst-wallets"],
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
      toast.success("Profile updated.");
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
      queryClient.invalidateQueries({ queryKey: ["inst-wallets"] });
      toast.success("Wallet removed.");
    },
    onError: () => toast.error("Failed to remove wallet"),
  });

  const handleAddWallet = async () => {
    setAddingWallet(true);
    try {
      let walletAddress = address;

      // Single-click connect: open the wallet and use the address it returns.
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
      queryClient.invalidateQueries({ queryKey: ["inst-wallets"] });
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
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
        Settings
      </h1>

      {/* Profile */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Profile
          </h2>
        </div>
        <form
          onSubmit={profileForm.handleSubmit((d) => profileMutation.mutate(d))}
          className="px-6 py-4 space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="First name"
              error={profileForm.formState.errors.firstName?.message}
            >
              <input
                className={inputCls}
                {...profileForm.register("firstName")}
              />
            </Field>
            <Field
              label="Last name"
              error={profileForm.formState.errors.lastName?.message}
            >
              <input
                className={inputCls}
                {...profileForm.register("lastName")}
              />
            </Field>
          </div>
          <Field label="Email" hint="Email cannot be changed">
            <input
              className={inputCls + " opacity-60"}
              value={user?.email ?? ""}
              disabled
            />
          </Field>
          <button
            type="submit"
            disabled={profileMutation.isPending}
            className={btnPrimary}
          >
            {profileMutation.isPending ? "Saving…" : "Save Profile"}
          </button>
        </form>
      </div>

      {/* Identity Verification (KYC) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Identity Verification
          </h2>
        </div>
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-50 dark:bg-gold-900/20">
              <ShieldCheck className="h-5 w-5 text-gold-600 dark:text-gold-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Entity KYC status
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
                  ? "Your institution is verified — trading is enabled."
                  : "Complete entity verification to enable trading."}
              </p>
            </div>
          </div>
          {user?.kycStatus !== "APPROVED" && (
            <Link
              href="/kyc"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gold-500 hover:bg-gold-600 text-white text-sm font-medium px-3.5 py-2 transition-colors"
            >
              {user?.kycStatus === "PENDING" ? "Start" : "Continue"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Password */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Change Password
          </h2>
        </div>
        <form
          onSubmit={passwordForm.handleSubmit((d) =>
            passwordMutation.mutate(d),
          )}
          className="px-6 py-4 space-y-4"
        >
          <Field
            label="Current password"
            error={passwordForm.formState.errors.currentPassword?.message}
          >
            <input
              type="password"
              className={inputCls}
              {...passwordForm.register("currentPassword")}
            />
          </Field>
          <Field
            label="New password"
            hint="Minimum 8 characters"
            error={passwordForm.formState.errors.newPassword?.message}
          >
            <input
              type="password"
              className={inputCls}
              {...passwordForm.register("newPassword")}
            />
          </Field>
          <Field
            label="Confirm new password"
            error={passwordForm.formState.errors.confirm?.message}
          >
            <input
              type="password"
              className={inputCls}
              {...passwordForm.register("confirm")}
            />
          </Field>
          <button
            type="submit"
            disabled={passwordMutation.isPending}
            className={btnPrimary}
          >
            {passwordMutation.isPending ? "Saving…" : "Change Password"}
          </button>
        </form>
      </div>

      {/* Connected Wallets */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Connected Wallets
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Up to {MAX_WALLETS} wallets · Signature required to verify
              ownership
            </p>
          </div>
          {(wallets?.length ?? 0) < MAX_WALLETS && (
            <button
              onClick={handleAddWallet}
              disabled={addingWallet}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {addingWallet ? "Connecting…" : "Add Wallet"}
            </button>
          )}
        </div>
        <div className="px-6 py-4">
          {!wallets?.length ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No wallets connected. Click "Add Wallet" and sign the verification
              message in MetaMask.
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
                      {w.address.slice(0, 10)}…{w.address.slice(-8)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">
                      {w.address}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
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
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Appearance
          </h2>
        </div>
        <div className="px-6 py-4 flex items-center justify-between">
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
            className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            Switch to {theme === "dark" ? "light" : "dark"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-500";

const btnPrimary =
  "rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-60 transition-colors";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
