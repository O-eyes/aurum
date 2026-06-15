'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window { snsWebSdk: any; }
}

interface Props {
  accessToken: string;
  onTokenRefresh: () => Promise<string>;
  onStatusChange?: (reviewStatus: string) => void;
}

const SUMSUB_SCRIPT = 'https://static.sumsub.com/idensic/static/sns-websdk-builder.js';

export function SumsubWidget({ accessToken, onTokenRefresh, onStatusChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sdkRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const onTokenRefreshRef = useRef(onTokenRefresh);
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => { onTokenRefreshRef.current = onTokenRefresh; }, [onTokenRefresh]);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

  useEffect(() => {
    if (!accessToken || !containerRef.current) return;

    const initSdk = () => {
      if (!window.snsWebSdk || sdkRef.current) return;
      try {
        const sdk = window.snsWebSdk
          .init(accessToken, () => onTokenRefreshRef.current())
          .withConf({ lang: 'en' })
          .withOptions({ addViewportTag: false, adaptIframeHeight: true })
          .on('idCheck.onApplicantStatusChanged', (payload: any) => {
            onStatusChangeRef.current?.(payload.reviewStatus ?? 'pending');
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

    if (window.snsWebSdk) { initSdk(); return; }

    if (document.querySelector(`script[src="${SUMSUB_SCRIPT}"]`)) {
      const poll = setInterval(() => { if (window.snsWebSdk) { clearInterval(poll); initSdk(); } }, 100);
      return () => clearInterval(poll);
    }

    const script = document.createElement('script');
    script.src = SUMSUB_SCRIPT;
    script.async = true;
    script.onload = initSdk;
    script.onerror = () => { setLoadError(true); setLoading(false); };
    document.head.appendChild(script);
    return () => { sdkRef.current = null; };
  }, [accessToken]);

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">Could not load the verification widget. Check your connection and try again.</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-96">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
          <p className="text-xs text-gray-400">Loading verification widget…</p>
        </div>
      )}
      <div ref={containerRef} className={loading ? 'invisible' : ''} />
    </div>
  );
}
