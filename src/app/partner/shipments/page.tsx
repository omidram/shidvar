"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/domain/chrome";
import { PartnerShipmentCard, type PartnerShipment } from "@/components/domain/partner-shipment-card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function PartnerShipmentsPage() {
  const q = useQuery({ queryKey: ["partner-shipments"], queryFn: () => api<PartnerShipment[]>("/partner/shipments") });
  return (
    <div className="grid gap-4">
      <PageHeader
        title="بارهای من"
        description="از تحویل به انبار شیدرو تا رسیدن به مقصد."
        actions={
          <Button asChild>
            <Link href="/partner/shipments/new">ثبت بار</Link>
          </Button>
        }
      />
      {q.isLoading ? <p>در حال بارگذاری…</p> : null}
      <div className="grid gap-3">
        {(q.data ?? []).map((row) => (
          <PartnerShipmentCard key={row.id} shipment={row} href={`/partner/shipments/${row.id}`} />
        ))}
      </div>
      {!q.isLoading && !(q.data ?? []).length ? <p className="text-sm text-muted">باری ثبت نشده است.</p> : null}
    </div>
  );
}
