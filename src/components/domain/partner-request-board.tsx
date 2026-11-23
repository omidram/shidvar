"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PartnerShipmentCard, type PartnerShipment } from "@/components/domain/partner-shipment-card";
import { api } from "@/lib/api";

export function groupPartnerShipments(rows: PartnerShipment[]) {
  const groups = new Map<string, PartnerShipment[]>();
  for (const row of rows) {
    const name = row.company?.tradeName?.trim() || "طرف قرارداد";
    const list = groups.get(name) ?? [];
    list.push(row);
    groups.set(name, list);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "fa"))
    .map(([name, items]) => ({ name, items }));
}

export function PartnerLoadsPreview() {
  const shipments = useQuery({
    queryKey: ["partner-shipments"],
    queryFn: () => api<PartnerShipment[]>("/partner/shipments"),
  });
  const groups = groupPartnerShipments(shipments.data ?? []);
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">طرف قرارداد</h2>
          <p className="mt-1 text-sm text-muted">این بارها جدا از درخواست صاحب بار هستند و بر اساس نام طرف قرارداد چیده شده‌اند.</p>
        </div>
        <Link href="/admin/partner-requests" className="text-sm font-bold text-primary">
          تخصیص راننده
        </Link>
      </div>
      {shipments.isLoading ? <p className="text-sm text-muted">در حال خواندن بارها…</p> : null}
      {!shipments.isLoading && groups.length === 0 ? <p className="text-sm text-muted">هنوز باری از طرف قرارداد ثبت نشده است.</p> : null}
      {groups.map((group) => (
        <div key={group.name} className="grid gap-2">
          <h3 className="font-bold">{group.name}</h3>
          {group.items.map((shipment) => (
            <PartnerShipmentCard key={shipment.id} shipment={shipment} />
          ))}
        </div>
      ))}
    </section>
  );
}
