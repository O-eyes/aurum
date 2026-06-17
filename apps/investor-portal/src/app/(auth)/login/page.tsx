"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { auth, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { PhoneOtpLogin } from "@/components/auth/phone-otp-login";
import { pickWalletConnector } from "@/lib/utils";
import { useAccount, useSignMessage, useConnect } from "wagmi";

// Client-only auth page: reads search params and initializes wallet/Privy
// stores. No SEO value, so skip static prerendering (avoids the
// useSearchParams CSR-bailout and storage-access-during-export errors).
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="pt-6">
            <div className="h-40" />
          </CardContent>
        </Card>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, refresh } = useAuth();
  const [error, setError] = useState("");
  const [siweLoading, setSiweLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("aurum_session_expired") === "1") {
      setSessionExpired(true);
      localStorage.removeItem("aurum_session_expired");
    }
    if (searchParams.get("verified") === "1") {
      setEmailVerified(true);
    }
  }, [searchParams]);

  const { devLogin } = useAuth();
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { signMessageAsync } = useSignMessage();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError("");
    try {
      await login(data.email, data.password);
      router.replace("/dashboard");
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Login failed. Please try again.",
      );
    }
  };

  const handleSiwe = async () => {
    setSiweLoading(true);
    setError("");
    try {
      let walletAddress = address;
      if (!isConnected || !walletAddress) {
        const connector = pickWalletConnector(connectors);
        if (!connector) {
          setError("No wallet connector available. Please try again.");
          return;
        }
        const result = await connectAsync({ connector });
        walletAddress = result.accounts[0];
      }
      if (!walletAddress) {
        setError("Could not read your wallet address. Please try again.");
        return;
      }
      const { message } = await auth.walletChallenge(walletAddress);
      const signature = await signMessageAsync({ message });
      const data = await auth.walletVerify({ signature, message });
      auth.setTokens(data.accessToken, data.refreshToken);
      await refresh();
      router.replace("/dashboard");
    } catch (e) {
      const rejected =
        (e as any)?.code === 4001 ||
        String(e).toLowerCase().includes("user rejected");
      if (!rejected) {
        setError(e instanceof ApiError ? e.message : "Wallet sign-in failed.");
      }
    } finally {
      setSiweLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {method === "phone" ? "Sign in or sign up" : "Sign in"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {method === "phone"
              ? "Enter your phone number to get started"
              : "Welcome back to your Aurum account"}
          </p>
        </div>

        {emailVerified && (
          <Alert variant="success">Email verified! You can now sign in.</Alert>
        )}
        {sessionExpired && (
          <Alert variant="warning">
            Your session has expired. Please sign in again.
          </Alert>
        )}
        {method === "email" && error && <Alert variant="error">{error}</Alert>}

        {method === "phone" ? (
          <PhoneOtpLogin />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register("password")}
            />
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Sign in
            </Button>
          </form>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs text-gray-500">
            <span className="bg-white px-2">or continue with</span>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() =>
              setMethod((m) => (m === "phone" ? "email" : "phone"))
            }
          >
            {method === "phone" ? "Sign in with Email" : "Sign in with Phone"}
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleSiwe}
            loading={siweLoading}
          >
            {isConnected ? "Sign in with Wallet" : "Connect Wallet"}
          </Button>
        </div>

        <p className="text-center text-sm text-gray-500">
          New to Aurum?{" "}
          {method === "phone" ? (
            <span className="text-gray-600">
              Just enter your phone number above to get started.
            </span>
          ) : (
            <Link
              href="/register"
              className="text-gold-600 font-medium hover:underline"
            >
              Create an account
            </Link>
          )}
        </p>

        {process.env.NODE_ENV === "development" && (
          <button
            type="button"
            onClick={() => {
              devLogin();
              router.replace("/dashboard");
            }}
            className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
          >
            ⚡ Dev preview (no backend)
          </button>
        )}
      </CardContent>
    </Card>
  );
}
