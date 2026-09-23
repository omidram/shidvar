"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ErrorState, MetaGrid, PageHeader, RouteLine, SimpleTable } from "@/components/domain/chrome";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { driverHref, jobHref, requestHref } from "@/lib/portal-links";
import { statusFa } from "@/lib/status-fa";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";
import { PdfExportButton } from "@/components/domain/pdf-export";

export type InvoiceDetail = {
  id: string;
  number: string;
  type: string;
  status: string;
  currencyCode: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  issuedAt?: string | null;
  dueAt?: string | null;
  createdAt: string;
  issuer: { name: string; legalName: string; phone?: string | null; email?: string | null; taxId?: string | null; registrationNumber?: string | null };
  recipient: { name: string; legalName: string; phone?: string | null; email?: string | null; taxId?: string | null; registrationNumber?: string | null };
  orderNumber: string;
  requestId?: string | null;
  requestNumber?: string | null;
  originCity?: string | null;
  destinationCity?: string | null;
  originLine1?: string | null;
  destinationLine1?: string | null;
  cargoNotes?: string | null;
  pickupNotes?: string | null;
  cargoItems: Array<{ name: string; quantity: number; unitCode: string }>;
  jobId?: string | null;
  jobNumber?: string | null;
  jobStatus?: string | null;
  cargoWeight?: number | null;
  cargoUnit?: string | null;
  requiredVehicleType?: string | null;
  fare?: number | null;
  waybill?: string | null;
  driver?: { id: string; name: string; phone?: string | null; licenseNumber?: string | null; ratingAvg?: number } | null;
  lines: Array<{ id: string; description: string; quantity: number; unitPrice: number; lineTotal: number }>;
  payments?: Array<{ id: string; status: string; provider: string; amount: number; paidAt?: string | null }>;
  payable?: boolean;
};

function PartyCard({ title, party }: { title: string; party: InvoiceDetail["issuer"] }) {
  const { t } = useI18n();
  return (
    <Card>
      <h2 className="font-bold">{title}</h2>
      <p className="mt-2 text-lg font-semibold">{party.name}</p>
      <MetaGrid
        items={[
          { label: t.common.legalName, value: party.legalName },
          { label: t.common.phone, value: party.phone },
          { label: t.common.email, value: party.email },
          { label: t.common.taxId, value: party.taxId },
          { label: t.common.registration, value: party.registrationNumber },
        ]}
      />
    </Card>
  );
}

