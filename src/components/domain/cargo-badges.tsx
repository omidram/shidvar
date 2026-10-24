import { cn } from "@/lib/utils";

export function CargoBadges({
  dispatchMode,
  needsWaybill,
  needsInsurance,
  roobar,
  className,
}: {
  dispatchMode?: string | null;
  needsWaybill?: boolean | null;
  needsInsurance?: boolean | null;
  roobar?: boolean;
  className?: string;
}) {
  const badges = [
    dispatchMode === "VIP" ? { label: "VIP", tone: "bg-amber-400/20 text-amber-700 dark:text-amber-300" } : null,
    roobar ? { label: "روبار", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" } : null,
    needsWaybill ? { label: "بارنامه", tone: "bg-primary/10 text-primary" } : null,
    needsInsurance ? { label: "بیمه‌نامه", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" } : null,
  ].filter((b): b is { label: string; tone: string } => Boolean(b));
  if (!badges.length) return null;
  return (
    <span className={cn("inline-flex flex-wrap gap-1.5", className)}>
      {badges.map((b) => (
        <span key={b.label} className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", b.tone)}>
          {b.label}
        </span>
      ))}
    </span>
  );
}
