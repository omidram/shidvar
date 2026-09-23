"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <button
      type="button"
      onClick={toggle}
      suppressHydrationWarning
      className={cn(
        "grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/80 text-foreground shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary",
        className,
      )}
      aria-label="تغییر تم"
    >
      {ready && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
