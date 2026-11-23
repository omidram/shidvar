"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ErrorState, PageHeader, RouteLine } from "@/components/domain/chrome";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PhoneLink } from "@/components/ui/phone-link";
import { api } from "@/lib/api";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";
import type { PartnerShipment } from "@/components/domain/partner-shipment-card";

export default function DriverPartnerShipmentPage() {
  const params = useParams<{ id: string }>();
  const q = useQuery({
    queryKey: ["driver-partner-shipment", params.id],
    queryFn: () => api<PartnerShipment>(`/driver/partner-shipments/${params.id}`),
  });
  if (q.isLoading) return <p>در حال بارگذاری…</p>;
  if (q.isError || !q.data) return <ErrorState message="این بار پیدا نشد" />;
  const row = q.data;
  return (
    <div className="grid gap-4">
      <PageHeader
        title={row.brandName}
        description={`${row.company.tradeName} · ${row.number}`}
        actions={<StatusBadge status={row.status} />}
      />
      <Card className="grid gap-3">
        <RouteLine from={row.warehouseName || "شورآباد"} to={[row.province, row.county, row.city].filter(Boolean).join("، ")} />
        <p>فروشگاه: {row.storeName}</p>
        <p>نوع بار: {row.cargoType}</p>
        <p>تعداد: {formatNumber(row.cartonCount)} کارتن</p>
        <p>مبلغ فاکتور: {formatMoney(row.cargoAmount)}</p>
        <p>تاریخ ارسال: {formatDate(row.shipAt)}</p>
        <p>مبلغ باربری: {row.freightAmount != null ? formatMoney(row.freightAmount) : "هنوز مشخص نشده"}</p>
        {row.company.phone ? (
          <p>
            تلفن طرف قرارداد: <PhoneLink phone={row.company.phone} />
          </p>
        ) : null}
        {row.notes ? <p>توضیح: {row.notes}</p> : null}
      </Card>
    </div>
  );
}
