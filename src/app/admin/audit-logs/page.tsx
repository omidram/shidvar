"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/domain/chrome";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";

const ACTION_FA: Record<string, string> = {
  "auth.login": "ورود به حساب",
  "auth.logout": "خروج از حساب",
  "auth.failed_login": "ورود ناموفق",
  "job.applied": "درخواست قبول بار",
  "job.accepted_by_driver": "قبول بار توسط راننده",
  "job.rejected_by_driver": "رد بار توسط راننده",
  "job.driver_selected": "انتخاب راننده",
  "job.driver_confirmed": "تأیید تخصیص راننده",
  "request.published": "انتشار درخواست",
  "request.created": "ثبت درخواست",
  "offer.submitted": "ثبت پیشنهاد",
  "offer.accepted": "قبول پیشنهاد",
  "pod.submitted": "ثبت رسید تحویل",
  "pod.returned": "بازگشت مدارک تحویل",
  "delivery.confirmed": "تأیید تحویل",
  "invoice.issued": "صدور فاکتور",
  "company.under_review": "ارسال شرکت برای بررسی",
};

const ENTITY_FA: Record<string, string> = {
  TransportationJob: "بار",
  ProcurementRequest: "درخواست",
  SupplierOffer: "پیشنهاد",
  Shipment: "محموله",
  User: "کاربر",
  Company: "شرکت",
  Invoice: "فاکتور",
};

export default function AuditPage() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["audit"],
    queryFn: () =>
      api<Array<{ action: string; entityType: string; entityId: string; createdAt: string; actorRole?: string | null; ipAddress?: string | null }>>("/admin/audit-logs"),
  });
  return (
    <div>
      <PageHeader
        title={t.menu.audit}
        description="تاریخچهٔ ورود، تغییر وضعیت بار، تأیید مدارک و صدور اسناد — هر ردیف یک عمل ثبت‌شده در سیستم است."
      />
      <div className="grid gap-3">
        {(q.data ?? []).map((row) => (
          <Card key={`${row.entityId}-${row.createdAt}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-bold">{ACTION_FA[row.action] ?? row.action}</div>
                <p className="mt-1 text-sm text-muted">
                  {ENTITY_FA[row.entityType] ?? row.entityType} · {row.entityId.slice(0, 8)}
                  {row.actorRole ? ` · نقش ${row.actorRole}` : ""}
                </p>
              </div>
              <div className="text-end text-sm text-muted">
                <div>{formatDateTime(row.createdAt)}</div>
                {row.ipAddress ? <div className="mt-1">{row.ipAddress}</div> : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
