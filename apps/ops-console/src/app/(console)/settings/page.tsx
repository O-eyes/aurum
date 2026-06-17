"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { request, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { useToast } from "@/contexts/toast-context";
import { Sun, Moon } from "lucide-react";

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

const ROLE_META: Record<string, { label: string; color: string }> = {
  ADMIN: { label: "Full access", color: "bg-red-900/40 text-red-400" },
  COMPLIANCE: { label: "KYC & audit", color: "bg-blue-900/40 text-blue-400" },
  TREASURY: { label: "Reserve ops", color: "bg-yellow-900/40 text-yellow-400" },
};

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

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
      reset();
      toast.success("Password changed successfully.");
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Password change failed"),
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">
      <h1 className="text-lg font-bold text-gray-100">Settings</h1>

      {/* Profile — read-only */}
      <div className="bg-gray-800 dark:bg-gray-800 rounded-xl border border-gray-700 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200">Profile</h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">First name</p>
              <p className="text-sm text-gray-200">{user?.firstName ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Last name</p>
              <p className="text-sm text-gray-200">{user?.lastName ?? "—"}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Email</p>
            <p className="text-sm text-gray-200">{user?.email}</p>
          </div>
          <p className="text-xs text-gray-500">
            Profile details are managed by the system administrator.
          </p>
        </div>
      </div>

      {/* Roles */}
      <div className="bg-gray-800 dark:bg-gray-800 rounded-xl border border-gray-700 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200">
            Roles &amp; Permissions
          </h2>
        </div>
        <div className="px-6 py-4 space-y-3">
          {user?.roles?.map((role) => {
            const meta = ROLE_META[role];
            return (
              <div
                key={role}
                className="flex items-center justify-between rounded-lg border border-gray-700 px-4 py-3"
              >
                <span className="text-sm text-gray-200">{role}</span>
                {meta && (
                  <span
                    className={`text-xs rounded-full px-2 py-0.5 ${meta.color}`}
                  >
                    {meta.label}
                  </span>
                )}
              </div>
            );
          })}
          <p className="text-xs text-gray-500">
            Role changes require an administrator.
          </p>
        </div>
      </div>

      {/* Password */}
      <div className="bg-gray-800 dark:bg-gray-800 rounded-xl border border-gray-700 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200">
            Change Password
          </h2>
        </div>
        <form
          onSubmit={handleSubmit((d) => passwordMutation.mutate(d))}
          className="px-6 py-4 space-y-4"
        >
          <Field
            label="Current password"
            error={errors.currentPassword?.message}
          >
            <input
              type="password"
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register("currentPassword")}
            />
          </Field>
          <Field
            label="New password"
            error={errors.newPassword?.message}
            hint="Minimum 8 characters"
          >
            <input
              type="password"
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register("newPassword")}
            />
          </Field>
          <Field label="Confirm new password" error={errors.confirm?.message}>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register("confirm")}
            />
          </Field>
          <button
            type="submit"
            disabled={passwordMutation.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-60 transition-colors"
          >
            {passwordMutation.isPending ? "Saving…" : "Change Password"}
          </button>
        </form>
      </div>

      {/* Appearance */}
      <div className="bg-gray-800 dark:bg-gray-800 rounded-xl border border-gray-700 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200">Appearance</h2>
        </div>
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-200">Theme</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Currently: {theme === "dark" ? "Dark" : "Light"} mode
            </p>
          </div>
          <button
            onClick={toggle}
            className="flex items-center gap-2 rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
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
      <label className="mb-1 block text-xs font-medium text-gray-400">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
