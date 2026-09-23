"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, PageHeader, RouteLine } from "@/components/domain/chrome";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { statusFa } from "@/lib/status-fa";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";

type Job = {
  id: string;
  number: string;
  status: string;
  cargoWeight?: number;
  cargoUnit?: string;
  requiredVehicleType?: string | null;
  compensationAmount?: number | string | null;
  currencyCode?: string;
  pickupAt?: string | null;
  cargoOwner?: { name: string; phone?: string | null };
  cargoItems?: Array<{ name: string; quantity: number; unitCode: string }>;
  originCity?: string | null;
  destinationCity?: string | null;
  waybill?: string | null;
  assignedDriver?: { name: string; phone?: string | null } | null;
  pickup?: { city: string } | null;
  delivery?: { city: string } | null;
};

export default function AdminJobsPage() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ["jobs", "/jobs"], queryFn: () => api<Job[]>("/jobs") });
  const rows = q.data ?? [];
  return (
    <div>
      <PageHeader title={t.menu.jobs} description="بارهای جاری، در انتظار راننده و در مسیر — جزئیات کامل با کلیک روی کارت" />
      <Card className="mb-4 overflow-hidden p-0">
        <img src="/media/cargo-3.jpg" alt="" className="h-40 w-full object-cover" />
      </Card>
      {q.isLoading ? <p>{t.common.loading}</p> : null}
      {!q.isLoading && !rows.length ? <EmptyState title={t.common.empty} /> : null}
      <div className="grid gap-3">
        {rows.map((job) => (
          <Link key={job.id} href={`/admin/jobs/${job.id}`}>
            <Card className="transition hover:-translate-y-0.5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-bold">{job.number}</div>
                <StatusBadge status={job.status} />
              </div>
              <div className="mt-4">
                <RouteLine from={job.originCity ?? job.pickup?.city ?? t.job.pickup} to={job.destinationCity ?? job.delivery?.city ?? t.job.delivery} />
              </div>
              <p className="mt-3 text-sm">
                {t.common.cargoOwner}: {job.cargoOwner?.name ?? "—"}
                {job.cargoOwner?.phone ? ` · ${job.cargoOwner.phone}` : ""}
              </p>
              <p className="mt-1 text-sm text-muted">
                {(job.cargoItems ?? []).map((item) => `${item.name} ${item.quantity} ${item.unitCode}`).join("، ")}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted">
                {job.requiredVehicleType ? <span>{statusFa(job.requiredVehicleType)}</span> : null}
                {job.cargoWeight != null ? <span>{formatNumber(job.cargoWeight)} {job.cargoUnit}</span> : null}
                {job.compensationAmount != null ? <span>{formatMoney(job.compensationAmount, job.currencyCode)}</span> : null}
                {job.pickupAt ? <span>{formatDateTime(job.pickupAt)}</span> : null}
                {job.assignedDriver ? <span>{t.common.driver}: {job.assignedDriver.name}</span> : null}
                {job.waybill ? <span className="font-semibold text-foreground">{t.common.waybill}: {job.waybill}</span> : null}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
