"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, FilterBar, PageHeader } from "@/components/domain/chrome";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { statusFa } from "@/lib/status-fa";
import { formatNumber } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";

type Driver = {
  id: string;
  status: string;
  licenseNumber?: string | null;
  licenseType?: string | null;
  ratingAvg?: number | string;
  completedJobs?: number;
  openJobCount?: number;
  user: { firstName: string; lastName: string; phone?: string | null; email?: string | null };
  carrier?: { company?: { tradeName: string } } | null;
  vehicles: Array<{ vehicle: { plateNumber: string; vehicleType: string } }>;
};

export default function AdminDriversPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const q = useQuery({ queryKey: ["admin-drivers"], queryFn: () => api<Driver[]>("/admin/drivers") });
  const rows = (q.data ?? []).filter((row) => {
    const hay = `${row.user.firstName} ${row.user.lastName} ${row.user.phone ?? ""} ${row.licenseNumber ?? ""} ${row.carrier?.company?.tradeName ?? ""}`.toLowerCase();
    return (!query || hay.includes(query.toLowerCase())) && (!status || row.status === status);
  });
  const statuses = Array.from(new Set((q.data ?? []).map((r) => r.status))).map((value) => ({ value, label: statusFa(value) }));
  return (
    <div>
      <PageHeader title={t.menu.drivers} description="رانندگان تأییدشده، ردشده و در انتظار بررسی — برای پروفایل کامل روی کارت بزنید" />
      <FilterBar query={query} onQuery={setQuery} status={status} onStatus={setStatus} statuses={[{ value: "", label: t.common.all }, ...statuses]} />
      {!rows.length ? (
        <EmptyState title={t.common.empty} />
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <Link key={row.id} href={`/admin/drivers/${row.id}`}>
              <Card className="transition hover:-translate-y-0.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold">
                      {row.user.firstName} {row.user.lastName}
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {[row.user.phone, row.user.email, row.carrier?.company?.tradeName].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <span>{t.common.license}: {row.licenseNumber ?? "—"}{row.licenseType ? ` (${row.licenseType})` : ""}</span>
                  <span>{t.common.rating}: {row.ratingAvg != null ? formatNumber(row.ratingAvg) : "—"}</span>
                  <span>بار تکمیل: {row.completedJobs ?? 0}</span>
                  <span>بار باز: {row.openJobCount ?? 0}</span>
                  <span>{t.common.fleet}: {row.vehicles.map((v) => `${v.vehicle.plateNumber} ${statusFa(v.vehicle.vehicleType)}`).join("، ") || "—"}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
