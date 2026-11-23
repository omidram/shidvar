"use client";

import Link from "next/link";
import { PhoneLink } from "@/components/ui/phone-link";
import { Card } from "@/components/ui/card";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";

export type PartnerShipment = {
  id: string;
  number: string;
  invoiceNumber: string;
  brandName: string;
  storeName: string;
  cargoType: string;
  cartonCount: number;
  cargoAmount: number;
  province: string;
  county?: string | null;
  city: string;
  warehouseName: string;
  receivedAt?: string | null;
  promisedDeliveryAt?: string | null;
  shipAt: string;
  notes?: string | null;
  status: string;
  driverLocation?: string | null;
  freightAmount?: number | null;
  deliveredAt?: string | null;
  company: { id: string; tradeName: string; phone?: string | null; status: string };
  driver?: { id: string; name: string; phone?: string | null } | null;
  invoice?: { id: string; number: string; status: string; total: number } | null;
};

const STEPS = [
  ["REGISTERED", "ثبت در انبار"],
  ["ASSIGNED", "راننده مشخص شد"],
  ["IN_TRANSIT", "در مسیر مقصد"],
  ["DELIVERED", "به مقصد رسید"],
] as const;

export function partnerStepIndex(status: string) {
  const index = STEPS.findIndex(([value]) => value === status);
  return index < 0 ? 0 : index;
}

export function PartnerShipmentCard({ shipment, href }: { shipment: PartnerShipment; href?: string }) {
  const step = partnerStepIndex(shipment.status);
  const body = (
      <Card className="grid min-w-0 gap-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="break-words text-lg font-bold">
              {href ? <Link href={href}>{shipment.brandName}</Link> : shipment.brandName}
            </div>
            <p className="mt-1 break-words text-sm text-muted">
              فاکتور {shipment.invoiceNumber} · {shipment.storeName}
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{STEPS[step]?.[1]}</span>
        </div>
        <p className="break-words text-sm">
          {shipment.cargoType} · {formatNumber(shipment.cartonCount)} کارتن · {formatMoney(shipment.cargoAmount)}
        </p>
        <p className="break-words text-sm text-muted">
          {shipment.province}
          {shipment.county ? `، ${shipment.county}` : ""}، {shipment.city} · ارسال {formatDate(shipment.shipAt)}
        </p>
        <div className="grid grid-cols-4 gap-1">
          {STEPS.map(([value, label], index) => (
            <span key={value} className={`h-1.5 rounded-full ${index <= step ? "bg-primary" : "bg-border"}`} title={label} />
          ))}
        </div>
        {shipment.driver ? (
          <p className="text-sm">
            راننده: {shipment.driver.name} {shipment.driver.phone ? <PhoneLink phone={shipment.driver.phone} /> : null}
          </p>
        ) : (
          <p className="text-sm text-muted">راننده هنوز تخصیص نشده است.</p>
        )}
        <p className="text-sm">
          مبلغ باربری: {shipment.freightAmount != null ? formatMoney(shipment.freightAmount) : "بعد از تخصیص مشخص می‌شود"}
          {shipment.invoice ? ` · فاکتور ${shipment.invoice.number}` : ""}
        </p>
      </Card>
  );
  return body;
}
