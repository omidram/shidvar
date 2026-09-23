"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, FilterBar, MetaGrid, PageHeader, RouteLine, SimpleTable, Timeline } from "@/components/domain/chrome";
import { api } from "@/lib/api";
import { statusFa } from "@/lib/status-fa";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";
import { useMe } from "@/hooks/use-me";
import { driverHref, invoiceHref, jobHref } from "@/lib/portal-links";
import { usePathname } from "next/navigation";
import { PdfExportButton } from "@/components/domain/pdf-export";
import { TrackingPanel } from "@/components/domain/tracking-panel";
import { JobOpsPanel } from "@/components/domain/ops-panels";
import { DocumentGallery } from "@/components/domain/document-uploader";

export { DashboardView } from "@/components/domain/dashboard-home";

type RequestRow = {
  id: string;
  number: string;
  status: string;
  requestedDeliveryDate: string;
  budgetAmount?: number | string | null;
  currencyCode?: string;
  originCity?: string | null;
  destinationCity?: string | null;
  originLine1?: string | null;
  destinationLine1?: string | null;
  pickupNotes?: string | null;
  notes?: string | null;
  matchScore?: number;
  items: Array<{ name: string; quantity: number; unitCode?: string }>;
  company?: { tradeName: string; phone?: string | null };
};

