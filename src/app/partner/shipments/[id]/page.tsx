"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ErrorState, PageHeader } from "@/components/domain/chrome";
import { partnerStepIndex, type PartnerShipment } from "@/components/domain/partner-shipment-card";
import { Button } from "@/components/ui/button";
import { PhoneLink } from "@/components/ui/phone-link";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";

function printReceipt(row: PartnerShipment) {
  const lines = [
    ["شماره رسید", row.number],
    ["شماره فاکتور", row.invoiceNumber],
    ["نام شرکت (برند)", row.brandName],
    ["نام فروشگاه", row.storeName],
    ["نوع بار", row.cargoType],
    ["تعداد کارتن", formatNumber(row.cartonCount)],
    ["مبلغ فاکتور", formatMoney(row.cargoAmount)],
    ["مقصد", [row.province, row.county, row.city].filter(Boolean).join(" / ")],
    ["انبار تحویلی", row.warehouseName],
    ["تاریخ تحویل بار به انبار", row.receivedAt ? formatDate(row.receivedAt) : "—"],
    ["تاریخ ارسال", formatDate(row.shipAt)],
    ["تاریخ تحویل", row.promisedDeliveryAt ? formatDate(row.promisedDeliveryAt) : row.deliveredAt ? formatDate(row.deliveredAt) : "—"],
    ["راننده", row.driver ? row.driver.name : "—"],
    ["تلفن راننده", row.driver?.phone ?? "—"],
    ["مبلغ باربری", row.freightAmount != null ? formatMoney(row.freightAmount) : "—"],
    ["اعلام صورتحساب", row.invoice ? row.invoice.number : "هنوز صادر نشده"],
    ["رسید تحویل بار", row.status === "DELIVERED" ? "ثبت شد" : "هنوز ثبت نشده"],
    ["توضیحات", row.notes || "—"],
  ];
  const popup = window.open("", "_blank", "noopener,width=720,height=900");
  if (!popup) return;
  popup.document.write(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>رسید ${row.number}</title>
    <style>body{font-family:Tahoma,sans-serif;margin:32px;color:#111}h1{font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}td{border-bottom:1px solid #ddd;padding:8px 4px}td:first-child{color:#555;width:40%}</style>
    </head><body><h1>رسید طرف قرارداد · شیدرو</h1><p>این برگه رسید ساده همین بار است.</p><table>${lines
      .map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`)
      .join("")}</table></body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}

const STEPS = ["ثبت در انبار شیدرو", "راننده تخصیص شد", "بار ارسال شد", "به مقصد رسید"];

export default function PartnerShipmentPage() {
  const params = useParams<{ id: string }>();
  const q = useQuery({
    queryKey: ["partner-shipment", params.id],
    queryFn: () => api<PartnerShipment>(`/partner/shipments/${params.id}`),
  });
  if (q.isLoading) return <p>در حال بارگذاری…</p>;
  if (q.isError || !q.data) return <ErrorState message="این بار پیدا نشد" />;
  const row = q.data;
  const step = partnerStepIndex(row.status);
  return (
    <div className="grid gap-4">
      <PageHeader
        title={row.brandName}
        description={`فاکتور ${row.invoiceNumber} · ${row.number}`}
        actions={<Button onClick={() => printReceipt(row)}>رسید ساده</Button>}
      />
      <Card className="grid gap-3">
        {STEPS.map((label, index) => (
          <div key={label} className="flex items-center gap-3">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${index <= step ? "bg-primary text-primary-foreground" : "bg-background text-muted"}`}>
              {(index + 1).toLocaleString("fa-IR")}
            </span>
            <span className={index <= step ? "font-bold" : "text-muted"}>{label}</span>
          </div>
        ))}
      </Card>
      <Card className="grid gap-2 text-sm leading-7">
        <p>فروشگاه: {row.storeName}</p>
        <p>نوع بار: {row.cargoType}</p>
        <p>تعداد: {formatNumber(row.cartonCount)} کارتن</p>
        <p>مبلغ فاکتور: {formatMoney(row.cargoAmount)}</p>
        <p>
          مقصد: {row.province}
          {row.county ? `، ${row.county}` : ""}، {row.city}
        </p>
        <p>انبار تحویلی: {row.warehouseName}</p>
        <p>تاریخ تحویل بار به انبار: {row.receivedAt ? formatDate(row.receivedAt) : "—"}</p>
        <p>تاریخ ارسال: {formatDate(row.shipAt)}</p>
        <p>تاریخ تحویل: {row.promisedDeliveryAt ? formatDate(row.promisedDeliveryAt) : "—"}</p>
        <p>مبلغ باربری: {row.freightAmount != null ? formatMoney(row.freightAmount) : "هنوز مشخص نشده"}</p>
        <p>اعلام صورتحساب: {row.invoice ? `${row.invoice.number} · ${formatMoney(row.invoice.total)}` : "هنوز صادر نشده"}</p>
        <p>رسید تحویل بار: {row.status === "DELIVERED" ? `ثبت شد${row.deliveredAt ? ` · ${formatDate(row.deliveredAt)}` : ""}` : "بعد از رسیدن به مقصد ثبت می‌شود"}</p>
        {row.driver ? (
          <p>
            راننده: {row.driver.name} {row.driver.phone ? <PhoneLink phone={row.driver.phone} /> : null}
          </p>
        ) : (
          <p>راننده هنوز مشخص نشده است.</p>
        )}
        {row.notes ? <p>توضیح: {row.notes}</p> : null}
      </Card>
    </div>
  );
}
