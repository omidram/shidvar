"use client";

import { useQuery } from "@tanstack/react-query";
import { BrandMark } from "@/components/visual/icons";
import { Button } from "@/components/ui/button";
import type { PartnerShipment } from "@/components/domain/partner-shipment-card";
import { api } from "@/lib/api";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";

function Line({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th className="w-[38%] border border-neutral-300 bg-neutral-50 px-3 py-2 text-start font-semibold">{label}</th>
      <td className="border border-neutral-300 px-3 py-2">{value}</td>
    </tr>
  );
}

export function PartnerReceiptPage({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["partner-shipment", id],
    queryFn: () => api<PartnerShipment>(`/partner/shipments/${id}`),
  });

  if (q.isLoading) return <p className="p-8">در حال آماده‌سازی رسید…</p>;
  if (q.isError || !q.data) return <p className="p-8">این رسید برای حساب شما در دسترس نیست.</p>;
  const row = q.data;
  const delivered = row.status === "DELIVERED";
  const destination = [row.province, row.county, row.city].filter(Boolean).join(" / ");

  return (
    <div className="print-doc print-single-page bg-white text-neutral-900">
      <div className="no-print sticky top-0 z-10 flex justify-end gap-2 border-b border-neutral-200 bg-white p-3">
        <Button type="button" onClick={() => window.print()}>
          چاپ و ذخیره PDF
        </Button>
      </div>
      <article className="mx-auto w-full max-w-[210mm] bg-white p-6 print:p-0">
        <header className="flex items-start justify-between gap-4 border-b border-neutral-300 pb-4">
          <div>
            <BrandMark />
            <h1 className="mt-4 text-2xl font-black">صدور رسید تحویل بار</h1>
            <p className="mt-1 text-sm">شیدرو · طرف قرارداد {row.company.tradeName}</p>
          </div>
          <div className="text-end text-sm leading-7">
            <p>شماره رسید: {row.number}</p>
            <p>شماره فاکتور: {row.invoiceNumber}</p>
            <p>{delivered ? "تحویل ثبت شد" : "در انتظار تحویل"}</p>
          </div>
        </header>
        <table className="mt-6 w-full border-collapse text-sm">
          <tbody>
            <Line label="نام شرکت (برند)" value={row.brandName} />
            <Line label="نام فروشگاه" value={row.storeName} />
            <Line label="نوع بار" value={row.cargoType} />
            <Line label="تعداد کارتن" value={formatNumber(row.cartonCount)} />
            <Line label="مبلغ فاکتور" value={formatMoney(row.cargoAmount)} />
            <Line label="مقصد" value={destination || "—"} />
            <Line label="انبار تحویلی" value={row.warehouseName || "شورآباد"} />
            <Line label="تاریخ تحویل بار به انبار" value={row.receivedAt ? formatDate(row.receivedAt) : "—"} />
            <Line label="تاریخ ارسال" value={formatDate(row.shipAt)} />
            <Line label="تاریخ تحویل" value={row.deliveredAt ? formatDate(row.deliveredAt) : row.promisedDeliveryAt ? formatDate(row.promisedDeliveryAt) : "—"} />
            <Line label="راننده" value={row.driver?.name || "—"} />
            <Line label="تلفن راننده" value={row.driver?.phone || "—"} />
            <Line label="مبلغ باربری" value={row.freightAmount != null ? formatMoney(row.freightAmount) : "—"} />
            <Line label="صورتحساب" value={row.invoice ? `${row.invoice.number} · ${formatMoney(row.invoice.total)}` : "هنوز صادر نشده"} />
            <Line label="توضیحات" value={row.notes || "—"} />
          </tbody>
        </table>
        <footer className="mt-10 grid grid-cols-3 gap-6 text-center text-sm">
          {["امضای تحویل‌دهنده", "امضای راننده", "امضای گیرنده"].map((label) => (
            <div key={label}>
              <div className="h-16 border-b border-dashed border-neutral-400" />
              <p className="mt-2">{label}</p>
            </div>
          ))}
        </footer>
      </article>
    </div>
  );
}
