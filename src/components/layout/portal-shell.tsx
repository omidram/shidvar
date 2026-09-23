"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  Building2,
  ChevronLeft,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MapPinned,
  PackageSearch,
  PlusCircle,
  Settings,
  ShieldCheck,
  Receipt,
  Truck,
  Users,
  UserRound,
  Wallet,
  Warehouse,
  LifeBuoy,
  Scale,
  ScrollText,
} from "lucide-react";
import { api, isAuthError } from "@/lib/api";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/visual/icons";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useMe } from "@/hooks/use-me";
import { notificationHref, notificationTitle, type NotificationPayload } from "@/lib/portal-links";

const ICONS = {
  dashboard: LayoutDashboard,
  requests: ClipboardList,
  newRequest: PlusCircle,
  orders: FileText,
  marketplace: PackageSearch,
  jobs: Truck,
  activeTrip: MapPinned,
  verifications: ShieldCheck,
  users: Users,
  companies: Building2,
  audit: ScrollText,
  rules: ShieldCheck,
  warehouses: Warehouse,
  settings: Settings,
  invoices: Receipt,
  drivers: Truck,
  profile: UserRound,
  priceBook: Receipt,
  reports: BarChart3,
  wallet: Wallet,
  tracking: MapPinned,
  support: LifeBuoy,
  disputes: Scale,
  tickets: LifeBuoy,
};

const NAV = {
  admin: [
    { href: "/admin/dashboard", key: "dashboard" as const },
    { href: "/admin/verifications", key: "verifications" as const },
    { href: "/admin/drivers", key: "drivers" as const },
    { href: "/admin/users", key: "users" as const },
    { href: "/admin/companies", key: "companies" as const },
    { href: "/admin/requests", key: "requests" as const },
    { href: "/admin/jobs", key: "jobs" as const },
    { href: "/admin/tracking", key: "tracking" as const },
    { href: "/admin/invoices", key: "invoices" as const },
    { href: "/admin/reports", key: "reports" as const },
    { href: "/admin/orders", key: "orders" as const },
    { href: "/admin/audit-logs", key: "audit" as const },
    { href: "/admin/business-rules", key: "rules" as const },
    { href: "/admin/disputes", key: "disputes" as const },
    { href: "/admin/tickets", key: "tickets" as const },
  ],
  requester: [
    { href: "/requester/dashboard", key: "dashboard" as const },
    { href: "/requester/requests", key: "requests" as const },
    { href: "/requester/requests/new", key: "newRequest" as const },
    { href: "/requester/orders", key: "orders" as const },
    { href: "/requester/jobs", key: "jobs" as const },
    { href: "/requester/tracking", key: "tracking" as const },
    { href: "/requester/invoices", key: "invoices" as const },
    { href: "/requester/reports", key: "reports" as const },
    { href: "/requester/price-book", key: "priceBook" as const },
    { href: "/requester/warehouses", key: "warehouses" as const },
    { href: "/requester/support", key: "support" as const },
    { href: "/requester/settings", key: "settings" as const },
  ],
  supplier: [
    { href: "/supplier/dashboard", key: "dashboard" as const },
    { href: "/supplier/requests", key: "marketplace" as const },
    { href: "/supplier/orders", key: "orders" as const },
    { href: "/supplier/reports", key: "reports" as const },
    { href: "/supplier/support", key: "support" as const },
    { href: "/supplier/settings", key: "settings" as const },
  ],
  driver: [
    { href: "/driver/dashboard", key: "dashboard" as const },
    { href: "/driver/jobs", key: "jobs" as const },
    { href: "/driver/active-trip", key: "activeTrip" as const },
    { href: "/driver/wallet", key: "wallet" as const },
    { href: "/driver/profile", key: "profile" as const },
    { href: "/driver/support", key: "support" as const },
    { href: "/driver/settings", key: "settings" as const },
  ],
};

