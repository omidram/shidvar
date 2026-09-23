"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/domain/chrome";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { statusFa } from "@/lib/status-fa";
import { formatDateTime } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";

type UserRow = {
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: string;
  createdAt?: string;
  memberships?: Array<{ isOwner?: boolean; company?: { tradeName: string; type: string; status: string } }>;
};

export default function UsersPage() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api<UserRow[]>("/admin/users"),
  });
  return (
    <div>
      <PageHeader title={t.menu.users} description="کاربران سامانه به همراه شرکت، نقش و وضعیت حساب" />
      <div className="grid gap-3">
        {(q.data ?? []).map((u) => (
          <Card key={`${u.email ?? ""}-${u.phone ?? ""}-${u.firstName}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-bold">{u.firstName} {u.lastName}</div>
                <p className="mt-1 text-sm text-muted">{[u.phone, u.email].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <StatusBadge status={u.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(u.memberships ?? []).map((m, i) => (
                <span key={`${m.company?.tradeName}-${i}`} className="rounded-full bg-background px-3 py-1 text-xs">
                  {m.company?.tradeName ?? "—"} · {statusFa(m.company?.type)} · {statusFa(m.company?.status)}
                  {m.isOwner ? " · مالک" : ""}
                </span>
              ))}
            </div>
            {u.createdAt ? <p className="mt-3 text-xs text-muted">عضویت: {formatDateTime(u.createdAt)}</p> : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