export function InvoiceDetailView({ id }: { id: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["invoice", id], queryFn: () => api<InvoiceDetail>(`/invoices/${id}`) });
  const pay = useMutation({
    mutationFn: () => api(`/invoices/${id}/pay`, { method: "POST" }),
    onSuccess: () => {
      toast.success(t.ops.paid);
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isLoading) return <p>{t.common.loading}</p>;
  if (q.isError || !q.data) return <ErrorState message={t.common.error} />;
  const invoice = q.data;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={invoice.number}
        description={`${statusFa(invoice.type)} · ${statusFa(invoice.status)}`}
        actions={
          <div className="flex gap-2">
            {invoice.payable ? (
              <Button onClick={() => pay.mutate()} disabled={pay.isPending}>
                {t.ops.payInvoice}
              </Button>
            ) : null}
            <PdfExportButton kind="invoice" id={invoice.id} label={t.common.pdfExport} />
            {invoice.jobId ? <PdfExportButton kind="waybill" id={invoice.jobId} label="خروجی بارنامه" /> : null}
            {invoice.requestId ? <PdfExportButton kind="request" id={invoice.requestId} label="خروجی درخواست" /> : null}
          </div>
        }
      />
      <Card className="overflow-hidden p-0">
        <img src="/media/invoice-illustration.jpg" alt="" className="h-40 w-full object-cover" />
        <div className="grid gap-4 p-5 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted">{t.common.total}</div>
            <div className="mt-1 text-xl font-bold">{formatMoney(invoice.total, invoice.currencyCode)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">{t.common.issuedAt}</div>
            <div className="mt-1 font-semibold">{formatDateTime(invoice.issuedAt)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">{t.common.dueAt}</div>
            <div className="mt-1 font-semibold">{formatDate(invoice.dueAt)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">{t.common.waybill}</div>
            <div className="mt-1 font-semibold">{invoice.waybill ?? "—"}</div>
          </div>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <PartyCard title={t.common.issuer} party={invoice.issuer} />
        <PartyCard title={t.common.recipient} party={invoice.recipient} />
      </div>
      {(invoice.originCity || invoice.destinationCity) && (
        <Card>
          <h2 className="mb-3 font-bold">{t.common.relatedLoad}</h2>
          <RouteLine from={invoice.originCity ?? t.job.pickup} to={invoice.destinationCity ?? t.job.delivery} />
          <p className="mt-3 text-sm text-muted">
            {invoice.originLine1 || t.request.originAddress} → {invoice.destinationLine1 || t.request.destinationAddress}
          </p>
          <MetaGrid
            items={[
              { label: t.order.title, value: invoice.orderNumber },
              { label: t.request.title, value: invoice.requestNumber },
              { label: t.job.title, value: invoice.jobNumber ? `${invoice.jobNumber} · ${statusFa(invoice.jobStatus)}` : null },
              { label: t.common.waybillNo, value: invoice.waybill },
              { label: t.common.weight, value: invoice.cargoWeight != null ? `${formatNumber(invoice.cargoWeight)} ${invoice.cargoUnit}` : null },
              { label: t.job.vehicleNeeded, value: invoice.requiredVehicleType ? statusFa(invoice.requiredVehicleType) : null },
              { label: t.common.fare, value: invoice.fare != null ? formatMoney(invoice.fare, invoice.currencyCode) : null },
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {invoice.jobId ? (
              <Button asChild variant="secondary">
                <Link href={jobHref(pathname, invoice.jobId)}>{t.common.viewLoad}</Link>
              </Button>
            ) : null}
            {invoice.requestId ? (
              <Button asChild variant="secondary">
                <Link href={requestHref(pathname, invoice.requestId)}>{t.common.viewRequest}</Link>
              </Button>
            ) : null}
          </div>
        </Card>
      )}
      {invoice.driver ? (
        <Card>
          <h2 className="font-bold">{t.common.driver}</h2>
          <p className="mt-2 text-lg font-semibold">{invoice.driver.name}</p>
          <MetaGrid
            items={[
              { label: t.common.phone, value: invoice.driver.phone },
              { label: t.common.license, value: invoice.driver.licenseNumber },
              { label: t.common.rating, value: invoice.driver.ratingAvg != null ? formatNumber(invoice.driver.ratingAvg) : null },
            ]}
          />
          <Button asChild className="mt-4" variant="secondary">
            <Link href={driverHref(pathname, invoice.driver.id)}>{t.common.viewProfile}</Link>
          </Button>
        </Card>
      ) : null}
      {invoice.cargoItems.length ? (
        <Card>
          <h2 className="mb-3 font-bold">{t.request.items}</h2>
          <SimpleTable
            headers={[t.request.items, t.common.quantity]}
            rows={invoice.cargoItems.map((item) => [item.name, `${formatNumber(item.quantity)} ${item.unitCode}`])}
          />
          {invoice.cargoNotes ? <p className="mt-3 text-sm text-muted">{invoice.cargoNotes}</p> : null}
          {invoice.pickupNotes ? <p className="mt-1 text-sm text-muted">{statusFa(invoice.pickupNotes)}</p> : null}
        </Card>
      ) : null}
      <Card>
        <h2 className="mb-3 font-bold">{t.common.invoice}</h2>
        <SimpleTable
          headers={[t.request.items, t.common.quantity, t.common.price, t.common.total]}
          rows={invoice.lines.map((line) => [
            line.description,
            formatNumber(line.quantity),
            formatMoney(line.unitPrice, invoice.currencyCode),
            formatMoney(line.lineTotal, invoice.currencyCode),
          ])}
        />
        <div className="mt-4 grid justify-end gap-1 text-sm">
          <div className="flex justify-between gap-10">
            <span className="text-muted">{t.common.subtotal}</span>
            <span>{formatMoney(invoice.subtotal, invoice.currencyCode)}</span>
          </div>
          <div className="flex justify-between gap-10">
            <span className="text-muted">{t.common.tax}</span>
            <span>{formatMoney(invoice.taxAmount, invoice.currencyCode)}</span>
          </div>
          <div className="flex justify-between gap-10 text-base font-bold">
            <span>{t.common.total}</span>
            <span>{formatMoney(invoice.total, invoice.currencyCode)}</span>
          </div>
        </div>
        {invoice.payments?.length ? (
          <div className="mt-4 border-t border-border pt-4 text-sm">
            {invoice.payments.map((payment) => (
              <div key={payment.id} className="flex justify-between gap-6">
                <span className="text-muted">{statusFa(payment.status)} · {payment.provider}</span>
                <span>{formatMoney(payment.amount, invoice.currencyCode)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
