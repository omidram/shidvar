import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("max-w-full rounded-3xl border border-border bg-card p-4 card-shadow sm:p-5", className)} {...props} />;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-muted">{label}</div>
          <div className="mt-2 break-words text-xl font-bold tracking-tight sm:text-2xl">{value}</div>
          {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
        </div>
        {icon ? <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">{icon}</div> : null}
      </div>
    </Card>
  );
}
