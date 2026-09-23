"use client";

import { BarChart3, ClipboardList, LifeBuoy, MapPinned, PlusCircle, Receipt, ShieldCheck, Truck, UserRound, Users, Wallet } from "lucide-react";
import { StatCard } from "@/components/ui/card";
import { ErrorState, PageHeader } from "@/components/domain/chrome";
import { QuickAccess, type QuickAction } from "@/components/domain/quick-access";
import { ReportsView } from "@/components/domain/reports-view";
import { TrackingCard, type TrackingDto } from "@/components/domain/tracking-panel";
import { BoxIcon, TruckIcon, WarehouseIcon } from "@/components/visual/icons";
import { api, liveInterval } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";
import { useMe } from "@/hooks/use-me";
import { useQuery } from "@tanstack/react-query";

type Dashboard = { portal: string; stats: Record<string, number | string | null> };

export function DashboardView() {
  const { t } = useI18n();
  const me = useMe();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard") });
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
  };

  const actions: QuickAction[] =
    portal === "REQUESTER"
      ? [
          { href: "/requester/requests/new", label: t.request.create, hint: t.dash.hintNewRequest, icon: PlusCircle, tone: "green" },
          { href: "/requester/requests", label: t.menu.requests, hint: t.dash.hintRequests, icon: ClipboardList, tone: "ink" },
          { href: "/requester/jobs", label: t.menu.jobs, hint: t.dash.hintJobs, icon: Truck, tone: "violet" },
          { href: "/requester/tracking", label: t.menu.tracking, hint: t.dash.hintTracking, icon: MapPinned, tone: "ink" },
          { href: "/requester/invoices", label: t.menu.invoices, hint: t.dash.hintInvoices, icon: Receipt, tone: "amber" },
          { href: "/requester/support", label: t.menu.support, hint: t.ops.supportHint, icon: LifeBuoy, tone: "ink" },
          { href: "/requester/reports", label: t.menu.reports, hint: t.dash.hintReports, icon: BarChart3, tone: "green" },
        ]
      : portal === "SUPPLIER"
        ? [
            { href: "/supplier/requests", label: t.request.marketplace, hint: t.dash.hintJobs, icon: ClipboardList, tone: "green" },
            { href: "/supplier/orders", label: t.menu.orders, hint: t.dash.hintRequests, icon: Receipt, tone: "ink" },
            { href: "/supplier/reports", label: t.menu.reports, hint: t.dash.hintReports, icon: BarChart3, tone: "violet" },
          ]
        : portal === "DRIVER"
          ? [
              { href: "/driver/jobs", label: t.dash.availableJobs, hint: t.dash.hintDriverJobs, icon: Truck, tone: "green" },
              { href: "/driver/active-trip", label: t.menu.activeTrip, hint: t.dash.hintActiveTrip, icon: MapPinned, tone: "ink" },
              { href: "/driver/wallet", label: t.menu.wallet, hint: t.dash.hintWallet, icon: Wallet, tone: "amber" },
              { href: "/driver/reports", label: t.menu.reports, hint: t.dash.hintDriverReports, icon: BarChart3, tone: "violet" },
              { href: "/driver/profile", label: t.menu.profile, hint: t.dash.hintProfile, icon: UserRound, tone: "amber" },
            ]
          : [
              { href: "/admin/verifications", label: t.menu.verifications, hint: t.dash.hintVerify, icon: ShieldCheck, tone: "green" },
              { href: "/admin/drivers", label: t.menu.drivers, hint: t.dash.hintDrivers, icon: Users, tone: "ink" },
              { href: "/admin/tracking", label: t.menu.tracking, hint: t.dash.hintTracking, icon: MapPinned, tone: "ink" },
              { href: "/admin/invoices", label: t.menu.invoices, hint: t.dash.hintInvoices, icon: Receipt, tone: "amber" },
              { href: "/admin/reports", label: t.menu.reports, hint: t.dash.hintReports, icon: BarChart3, tone: "violet" },
              { href: "/admin/disputes", label: t.menu.disputes, hint: t.ops.supportHint, icon: LifeBuoy, tone: "ink" },
            ];

  const richHome = portal === "REQUESTER" || portal === "DRIVER";
  const name = me.data ? `${me.data.firstName} ${me.data.lastName}` : "";

  return (
    <div className="grid gap-6">
      <PageHeader
        title={name ? `${t.dash.hello} ${me.data?.firstName}` : t.common.dashboard}
        description={portal === "DRIVER" ? t.dash.driverHome : portal === "REQUESTER" ? t.dash.requesterHome : t.dash.adminHome}
      />
      <QuickAccess title={t.dash.quick} actions={actions} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>
      {portal === "REQUESTER" || portal === "DRIVER" || portal === "PLATFORM" ? <DashboardLiveTracking /> : null}
      {richHome || portal === "PLATFORM" ? <ReportsView compact /> : null}
    </div>
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
