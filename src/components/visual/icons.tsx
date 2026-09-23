import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold tracking-tight", className)}>
      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary text-primary-foreground">
        <TruckIcon className="h-5 w-5" />
      </span>
      شیدور
    </span>
  );
}

export function TruckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path d="M4 16h24v16H4z" fill="currentColor" opacity="0.2" />
      <path d="M28 20h8l6 6v6H28V20Z" fill="currentColor" opacity="0.35" />
      <path d="M6 16h22v16H6a2 2 0 0 1-2-2V18a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2.4" />
      <path d="M28 20h8l6 6v6h-14V20Z" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="14" cy="34" r="4" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="36" cy="34" r="4" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

export function VanIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <rect x="6" y="16" width="28" height="16" rx="3" fill="currentColor" opacity="0.18" />
      <path d="M34 20h6l2 6v6h-8V20Z" fill="currentColor" opacity="0.3" />
      <rect x="6" y="16" width="28" height="16" rx="3" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="15" cy="34" r="3.5" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="35" cy="34" r="3.5" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

export function HeavyTruckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <rect x="4" y="14" width="22" height="18" rx="2" fill="currentColor" opacity="0.16" />
      <rect x="26" y="18" width="16" height="14" rx="2" fill="currentColor" opacity="0.28" />
      <rect x="4" y="14" width="22" height="18" rx="2" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="12" cy="35" r="3.2" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="22" cy="35" r="3.2" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="36" cy="35" r="3.2" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}

export function TankerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <ellipse cx="22" cy="24" rx="16" ry="8" fill="currentColor" opacity="0.18" />
      <ellipse cx="22" cy="24" rx="16" ry="8" stroke="currentColor" strokeWidth="2.4" />
      <path d="M36 21h6v6h-6" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="14" cy="35" r="3.2" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="30" cy="35" r="3.2" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}

export function ColdIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path d="M24 6v36M12 12l24 24M36 12 12 36M8 24h32" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function WarehouseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path d="M6 20 24 8l18 12v20H6V20Z" fill="currentColor" opacity="0.14" />
      <path d="M6 20 24 8l18 12v20H6V20Z" stroke="currentColor" strokeWidth="2.4" />
      <path d="M18 40V26h12v14" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

export function StoreIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path d="M8 20 12 10h24l4 10v18H8V20Z" fill="currentColor" opacity="0.14" />
      <path d="M8 20h32M12 10h24l4 10H8l4-10Z" stroke="currentColor" strokeWidth="2.4" />
      <path d="M20 38V26h8v12" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

export function GrainIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path d="M24 8c8 8 8 16 0 24-8-8-8-16 0-24Z" fill="currentColor" opacity="0.2" />
      <path d="M24 8c8 8 8 16 0 24" stroke="currentColor" strokeWidth="2.4" />
      <path d="M24 8c-8 8-8 16 0 24" stroke="currentColor" strokeWidth="2.4" />
      <path d="M24 8v32" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

export function BoxIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path d="M8 16 24 8l16 8-16 8-16-8Z" fill="currentColor" opacity="0.16" />
      <path d="M8 16v16l16 8 16-8V16L24 24 8 16Z" stroke="currentColor" strokeWidth="2.4" />
      <path d="M24 24v16" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

export function RouteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="14" r="5" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="36" cy="34" r="5" stroke="currentColor" strokeWidth="2.4" />
      <path d="M16 18c8 0 8 12 16 12" stroke="currentColor" strokeWidth="2.4" strokeDasharray="3 4" />
    </svg>
  );
}
