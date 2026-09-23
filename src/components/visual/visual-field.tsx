import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function VisualField({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={cn("aurora-field relative overflow-hidden", className)}>
      <span className="glow-orb glow-orb-a" aria-hidden />
      <span className="glow-orb glow-orb-b" aria-hidden />
      <span className="glow-orb glow-orb-c" aria-hidden />
      {children}
    </div>
  );
}
