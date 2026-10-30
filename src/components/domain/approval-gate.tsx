"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/i18n/provider";
import { useMe } from "@/hooks/use-me";
import { Card } from "@/components/ui/card";
import { OwnDocumentGate } from "@/components/domain/document-uploader";
import { InfoRequestsPanel } from "@/components/domain/info-requests";

export function ApprovalGate({ kind, children }: { kind: "requester" | "driver"; children: ReactNode }) {
  const { t } = useI18n();
  const me = useMe();
  if (me.isLoading) return <p className="p-6">{t.common.loading}</p>;
  if (!me.data || me.data.isPlatformStaff) return <>{children}</>;

  const approved =
    kind === "driver"
      ? me.data.driverProfile?.status === "APPROVED"
      : me.data.memberships.some(
          (m) => (m.companyType === "REQUESTER" || m.companyType === "SUPPLIER") && m.companyStatus === "APPROVED",
        );

  if (approved) {
    return (
      <div className="grid gap-4">
        <InfoRequestsPanel onlyOpen />
        {children}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <Card className="overflow-hidden p-0">
        <img src="/media/loading-crew.jpg" alt="" className="h-48 w-full object-cover" />
        <div className="p-6">
          <h1 className="text-2xl font-black">{t.auth.pendingTitle}</h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            حساب شما ساخته شد و ۱۰۰۰ اعتبار هدیه گرفتید. مدیریت به‌زودی اطلاعات و مدارک تکمیلی لازم را از همین صفحه از شما می‌خواهد؛ بعد از بررسی، حساب فعال می‌شود.
          </p>
        </div>
      </Card>
      <InfoRequestsPanel />
      <OwnDocumentGate />
    </div>
  );
}
