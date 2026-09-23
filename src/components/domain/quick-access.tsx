import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type QuickAction = {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone?: "green" | "ink" | "violet" | "amber";
};

const tones = {
  green: "bg-primary/15 text-primary",
  ink: "bg-ink text-white",
  violet: "bg-accent/15 text-accent",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
};

export function QuickAccess({ title, actions }: { title: string; actions: QuickAction[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold text-muted">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-center gap-3 rounded-3xl border border-border bg-card p-4 card-shadow transition hover:-translate-y-0.5 hover:border-primary"
            >
              <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", tones[action.tone ?? "green"])}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-bold leading-6">{action.label}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted">{action.hint}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
