"use client";

import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, PageHeader } from "@/components/domain/chrome";
import { TrackingCard, type TrackingDto } from "@/components/domain/tracking-panel";
import { api, liveInterval } from "@/lib/api";
import { useI18n } from "@/i18n/provider";

export function TrackingBoard({ description }: { description?: string }) {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["tracking-live"],
    queryFn: () => api<TrackingDto[]>("/tracking"),
    refetchInterval: liveInterval(5000),
  });
  if (q.isLoading) return <p>{t.common.loading}</p>;
  if (q.isError) return <ErrorState message={t.common.error} />;
  const rows = q.data ?? [];
  return (
    <div className="grid gap-6">
      <PageHeader title={t.menu.tracking} description={description ?? t.tracking.pageHint} />
      {rows.length === 0 ? (
        <EmptyState title={t.tracking.empty} hint={t.tracking.emptyHint} />
      ) : (
        <div className="grid gap-4">
          {rows.map((row) => (
            <TrackingCard key={row.jobId} data={row} />
          ))}
        </div>
      )}
    </div>
  );
}
