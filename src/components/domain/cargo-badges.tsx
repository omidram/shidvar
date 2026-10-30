import { cn } from "@/lib/utils";

export function CargoBadges({
  dispatchMode,
  needsWaybill,
  needsInsurance,
  roobar,
  loadType,
  className,
}: {
  loadType?: string | null;
  dispatchMode?: string | null;
  needsWaybill?: boolean | null;
  needsInsurance?: boolean | null;
  roobar?: boolean;
  className?: string;
}) {
  const badges = [
    dispatchMode === "VIP" ? { label: "VIP", tone: "bg-amber-400/20 text-amber-700 dark:text-amber-300" } : null,
    loadType === "SHARED" ? { label: "روباری", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" } : null,
    loadType === "FULL" ? { label: "دربستی", tone: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" } : null,
    roobar && loadType !== "SHARED" ? { label: "هم‌مقصد با بار فعلی", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" } : null,
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
