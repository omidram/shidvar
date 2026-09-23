import { cn } from "@/lib/utils";
import { statusFa } from "@/lib/status-fa";

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary", className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status.includes("CANCEL") || status.includes("REJECT") || status.includes("DISPUTE") || status.includes("BLOCK")
      ? "bg-red-100 text-red-800"
      : status.includes("COMPLETE") || status.includes("APPROVE") || status.includes("ACCEPT") || status === "DELIVERED" || status === "ACTIVE"
        ? "bg-emerald-100 text-emerald-800"
        : "bg-amber-100 text-amber-900";
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", tone)}>{statusFa(status)}</span>;
}
