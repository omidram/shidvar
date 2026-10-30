"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, MetaGrid, PageHeader, RouteLine } from "@/components/domain/chrome";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { statusFa } from "@/lib/status-fa";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";
import { PriceBookEditor } from "@/components/domain/price-book-editor";
import { DocumentGallery } from "@/components/domain/document-uploader";
import { AdminInfoRequestPanel } from "@/components/domain/admin-info-request";
import { AdminCoinsPanel } from "@/components/domain/coins-view";
import { SpecialToggle } from "@/components/domain/special-badge";

type CompanyProfile = {
  id: string;
  type: string;
  status: string;
  legalName: string;
  tradeName: string;
  registrationNumber?: string | null;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  defaultCurrency: string;
  isSpecial: boolean;
  specialNote?: string | null;
  verificationNotes?: string | null;
  rejectedReason?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
  members: Array<{ title?: string | null; isOwner: boolean; firstName: string; lastName: string; phone?: string | null; email?: string | null; status: string }>;
  warehouses: Array<{ id: string; code: string; name: string; status: string; city: string; region: string; line1: string; postalCode?: string | null }>;
  addresses: Array<{ id: string; label?: string | null; line1: string; city: string; region: string; postalCode?: string | null }>;
  requests: Array<{ id: string; number: string; status: string; originCity?: string | null; destinationCity?: string | null; requestedDeliveryDate: string; items: string[] }>;
  orders: Array<{ id: string; number: string; status: string; invoiceCount: number; jobCount: number }>;
  drivers: Array<{ id: string; status: string; name: string; phone?: string | null }>;
};

export function CompanyProfileView({ id }: { id: string }) {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ["company", id], queryFn: () => api<CompanyProfile>(`/admin/companies/${id}`) });
  if (q.isLoading) return <p>{t.common.loading}</p>;
  if (q.isError || !q.data) return <ErrorState message={t.common.error} />;
  const company = q.data;
  const isCargoOwner = company.type === "REQUESTER" || company.type === "SUPPLIER";

  if (!isCargoOwner) {
    return (
      <div className="grid gap-6">
        <PageHeader title={company.tradeName} description={`پروفایل راننده · ${statusFa(company.status)}`} />
        <SpecialToggle companyId={company.id} isSpecial={company.isSpecial} note={company.specialNote} />
        <Card>
          <h2 className="font-bold">پروفایل راننده</h2>
          <div className="mt-3 grid gap-3">
            {company.drivers.map((driver) => (
              <Link key={driver.id} href={`/admin/drivers/${driver.id}`} className="rounded-2xl border border-border p-4 hover:bg-background">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold">{driver.name}</div>
                  <StatusBadge status={driver.status} />
                </div>
                {driver.phone ? <p className="mt-1 text-sm text-muted">{driver.phone}</p> : null}
              </Link>
            ))}
            {!company.drivers.length ? <p className="text-sm text-muted">پروفایل راننده برای این حساب هنوز کامل نشده است.</p> : null}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <PageHeader title={company.tradeName} description={`صاحب بار · ${statusFa(company.status)}${company.isSpecial ? " · ویژه" : ""}`} />
      <SpecialToggle companyId={company.id} isSpecial={company.isSpecial} note={company.specialNote} />
      <Card>
        <h2 className="mb-3 font-bold">شناسنامه صاحب بار</h2>
        <MetaGrid
          items={[
            { label: t.common.legalName, value: company.legalName },
            { label: t.common.phone, value: company.phone },
            { label: t.common.email, value: company.email },
            { label: t.common.taxId, value: company.taxId },
            { label: t.common.registration, value: company.registrationNumber },
            { label: "وب‌سایت", value: company.website },
            { label: "واحد پول", value: "ریال" },
            { label: "تاریخ تأیید", value: formatDate(company.verifiedAt) },
            { label: "عضویت از", value: formatDate(company.createdAt) },
            { label: "یادداشت بررسی", value: company.verificationNotes },
            { label: "دلیل رد", value: company.rejectedReason },
          ]}
        />
      </Card>
      <AdminInfoRequestPanel companyId={company.id} target="company" />
      <AdminCoinsPanel companyId={company.id} />
      {isCargoOwner ? <PriceBookEditor companyId={company.id} /> : null}
      <DocumentGallery kind="company" entityId={company.id} title="مدارک صاحب بار" canVerify />
      <Card>
        <h2 className="mb-3 font-bold">اعضای شرکت</h2>
        <div className="grid gap-3">
          {company.members.map((member, i) => (
            <div key={`${member.email ?? member.phone ?? i}`} className="rounded-2xl bg-background px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">
                  {member.firstName} {member.lastName}
                  {member.isOwner ? <span className="ms-2 text-xs text-primary">مالک</span> : null}
                </div>
                <StatusBadge status={member.status} />
              </div>
              <p className="mt-1 text-sm text-muted">
                {[member.title, member.phone, member.email].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">{t.menu.warehouses}</h2>
        {company.warehouses.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {company.warehouses.map((w) => (
              <div key={w.id} className="rounded-2xl border border-border p-4">
                <div className="font-bold">{w.name}</div>
                <p className="mt-1 text-sm text-muted">{w.code} · {statusFa(w.status)}</p>
                <p className="mt-2 text-sm">{w.city}، {w.region}</p>
                <p className="text-sm text-muted">{w.line1}{w.postalCode ? ` · ${w.postalCode}` : ""}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">انباری ثبت نشده.</p>
        )}
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">درخواست‌های اخیر</h2>
        <div className="grid gap-3">
          {company.requests.map((req) => (
            <Link key={req.id} href={`/admin/requests/${req.id}`} className="rounded-2xl border border-border p-4 hover:bg-background">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold">{req.number}</div>
                <StatusBadge status={req.status} />
              </div>
              <div className="mt-3">
                <RouteLine from={req.originCity ?? t.job.pickup} to={req.destinationCity ?? t.job.delivery} />
              </div>
              <p className="mt-2 text-sm text-muted">{req.items.join("، ")}</p>
              <p className="mt-1 text-xs text-muted">{t.request.deliveryDate}: {formatDate(req.requestedDeliveryDate)}</p>
            </Link>
          ))}
          {!company.requests.length ? <p className="text-sm text-muted">درخواستی ثبت نشده.</p> : null}
        </div>
      </Card>
    </div>
  );
}