export function PortalShell({ portal, children }: { portal: keyof typeof NAV; children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const me = useMe();
  const [openNotes, setOpenNotes] = useState(false);
  const [navReady, setNavReady] = useState(false);
  useEffect(() => {
    setNavReady(true);
  }, []);
  const notes = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      api<
        Array<{
          id: string;
          title: string;
          body?: string;
          readAt?: string | null;
          eventType?: string;
          payload?: NotificationPayload | null;
        }>
      >("/notifications"),
    enabled: Boolean(me.data),
    retry: false,
  });

  useEffect(() => {
    if (isAuthError(me.error)) window.location.replace("/login");
  }, [me.error]);

  async function signOut() {
    await api("/auth/logout", { method: "POST" });
    window.location.replace("/login");
  }

  const items = NAV[portal];
  const mobile = portal === "driver";
  const unread = (notes.data ?? []).filter((n) => !n.readAt).length;

  return (
    <div className={cn("min-h-screen bg-background", mobile ? "pb-24" : "grid md:grid-cols-[280px_1fr]")}>
      <aside className={cn("bg-ink p-5 text-white", mobile ? "hidden" : "min-h-screen")}>
        <Link href={`/${portal}/dashboard`} className="block">
          <BrandMark className="text-white" />
        </Link>
        <p className="mt-3 text-sm text-white/70">{me.data ? `${me.data.firstName} ${me.data.lastName}` : "…"}</p>
        <p className="text-xs text-white/40">
          {portal === "admin" ? t.auth.admin : portal === "requester" ? t.auth.requester : portal === "supplier" ? t.auth.supplier : t.auth.driver}
        </p>
        <nav className="mt-8 grid gap-1">
          {items.map((item) => {
            const Icon = ICONS[item.key];
            const active =
              navReady && (pathname === item.href || (item.href !== `/${portal}/dashboard` && pathname.startsWith(item.href)));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm",
                  active ? "bg-primary text-primary-foreground" : "text-white/80 hover:bg-white/10",
                )}
              >
                <Icon className="h-4 w-4" />
                {t.menu[item.key]}
              </Link>
            );
          })}
        </nav>
        <Button variant="outline" className="mt-8 w-full border-white/20 text-white" onClick={signOut}>
          {t.common.signOut}
        </Button>
      </aside>
      <div>
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur md:px-8">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{me.data ? `${me.data.firstName} ${me.data.lastName}` : t.common.loading}</p>
            <p className="truncate text-xs text-muted">{me.data?.email ?? me.data?.phone}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
            type="button"
            className="relative grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card"
            onClick={() => setOpenNotes((v) => !v)}
            aria-label={t.common.notifications}
          >
            <Bell className="h-4 w-4" />
            {unread ? (
              <span className="absolute -top-1 -start-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unread}
              </span>
            ) : null}
          </button>
          </div>
        </header>
        {openNotes ? (
          <div className="mx-4 mt-3 rounded-3xl border border-border bg-card p-4 card-shadow md:mx-8">
            <h2 className="font-semibold">{t.common.notifications}</h2>
            <div className="mt-3 grid max-h-[min(28rem,60vh)] gap-2 overflow-y-auto">
              {(notes.data ?? []).length === 0 ? (
                <p className="text-sm text-muted">{t.common.empty}</p>
              ) : (
                (notes.data ?? []).slice(0, 20).map((n) => {
                  const href = notificationHref(portal, n);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-start text-sm transition",
                        n.readAt ? "bg-background hover:bg-background/80" : "bg-primary/10 hover:bg-primary/15",
                      )}
                      onClick={() => {
                        if (!n.readAt) {
                          void api(`/notifications/${n.id}/read`, { method: "POST" }).then(() => notes.refetch());
                        }
                        setOpenNotes(false);
                        router.push(href);
                      }}
                    >
                      <span
                        className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-border" : "bg-primary")}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block", n.readAt ? "font-medium" : "font-bold")}>{notificationTitle(n)}</span>
                        {n.body ? <span className="mt-0.5 block text-muted">{n.body}</span> : null}
                      </span>
                      <ChevronLeft className="mt-1 h-4 w-4 shrink-0 text-muted" aria-hidden />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
        <main className="p-4 md:p-8">{children}</main>
      </div>
      {mobile ? (
        <nav className={cn("fixed bottom-0 inset-x-0 grid border-t border-border bg-card p-2", items.length > 6 ? "grid-cols-7" : "grid-cols-6")}>
          {items.map((item) => {
            const Icon = ICONS[item.key];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "grid place-items-center gap-1 rounded-2xl py-2 text-[11px]",
                  navReady && pathname === item.href && "bg-primary/10 text-primary",
                )}
              >
                <Icon className="h-4 w-4" />
                {t.menu[item.key]}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
