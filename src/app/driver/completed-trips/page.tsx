"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, PageHeader, RouteLine } from "@/components/domain/chrome";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, liveInterval } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";

type CompletedTrip = {
  id: string;
  kind: "partner" | "job";
  number: string;
  title: string;
  source: string;
  sourceKind: string;
  from: string;
  to: string;
  cargo: string;
  cartonCount: number | null;
  status: string;
  completedAt: string;
};

export default function CompletedTripsPage() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["driver-completed-trips"],
    queryFn: () => api<CompletedTrip[]>("/driver/completed-trips"),
    refetchInterval: liveInterval(5000),
  });
  if (q.isLoading) return <p>{t.common.loading}</p>;
  if (q.isError) return <ErrorState message={t.common.error} />;
  const rows = q.data ?? [];
  return (
    <div className="grid gap-4">
      <PageHeader title={t.menu.completedTrips} description="بارهایی که مدیریت از طرف قرارداد یا صاحب بار به شما سپرده و تحویل شده‌اند." />
      {rows.length === 0 ? (
        <EmptyState title="هنوز سفری تمام نشده" hint="وقتی باری را تحویل دهید، همین‌جا می‌ماند." />
      ) : (
        rows.map((trip) => (
          <Card key={`${trip.kind}-${trip.id}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link href={trip.kind === "partner" ? `/driver/partner-shipments/${trip.id}` : `/driver/jobs/${trip.id}`} className="text-lg font-bold hover:underline">
                  {trip.title}
                  <span className="ms-2 text-sm font-normal text-muted">{trip.number}</span>
                </Link>
                <p className="mt-1 text-sm text-muted">
                  {trip.sourceKind}: {trip.source}
                </p>
              </div>
              <StatusBadge status={trip.status} />
            </div>
            <div className="mt-3">
              <RouteLine from={trip.from} to={trip.to} />
            </div>
            <p className="mt-3 text-sm text-muted">
              {trip.cargo}
              {trip.cartonCount != null ? ` · ${formatNumber(trip.cartonCount)} کارتن` : ""} · تحویل {formatDate(trip.completedAt)}
            </p>
            <Button asChild variant="secondary" className="mt-4">
              <Link href={trip.kind === "partner" ? `/driver/partner-shipments/${trip.id}` : `/driver/jobs/${trip.id}`}>{t.common.details}</Link>
            </Button>
          </Card>
        ))
      )}
    </div>
  );
}
