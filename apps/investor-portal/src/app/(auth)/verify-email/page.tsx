"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { request, ApiError } from "@/lib/api";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

// Client-only page driven by a ?token= search param; skip static prerender.
export const dynamic = "force-dynamic";

type Status = "verifying" | "success" | "error";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="py-10 text-center">
            <Loader2 className="h-10 w-10 text-gold-500 animate-spin mx-auto" />
          </CardContent>
        </Card>
      }
    >
      <VerifyEmail />
    </Suspense>
  );
}

function VerifyEmail() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Verification link is missing or malformed.");
      return;
    }

    request(`/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: "GET",
      skipAuth: true,
    })
      .then(() => {
        setStatus("success");
        setTimeout(() => router.push("/login?verified=1"), 3000);
      })
      .catch((err: unknown) => {
        setStatus("error");
        setErrorMsg(
          err instanceof ApiError
            ? err.message
            : "Verification failed. The link may have expired.",
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <Card>
      <CardContent className="py-10 text-center space-y-4">
        {status === "verifying" && (
          <>
            <Loader2 className="h-10 w-10 text-gold-500 animate-spin mx-auto" />
            <p className="text-sm text-gray-600">Verifying your email…</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
            <p className="font-semibold text-gray-900">Email verified!</p>
            <p className="text-sm text-gray-500">Redirecting you to login…</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-10 w-10 text-red-500 mx-auto" />
            <p className="font-semibold text-gray-900">Verification failed</p>
            <p className="text-sm text-red-600">{errorMsg}</p>
            <Link
              href="/register"
              className="text-sm text-gold-600 hover:underline"
            >
              Register again
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
