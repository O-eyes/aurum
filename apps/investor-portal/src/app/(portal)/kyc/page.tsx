"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { kyc as kycApi, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { SumsubWidget } from "@/components/kyc/sumsub-widget";
import { formatDate, KYC_STATUS_LABELS } from "@/lib/utils";
import {
  Shield,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";

const STATUS_ICON: Record<string, React.ReactNode> = {
  APPROVED: <CheckCircle2 className="h-12 w-12 text-green-500" />,
  UNDER_REVIEW: <Clock className="h-12 w-12 text-blue-400" />,
  REJECTED: <XCircle className="h-12 w-12 text-red-500" />,
  NEEDS_REVIEW: <AlertTriangle className="h-12 w-12 text-yellow-500" />,
  PENDING: <Shield className="h-12 w-12 text-gray-300" />,
};

const STATUS_VARIANT: Record<
  string,
  "success" | "info" | "danger" | "warning" | "default"
> = {
  APPROVED: "success",
  UNDER_REVIEW: "info",
  REJECTED: "danger",
  NEEDS_REVIEW: "warning",
  PENDING: "default",
};

const STATUS_DESC: Record<string, string> = {
  PENDING: "Verify your identity to start trading gold tokens.",
  UNDER_REVIEW:
    "Your documents are being reviewed. This usually takes 1–2 business days.",
  APPROVED: "Your identity is verified. You can buy and sell gold tokens.",
  REJECTED:
    "Your verification was rejected. Please resubmit with valid documents.",
  NEEDS_REVIEW:
    "Additional information is required. Please click below to resubmit.",
};

export default function KycPage() {
  const { user, refresh: refreshAuth } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [widgetOpen, setWidgetOpen] = useState(false);

  const { data: kycStatus, isLoading } = useQuery({
    queryKey: ["kyc-status"],
    queryFn: kycApi.status,
    refetchInterval: 30_000,
  });

  const submitMutation = useMutation({
    mutationFn: () => kycApi.submit({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc-status"] });
      setWidgetOpen(true);
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : "KYC submission failed"),
  });

  // Called by the widget when the token expires; fetches a fresh one
  const handleTokenRefresh = async (): Promise<string> => {
    const result = await kycApi.submit({});
    return result.sdkToken;
  };

  // Called by the widget when Sumsub reports a status change
  const handleStatusChange = async (reviewStatus: string) => {
    await queryClient.invalidateQueries({ queryKey: ["kyc-status"] });
    await refreshAuth();
    if (reviewStatus === "completed") {
      setWidgetOpen(false);
    }
  };

  const status = user?.kycStatus ?? "PENDING";
  const canVerify =
    status === "PENDING" || status === "REJECTED" || status === "NEEDS_REVIEW";

  // Active SDK token — either from the fresh submit response or from existing status
  const sdkToken = kycStatus?.sdkToken;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
        Identity Verification
      </h1>

      <div className="max-w-2xl space-y-6">
        {/* Status card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-6">
              {STATUS_ICON[status] ?? STATUS_ICON.PENDING}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {KYC_STATUS_LABELS[status] ?? status}
                  </h2>
                  <Badge variant={STATUS_VARIANT[status] ?? "default"}>
                    {status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {STATUS_DESC[status] ?? ""}
                </p>
                {kycStatus?.updatedAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    Last updated: {formatDate(kycStatus.updatedAt)}
                  </p>
                )}
              </div>
            </div>

            {kycStatus?.reviewNote && (
              <Alert variant="warning" className="mt-4">
                <strong>Review note:</strong> {kycStatus.reviewNote}
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Verification widget / launch area */}
        {canVerify && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {status === "PENDING"
                    ? "Start Verification"
                    : "Resubmit Verification"}
                </CardTitle>
                {widgetOpen && sdkToken && (
                  <button
                    onClick={() => setWidgetOpen(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              ) : widgetOpen && sdkToken ? (
                <SumsubWidget
                  accessToken={sdkToken}
                  onTokenRefresh={handleTokenRefresh}
                  onStatusChange={handleStatusChange}
                />
              ) : (
                <div className="space-y-4">
                  {error && <Alert variant="error">{error}</Alert>}

                  <ol className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                    {[
                      "Click Start Verification to launch the document flow.",
                      "Upload a government-issued ID (passport, national ID, or driver's licence).",
                      "Complete a liveness check (selfie).",
                      "Your submission will be reviewed within 1–2 business days.",
                    ].map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-100 dark:bg-gold-900/30 text-xs font-bold text-gold-700 dark:text-gold-400">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>

                  <Button
                    className="w-full"
                    onClick={() => {
                      setError("");
                      if (sdkToken) {
                        setWidgetOpen(true);
                      } else {
                        submitMutation.mutate();
                      }
                    }}
                    loading={submitMutation.isPending}
                  >
                    {status === "PENDING"
                      ? "Start Verification"
                      : "Resubmit Verification"}
                  </Button>

                  <p className="text-xs text-gray-400 text-center">
                    Powered by Sumsub — your documents are encrypted and handled
                    securely.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {status === "APPROVED" && (
          <Alert variant="success" title="Fully verified">
            Your identity has been verified. You have full access to buy, hold,
            and sell gold tokens.
          </Alert>
        )}

        {status === "UNDER_REVIEW" && (
          <Alert variant="info" title="Under review">
            We will notify you once your verification is complete.
          </Alert>
        )}
      </div>
    </div>
  );
}
