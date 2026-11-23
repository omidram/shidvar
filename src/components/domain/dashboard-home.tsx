"use client";

import Link from "next/link";
import { BarChart3, ClipboardList, LifeBuoy, MapPinned, PlusCircle, Receipt, ShieldCheck, Truck, Users, Wallet } from "lucide-react";
import { StatCard, Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ErrorState, PageHeader, RouteLine } from "@/components/domain/chrome";
import { QuickAccess, type QuickAction } from "@/components/domain/quick-access";
import { ReportsView } from "@/components/domain/reports-view";
import { TrackingCard, type TrackingDto } from "@/components/domain/tracking-panel";
import { BoxIcon, TruckIcon, WarehouseIcon } from "@/components/visual/icons";
import { api, liveInterval } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";
import { useMe } from "@/hooks/use-me";
import { useQuery } from "@tanstack/react-query";
import { DeliveryFlow, ownerTaskRank } from "@/components/domain/delivery-flow";
import { PartnerLoadsPreview } from "@/components/domain/partner-request-board";

type Dashboard = { portal: string; stats: Record<string, number | string | null> };

export function DashboardView() {
  const { t } = useI18n();
  const me = useMe();
  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/dashboard"),
    refetchInterval: liveInterval(5000),
  });
  if (dash.isLoading) return <p>{t.common.loading}</p>;
  if (dash.isError || !dash.data) return <ErrorState message={t.common.error} />;
  const stats = dash.data.stats;
  const portal = dash.data.portal;
  const labels: Record<string, string> = {
    pendingApprovals: t.dash.pendingApprovals,
    activeRequests: t.dash.activeRequests,
    activeShipments: t.dash.activeShipments,
    matchedRequests: t.dash.matchedRequests,
    availableJobs: t.dash.availableJobs,
    pendingOffers: t.dash.pendingOffers,
    waitingDrivers: t.dash.waitingDrivers,
    assignedLoads: t.dash.assignedLoads,
    invoices: t.dash.invoices,
    cargoOwners: t.dash.cargoOwners,
    orders: t.dash.orders,
    pendingConfirmations: t.dash.pendingConfirmations,
    acceptedOrders: t.dash.acceptedOrders,
    activeJobs: t.dash.activeJobs,
    earnings: t.dash.earnings,
    users: t.dash.users,
    suppliers: t.dash.suppliers,
    drivers: t.dash.drivers,
    completedOrders: t.dash.completedOrders,
    cancelledOrders: t.dash.cancelledOrders,
    disputes: t.dash.disputes,
    unpaidInvoices: t.dash.unpaidInvoices,
    openDisputes: t.dash.openDisputes,
    openTickets: t.dash.openTickets,
    rating: t.common.rating,
    docsToReview: "مدارک برای تأیید",
    pendingRequests: "درخواست در انتظار تأیید",
    partners: "طرف قرارداد",
    partnerRequests: "بار طرف قرارداد",
  };

  const actions: QuickAction[] =
    portal === "REQUESTER"
      ? [
          { href: "/requester/requests/new", label: "ثبت بار", hint: "مبدأ، مقصد و اقلام", icon: PlusCircle, tone: "green" },
          { href: "/requester/jobs", label: "بارهای جاری", hint: "وضعیت بارهایی که ثبت شده", icon: Truck, tone: "ink" },
          { href: "/requester/requests", label: t.menu.requests, hint: "فهرست درخواست‌ها", icon: ClipboardList, tone: "violet" },
        ]
      : portal === "SUPPLIER"
        ? [
            { href: "/supplier/requests", label: t.request.marketplace, hint: t.dash.hintJobs, icon: ClipboardList, tone: "green" },
            { href: "/supplier/orders", label: t.menu.orders, hint: t.dash.hintRequests, icon: Receipt, tone: "ink" },
            { href: "/supplier/reports", label: t.menu.reports, hint: t.dash.hintReports, icon: BarChart3, tone: "violet" },
          ]
        : portal === "DRIVER"
          ? [
              { href: "/driver/jobs", label: "بارهای جاری", hint: "بارهایی که می‌توانید قبول کنید", icon: Truck, tone: "green" },
              { href: "/driver/active-trip", label: t.menu.activeTrip, hint: "مسیر باری که قبول کرده‌اید", icon: MapPinned, tone: "ink" },
              { href: "/driver/wallet", label: t.menu.wallet, hint: t.dash.hintWallet, icon: Wallet, tone: "amber" },
            ]
          : [
              { href: "/admin/verifications", label: t.menu.verifications, hint: t.dash.hintVerify, icon: ShieldCheck, tone: "green" },
              { href: "/admin/drivers", label: t.menu.drivers, hint: t.dash.hintDrivers, icon: Users, tone: "ink" },
              { href: "/admin/tracking", label: t.menu.tracking, hint: t.dash.hintTracking, icon: MapPinned, tone: "ink" },
              { href: "/admin/invoices", label: t.menu.invoices, hint: t.dash.hintInvoices, icon: Receipt, tone: "amber" },
              { href: "/admin/reports", label: t.menu.reports, hint: t.dash.hintReports, icon: BarChart3, tone: "violet" },
              { href: "/admin/disputes", label: t.menu.disputes, hint: t.ops.supportHint, icon: LifeBuoy, tone: "ink" },
            ];

  const summaryHome = portal === "REQUESTER" || portal === "DRIVER";
  const name = me.data ? `${me.data.firstName} ${me.data.lastName}` : "";

  return (
    <div className="grid gap-6">
      <PageHeader
        title={name ? `${t.dash.hello} ${me.data?.firstName}` : t.common.dashboard}
        description={portal === "DRIVER" ? t.dash.driverHome : portal === "REQUESTER" ? t.dash.requesterHome : t.dash.adminHome}
      />
      {portal === "PLATFORM" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Link href="/admin/requests" className="flex items-center gap-4 rounded-3xl bg-primary px-5 py-4 text-primary-foreground">
            <span className="grid h-16 min-w-16 shrink-0 place-items-center rounded-2xl bg-white/15 text-3xl font-black tabular-nums">
              {Number(stats.pendingRequests ?? 0).toLocaleString("fa-IR")}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold opacity-80">صاحب بار</span>
              <span className="block text-lg font-black">درخواست‌های در انتظار تأیید</span>
            </span>
          </Link>
          <Link href="/admin/partner-requests" className="flex items-center gap-4 rounded-3xl border border-border bg-card px-5 py-4 text-foreground">
            <span className="grid h-16 min-w-16 shrink-0 place-items-center rounded-2xl bg-primary text-3xl font-black tabular-nums text-primary-foreground">
              {Number(stats.partnerRequests ?? 0).toLocaleString("fa-IR")}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-muted">جدا از صاحب بار</span>
              <span className="block text-lg font-black">درخواست‌های طرف قرارداد</span>
            </span>
          </Link>
        </div>
      ) : null}
      {portal === "PLATFORM" ? <PartnerLoadsPreview /> : null}
      {summaryHome ? <p className="text-sm leading-7 text-muted">بقیهٔ کارها داخل منو است.</p> : null}
      {portal === "REQUESTER" ? <OwnerLiveLoads /> : null}
      <QuickAccess title={summaryHome ? "کارهای اصلی" : t.dash.quick} actions={actions} />
      {summaryHome ? null : <p className="text-xs text-muted">عددها و مراحل بار هر چند ثانیه خودبه‌خود تازه می‌شوند.</p>}
      {summaryHome ? null : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(stats)
          .filter(([, value]) => value !== null && value !== undefined)
          .map(([key, value], index) => (
            <StatCard
              key={key}
              label={labels[key] ?? key}
              value={key === "earnings" ? formatMoney(Number(value ?? 0)) : value ?? "—"}
              icon={index % 3 === 0 ? <TruckIcon className="h-6 w-6" /> : index % 3 === 1 ? <BoxIcon className="h-6 w-6" /> : <WarehouseIcon className="h-6 w-6" />}
            />
          ))}
      </div>}
      {portal === "PLATFORM" ? <DashboardLiveTracking /> : null}
      {portal === "PLATFORM" ? <ReportsView compact /> : null}
    </div>
  );
}

