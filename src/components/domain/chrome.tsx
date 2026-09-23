import type { ReactNode } from "react";
import { BoxIcon } from "@/components/visual/icons";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-3xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary/10 text-primary">
        <BoxIcon className="h-8 w-8" />
      </div>
      <p className="mt-4 font-semibold">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <p className="rounded-3xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{message}</p>;
}

export function SimpleTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-border bg-card card-shadow">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-border bg-background text-start text-muted">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Timeline({ items }: { items: Array<{ label: string; at?: string; current?: boolean }> }) {
  return (
    <ol className="grid gap-3">
      {items.map((item, i) => (
        <li key={`${item.label}-${i}`} className="flex gap-3">
          <span className={cn("mt-1 h-2.5 w-2.5 rounded-full", item.current ? "bg-primary" : "bg-border")} />
          <div>
            <div className="text-sm font-medium">{item.label}</div>
            {item.at ? <div className="text-xs text-muted">{item.at}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ChoiceTile({
  active,
  title,
  body,
  icon,
  onClick,
  badge,
  className,
}: {
  active?: boolean;
  title: string;
  body?: string;
  icon: ReactNode;
  onClick: () => void;
  badge?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative grid min-h-[168px] content-start gap-4 rounded-[28px] border p-5 text-start transition",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-[0_16px_40px_-20px_rgb(0_181_98_/_0.7)]"
          : "border-border bg-card text-foreground hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      {badge ? (
        <span
          className={cn(
            "absolute top-4 start-4 rounded-full px-2.5 py-1 text-[10px] font-bold",
            active ? "bg-ink text-white" : "bg-primary text-primary-foreground",
          )}
        >
          {badge}
        </span>
      ) : null}
      <div
        className={cn(
          "grid h-14 w-14 place-items-center rounded-2xl",
          active ? "bg-ink/10 text-ink" : "bg-surface-soft text-primary",
        )}
      >
        {icon}
      </div>
      <div>
        <div className="text-base font-bold">{title}</div>
        {body ? <div className={cn("mt-1 text-sm", active ? "text-ink/70" : "text-muted")}>{body}</div> : null}
      </div>
    </button>
  );
}

export function RouteLine({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-medium">{from}</span>
      <span className="h-px flex-1 bg-gradient-to-l from-primary to-border" />
      <span className="grid h-2 w-2 rounded-full bg-primary" />
      <span className="font-medium">{to}</span>
    </div>
  );
}

export function MetaGrid({ items }: { items: Array<{ label: string; value?: ReactNode | null }> }) {
  const visible = items.filter((item) => item.value !== undefined && item.value !== null && item.value !== "");
  if (!visible.length) return null;
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {visible.map((item) => (
        <div key={item.label} className="rounded-2xl bg-background px-4 py-3">
          <dt className="text-xs text-muted">{item.label}</dt>
          <dd className="mt-1 text-sm font-medium leading-6">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FilterBar({
  query,
  onQuery,
  statuses,
  status,
  onStatus,
}: {
  query: string;
  onQuery: (value: string) => void;
  statuses: Array<{ value: string; label: string }>;
  status: string;
  onStatus: (value: string) => void;
}) {
  return (
    <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="جستجو در شماره، شهر یا کالا"
        className="h-11 rounded-2xl border border-border bg-card px-4 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        {statuses.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onStatus(item.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium",
              status === item.value ? "bg-ink text-white" : "bg-card border border-border",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
