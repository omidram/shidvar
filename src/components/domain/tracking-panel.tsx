"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { api, liveInterval } from "@/lib/api";
import { jobHref } from "@/lib/portal-links";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";
import { useMe } from "@/hooks/use-me";
import { readPhonePosition, useDriverGps } from "@/hooks/use-driver-gps";
import type { TrackingMapData } from "@/components/domain/tracking-map";

const TrackingMap = dynamic(() => import("@/components/domain/tracking-map").then((m) => m.TrackingMap), {
  ssr: false,
  loading: () => <div className="grid h-[420px] place-items-center rounded-3xl bg-background text-sm text-muted">در حال بارگذاری نقشه…</div>,
});

export type TrackingDto = TrackingMapData & {
  jobId: string;
  jobNumber: string;
  waybill?: string | null;
  status: string;
  sessionStatus: string;
  consentStatus?: string;
  needsConsent?: boolean;
  waitingForDriver?: boolean;
  deviceConsent?: boolean;
  source?: string;
  active: boolean;
  originCity?: string | null;
  destCity?: string | null;
  originLabel?: string;
  destLabel?: string;
  cargoOwner?: string;
  driver?: { id: string; name: string; phone?: string | null } | null;
  plate?: string | null;
  lastAt?: string | null;
  remainingKm: number;
  etaMinutes: number;
  routeKm: number;
  speedKmh?: number | null;
};

export function TrackingPanel({ jobId }: { jobId: string }) {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["tracking", jobId],
    queryFn: () => api<TrackingDto>(`/jobs/${jobId}/tracking`),
    refetchInterval: liveInterval(5000),
    retry: false,
  });
  if (q.isLoading) return <Card><p>{t.common.loading}</p></Card>;
  if (q.isError || !q.data) return null;
  return <TrackingCard data={q.data} />;
}

export function TrackingCard({ data, href }: { data: TrackingDto; href?: string }) {
  const { t } = useI18n();
  const me = useMe();
  const pathname = usePathname();
  const isAssignedDriver = Boolean(me.data?.driverProfile?.id && data.driver?.id === me.data.driverProfile.id);
  useDriverGps(data.jobId, Boolean(isAssignedDriver && data.active && data.deviceConsent));
  const link = href ?? jobHref(pathname, data.jobId);

  if (data.waitingForDriver && isAssignedDriver) {
    return <TrackingConsentCard data={data} href={link} />;
  }
  if (data.waitingForDriver) {
    return <TrackingWaitingCard data={data} href={link} />;
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div>
          <div className="text-xs font-bold text-primary">{data.deviceConsent ? t.tracking.phoneSource : t.tracking.live}</div>
          <Link href={link} className="mt-1 block text-lg font-black hover:underline">
            {data.waybill || data.jobNumber}
          </Link>
          <p className="mt-1 text-sm text-muted">
            {data.originCity} ← {data.destCity}
            {data.driver ? ` · ${data.driver.name}` : ""}
            {data.plate ? ` · ${data.plate}` : ""}
          </p>
        </div>
        <StatusBadge status={data.status} />
      </div>
      <TrackingMap data={data} className="h-[380px] w-full" />
      <div className="grid gap-3 p-5 sm:grid-cols-4">
        <Meta label={t.tracking.remaining} value={`${formatNumber(data.remainingKm)} ${t.tracking.km}`} />
        <Meta label={t.tracking.eta} value={`${formatNumber(data.etaMinutes)} ${t.tracking.minutes}`} />
        <Meta label={t.tracking.speed} value={data.speedKmh != null ? `${formatNumber(data.speedKmh)} ${t.tracking.kmh}` : "—"} />
        <Meta label={t.tracking.updated} value={formatDateTime(data.lastAt)} />
      </div>
    </Card>
  );
}

function TrackingWaitingCard({ data, href }: { data: TrackingDto; href?: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const link = href ?? jobHref(pathname, data.jobId);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-amber-700">{t.tracking.waiting}</div>
          <Link href={link} className="mt-1 block text-lg font-black hover:underline">
            {data.waybill || data.jobNumber}
          </Link>
          <p className="mt-1 text-sm text-muted">
            {data.originCity} ← {data.destCity}
            {data.driver ? ` · ${data.driver.name}` : ""}
          </p>
        </div>
        <StatusBadge status={data.status} />
      </div>
      <p className="mt-4 text-sm leading-7 text-muted">{t.tracking.waitingHint}</p>
    </Card>
  );
}

function TrackingConsentCard({ data, href }: { data: TrackingDto; href?: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const qc = useQueryClient();
  const link = href ?? jobHref(pathname, data.jobId);
  const [allowed, setAllowed] = useState(false);
  const consent = useMutation({
    mutationFn: async () => {
      if (!allowed) throw new Error(t.tracking.allowHint);
      const point = await readPhonePosition();
      return api(`/jobs/${data.jobId}/tracking/consent`, {
        method: "POST",
        body: JSON.stringify({ deviceAllowed: true, ...point }),
      });
    },
    onSuccess: () => {
      toast.success(t.tracking.phoneSource);
      void qc.invalidateQueries({ queryKey: ["tracking", data.jobId] });
      void qc.invalidateQueries({ queryKey: ["tracking-live"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: Error) => {
      if (error.message === "geo-denied") toast.error(t.tracking.geoDenied);
      else if (error.message === "geo-missing") toast.error(t.tracking.geoMissing);
      else toast.error(error.message);
    },
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-primary">{t.tracking.consentTitle}</div>
          <Link href={link} className="mt-1 block text-lg font-black hover:underline">
            {data.waybill || data.jobNumber}
          </Link>
          <p className="mt-1 text-sm text-muted">
            {data.originCity} ← {data.destCity}
          </p>
        </div>
        <StatusBadge status={data.status} />
      </div>
      <p className="mt-4 text-sm leading-7 text-muted">{t.tracking.consentBody}</p>
      <label className="mt-4 flex items-start gap-3 rounded-2xl bg-background px-4 py-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-primary"
          checked={allowed}
          onChange={(e) => setAllowed(e.target.checked)}
        />
        <span>
          <span className="block font-bold">{t.tracking.allowLabel}</span>
          <span className="text-muted">{t.tracking.allowHint}</span>
        </span>
      </label>
      <Button className="mt-4 w-full" disabled={!allowed || consent.isPending} onClick={() => consent.mutate()}>
        {consent.isPending ? t.common.loading : t.tracking.confirmConsent}
      </Button>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-bold">{value}</div>
    </div>
  );
}
