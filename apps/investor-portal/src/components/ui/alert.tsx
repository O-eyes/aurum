import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Info, XCircle } from "lucide-react";

type AlertVariant = "info" | "success" | "warning" | "error";

const styles: Record<
  AlertVariant,
  { wrapper: string; icon: React.ElementType }
> = {
  info: { wrapper: "bg-blue-50 border-blue-200 text-blue-800", icon: Info },
  success: {
    wrapper: "bg-green-50 border-green-200 text-green-800",
    icon: CheckCircle2,
  },
  warning: {
    wrapper: "bg-yellow-50 border-yellow-200 text-yellow-800",
    icon: AlertCircle,
  },
  error: { wrapper: "bg-red-50 border-red-200 text-red-800", icon: XCircle },
};

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Alert({
  variant = "info",
  title,
  children,
  className,
}: AlertProps) {
  const { wrapper, icon: Icon } = styles[variant];
  return (
    <div className={cn("flex gap-3 rounded-lg border p-4", wrapper, className)}>
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="text-sm">
        {title && <p className="font-semibold mb-1">{title}</p>}
        {children}
      </div>
    </div>
  );
}
