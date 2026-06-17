"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";

declare global {
  interface Window {
    snsWebSdk: any;
  }
}

interface Props {
  accessToken: string;
  onTokenRefresh: () => Promise<string>;
  onStatusChange?: (reviewStatus: string) => void;
}

const SUMSUB_SCRIPT =
  "https://static.sumsub.com/idensic/static/sns-websdk-builder.js";

export function SumsubWidget({
  accessToken,
  onTokenRefresh,
  onStatusChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sdkRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Keep latest callbacks in refs so the SDK closure doesn't go stale
  const onTokenRefreshRef = useRef(onTokenRefresh);
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onTokenRefreshRef.current = onTokenRefresh;
  }, [onTokenRefresh]);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    if (!accessToken || !containerRef.current) return;

    const initSdk = () => {
      if (!window.snsWebSdk || sdkRef.current) return;
      try {
        const sdk = window.snsWebSdk
          .init(accessToken, () => onTokenRefreshRef.current())
          .withConf({ lang: "en" })
          .withOptions({ addViewportTag: false, adaptIframeHeight: true })
          .on("idCheck.onApplicantStatusChanged", (payload: any) => {
            onStatusChangeRef.current?.(payload.reviewStatus ?? "pending");
          })
          .build();

        sdk.launch(containerRef.current);
        sdkRef.current = sdk;
        setLoading(false);
      } catch {
        setLoadError(true);
        setLoading(false);
      }
    };

    if (window.snsWebSdk) {
      initSdk();
      return;
    }

    // Avoid duplicate script injection
    if (document.querySelector(`script[src="${SUMSUB_SCRIPT}"]`)) {
      const poll = setInterval(() => {
        if (window.snsWebSdk) {
          clearInterval(poll);
          initSdk();
        }
      }, 100);
      return () => clearInterval(poll);
    }

    const script = document.createElement("script");
    script.src = SUMSUB_SCRIPT;
    script.async = true;
    script.onload = initSdk;
    script.onerror = () => {
      setLoadError(true);
      setLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      sdkRef.current = null;
    };
  }, [accessToken]);

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-6 text-center">
        <p className="text-sm text-red-700 dark:text-red-400">
          Could not load the verification widget. Check your internet connection
          and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-96">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <Spinner />
          <p className="text-xs text-gray-400">Loading verification widget…</p>
        </div>
      )}
      <div ref={containerRef} className={loading ? "invisible" : ""} />
    </div>
  );
}
