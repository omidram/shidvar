"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/domain/chrome";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { statusFa } from "@/lib/status-fa";
import { useI18n } from "@/i18n/provider";
import { DocumentGallery } from "@/components/domain/document-uploader";

export default function VerificationsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["verifications"],
    queryFn: () =>
      api<{
        companies: Array<{
          id: string;
          tradeName: string;
          legalName?: string;
          type: string;
          status: string;
          phone?: string | null;
          email?: string | null;
          registrationNumber?: string | null;
          taxId?: string | null;
          memberships?: Array<{ user?: { firstName: string; lastName: string; phone?: string | null } }>;
        }>;
        drivers: Array<{
          id: string;
          status: string;
          licenseNumber?: string | null;
          licenseType?: string | null;
          user: { firstName: string; lastName: string; phone?: string | null; email?: string | null };
          carrier?: { company?: { tradeName: string } };
        }>;
      }>("/admin/verifications"),
  });
  const moderateCompany = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/admin/companies/${id}/status`, { method: "POST", body: JSON.stringify({ status, reason: status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["verifications"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const moderateDriver = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/admin/drivers/${id}/status`, { method: "POST", body: JSON.stringify({ status, reason: status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["verifications"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const companies = q.data?.companies ?? [];
  const drivers = q.data?.drivers ?? [];
  return (
    <div>
      <PageHeader title={t.menu.verifications} description="شرکت‌ها و رانندگان در انتظار تأیید — قبل از تصمیم پروفایل را باز کنید" />
      {!companies.length && !drivers.length ? <EmptyState title={t.common.empty} /> : null}
      <div className="grid gap-3">
        {companies.map((c) => {
          const owner = c.memberships?.[0]?.user;
          return (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/admin/companies/${c.id}`} className="text-lg font-bold hover:underline">
                    {c.tradeName}
                  </Link>
                  <p className="mt-1 text-sm text-muted">{c.legalName}</p>
                  <p className="mt-2 text-sm">
                    {statusFa(c.type)} · {[c.phone, c.email, c.taxId, c.registrationNumber].filter(Boolean).join(" · ")}
                  </p>
                  {owner ? (
                    <p className="mt-1 text-sm text-muted">
                      رابط: {owner.firstName} {owner.lastName}{owner.phone ? ` · ${owner.phone}` : ""}
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => moderateCompany.mutate({ id: c.id, status: "APPROVED" })}>{t.common.accept}</Button>
                <Button variant="secondary" onClick={() => moderateCompany.mutate({ id: c.id, status: "REJECTED" })}>
                  {t.common.reject}
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/admin/companies/${c.id}`}>{t.common.details}</Link>
                </Button>
              </div>
              <div className="mt-4">
                <DocumentGallery kind="company" entityId={c.id} title="مدارک شرکت" canVerify />
              </div>
            </Card>
          );
        })}
        {drivers.map((d) => (
          <Card key={d.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`/admin/drivers/${d.id}`} className="text-lg font-bold hover:underline">
                  {d.user.firstName} {d.user.lastName}
                </Link>
                <p className="mt-2 text-sm">
                  {[d.user.phone, d.user.email, d.carrier?.company?.tradeName].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {t.common.license}: {d.licenseNumber ?? "—"}
                  {d.licenseType ? ` · ${d.licenseType}` : ""}
                </p>
              </div>
              <StatusBadge status={d.status} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => moderateDriver.mutate({ id: d.id, status: "APPROVED" })}>{t.common.accept}</Button>
              <Button variant="secondary" onClick={() => moderateDriver.mutate({ id: d.id, status: "REJECTED" })}>
                {t.common.reject}
              </Button>
              <Button asChild variant="secondary">
                <Link href={`/admin/drivers/${d.id}`}>{t.common.viewProfile}</Link>
              </Button>
            </div>
            <div className="mt-4">
              <DocumentGallery kind="driver" entityId={d.id} title="مدارک راننده" canVerify />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
