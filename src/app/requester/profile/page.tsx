"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, MetaGrid, PageHeader } from "@/components/domain/chrome";
import { DocumentGallery } from "@/components/domain/document-uploader";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { PortalSettings } from "@/lib/settings";
import { statusFa } from "@/lib/status-fa";
import { useI18n } from "@/i18n/provider";

export default function OwnerProfilePage() {
  const { t } = useI18n();
  const query = useQuery({ queryKey: ["settings"], queryFn: () => api<PortalSettings>("/settings") });
  if (query.isLoading) return <p className="text-sm text-muted">{t.common.loading}</p>;
  if (query.isError || !query.data) return <ErrorState message={t.common.error} />;
  const data = query.data;
  const name = `${data.user.firstName} ${data.user.lastName}`.trim() || data.user.phone || "صاحب بار";

  return (
    <div className="grid gap-6">
      <PageHeader title={data.company?.tradeName || name} description="پروفایل صاحب بار" />
      <Card>
        <h2 className="mb-3 font-bold">شناسنامه صاحب بار</h2>
        <MetaGrid
          items={[
            { label: "نام", value: name },
            { label: t.common.phone, value: data.user.phone },
            { label: t.common.email, value: data.user.email },
            { label: "نام تجاری", value: data.company?.tradeName },
            { label: t.common.legalName, value: data.company?.legalName },
            { label: "تلفن شرکت", value: data.company?.phone },
            { label: t.common.taxId, value: data.company?.taxId },
            { label: t.common.registration, value: data.company?.registrationNumber },
            { label: "وضعیت", value: data.company ? statusFa(data.company.status) : statusFa(data.user.status) },
          ]}
        />
        <Link href="/requester/settings" className="mt-4 inline-block text-sm font-semibold text-primary">
          ویرایش در تنظیمات
        </Link>
      </Card>
      {data.company ? <DocumentGallery kind="company" entityId={data.company.id} title="مدارک صاحب بار" canUpload /> : null}
    </div>
  );
}
