"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/domain/chrome";
import { PartnerShipmentCard, type PartnerShipment } from "@/components/domain/partner-shipment-card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function PartnerDashboard() {
  const q = useQuery({ queryKey: ["partner-shipments"], queryFn: () => api<PartnerShipment[]>("/partner/shipments") });
  const rows = q.data ?? [];
  const moving = rows.filter((row) => row.status !== "DELIVERED").length;
  const delivered = rows.filter((row) => row.status === "DELIVERED").length;
  return (
    <div className="grid gap-4">
      <PageHeader
        title="خلاصه طرف قرارداد"
        description="بار را به انبار شیدرو می‌رسانید، فاکتور را ثبت می‌کنید و تا رسیدن به مقصد همین‌جا می‌بینید."
        actions={
          <Button asChild>
            <Link href="/partner/shipments/new">ثبت بار جدید</Link>
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-4">
          <p className="text-sm text-muted">همه بارها</p>
          <p className="mt-1 text-3xl font-black">{rows.length.toLocaleString("fa-IR")}</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-4">
          <p className="text-sm text-muted">در جریان</p>
          <p className="mt-1 text-3xl font-black">{moving.toLocaleString("fa-IR")}</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-4">
          <p className="text-sm text-muted">رسیده به مقصد</p>
          <p className="mt-1 text-3xl font-black">{delivered.toLocaleString("fa-IR")}</p>
        </div>
      </div>
      <div className="grid gap-3">
        {q.isLoading ? <p>در حال بارگذاری…</p> : null}
        {rows.slice(0, 5).map((row) => (
          <PartnerShipmentCard key={row.id} shipment={row} href={`/partner/shipments/${row.id}`} />
        ))}
        {!q.isLoading && !rows.length ? <p className="text-sm text-muted">هنوز باری ثبت نشده است.</p> : null}
      </div>
    </div>
  );
}