function OwnerLiveLoads() {
  const q = useQuery({
    queryKey: ["jobs", "/jobs"],
    queryFn: () =>
      api<Array<{ id: string; number: string; status: string; originCity?: string | null; destinationCity?: string | null }>>("/jobs"),
    refetchInterval: liveInterval(5000),
  });
  const open = (q.data ?? [])
    .filter((job) => !["COMPLETED", "CANCELLED", "CONFIRMED", "REJECTED"].includes(job.status))
    .sort((a, b) => ownerTaskRank(a.status) - ownerTaskRank(b.status));
  if (!open.length) return null;
  return (
    <section className="grid gap-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg font-bold">وضعیت بارها</h2>
        <Link href="/requester/jobs" className="text-sm font-bold text-primary">
          همه بارها
        </Link>
      </div>
      {open.slice(0, 3).map((job) => (
        <Card key={job.id}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Link href={`/requester/jobs/${job.id}`} className="font-bold">
              {job.number}
            </Link>
            <StatusBadge status={job.status} />
          </div>
          {job.originCity || job.destinationCity ? <RouteLine from={job.originCity ?? "مبدأ"} to={job.destinationCity ?? "مقصد"} /> : null}
          <div className="mt-4">
            <DeliveryFlow status={job.status} audience="owner" />
          </div>
        </Card>
      ))}
    </section>
  );
}

function DashboardLiveTracking() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["tracking-live"],
    queryFn: () => api<TrackingDto[]>("/tracking"),
    refetchInterval: liveInterval(8000),
  });
  const first = q.data?.[0];
  if (!first) return null;
  return (
    <section className="grid gap-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg font-bold">{t.tracking.live}</h2>
        <span className="text-sm text-muted">{q.data && q.data.length > 1 ? `${q.data.length} بار در مسیر` : null}</span>
      </div>
      <TrackingCard data={first} />
    </section>
  );
}
