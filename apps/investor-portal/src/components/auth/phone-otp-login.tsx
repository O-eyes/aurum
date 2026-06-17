"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { auth, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Smartphone, ArrowLeft } from "lucide-react";

/**
 * Normalise a Ghana phone number to E.164.
 * - "0241234567"  → "+233241234567"
 * - "233241234567" → "+233241234567"
 * - "+233241234567" → unchanged
 * Falls back to the raw input (with a leading +) for other country codes.
 */
function toE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return "+233" + digits.slice(1);
  if (digits.startsWith("233")) return "+" + digits;
  if (digits.length === 9) return "+233" + digits; // 24xxxxxxx without leading 0
  return "+" + digits;
}

const RESEND_SECONDS = 60;

export function PhoneOtpLogin() {
  const router = useRouter();
  const { loginWithOtp } = useAuth();

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [e164, setE164] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = useCallback(async (phone: string) => {
    setError("");
    setLoading(true);
    try {
      await auth.requestOtp(phone);
      setStep("code");
      setCooldown(RESEND_SECONDS);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not send code. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSendCode = async () => {
    const normalized = toE164(phoneInput);
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setError("Enter a valid phone number, e.g. 024 123 4567.");
      return;
    }
    setE164(normalized);
    await sendCode(normalized);
  };

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { isNewUser } = await loginWithOtp(e164, code);
      // New phone users land on KYC to unlock buying; returning users go home.
      router.replace(isNewUser ? "/kyc" : "/dashboard");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "phone") {
    return (
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <Input
          label="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="024 123 4567"
          hint="We'll text you a 6-digit code"
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
        />
        <Button className="w-full" onClick={handleSendCode} loading={loading}>
          <Smartphone className="h-4 w-4" />
          Send code
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      <button
        type="button"
        onClick={() => {
          setStep("phone");
          setCode("");
          setError("");
        }}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      >
        <ArrowLeft className="h-3 w-3" /> Change number
      </button>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Enter the code sent to{" "}
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {e164}
        </span>
      </p>
      <Input
        label="Verification code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && handleVerify()}
      />
      <Button className="w-full" onClick={handleVerify} loading={loading}>
        Verify &amp; continue
      </Button>
      <button
        type="button"
        disabled={cooldown > 0 || loading}
        onClick={() => sendCode(e164)}
        className="w-full text-center text-xs text-gold-600 hover:underline disabled:text-gray-400 disabled:no-underline"
      >
        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
      </button>
    </div>
  );
}
