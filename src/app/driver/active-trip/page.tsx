"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader, EmptyState, ErrorState } from "@/components/domain/chrome";
import { TrackingCard, type TrackingDto } from "@/components/domain/tracking-panel";
import { api, liveInterval } from "@/lib/api";
import { useI18n } from "@/i18n/provider";

export default function ActiveTripPage() {
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
      <PageHeader title={t.menu.activeTrip} description={t.tracking.driverHint} />
      {rows.length === 0 ? (
        <EmptyState title={t.tracking.empty} hint={t.tracking.driverEmpty} />
      ) : (
        rows.map((row) => <TrackingCard key={row.jobId} data={row} href={`/driver/jobs/${row.jobId}`} />)
      )}
    </div>
  );
}
