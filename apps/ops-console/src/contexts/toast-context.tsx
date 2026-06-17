"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextValue {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const styles: Record<ToastType, string> = {
  success: "border-l-emerald-500 bg-white dark:bg-gray-800",
  error: "border-l-red-500 bg-white dark:bg-gray-800",
  info: "border-l-blue-500 bg-white dark:bg-gray-800",
  warning: "border-l-yellow-500 bg-white dark:bg-gray-800",
};

const iconColors: Record<ToastType, string> = {
  success: "text-emerald-500",
  error: "text-red-500",
  info: "text-blue-500",
  warning: "text-yellow-500",
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const Icon = icons[toast.type];
  useEffect(() => {
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700",
        "border-l-4 shadow-lg px-4 py-3 min-w-[280px] max-w-[360px]",
        "animate-in slide-in-from-right-5 fade-in duration-200",
        styles[toast.type],
      )}
    >
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", iconColors[toast.type])} />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-none mb-1">
            {toast.title}
          </p>
        )}
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {toast.message}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback(
    (type: ToastType, message: string, title?: string) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, type, message, title }]);
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    success: (msg, title) => add("success", msg, title),
    error: (msg, title) => add("error", msg, title),
    info: (msg, title) => add("info", msg, title),
    warning: (msg, title) => add("warning", msg, title),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
