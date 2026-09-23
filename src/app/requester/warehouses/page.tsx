"use client";

import { useQuery } from "@tanstack/react-query";
import { EmptyState, PageHeader } from "@/components/domain/chrome";
import { Card } from "@/components/ui/card";
import { WarehouseIcon } from "@/components/visual/icons";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/provider";

type Warehouse = {
  code: string;
  name: string;
  status?: string;
  capacityWeight?: number | string | null;
  address?: { city: string; region?: string; line1?: string; line2?: string | null; district?: string | null; postalCode?: string | null };
};

export default function WarehousesPage() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api<Warehouse[]>("/tenancy/warehouses"),
  });
  return (
    <div>
      <PageHeader title={t.menu.warehouses} description="نقاط بارگیری و تحویل ساخته‌شده از مسیر درخواست‌ها" />
      {!q.data?.length ? (
        <EmptyState title={t.common.empty} hint={t.common.emptyHint} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {q.data.map((w) => (
            <Card key={w.code} className="flex items-start gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <WarehouseIcon className="h-6 w-6" />
              </div>
              <div>
                <div className="font-bold">{w.name}</div>
                <p className="mt-1 text-sm text-muted">{w.code}{w.status ? ` · ${w.status}` : ""}</p>
                <p className="mt-2 text-sm">
                  {[w.address?.city, w.address?.region, w.address?.district].filter(Boolean).join("، ")}
                </p>
                <p className="text-sm text-muted">
                  {[w.address?.line1, w.address?.line2, w.address?.postalCode].filter(Boolean).join(" · ")}
                </p>
                {w.capacityWeight != null ? <p className="mt-2 text-xs text-muted">ظرفیت: {String(w.capacityWeight)}</p> : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
