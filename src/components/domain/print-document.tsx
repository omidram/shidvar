"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/utils";
import { statusFa } from "@/lib/status-fa";
import { BrandMark } from "@/components/visual/icons";
import { Button } from "@/components/ui/button";
import type { InvoiceDetail } from "@/components/domain/invoice-detail";
import { QrMark, qrPayload } from "@/components/domain/qr-mark";

type RequestDto = {
  number: string;
  status: string;
  requestedDeliveryDate: string;
  budgetAmount: number | null;
  currencyCode: string;
  originCity?: string | null;
  destinationCity?: string | null;
  originLine1?: string | null;
  destinationLine1?: string | null;
  notes?: string | null;
  createdAt?: string;
  company?: { tradeName: string; legalName?: string; phone?: string | null };
  items: Array<{ name: string; quantity: number; unitCode: string }>;
  orders?: Array<{
    invoices?: Array<{ number: string }>;
    jobs?: Array<{
      number?: string;
      shipment?: { trackingNumber?: string | null } | null;
      assignedDriver?: { user: { firstName: string; lastName: string; phone?: string | null } } | null;
    }>;
  }>;
};

type JobDto = {
  number: string;
  status: string;
  waybill?: string | null;
  compensationAmount?: number | null;
  currencyCode?: string;
  cargoWeight?: number;
  cargoUnit?: string;
  requiredVehicleType?: string | null;
  originCity?: string | null;
  destinationCity?: string | null;
  originLine1?: string | null;
  destinationLine1?: string | null;
  pickupAt?: string | null;
  deliveryDeadline?: string | null;
  cargoOwner?: { name: string; legalName?: string | null; phone?: string | null };
  cargoItems?: Array<{ name: string; quantity: number; unitCode: string }>;
  assignedDriver?: { name: string; phone?: string | null; licenseNumber?: string | null; plateNumber?: string | null };
  assignedVehicle?: { plateNumber: string; vehicleType: string };
  requestNumber?: string | null;
  orderNumber?: string;
  invoices?: Array<{ number: string }>;
  signatures?: { issuer?: string | null; driver?: string | null; receiver?: string | null } | null;
};

function SignatureBox({ label, url }: { label: string; url?: string | null }) {
  return (
    <div>
      <div className="flex h-16 items-end justify-center border-b border-dashed border-border">
        {url ? <img src={url} alt={label} className="max-h-16 max-w-full object-contain" /> : null}
      </div>
      <p className="mt-2">{label}</p>
    </div>
  );
}

