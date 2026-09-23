"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, PageHeader, RouteLine } from "@/components/domain/chrome";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { invoiceHref } from "@/lib/portal-links";
import { formatDate, formatMoney } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";

type Invoice = {
  id: string;
  number: string;
  type: string;
  status: string;
  currencyCode: string;
  total: number;
  issuedAt?: string | null;
  issuerName: string;
  recipientName: string;
  orderNumber: string;
  originCity?: string | null;
  destinationCity?: string | null;
  waybill?: string | null;
  driver?: { name: string } | null;
  cargoItems?: Array<{ name: string; quantity: number; unitCode: string }>;
  lines: Array<{ description: string; quantity: number; lineTotal: number }>;
};

export function InvoiceList({ description }: { description?: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const q = useQuery({ queryKey: ["invoices"], queryFn: () => api<Invoice[]>("/invoices") });
  const rows = q.data ?? [];
  return (
    <div>
      <PageHeader title={t.menu.invoices} description={description ?? "فاکتور و اسناد حمل صادرشده پس از قبول راننده"} />
      <Card className="mb-4 overflow-hidden p-0">
        <img src="/media/invoice-illustration.jpg" alt="" className="h-40 w-full object-cover" />
      </Card>
      {q.isLoading ? <p>{t.common.loading}</p> : null}
      {!q.isLoading && !rows.length ? <EmptyState title={t.common.empty} hint="با قبول اولین بار، فاکتور اینجا دیده می‌شود." /> : null}
      <div className="grid gap-3">
        {rows.map((invoice) => (
          <Link key={invoice.id} href={invoiceHref(pathname, invoice.id)}>
            <Card className="transition hover:-translate-y-0.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-bold">{invoice.number}</div>
                  <p className="mt-1 text-sm text-muted">
                    {t.common.issuer}: {invoice.issuerName} · {t.common.recipient}: {invoice.recipientName}
                  </p>
                </div>
                <div className="text-end">
                  <StatusBadge status={invoice.status} />
                  <div className="mt-2 text-lg font-bold">{formatMoney(invoice.total, invoice.currencyCode)}</div>
                </div>
              </div>
              {(invoice.originCity || invoice.destinationCity) && (
                <div className="mt-4">
                  <RouteLine from={invoice.originCity ?? t.job.pickup} to={invoice.destinationCity ?? t.job.delivery} />
                </div>
              )}
              <p className="mt-3 text-sm text-muted">
                {(invoice.cargoItems ?? invoice.lines).map((item) =>
                  "name" in item ? `${item.name} ${item.quantity} ${item.unitCode}` : item.description,
                ).join("، ") || invoice.orderNumber}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <span>{t.order.title}: {invoice.orderNumber}</span>
                {invoice.waybill ? <span>{t.common.waybill}: {invoice.waybill}</span> : null}
                {invoice.driver ? <span>{t.common.driver}: {invoice.driver.name}</span> : null}
                <span>{t.common.date}: {invoice.issuedAt ? formatDate(invoice.issuedAt) : "—"}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
