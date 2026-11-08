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
  Coins,
  FileText,
  LayoutDashboard,
  MapPinned,
  Menu,
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
  LogOut,
} from "lucide-react";
import { api, isAuthError, liveInterval } from "@/lib/api";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/visual/icons";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useMe } from "@/hooks/use-me";
import { notificationHref, notificationTitle, type NotificationPayload } from "@/lib/portal-links";
import { driverTaskLabel, driverTaskRank, ownerTaskHref, ownerTaskLabel, ownerTaskRank } from "@/components/domain/delivery-flow";

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
  ownerProfile: UserRound,
  adminProfile: UserRound,
  priceBook: Receipt,
  reports: BarChart3,
  wallet: Wallet,
  tracking: MapPinned,
  support: LifeBuoy,
  disputes: Scale,
  tickets: LifeBuoy,
  coins: Coins,
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
    { href: "/admin/profile", key: "adminProfile" as const },
    { href: "/admin/settings", key: "settings" as const },
  ],
  requester: [
    { href: "/requester/dashboard", key: "dashboard" as const },
    { href: "/requester/requests", key: "requests" as const },
    { href: "/requester/requests/new", key: "newRequest" as const },
    { href: "/requester/orders", key: "orders" as const },
    { href: "/requester/jobs", key: "jobs" as const },
    { href: "/requester/tracking", key: "tracking" as const },
    { href: "/requester/invoices", key: "invoices" as const },
    { href: "/requester/coins", key: "coins" as const },
    { href: "/requester/reports", key: "reports" as const },
    { href: "/requester/price-book", key: "priceBook" as const },
    { href: "/requester/warehouses", key: "warehouses" as const },
    { href: "/requester/support", key: "support" as const },
    { href: "/requester/profile", key: "ownerProfile" as const },
    { href: "/requester/settings", key: "settings" as const },
  ],
  supplier: [
    { href: "/requester/dashboard", key: "dashboard" as const },
    { href: "/requester/requests", key: "requests" as const },
    { href: "/requester/requests/new", key: "newRequest" as const },
    { href: "/requester/orders", key: "orders" as const },
    { href: "/requester/jobs", key: "jobs" as const },
    { href: "/requester/tracking", key: "tracking" as const },
    { href: "/requester/invoices", key: "invoices" as const },
    { href: "/requester/support", key: "support" as const },
    { href: "/requester/profile", key: "ownerProfile" as const },
    { href: "/requester/settings", key: "settings" as const },
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

function DriverNextTask() {
  const jobs = useQuery({
    queryKey: ["jobs", "/jobs"],
    queryFn: () => api<Array<{ id: string; status: string }>>("/jobs"),
    refetchInterval: liveInterval(5000),
  });
  const open = (jobs.data ?? []).filter((job) => !["COMPLETED", "CANCELLED", "CONFIRMED"].includes(job.status));
  const current = [...open].sort((a, b) => driverTaskRank(a.status) - driverTaskRank(b.status))[0];
  const offers = useQuery({
    queryKey: ["jobs", "/marketplace/jobs"],
    queryFn: () => api<Array<{ id: string }>>("/marketplace/jobs"),
    enabled: jobs.isSuccess && !current,
    refetchInterval: liveInterval(5000),
  });
  if (current) {
    const onTrip = ["LOADED", "IN_TRANSIT", "ARRIVING_AT_DESTINATION", "AT_DESTINATION", "UNLOADING", "DELIVERED"].includes(current.status);
    const href =
      current.status === "DELIVERED"
        ? "/driver/active-trip#delivery-docs"
        : onTrip
          ? "/driver/active-trip"
          : `/driver/jobs/${current.id}#delivery-docs`;
    return (
      <Link href={href} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-2 text-primary-foreground">
        <span className="min-w-0">
          <span className="block text-xs font-semibold opacity-80">کار بعدی شما</span>
          <span className="block truncate text-base font-black">{driverTaskLabel(current.status)}</span>
        </span>
        <ChevronLeft className="h-5 w-5 shrink-0" />
      </Link>
    );
  }
  if ((offers.data ?? []).length) {
    return (
      <Link href="/driver/jobs" className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-2 text-primary-foreground">
        <span className="min-w-0">
          <span className="block text-xs font-semibold opacity-80">کار بعدی شما</span>
          <span className="block truncate text-base font-black">یک بار جدید آمده. ببینید و قبول یا رد کنید</span>
        </span>
        <ChevronLeft className="h-5 w-5 shrink-0" />
      </Link>
    );
  }
  return null;
}

function OwnerNextTask() {
  const jobs = useQuery({
    queryKey: ["jobs", "/jobs"],
    queryFn: () => api<Array<{ id: string; status: string }>>("/jobs"),
    refetchInterval: liveInterval(5000),
  });
  const requests = useQuery({
    queryKey: ["requests", "own"],
    queryFn: () => api<Array<{ id: string; status: string }>>("/requests"),
    refetchInterval: liveInterval(5000),
  });
  const open = (jobs.data ?? []).filter((job) => !["COMPLETED", "CANCELLED", "CONFIRMED", "REJECTED"].includes(job.status));
  const current = [...open].sort((a, b) => ownerTaskRank(a.status) - ownerTaskRank(b.status))[0];
  if (current) {
    return (
      <Link href={ownerTaskHref(current.id, current.status)} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-2 text-primary-foreground">
        <span className="min-w-0">
          <span className="block text-xs font-semibold opacity-80">کار بعدی شما</span>
          <span className="block truncate text-base font-black">{ownerTaskLabel(current.status)}</span>
        </span>
        <ChevronLeft className="h-5 w-5 shrink-0" />
      </Link>
    );
  }
  const pending = (requests.data ?? []).find((row) => ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "PUBLISHED", "TRANSPORT_PENDING"].includes(row.status));
  if (!pending) return null;
  const label =
    pending.status === "DRAFT"
      ? "درخواست پیش‌نویس مانده. آن را بفرستید"
      : pending.status === "UNDER_REVIEW" || pending.status === "SUBMITTED"
        ? "درخواست شما در صف بررسی مدیریت است"
        : "بار اعلام شده. منتظر قبول راننده هستید";
  return (
    <Link href={`/requester/requests/${pending.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-2 text-primary-foreground">
      <span className="min-w-0">
        <span className="block text-xs font-semibold opacity-80">کار بعدی شما</span>
        <span className="block truncate text-base font-black">{label}</span>
      </span>
      <ChevronLeft className="h-5 w-5 shrink-0" />
    </Link>
  );
}

export function PortalShell({ portal, children }: { portal: keyof typeof NAV; children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const me = useMe();
  const [openNotes, setOpenNotes] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navReady, setNavReady] = useState(false);
  useEffect(() => {
    setNavReady(true);
  }, []);
  useEffect(() => {
    setMenuOpen(false);
    setOpenNotes(false);
  }, [pathname]);
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
    refetchInterval: liveInterval(8000),
  });

  useEffect(() => {
    if (isAuthError(me.error)) window.location.replace("/login");
  }, [me.error]);

  async function signOut() {
    await api("/auth/logout", { method: "POST" });
    window.location.replace("/login");
  }

  const items = NAV[portal];
  const pinned = portal === "admin" ? items.filter((item) => item.key === "adminProfile" || item.key === "settings") : [];
  const menuItems = portal === "admin" ? items.filter((item) => item.key !== "adminProfile" && item.key !== "settings") : items;
  const phoneShell = portal === "driver" || portal === "requester" || portal === "supplier";
  const dockKeys = portal === "driver" ? ["dashboard", "jobs", "activeTrip", "wallet"] : ["dashboard", "requests", "newRequest", "jobs"];
  const dock = items.filter((item) => dockKeys.includes(item.key));
  const unread = (notes.data ?? []).filter((n) => !n.readAt).length;
  const hasCoins = portal === "requester" || portal === "driver";
  const coins = useQuery({
    queryKey: ["coins"],
    queryFn: () => api<{ balance: number }>("/coins"),
    enabled: Boolean(me.data) && hasCoins,
    retry: false,
    refetchInterval: liveInterval(8000),
  });
  const displayName = me.data ? `${me.data.firstName} ${me.data.lastName}`.trim() || me.data.phone || me.data.email || "" : "";

  return (
    <div className={cn("min-h-screen max-w-full bg-background", phoneShell ? "pb-24 lg:grid lg:grid-cols-[280px_1fr] lg:pb-0" : "grid md:grid-cols-[280px_1fr]")}>
      {phoneShell && menuOpen ? (
        <button type="button" className="fixed inset-0 z-30 bg-black/50 lg:hidden" aria-label="بستن منو" onClick={() => setMenuOpen(false)} />
      ) : null}
      <aside
        className={cn(
          "border-e-4 border-accent bg-ink p-5 text-white",
          phoneShell
            ? cn(
                "fixed inset-y-0 start-0 z-40 h-screen w-[min(20rem,88vw)] flex-col shadow-2xl lg:sticky lg:z-auto lg:flex lg:w-full lg:max-w-none lg:shadow-none",
                menuOpen ? "flex" : "hidden lg:flex",
              )
            : "sticky top-0 flex h-screen flex-col",
        )}
      >
        <Link href={`/${portal}/dashboard`} className="block shrink-0">
          <BrandMark className="h-20" />
        </Link>
        <p className="mt-3 shrink-0 text-sm text-white/70">{me.data ? displayName : "…"}</p>
        <p className="shrink-0 text-xs text-white/40">
          {portal === "admin" ? t.auth.admin : portal === "requester" ? t.auth.requester : portal === "supplier" ? t.auth.requester : t.auth.driver}
        </p>
        <nav className="portal-scroll mt-8 grid min-h-0 flex-1 content-start gap-1 overflow-y-auto pe-1">
          {menuItems.map((item) => {
            const Icon = ICONS[item.key];
            const active =
              navReady && (pathname === item.href || (item.href !== `/${portal}/dashboard` && pathname.startsWith(item.href)));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
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
        {pinned.length ? (
          <nav className="mt-3 grid shrink-0 gap-1 border-t border-white/10 pt-3">
            {pinned.map((item) => {
              const Icon = ICONS[item.key];
              const active = navReady && (pathname === item.href || pathname.startsWith(item.href));
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
        ) : null}
        <Button variant="outline" className="mt-4 w-full shrink-0 border-white/20 text-white" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" />
          {t.common.signOut}
        </Button>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 grid max-w-full gap-3 overflow-x-clip border-b border-border bg-card/80 px-3 py-3 backdrop-blur sm:px-4 md:px-8">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {phoneShell ? (
              <button
                type="button"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-card lg:hidden"
                aria-label="منو"
                onClick={() => setMenuOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </button>
            ) : null}
            <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{me.data ? displayName : t.common.loading}</p>
            <p className="truncate text-xs text-muted">{me.data?.email ?? me.data?.phone}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasCoins && coins.data ? (
              <Link
                href={`/${portal}/coins`}
                className="flex h-11 min-w-0 max-w-28 shrink items-center gap-1.5 rounded-2xl border border-amber-400/50 bg-amber-400/10 px-2.5 text-sm font-bold text-amber-700 sm:max-w-none sm:px-3 dark:text-amber-300"
                aria-label={t.menu.coins}
              >
                <Coins className="h-4 w-4" />
                {coins.data.balance.toLocaleString("fa-IR")}
              </Link>
            ) : null}
            <ThemeToggle />
            {portal === "admin" ? (
              <Link href="/admin/settings" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border bg-card px-3 text-sm font-semibold">
                <Settings className="h-4 w-4" />
                {t.menu.settings}
              </Link>
            ) : null}
            <Button variant="secondary" className="hidden h-11 px-3 lg:inline-flex" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
              {t.common.signOut}
            </Button>
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
          </div>
          {portal === "driver" ? <DriverNextTask /> : null}
          {portal === "requester" ? <OwnerNextTask /> : null}
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
        <main className="min-w-0 p-3 sm:p-4 md:p-8">{children}</main>
      </div>
      {phoneShell ? (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card px-1 py-1 lg:hidden">
          {dock.map((item) => {
            const Icon = ICONS[item.key];
            const active = navReady && (pathname === item.href || (item.href !== `/${portal}/dashboard` && pathname.startsWith(item.href)));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "grid min-w-0 place-items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold leading-4",
                  active && "bg-primary/10 text-primary",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="max-w-full truncate">{t.menu[item.key]}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className="grid min-w-0 place-items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold leading-4"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="h-4 w-4" />
            منو
          </button>
        </nav>
      ) : null}
    </div>
  );
}
