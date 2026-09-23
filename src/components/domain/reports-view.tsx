"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorState, PageHeader } from "@/components/domain/chrome";
import { StatusBadge } from "@/components/ui/badge";
import { Card, StatCard } from "@/components/ui/card";
import { api } from "@/lib/api";
import { invoiceHref, jobHref, requestHref } from "@/lib/portal-links";
import { statusFa } from "@/lib/status-fa";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";
import type { ReportsPayload } from "@/server/domains/reports/report-service";
import { BoxIcon, TruckIcon, WarehouseIcon } from "@/components/visual/icons";

const KPI_LABELS: Record<string, string> = {
  requests: "درخواست‌ها",
  jobs: "بارها",
  invoiceTotal: "جمع فاکتورها",
  unpaid: "مانده پرداخت‌نشده",
  waitingDrivers: "در انتظار راننده",
  cargoOwners: "صاحبان بار",
  drivers: "رانندگان",
  availableJobs: "بارهای پیشنهادی",
  activeJobs: "بارهای فعال",
  completedJobs: "بارهای تکمیل‌شده",
  earnings: "درآمد",
  orders: "سفارش‌ها",
};

function hrefFor(kind: ReportsPayload["recent"][number]["kind"], id: string, pathname: string) {
  if (kind === "invoice") return invoiceHref(pathname, id);
  if (kind === "job") return jobHref(pathname, id);
  if (kind === "order") {
    if (pathname.startsWith("/admin")) return `/admin/orders/${id}`;
    if (pathname.startsWith("/supplier")) return `/supplier/orders/${id}`;
    return `/requester/orders/${id}`;
  }
  return requestHref(pathname, id);
}

export function ReportsView({ compact }: { compact?: boolean }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const q = useQuery({ queryKey: ["reports"], queryFn: () => api<ReportsPayload>("/reports") });
  if (q.isLoading) return <p>{t.common.loading}</p>;
  if (q.isError || !q.data) return <ErrorState message={t.common.error} />;
  const data = q.data;
  const maxStatus = Math.max(...data.statuses.map((item) => item.count), 1);
  const portalBase = pathname.startsWith("/admin")
    ? "/admin"
    : pathname.startsWith("/requester")
      ? "/requester"
      : pathname.startsWith("/driver")
        ? "/driver"
        : "/supplier";

  return (
    <div className="grid gap-6">
      {compact ? (
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{t.menu.reports}</h2>
            <p className="mt-1 text-sm text-muted">{t.reports.periodHint}</p>
          </div>
          <Link href={`${portalBase}/reports`} className="text-sm font-bold text-primary">
            {t.reports.openFull}
          </Link>
        </div>
      ) : (
        <PageHeader title={t.menu.reports} description={t.reports.pageHint} />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.kpis.map((kpi, index) => (
          <StatCard
            key={kpi.key}
            label={KPI_LABELS[kpi.key] ?? kpi.key}
            value={kpi.unit === "money" ? formatMoney(kpi.value) : formatNumber(kpi.value)}
            icon={index % 3 === 0 ? <TruckIcon className="h-6 w-6" /> : index % 3 === 1 ? <BoxIcon className="h-6 w-6" /> : <WarehouseIcon className="h-6 w-6" />}
          />
        ))}
      </div>

      <div className={`grid gap-4 ${compact ? "lg:grid-cols-2" : "lg:grid-cols-[1.4fr_1fr]"}`}>
        <Card>
          <h3 className="font-bold">{t.reports.monthly}</h3>
          <div className="mt-4 h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.series} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="requests" name={t.reports.requests} fill="#00b562" radius={[6, 6, 0, 0]} />
                <Bar dataKey="jobs" name={t.reports.jobs} fill="#0b1220" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h3 className="font-bold">{t.reports.byStatus}</h3>
          <div className="mt-4 grid gap-3">
            {data.statuses.length === 0 ? (
              <p className="text-sm text-muted">{t.common.empty}</p>
            ) : (
              data.statuses.slice(0, compact ? 5 : 8).map((item) => (
                <div key={item.status}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{statusFa(item.status)}</span>
                    <span className="font-bold">{formatNumber(item.count)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-background">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(item.count / maxStatus) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {!compact || data.routes.length > 0 ? (
        <div className={`grid gap-4 ${compact ? "" : "lg:grid-cols-2"}`}>
          <Card>
            <h3 className="font-bold">{t.reports.topRoutes}</h3>
            <div className="mt-3 grid gap-2">
              {data.routes.length === 0 ? (
                <p className="text-sm text-muted">{t.common.empty}</p>
              ) : (
                data.routes.map((route) => (
                  <div key={`${route.origin}-${route.destination}`} className="flex items-center justify-between gap-3 rounded-2xl bg-background px-3 py-2 text-sm">
                    <span className="font-semibold">
                      {route.origin} ← {route.destination}
                    </span>
                    <span className="text-muted">
                      {formatNumber(route.count)} بار
                      {route.amount ? ` · ${formatMoney(route.amount)}` : ""}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
          {!compact ? (
            <Card>
              <h3 className="font-bold">{t.dash.recent}</h3>
              <RecentList items={data.recent} pathname={pathname} />
            </Card>
          ) : null}
        </div>
      ) : null}

      {compact ? (
        <Card>
          <h3 className="font-bold">{t.dash.recent}</h3>
          <RecentList items={data.recent} pathname={pathname} />
        </Card>
      ) : null}
    </div>
  );
}

function RecentList({ items, pathname }: { items: ReportsPayload["recent"]; pathname: string }) {
  const { t } = useI18n();
  if (items.length === 0) return <p className="mt-3 text-sm text-muted">{t.common.empty}</p>;
  return (
    <div className="mt-3 grid gap-2">
      {items.map((item) => (
        <Link
          key={`${item.kind}-${item.id}`}
          href={hrefFor(item.kind, item.id, pathname)}
          className="flex items-center justify-between gap-3 rounded-2xl bg-background px-3 py-2 transition hover:bg-primary/5"
        >
          <div className="min-w-0">
            <div className="truncate font-bold">{item.number}</div>
            <div className="truncate text-xs text-muted">
              {item.title} · {formatDate(item.at)}
            </div>
          </div>
          <div className="shrink-0 text-end">
            <StatusBadge status={item.status} />
            {item.amount != null ? <div className="mt-1 text-xs font-bold">{formatMoney(item.amount, item.currencyCode)}</div> : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