function Sheet({
  title,
  number,
  subtitle,
  codes,
  signatures,
  children,
}: {
  title: string;
  number: string;
  subtitle?: string;
  codes?: Array<{ value: string; label: string }>;
  signatures?: { issuer?: string | null; driver?: string | null; receiver?: string | null } | null;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-[210mm] bg-white p-8 print:p-0">
      <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <BrandMark />
          <h1 className="mt-4 text-2xl font-black">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          <div className="mt-2 text-sm">
            <span className="text-muted">شماره سند </span>
            <span className="font-black">{number}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-3">
          {(codes ?? []).map((code) => (
            <QrMark key={code.label} value={code.value} label={code.label} size={86} />
          ))}
        </div>
      </header>
      <div className="mt-6 grid gap-4">{children}</div>
      <footer className="mt-10 grid grid-cols-3 gap-6 border-t border-border pt-8 text-center text-sm">
        <SignatureBox label="امضای صادرکننده" url={signatures?.issuer} />
        <SignatureBox label="امضای راننده" url={signatures?.driver} />
        <SignatureBox label="امضای گیرنده" url={signatures?.receiver} />
      </footer>
    </article>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between gap-4 border-b border-border/70 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export function PrintDocumentPage({ kind, id }: { kind: string; id: string }) {
  const params = useSearchParams();
  const invoice = useQuery({
    queryKey: ["print-invoice", id],
    queryFn: () => api<InvoiceDetail>(`/invoices/${id}`),
    enabled: kind === "invoice",
  });
  const request = useQuery({
    queryKey: ["print-request", id],
    queryFn: () => api<RequestDto>(`/requests/${id}`),
    enabled: kind === "request",
  });
  const job = useQuery({
    queryKey: ["print-job", id],
    queryFn: () => api<JobDto>(`/jobs/${id}`),
    enabled: kind === "waybill",
  });
  const invoiceJob = useQuery({
    queryKey: ["print-job", invoice.data?.jobId],
    queryFn: () => api<JobDto>(`/jobs/${invoice.data!.jobId}`),
    enabled: kind === "invoice" && Boolean(invoice.data?.jobId),
  });
  const ready = (kind === "invoice" && invoice.data) || (kind === "request" && request.data) || (kind === "waybill" && job.data);

  useEffect(() => {
    if (ready && params.get("auto") === "1") {
      const timer = window.setTimeout(() => window.print(), 500);
      return () => window.clearTimeout(timer);
    }
  }, [ready, params]);

  return (
    <div className={kind === "invoice" ? "print-invoice-root" : undefined}>
      <div className="no-print sticky top-0 z-10 flex justify-end gap-2 border-b border-border bg-white/95 p-3">
        <Button type="button" onClick={() => window.print()}>
          ذخیره PDF
        </Button>
      </div>
      {kind === "invoice" && invoice.data ? <InvoiceSheet invoice={invoice.data} signatures={invoiceJob.data?.signatures} /> : null}
      {kind === "request" && request.data ? <RequestSheet request={request.data} /> : null}
      {kind === "waybill" && job.data ? <WaybillSheet job={job.data} /> : null}
      {!ready ? <p className="p-8">در حال آماده‌سازی سند…</p> : null}
    </div>
  );
}

function PartyCell({ title, party }: { title: string; party: InvoiceDetail["issuer"] }) {
  return (
    <section className="rounded-lg border border-border p-2.5">
      <h2 className="mb-1 text-[11px] font-black text-muted">{title}</h2>
      <p className="text-[13px] font-bold leading-5">{party.name}</p>
      {party.legalName && party.legalName !== party.name ? <p className="text-[11px] leading-4">{party.legalName}</p> : null}
      <p className="mt-1 text-[11px] leading-4 text-muted">
        {[party.phone, party.taxId ? `شناسه ${party.taxId}` : null, party.registrationNumber ? `ثبت ${party.registrationNumber}` : null]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </section>
  );
}

function InvoiceSheet({ invoice, signatures }: { invoice: InvoiceDetail; signatures?: JobDto["signatures"] }) {
  const loadNumber = invoice.waybill || invoice.jobNumber || invoice.requestNumber || invoice.orderNumber;
  const visibleLines = invoice.lines.slice(0, 6);
  const hidden = invoice.lines.length - visibleLines.length;

  return (
    <article className="print-single-page mx-auto w-[210mm] max-w-full bg-white p-5 text-[12px] leading-5 print:p-0">
      <header className="flex items-start justify-between gap-3 border-b-2 border-ink pb-2">
        <div className="min-w-0">
          <BrandMark />
          <h1 className="mt-2 text-xl font-black leading-7">فاکتور حمل</h1>
          <p className="text-[11px] text-muted">
            {statusFa(invoice.type)} · {statusFa(invoice.status)} · شرکت شیدوَر تجارت ایرانیان
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <QrMark value={qrPayload("invoice", invoice.number)} label={`فاکتور ${invoice.number}`} size={72} />
          {loadNumber ? <QrMark value={qrPayload("load", loadNumber)} label={`بار ${loadNumber}`} size={72} /> : null}
        </div>
      </header>

      <div className="mt-2 grid grid-cols-4 gap-x-3 gap-y-1 border-b border-border pb-2 text-[11px]">
        <div>
          <span className="text-muted">شماره فاکتور</span>
          <div className="font-black">{invoice.number}</div>
        </div>
        <div>
          <span className="text-muted">شماره بار</span>
          <div className="font-black">{loadNumber || "—"}</div>
        </div>
        <div>
          <span className="text-muted">تاریخ صدور</span>
          <div className="font-semibold">{formatDate(invoice.issuedAt ?? invoice.createdAt)}</div>
        </div>
        <div>
          <span className="text-muted">سررسید</span>
          <div className="font-semibold">{formatDate(invoice.dueAt)}</div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <PartyCell title="صادرکننده" party={invoice.issuer} />
        <PartyCell title="گیرنده" party={invoice.recipient} />
      </div>

      <div className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div className="rounded-lg bg-background px-2 py-1.5">
          <div className="text-muted">مسیر</div>
          <div className="font-bold">{[invoice.originCity, invoice.destinationCity].filter(Boolean).join(" ← ") || "—"}</div>
        </div>
        <div className="rounded-lg bg-background px-2 py-1.5">
          <div className="text-muted">بارنامه</div>
          <div className="font-bold">{invoice.waybill || "—"}</div>
        </div>
        <div className="rounded-lg bg-background px-2 py-1.5">
          <div className="text-muted">راننده</div>
          <div className="font-bold">{invoice.driver?.name || "—"}</div>
        </div>
        <div className="rounded-lg bg-background px-2 py-1.5">
          <div className="text-muted">درخواست</div>
          <div className="font-bold">{invoice.requestNumber || invoice.orderNumber}</div>
        </div>
      </div>

      <table className="mt-2 w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-ink text-white">
            <th className="px-2 py-1.5 text-start font-bold">شرح</th>
            <th className="px-2 py-1.5 text-start font-bold">مقدار</th>
            <th className="px-2 py-1.5 text-start font-bold">مبلغ واحد</th>
            <th className="px-2 py-1.5 text-start font-bold">جمع</th>
          </tr>
        </thead>
        <tbody>
          {visibleLines.map((line) => (
            <tr key={line.id} className="border-b border-border">
              <td className="px-2 py-1.5">{line.description}</td>
              <td className="px-2 py-1.5">{formatNumber(line.quantity)}</td>
              <td className="px-2 py-1.5">{formatMoney(line.unitPrice, invoice.currencyCode)}</td>
              <td className="px-2 py-1.5 font-bold">{formatMoney(line.lineTotal, invoice.currencyCode)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 ? <p className="mt-1 text-[11px] text-muted">و {formatNumber(hidden)} قلم دیگر در سامانه</p> : null}

      <div className="mt-2 ms-auto w-72 rounded-lg border border-ink/20 p-2 text-[12px]">
        <div className="flex justify-between">
          <span>جمع جزء</span>
          <span className="font-semibold">{formatMoney(invoice.subtotal, invoice.currencyCode)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span>مالیات</span>
          <span className="font-semibold">{formatMoney(invoice.taxAmount, invoice.currencyCode)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-ink pt-1 text-[13px] font-black">
          <span>جمع کل</span>
          <span>{formatMoney(invoice.total, invoice.currencyCode)}</span>
        </div>
      </div>

      <footer className="mt-3 grid grid-cols-3 gap-4 border-t border-border pt-3 text-center text-[11px]">
        <SignatureBox label="امضای صادرکننده" url={signatures?.issuer} />
        <SignatureBox label="امضای راننده" url={signatures?.driver} />
        <SignatureBox label="امضای گیرنده" url={signatures?.receiver} />
      </footer>
    </article>
  );
}

function RequestSheet({ request }: { request: RequestDto }) {
  const job = request.orders?.[0]?.jobs?.[0];
  const invoiceNumber = request.orders?.[0]?.invoices?.[0]?.number;
  const loadNumber = job?.shipment?.trackingNumber || job?.number;
  return (
    <Sheet
      title="برگه درخواست بار"
      number={request.number}
      subtitle={statusFa(request.status)}
      codes={[
        { value: qrPayload("request", request.number), label: `درخواست ${request.number}` },
        ...(loadNumber ? [{ value: qrPayload("load", loadNumber), label: `بار ${loadNumber}` }] : []),
        ...(invoiceNumber ? [{ value: qrPayload("invoice", invoiceNumber), label: `فاکتور ${invoiceNumber}` }] : []),
      ]}
    >
      <Row label="صاحب بار" value={request.company?.tradeName} />
      <Row label="تلفن" value={request.company?.phone} />
      <Row label="مسیر" value={[request.originCity, request.destinationCity].filter(Boolean).join(" ← ")} />
      <Row label="بارگیری" value={request.originLine1} />
      <Row label="تحویل" value={request.destinationLine1} />
      <Row label="تاریخ تحویل" value={formatDate(request.requestedDeliveryDate)} />
      <Row label="کرایه" value={request.budgetAmount != null ? formatMoney(request.budgetAmount, request.currencyCode) : "—"} />
      <Row label="بارنامه" value={loadNumber} />
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted">
            <th className="py-2 text-start">کالا</th>
            <th className="py-2 text-start">مقدار</th>
          </tr>
        </thead>
        <tbody>
          {request.items.map((item, index) => (
            <tr key={`${item.name}-${index}`} className="border-b border-border/70">
              <td className="py-2">{item.name}</td>
              <td>
                {formatNumber(item.quantity)} {item.unitCode}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {request.notes ? <p className="text-sm leading-7">{request.notes}</p> : null}
    </Sheet>
  );
}

function WaybillSheet({ job }: { job: JobDto }) {
  const loadNumber = job.waybill || job.number;
  const invoiceNumber = job.invoices?.[0]?.number;
  return (
    <Sheet
      title="بارنامه حمل کالا"
      number={loadNumber}
      subtitle={`${job.number} · ${statusFa(job.status)}`}
      signatures={job.signatures}
      codes={[
        { value: qrPayload("load", loadNumber), label: `بار ${loadNumber}` },
        ...(job.requestNumber ? [{ value: qrPayload("request", job.requestNumber), label: `درخواست ${job.requestNumber}` }] : []),
        ...(invoiceNumber ? [{ value: qrPayload("invoice", invoiceNumber), label: `فاکتور ${invoiceNumber}` }] : []),
      ]}
    >
      <Row label="صاحب بار" value={job.cargoOwner?.name} />
      <Row label="تلفن صاحب بار" value={job.cargoOwner?.phone} />
      <Row label="درخواست" value={job.requestNumber} />
      <Row label="سفارش" value={job.orderNumber} />
      <Row label="مبدأ" value={[job.originCity, job.originLine1].filter(Boolean).join(" · ")} />
      <Row label="مقصد" value={[job.destinationCity, job.destinationLine1].filter(Boolean).join(" · ")} />
      <Row label="بارگیری" value={formatDateTime(job.pickupAt)} />
      <Row label="مهلت تحویل" value={formatDateTime(job.deliveryDeadline)} />
      <Row label="راننده" value={job.assignedDriver?.name} />
      <Row label="تلفن راننده" value={job.assignedDriver?.phone} />
      <Row label="گواهینامه" value={job.assignedDriver?.licenseNumber} />
      <Row label="پلاک" value={job.assignedVehicle?.plateNumber ?? job.assignedDriver?.plateNumber} />
      <Row label="ناوگان" value={job.requiredVehicleType ? statusFa(job.requiredVehicleType) : null} />
      <Row label="وزن" value={job.cargoWeight != null ? `${formatNumber(job.cargoWeight)} ${job.cargoUnit}` : null} />
      <Row label="کرایه" value={job.compensationAmount != null ? formatMoney(job.compensationAmount, job.currencyCode) : null} />
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted">
            <th className="py-2 text-start">شرح بار</th>
            <th className="py-2 text-start">مقدار</th>
          </tr>
        </thead>
        <tbody>
          {(job.cargoItems ?? []).map((item, index) => (
            <tr key={`${item.name}-${index}`} className="border-b border-border/70">
              <td className="py-2">{item.name}</td>
              <td>
                {formatNumber(item.quantity)} {item.unitCode}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Sheet>
  );
}