export function RequestList({ hrefPrefix, marketplace }: { hrefPrefix: string; marketplace?: boolean }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const q = useQuery({
    queryKey: ["requests", marketplace ? "market" : "own"],
    queryFn: () => api<RequestRow[]>(marketplace ? "/marketplace/requests" : "/requests"),
  });
  const rows = useMemo(() => {
    return (q.data ?? []).filter((row) => {
      const hay = `${row.number} ${row.items.map((i) => i.name).join(" ")} ${row.company?.tradeName ?? ""}`.toLowerCase();
      const matchQuery = !query || hay.includes(query.toLowerCase());
      const matchStatus = !status || row.status === status;
      return matchQuery && matchStatus;
    });
  }, [q.data, query, status]);
  if (q.isLoading) return <p>{t.common.loading}</p>;
  if (q.isError) return <ErrorState message={t.common.error} />;
  const statuses = Array.from(new Set((q.data ?? []).map((r) => r.status))).map((value) => ({ value, label: statusFa(value) }));
  return (
    <div>
      <PageHeader
        title={marketplace ? t.request.marketplace : t.request.title}
        description={marketplace ? "بارهای امتیازدهی‌شده برای ظرفیت شما" : "درخواست‌های حمل شرکت پخش"}
        actions={
          hrefPrefix.startsWith("/requester") ? (
            <Button asChild>
              <Link href="/requester/requests/new">{t.request.create}</Link>
            </Button>
          ) : null
        }
      />
      <FilterBar
        query={query}
        onQuery={setQuery}
        status={status}
        onStatus={setStatus}
        statuses={[{ value: "", label: t.common.all }, ...statuses]}
      />
      {rows.length === 0 ? (
        <EmptyState
          title={t.common.empty}
          hint={t.common.emptyHint}
          action={
            hrefPrefix.startsWith("/requester") ? (
              <Button asChild>
                <Link href="/requester/requests/new">{t.request.create}</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <Link key={row.id} href={`${hrefPrefix}/${row.id}`}>
              <Card className="transition hover:-translate-y-0.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold">{row.number}</div>
                    {row.company ? <p className="mt-1 text-sm">{t.common.cargoOwner}: {row.company.tradeName}{row.company.phone ? ` · ${row.company.phone}` : ""}</p> : null}
                  </div>
                  <StatusBadge status={row.status} />
                </div>
                {(row.originCity || row.destinationCity) && (
                  <div className="mt-4">
                    <RouteLine from={row.originCity ?? t.job.pickup} to={row.destinationCity ?? t.job.delivery} />
                  </div>
                )}
                <p className="mt-2 text-sm text-muted">
                  {row.originLine1 || row.destinationLine1 ? `${row.originLine1 ?? "—"} → ${row.destinationLine1 ?? "—"}` : null}
                </p>
                <p className="mt-2 text-sm">
                  {row.items.map((i) => `${i.name} ${i.quantity}${i.unitCode ? ` ${i.unitCode}` : ""}`).join("، ") || t.request.items}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span>{t.request.deliveryDate}: {formatDate(row.requestedDeliveryDate)}</span>
                  {row.budgetAmount != null ? <span>{t.request.budget}: {formatMoney(row.budgetAmount, row.currencyCode)}</span> : null}
                  {row.pickupNotes ? <span className="text-muted">{row.pickupNotes}</span> : null}
                  {marketplace ? <span className="rounded-full bg-primary/10 px-3 py-1 font-bold text-primary">{t.request.score}: {row.matchScore ?? "—"}</span> : null}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrderList({ hrefPrefix }: { hrefPrefix: string }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const q = useQuery({
    queryKey: ["orders"],
    queryFn: () => api<Array<{ id: string; number: string; status: string; merchandiseTotal?: number; currencyCode: string; requesterCompany?: { tradeName: string }; supplierCompany?: { tradeName: string } }>>("/orders"),
  });
  const rows = (q.data ?? []).filter((row) => {
    const hay = `${row.number} ${row.requesterCompany?.tradeName ?? ""} ${row.supplierCompany?.tradeName ?? ""}`.toLowerCase();
    return (!query || hay.includes(query.toLowerCase())) && (!status || row.status === status);
  });
  if (q.isLoading) return <p>{t.common.loading}</p>;
  if (q.isError) return <ErrorState message={t.common.error} />;
  return (
    <div>
      <PageHeader title={t.order.title} description="سفارش‌های زنده، تکمیل‌شده و نیازمند تأیید" />
      <FilterBar
        query={query}
        onQuery={setQuery}
        status={status}
        onStatus={setStatus}
        statuses={[{ value: "", label: t.common.all }, ...Array.from(new Set((q.data ?? []).map((r) => r.status))).map((value) => ({ value, label: statusFa(value) }))]}
      />
      {rows.length === 0 ? (
        <EmptyState title={t.common.empty} hint={t.common.emptyHint} />
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <Link key={row.id} href={`${hrefPrefix}/${row.id}`}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold">{row.number}</div>
                  <p className="mt-1 text-sm text-muted">
                    {t.common.cargoOwner}: {row.requesterCompany?.tradeName ?? "—"}
                  </p>
                </div>
                <div className="text-end">
                  <StatusBadge status={row.status} />
                  <div className="mt-2 font-bold">{formatMoney(row.merchandiseTotal, row.currencyCode)}</div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

type JobDto = {
  id: string;
  number: string;
  status: string;
  cargoWeight: number;
  cargoUnit: string;
  requiredVehicleType?: string | null;
  compensationAmount?: number | string | null;
  pickupAt?: string | null;
  deliveryDeadline?: string | null;
  detailsReleased: boolean;
  cargoOwner?: { id?: string; name: string; legalName?: string | null; phone?: string | null; email?: string | null };
  cargoItems?: Array<{ name: string; quantity: number; unitCode: string; qualityNotes?: string | null; packagingNotes?: string | null }>;
  originCity?: string | null;
  destinationCity?: string | null;
  originLine1?: string | null;
  destinationLine1?: string | null;
  waybill?: string | null;
  requestId?: string | null;
  requestNumber?: string | null;
  requestNotes?: string | null;
  pickupNotes?: string | null;
  qualityNotes?: string | null;
  packagingNotes?: string | null;
  budgetAmount?: number | null;
  currencyCode?: string;
  assignedDriver?: {
    id: string;
    name: string;
    phone?: string | null;
    licenseNumber?: string | null;
    licenseType?: string | null;
    ratingAvg?: number;
    completedJobs?: number;
    plateNumber?: string | null;
    vehicleType?: string | null;
  } | null;
  assignedVehicle?: { plateNumber: string; vehicleType: string; brand?: string | null; model?: string | null; weightCapacity?: number } | null;
  invoices?: Array<{ id: string; number: string; type: string; status: string; total: number; currencyCode: string }>;
  pickup: { city: string; region: string; line1: string | null; latitude?: number | null; longitude?: number | null } | null;
  delivery: { city: string; region: string; line1: string | null; latitude?: number | null; longitude?: number | null } | null;
  applications?: Array<{ id: string; driverId: string; status: string; driver?: { ratingAvg: number; user: { firstName: string; lastName: string } } }>;
  shipment?: { id: string; items: Array<{ id: string; requestedQuantity: number; deliveredQuantity: number; unitCode: string }>; pod?: { receiverName: string; resolution: string } | null };
  deliveryDocs?: { complete: boolean } | null;
  orderNumber?: string;
  matchScore?: number;
  trackingActive?: boolean;
  items?: Array<{ id: string; name: string; quantity: number; unitCode: string }>;
};

export function JobBoard({ marketplace, hrefPrefix = "/driver/jobs" }: { marketplace?: boolean; hrefPrefix?: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const path = marketplace ? "/marketplace/jobs" : "/jobs";
  const q = useQuery({ queryKey: ["jobs", path], queryFn: () => api<JobDto[]>(path) });
  const accept = useMutation({
    mutationFn: (id: string) => api(`/jobs/${id}/accept`, { method: "POST" }),
    onSuccess: () => {
      toast.success("بار قبول شد و بارنامه صادر شد");
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api(`/jobs/${id}/reject`, { method: "POST" }),
    onSuccess: () => {
      toast.success("بار رد شد");
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isLoading) return <p>{t.common.loading}</p>;
  if (q.isError) return <ErrorState message={t.common.error} />;
  const rows = q.data ?? [];
  return (
    <div>
      <PageHeader title={marketplace ? t.job.incoming : t.job.title} description="صاحب بار، نوع محموله و مقصد را ببینید و تصمیم بگیرید." />
      {rows.length === 0 ? (
        <EmptyState title={t.common.empty} hint="وقتی باری در ناحیه شما آزاد شود اینجا ظاهر می‌شود." />
      ) : (
        <div className="grid gap-3">
          {rows.map((job) => (
            <Card key={job.id}>
              <div className="flex items-center justify-between gap-3">
                <Link href={`${hrefPrefix}/${job.id}`} className="text-lg font-bold hover:underline">
                  {job.number}
                  {job.requestNumber ? <span className="ms-2 text-sm font-normal text-muted">{job.requestNumber}</span> : null}
                </Link>
                <StatusBadge status={job.status} />
              </div>
              <div className="mt-4">
                <RouteLine from={job.originCity ?? job.pickup?.city ?? t.job.pickup} to={job.destinationCity ?? job.delivery?.city ?? t.job.delivery} />
              </div>
              {job.cargoOwner ? (
                <p className="mt-3 text-sm">
                  {t.common.cargoOwner}: {job.cargoOwner.name}
                  {job.cargoOwner.phone ? ` · ${job.cargoOwner.phone}` : ""}
                </p>
              ) : null}
              <p className="mt-1 text-sm text-muted">
                {(job.cargoItems ?? job.items ?? []).map((item) => `${item.name} ${item.quantity} ${item.unitCode}`).join("، ") || `${job.cargoWeight} ${job.cargoUnit}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted">
                {job.requiredVehicleType ? <span>{t.job.vehicleNeeded}: {statusFa(job.requiredVehicleType)}</span> : null}
                <span>{t.job.weight}: {formatNumber(job.cargoWeight)} {job.cargoUnit}</span>
                {job.compensationAmount != null ? <span>{t.job.fare}: {formatMoney(job.compensationAmount, job.currencyCode)}</span> : null}
                {job.pickupAt ? <span>{t.job.pickupTime}: {formatDateTime(job.pickupAt)}</span> : null}
                {job.waybill ? <span className="font-semibold text-foreground">{t.common.waybill}: {job.waybill}</span> : null}
                {job.trackingActive ? <span className="rounded-full bg-primary/10 px-3 py-1 font-bold text-primary">{t.tracking.live}</span> : null}
                {job.assignedDriver ? <span>{t.common.driver}: {job.assignedDriver.name}</span> : null}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {job.matchScore != null ? <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">{t.request.score}: {job.matchScore}</span> : null}
                {marketplace && ["OFFERED_TO_DRIVERS", "DRIVER_APPLIED"].includes(job.status) ? (
                  <>
                    <Button onClick={() => accept.mutate(job.id)}>{t.common.accept}</Button>
                    <Button variant="secondary" onClick={() => reject.mutate(job.id)}>
                      {t.common.reject}
                    </Button>
                  </>
                ) : (
                  <Button asChild variant="secondary">
                    <Link href={`${hrefPrefix}/${job.id}`}>{t.common.details}</Link>
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function RequestDetailView({ id, mode }: { id: string; mode: "requester" | "supplier" | "admin" }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["request", id],
    queryFn: () =>
      api<{
        id: string;
        number: string;
        status: string;
        requestedDeliveryDate: string;
        budgetAmount: number | null;
        currencyCode: string;
        originCity?: string | null;
        destinationCity?: string | null;
        originLine1?: string | null;
        destinationLine1?: string | null;
        pickupNotes?: string | null;
        qualityNotes?: string | null;
        packagingNotes?: string | null;
        notes?: string | null;
        createdAt?: string;
        publishedAt?: string | null;
        company?: { id?: string; tradeName: string; legalName?: string; phone?: string | null; email?: string | null };
        items: Array<{ id: string; name: string; quantity: number; unitCode: string; minQuantity?: number; maxQuantity?: number; qualityNotes?: string | null; packagingNotes?: string | null }>;
        requirements?: Array<{ kind: string; value: string }>;
        orders: Array<{
          id: string;
          number: string;
          invoices: Array<{ id: string; number: string; type: string; status: string; total: number; currencyCode: string }>;
          jobs: Array<{
            id: string;
            number: string;
            status: string;
            cargoWeight?: number | string;
            cargoUnit?: string;
            requiredVehicleType?: string | null;
            compensationAmount?: number | string | null;
            pickupAt?: string | null;
            deliveryDeadline?: string | null;
            assignedDriver?: {
              id: string;
              licenseNumber?: string | null;
              licenseType?: string | null;
              ratingAvg?: number | string;
              completedJobs?: number;
              user: { firstName: string; lastName: string; phone?: string | null; email?: string | null };
              vehicles?: Array<{ vehicle: { plateNumber: string; vehicleType: string; brand?: string | null; model?: string | null } }>;
            } | null;
            assignedVehicle?: { plateNumber: string; vehicleType: string } | null;
            shipment?: { trackingNumber?: string | null } | null;
          }>;
        }>;
      }>(`/requests/${id}`),
  });
  const publish = useMutation({
    mutationFn: () => api(`/requests/${id}/publish`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["request", id] }),
  });
  const submit = useMutation({
    mutationFn: () => api(`/requests/${id}/submit`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["request", id] }),
  });

  if (q.isLoading) return <p>{t.common.loading}</p>;
  if (q.isError || !q.data) return <ErrorState message={t.common.error} />;
  const req = q.data;
  const job = req.orders?.[0]?.jobs?.[0];
  const invoices = req.orders?.flatMap((order) => order.invoices ?? []) ?? [];
  const driver = job?.assignedDriver;
  const vehicle = driver?.vehicles?.[0]?.vehicle ?? job?.assignedVehicle;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={req.number}
        description={statusFa(req.status)}
        actions={
          <div className="flex gap-2">
            <PdfExportButton kind="request" id={req.id} label={t.common.pdfExport} />
            {job?.id ? <PdfExportButton kind="waybill" id={job.id} label="خروجی بارنامه" /> : null}
            {mode !== "supplier" && req.status === "DRAFT" ? <Button onClick={() => submit.mutate()}>{t.common.submit}</Button> : null}
            {mode === "admin" && ["SUBMITTED", "UNDER_REVIEW", "PUBLISHED"].includes(req.status) ? (
              <Button onClick={() => publish.mutate()}>{t.common.publish}</Button>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <div className="text-xs text-muted">{t.request.deliveryDate}</div>
          <div className="mt-1 font-bold">{formatDate(req.requestedDeliveryDate)}</div>
        </Card>
        <Card>
          <div className="text-xs text-muted">{t.request.budget}</div>
          <div className="mt-1 font-bold">{req.budgetAmount != null ? formatMoney(req.budgetAmount, req.currencyCode) : "—"}</div>
        </Card>
        <Card>
          <div className="text-xs text-muted">{t.request.items}</div>
          <div className="mt-1 font-bold">{req.items.length} قلم</div>
        </Card>
      </div>
      <Card>
        <h2 className="mb-3 font-bold">مسیر و نشانی</h2>
        <RouteLine from={req.originCity ?? t.job.pickup} to={req.destinationCity ?? t.job.delivery} />
        <MetaGrid
          items={[
            { label: t.request.originAddress, value: req.originLine1 },
            { label: t.request.destinationAddress, value: req.destinationLine1 },
            { label: t.common.cargoOwner, value: req.company ? `${req.company.tradeName}${req.company.phone ? ` · ${req.company.phone}` : ""}` : null },
            { label: t.common.email, value: req.company?.email },
            { label: "تاریخ ثبت", value: formatDateTime(req.createdAt) },
            { label: "تاریخ انتشار", value: formatDateTime(req.publishedAt) },
          ]}
        />
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">یادداشت‌ها و الزامات</h2>
        <MetaGrid
          items={[
            { label: t.common.notes, value: req.notes },
            { label: t.job.cargoNotes, value: req.pickupNotes ? statusFa(req.pickupNotes) : null },
            { label: t.job.quality, value: req.qualityNotes },
            { label: t.job.packaging, value: req.packagingNotes },
            { label: t.request.certifications, value: req.requirements?.map((r) => r.value).join("، ") },
          ]}
        />
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">{t.request.items}</h2>
        <SimpleTable
          headers={[t.request.items, t.common.quantity, t.request.min, t.request.max, t.job.quality, t.job.packaging]}
          rows={req.items.map((item) => [
            item.name,
            `${formatNumber(item.quantity)} ${item.unitCode}`,
            item.minQuantity != null ? formatNumber(item.minQuantity) : "—",
            item.maxQuantity != null ? formatNumber(item.maxQuantity) : "—",
            item.qualityNotes ?? "—",
            item.packagingNotes ?? "—",
          ])}
        />
      </Card>
      {driver ? (
        <Card className="overflow-hidden p-0">
          <img src="/media/tracking-phone.jpg" alt="" className="h-36 w-full object-cover" />
          <div className="p-5">
            <h2 className="font-bold">{t.request.driverConfirmed}</h2>
            <p className="mt-2 text-lg font-semibold">
              {driver.user.firstName} {driver.user.lastName}
            </p>
            <MetaGrid
              items={[
                { label: t.common.phone, value: driver.user.phone },
                { label: t.common.email, value: driver.user.email },
                { label: t.common.license, value: driver.licenseNumber },
                { label: "نوع گواهینامه", value: driver.licenseType },
                { label: t.common.rating, value: driver.ratingAvg != null ? formatNumber(driver.ratingAvg) : null },
                { label: "بارهای تکمیل‌شده", value: driver.completedJobs },
                { label: t.common.plate, value: vehicle?.plateNumber },
                { label: t.common.fleet, value: vehicle?.vehicleType ? statusFa(vehicle.vehicleType) : null },
                { label: t.common.waybill, value: job?.shipment?.trackingNumber },
                { label: t.job.title, value: job ? `${job.number} · ${statusFa(job.status)}` : null },
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild>
                <Link href={driverHref(pathname, driver.id)}>{t.common.viewProfile}</Link>
              </Button>
              {job ? (
                <Button asChild variant="secondary">
                  <Link href={jobHref(pathname, job.id)}>{t.common.viewLoad}</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <h2 className="font-bold">{t.request.compare}</h2>
          <p className="mt-2 text-sm text-muted">{t.request.waitingDriver}</p>
          {job ? (
            <div className="mt-3">
              <p className="text-sm">{job.number} · {statusFa(job.status)}</p>
              <Button asChild className="mt-3" variant="secondary">
                <Link href={jobHref(pathname, job.id)}>{t.common.viewLoad}</Link>
              </Button>
            </div>
          ) : null}
        </Card>
      )}
      {invoices.length ? (
        <Card>
          <h2 className="mb-3 font-bold">{t.common.invoice}</h2>
          <div className="grid gap-3">
            {invoices.map((invoice) => (
              <Link key={invoice.id} href={invoiceHref(pathname, invoice.id)} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background px-4 py-3">
                <div>
                  <div className="font-semibold">{invoice.number}</div>
                  <p className="text-sm text-muted">{statusFa(invoice.type)} · {statusFa(invoice.status)}</p>
                </div>
                <div className="font-bold">{formatMoney(Number(invoice.total), invoice.currencyCode)}</div>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export function OrderDetailView({ id }: { id: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const qc = useQueryClient();
  const me = useMe();
  const q = useQuery({
    queryKey: ["order", id],
    queryFn: () =>
      api<{
        id: string;
        number: string;
        status: string;
        items: Array<{ name: string; quantity: number; unitCode: string; lineTotal: number }>;
        jobs: Array<JobDto & { applications?: JobDto["applications"] }>;
        history: Array<{ toStatus: string; createdAt: string; entityType: string }>;
      }>(`/orders/${id}`),
  });
  const select = useMutation({
    mutationFn: ({ jobId, driverId }: { jobId: string; driverId: string }) =>
      api(`/jobs/${jobId}/select-driver`, { method: "POST", body: JSON.stringify({ driverId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order", id] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const confirm = useMutation({
    mutationFn: (jobId: string) => api(`/jobs/${jobId}/confirm-driver`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p>{t.common.loading}</p>;
  if (q.isError || !q.data) return <ErrorState message={t.common.error} />;
  const order = q.data;
  const requester = me.data?.memberships.some((m) => m.companyType === "REQUESTER") || me.data?.isPlatformStaff;
  return (
    <div className="grid gap-6">
      <PageHeader title={order.number} description={statusFa(order.status)} />
      <Card>
        <h2 className="font-semibold">{t.request.items}</h2>
        <SimpleTable
          headers={[t.request.items, t.common.quantity, t.common.total]}
          rows={(order.items ?? []).map((item) => [item.name, `${item.quantity} ${item.unitCode}`, formatMoney(item.lineTotal)])}
        />
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">{t.order.timeline}</h2>
        <Timeline items={(order.history ?? []).map((h) => ({ label: `${h.entityType}: ${h.toStatus}`, at: formatDate(h.createdAt) }))} />
      </Card>
      {(order.jobs ?? []).map((job) => (
        <Card key={job.id}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{job.number}</h2>
            <StatusBadge status={job.status} />
          </div>
          <p className="mt-2 text-sm text-muted">
            {t.job.pickup}: {job.pickup?.line1 ?? job.pickup?.city} → {t.job.delivery}: {job.delivery?.line1 ?? job.delivery?.city}
          </p>
          {requester && job.applications?.length ? (
            <div className="mt-4 grid gap-2">
              {job.applications.map((app) => (
                <div key={app.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
                  <span>
                    {app.driver?.user.firstName} {app.driver?.user.lastName} · {statusFa(app.status)}
                  </span>
                  {app.status === "SUBMITTED" ? (
                    <Button onClick={() => select.mutate({ jobId: job.id, driverId: app.driverId })}>{t.job.select}</Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {requester && job.status === "DRIVER_SELECTED" ? (
            <Button className="mt-3" onClick={() => confirm.mutate(job.id)}>
              {t.job.confirmDriver}
            </Button>
          ) : null}
          {requester && job.status === "PROOF_SUBMITTED" ? (
            <Button asChild className="mt-3">
              <Link href={jobHref(pathname, job.id)}>{t.job.reviewDeliveryDocs}</Link>
            </Button>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

const DRIVER_STEPS = ["ARRIVING_AT_PICKUP", "AT_PICKUP", "LOADING", "LOADED", "IN_TRANSIT", "ARRIVING_AT_DESTINATION", "AT_DESTINATION", "UNLOADING", "DELIVERED"] as const;

export function DriverJobView({ id }: { id: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const me = useMe();
  const isDriver = Boolean(me.data?.driverProfile);
  const requester = Boolean(me.data?.isPlatformStaff || me.data?.memberships.some((m) => m.companyType === "REQUESTER"));
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["job", id], queryFn: () => api<JobDto>(`/jobs/${id}`) });
  const accept = useMutation({
    mutationFn: () => api(`/jobs/${id}/accept`, { method: "POST" }),
    onSuccess: () => {
      toast.success("بار قبول شد");
      qc.invalidateQueries({ queryKey: ["job", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: () => api(`/jobs/${id}/reject`, { method: "POST" }),
    onSuccess: () => {
      toast.success("بار رد شد");
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const status = useMutation({
    mutationFn: (next: string) => api(`/jobs/${id}/status`, { method: "POST", body: JSON.stringify({ status: next }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job", id] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const pod = useMutation({
    mutationFn: (payload: unknown) => api(`/jobs/${id}/pod`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      toast.success("رسید برای تأیید صاحب بار ارسال شد");
      qc.invalidateQueries({ queryKey: ["job", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p>{t.common.loading}</p>;
  if (q.isError || !q.data) return <ErrorState message={t.common.error} />;
  const job = q.data;
  const mapUrl =
    job.detailsReleased && job.pickup?.latitude
      ? `https://www.openstreetmap.org/?mlat=${job.pickup.latitude}&mlon=${job.pickup.longitude}`
      : null;
  const next = DRIVER_STEPS.find((step) => DRIVER_STEPS.indexOf(step) > DRIVER_STEPS.indexOf(job.status as (typeof DRIVER_STEPS)[number])) ?? DRIVER_STEPS[0];

  return (
    <div className="grid gap-4">
      <PageHeader
        title={job.number}
        description={`${statusFa(job.status)}${job.requestNumber ? ` · ${job.requestNumber}` : ""}`}
        actions={
          <div className="flex gap-2">
            <PdfExportButton kind="waybill" id={job.id} label="خروجی بارنامه" />
            {job.requestId ? <PdfExportButton kind="request" id={job.requestId} label="خروجی درخواست" /> : null}
            {job.invoices?.[0]?.id ? <PdfExportButton kind="invoice" id={job.invoices[0].id} label={t.common.pdfExport} /> : null}
          </div>
        }
      />
      <Card className="overflow-hidden p-0">
        <img src="/media/cargo-2.jpg" alt="" className="h-40 w-full object-cover" />
        <div className="grid gap-4 p-5 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted">{t.job.fare}</div>
            <div className="mt-1 font-bold">{job.compensationAmount != null ? formatMoney(job.compensationAmount, job.currencyCode) : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted">{t.job.weight}</div>
            <div className="mt-1 font-bold">{formatNumber(job.cargoWeight)} {job.cargoUnit}</div>
          </div>
          <div>
            <div className="text-xs text-muted">{t.job.vehicleNeeded}</div>
            <div className="mt-1 font-bold">{job.requiredVehicleType ? statusFa(job.requiredVehicleType) : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted">{t.common.waybill}</div>
            <div className="mt-1 font-bold">{job.waybill ?? "—"}</div>
          </div>
        </div>
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">مسیر بار</h2>
        <RouteLine from={`${job.originCity ?? job.pickup?.city ?? t.job.pickup}`} to={`${job.destinationCity ?? job.delivery?.city ?? t.job.delivery}`} />
        <MetaGrid
          items={[
            { label: t.job.pickup, value: [job.pickup?.city, job.pickup?.region, job.detailsReleased ? job.pickup?.line1 ?? job.originLine1 : null].filter(Boolean).join("، ") },
            { label: t.job.delivery, value: [job.delivery?.city, job.delivery?.region, job.detailsReleased ? job.delivery?.line1 ?? job.destinationLine1 : null].filter(Boolean).join("، ") },
            { label: t.job.pickupTime, value: formatDateTime(job.pickupAt) },
            { label: t.job.deadline, value: formatDateTime(job.deliveryDeadline) },
            { label: t.order.title, value: job.orderNumber },
            { label: t.request.title, value: job.requestNumber },
          ]}
        />
        {!job.detailsReleased ? <p className="mt-3 text-sm text-muted">{t.job.redacted}</p> : null}
        {mapUrl ? (
          <Button asChild className="mt-3" variant="secondary">
            <a href={mapUrl} target="_blank" rel="noreferrer">
              {t.job.navigate}
            </a>
          </Button>
        ) : null}
      </Card>
      {job.trackingActive || ["LOADED", "IN_TRANSIT", "ARRIVING_AT_DESTINATION", "AT_DESTINATION", "UNLOADING"].includes(job.status) ? (
        <TrackingPanel jobId={job.id} />
      ) : null}
      <Card>
        <h2 className="mb-3 font-bold">{t.common.cargoOwner}</h2>
        {job.cargoOwner ? (
          <MetaGrid
            items={[
              { label: t.auth.company, value: job.cargoOwner.name },
              { label: t.common.legalName, value: job.cargoOwner.legalName },
              { label: t.common.phone, value: job.cargoOwner.phone },
              { label: t.common.email, value: job.cargoOwner.email },
            ]}
          />
        ) : (
          <p className="text-sm text-muted">—</p>
        )}
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">{t.job.cargo}</h2>
        <SimpleTable
          headers={[t.request.items, t.common.quantity, t.job.quality, t.job.packaging]}
          rows={(job.cargoItems ?? job.items ?? []).map((item) => [
            item.name,
            `${formatNumber(item.quantity)} ${item.unitCode}`,
            "qualityNotes" in item ? item.qualityNotes ?? "—" : "—",
            "packagingNotes" in item ? item.packagingNotes ?? "—" : "—",
          ])}
        />
        <MetaGrid
          items={[
            { label: t.job.cargoNotes, value: job.requestNotes ? statusFa(job.requestNotes) : job.pickupNotes ? statusFa(job.pickupNotes) : null },
            { label: t.job.quality, value: job.qualityNotes },
            { label: t.job.packaging, value: job.packagingNotes },
            { label: t.request.budget, value: job.budgetAmount != null ? formatMoney(job.budgetAmount, job.currencyCode) : null },
          ]}
        />
      </Card>
      {job.assignedDriver ? (
        <Card>
          <h2 className="mb-3 font-bold">{t.common.driver}</h2>
          <p className="text-lg font-semibold">{job.assignedDriver.name}</p>
          <MetaGrid
            items={[
              { label: t.common.phone, value: job.assignedDriver.phone },
              { label: t.common.license, value: job.assignedDriver.licenseNumber },
              { label: t.common.rating, value: job.assignedDriver.ratingAvg != null ? formatNumber(job.assignedDriver.ratingAvg) : null },
              { label: t.common.plate, value: job.assignedDriver.plateNumber ?? job.assignedVehicle?.plateNumber },
              { label: t.common.fleet, value: job.assignedDriver.vehicleType ? statusFa(job.assignedDriver.vehicleType) : job.assignedVehicle ? statusFa(job.assignedVehicle.vehicleType) : null },
            ]}
          />
          <Button asChild className="mt-3" variant="secondary">
            <Link href={driverHref(pathname, job.assignedDriver.id)}>{t.common.viewProfile}</Link>
          </Button>
        </Card>
      ) : null}
      {job.invoices?.length ? (
        <Card>
          <h2 className="mb-3 font-bold">{t.job.documents}</h2>
          <div className="grid gap-2">
            {job.invoices.map((invoice) => (
              <Link key={invoice.id} href={invoiceHref(pathname, invoice.id)} className="flex items-center justify-between rounded-2xl bg-background px-4 py-3">
                <span>{invoice.number} · {statusFa(invoice.status)}</span>
                <span className="font-bold">{formatMoney(invoice.total, invoice.currencyCode)}</span>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
      {isDriver && ["OFFERED_TO_DRIVERS", "DRIVER_APPLIED"].includes(job.status) ? (
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => accept.mutate()}>{t.common.accept}</Button>
          <Button variant="secondary" onClick={() => reject.mutate()}>
            {t.common.reject}
          </Button>
        </div>
      ) : null}
      {isDriver &&
      (job.status === "DRIVER_ASSIGNED" ||
        (job.status !== "DELIVERED" && (DRIVER_STEPS as readonly string[]).includes(job.status))) ? (
        <Button onClick={() => status.mutate(job.status === "DRIVER_ASSIGNED" ? "ARRIVING_AT_PICKUP" : next)}>{t.job.nextStatus}</Button>
      ) : null}
      {["DELIVERED", "PROOF_SUBMITTED", "COMPLETED", "CONFIRMED", "DISPUTED"].includes(job.status) ? (
        <DocumentGallery
          kind="job"
          entityId={job.id}
          title={t.job.deliveryDocs}
          canUpload={(slot) => {
            if (me.data?.isPlatformStaff && ["DELIVERED", "PROOF_SUBMITTED"].includes(job.status)) return true;
            if (slot.signatureRole === "issuer") return requester && ["DELIVERED", "PROOF_SUBMITTED"].includes(job.status);
            return isDriver && job.status === "DELIVERED";
          }}
          canSign={(slot) => {
            if (me.data?.isPlatformStaff && ["DELIVERED", "PROOF_SUBMITTED"].includes(job.status)) return Boolean(slot.signable);
            if (slot.signatureRole === "issuer") return requester && ["DELIVERED", "PROOF_SUBMITTED"].includes(job.status);
            return isDriver && job.status === "DELIVERED";
          }}
          context={{ number: job.number, waybill: job.waybill }}
        />
      ) : null}
      {isDriver && job.status === "DELIVERED" && job.shipment ? (
        <Card>
          <h2 className="font-semibold">{t.job.pod}</h2>
          <p className="mt-1 text-sm text-muted">{t.job.podNeedDocs}</p>
          <PodForm
            items={job.shipment.items}
            docsComplete={Boolean(job.deliveryDocs?.complete)}
            pending={pod.isPending}
            onSubmit={(payload) => pod.mutate(payload)}
          />
        </Card>
      ) : null}
      {isDriver && job.status === "PROOF_SUBMITTED" ? (
        <Card>
          <h2 className="font-semibold">{t.job.pod}</h2>
          <p className="mt-1 text-sm text-muted">{t.job.podWaiting}</p>
        </Card>
      ) : null}
      <JobOpsPanel
        jobId={job.id}
        status={job.status}
        currencyCode={job.currencyCode}
        receiverName={job.shipment?.pod?.receiverName}
      />
    </div>
  );
}

function PodForm({
  items,
  docsComplete,
  pending,
  onSubmit,
}: {
  items: Array<{ id: string; requestedQuantity: number; unitCode: string }>;
  docsComplete: boolean;
  pending?: boolean;
  onSubmit: (payload: {
    receiverName: string;
    notes?: string;
    damageNotes?: string;
    deliveredQuantities: Array<{ shipmentItemId: string; quantity: number }>;
  }) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [damageNotes, setDamageNotes] = useState("");
  return (
    <form
      className="mt-4 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!docsComplete) {
          toast.error(t.job.podNeedDocs);
          return;
        }
        onSubmit({
          receiverName: name,
          notes: notes || undefined,
          damageNotes: damageNotes || undefined,
          deliveredQuantities: items.map((item) => ({ shipmentItemId: item.id, quantity: Number(item.requestedQuantity) })),
        });
      }}
    >
      <label className="grid gap-1 text-sm">
        {t.job.receiver}
        <input className="h-10 rounded-md border border-border px-3" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="grid gap-1 text-sm">
        {t.common.notes}
        <input className="h-10 rounded-md border border-border px-3" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        {t.ops.disputeHint}
        <input className="h-10 rounded-md border border-border px-3" value={damageNotes} onChange={(e) => setDamageNotes(e.target.value)} placeholder={t.job.quality} />
      </label>
      {!docsComplete ? <p className="text-sm text-danger">{t.job.podNeedDocs}</p> : null}
      <Button type="submit" disabled={!docsComplete || pending}>
        {t.common.submit}
      </Button>
    </form>
  );
}
