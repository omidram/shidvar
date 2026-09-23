"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, MetaGrid, PageHeader, RouteLine, SimpleTable } from "@/components/domain/chrome";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { jobHref } from "@/lib/portal-links";
import { statusFa } from "@/lib/status-fa";
import { formatDate, formatNumber } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";
import { DocumentGallery } from "@/components/domain/document-uploader";
import { useMe } from "@/hooks/use-me";

export type DriverProfile = {
  id: string;
  status: string;
  licenseNumber?: string | null;
  licenseType?: string | null;
  licenseExpiresAt?: string | null;
  nationalIdMasked?: string | null;
  ratingAvg: number;
  ratingCount: number;
  completedJobs: number;
  openJobCount: number;
  availableFrom?: string | null;
  availableTo?: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string; phone?: string | null; email?: string | null; status: string; createdAt: string };
  carrier: { id: string; tradeName: string; legalName: string; phone?: string | null; email?: string | null };
  areas: Array<{ id: string; name: string; type: string }>;
  vehicles: Array<{
    id: string;
    isPrimary: boolean;
    plateNumber: string;
    vehicleType: string;
    status: string;
    brand?: string | null;
    model?: string | null;
    year?: number | null;
    weightCapacity: number;
    volumeCapacity?: number | null;
    insuranceExpiresAt?: string | null;
    inspectionExpiresAt?: string | null;
  }>;
  recentJobs: Array<{
    id: string;
    number: string;
    status: string;
    originCity?: string | null;
    destinationCity?: string | null;
    cargoOwner: string;
    cargoItems: string[];
    waybill?: string | null;
    pickupAt?: string | null;
    createdAt: string;
  }>;
  ratings: Array<{
    id: string;
    overall: number;
    punctuality?: number | null;
    communication?: number | null;
    comment?: string | null;
    rater: string;
    createdAt: string;
  }>;
};

export function DriverProfileView({ id }: { id: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const me = useMe();
  const q = useQuery({ queryKey: ["driver", id], queryFn: () => api<DriverProfile>(`/drivers/${id}`) });
  const canUpload = Boolean(me.data?.isPlatformStaff || me.data?.driverProfile?.id === id);
  const canVerify = Boolean(me.data?.isPlatformStaff);
  if (q.isLoading) return <p>{t.common.loading}</p>;
  if (q.isError || !q.data) return <ErrorState message={t.common.error} />;
  const driver = q.data;
  const name = `${driver.user.firstName} ${driver.user.lastName}`.trim();

  return (
    <div className="grid gap-6">
      <PageHeader title={name} description={`${t.common.profile} · ${statusFa(driver.status)}`} />
      <Card className="overflow-hidden p-0">
        <img src="/media/tracking-phone.jpg" alt="" className="h-40 w-full object-cover" />
        <div className="grid gap-4 p-5 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted">{t.common.rating}</div>
            <div className="mt-1 text-xl font-bold">
              {formatNumber(driver.ratingAvg)} <span className="text-sm font-normal text-muted">({driver.ratingCount || driver.ratings.length} نظر)</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">بارهای تکمیل‌شده</div>
            <div className="mt-1 text-xl font-bold">{formatNumber(driver.completedJobs)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">بارهای باز</div>
            <div className="mt-1 text-xl font-bold">{formatNumber(driver.openJobCount)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">{t.common.license}</div>
            <div className="mt-1 font-semibold">{driver.licenseNumber ?? "—"}</div>
          </div>
        </div>
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">مشخصات فردی و تماس</h2>
        <MetaGrid
          items={[
            { label: t.auth.firstName, value: name },
            { label: t.common.phone, value: driver.user.phone },
            { label: t.common.email, value: driver.user.email },
            { label: "وضعیت حساب", value: <StatusBadge status={driver.user.status} /> },
            { label: "شناسه ملی", value: driver.nationalIdMasked },
            { label: "نوع گواهینامه", value: driver.licenseType },
            { label: "اعتبار گواهینامه", value: formatDate(driver.licenseExpiresAt) },
            { label: "عضویت از", value: formatDate(driver.createdAt) },
            { label: "آمادگی از", value: formatDate(driver.availableFrom) },
            { label: "آمادگی تا", value: formatDate(driver.availableTo) },
          ]}
        />
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">شرکت حمل</h2>
        <p className="text-lg font-semibold">{driver.carrier.tradeName}</p>
        <MetaGrid
          items={[
            { label: t.common.legalName, value: driver.carrier.legalName },
            { label: t.common.phone, value: driver.carrier.phone },
            { label: t.common.email, value: driver.carrier.email },
          ]}
        />
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">محدوده فعالیت</h2>
        {driver.areas.length ? (
          <div className="flex flex-wrap gap-2">
            {driver.areas.map((area) => (
              <span key={area.id} className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
                {area.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">محدوده ثبت‌شده‌ای دیده نشد.</p>
        )}
      </Card>
      <DocumentGallery kind="driver" entityId={driver.id} title="عکس و مدارک راننده" canUpload={canUpload} canVerify={canVerify} />
      <Card>
        <h2 className="mb-3 font-bold">{t.common.fleet}</h2>
        <div className="grid gap-3">
          {driver.vehicles.map((vehicle) => (
            <div key={vehicle.id} className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold">
                  {vehicle.plateNumber} {vehicle.isPrimary ? <span className="text-xs text-primary">· اصلی</span> : null}
                </div>
                <StatusBadge status={vehicle.status} />
              </div>
              <MetaGrid
                items={[
                  { label: "نوع", value: statusFa(vehicle.vehicleType) },
                  { label: "برند / مدل", value: [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || null },
                  { label: "سال ساخت", value: vehicle.year },
                  { label: "ظرفیت وزن", value: `${formatNumber(vehicle.weightCapacity)} تن` },
                  { label: "ظرفیت حجمی", value: vehicle.volumeCapacity != null ? formatNumber(vehicle.volumeCapacity) : null },
                  { label: "بیمه تا", value: formatDate(vehicle.insuranceExpiresAt) },
                  { label: "معاینه فنی تا", value: formatDate(vehicle.inspectionExpiresAt) },
                ]}
              />
              <div className="mt-4">
                <DocumentGallery kind="vehicle" entityId={vehicle.id} title={`مدارک خودرو ${vehicle.plateNumber}`} canUpload={canUpload} canVerify={canVerify} />
              </div>
            </div>
          ))}
          {!driver.vehicles.length ? <p className="text-sm text-muted">ناوگانی ثبت نشده است.</p> : null}
        </div>
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">بارهای اخیر</h2>
        {driver.recentJobs.length ? (
          <div className="grid gap-3">
            {driver.recentJobs.map((job) => (
              <Link key={job.id} href={jobHref(pathname, job.id)} className="rounded-2xl border border-border p-4 hover:bg-background">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold">{job.number}</div>
                  <StatusBadge status={job.status} />
                </div>
                <div className="mt-3">
                  <RouteLine from={job.originCity ?? t.job.pickup} to={job.destinationCity ?? t.job.delivery} />
                </div>
                <p className="mt-2 text-sm">{t.common.cargoOwner}: {job.cargoOwner}</p>
                <p className="mt-1 text-sm text-muted">{job.cargoItems.join("، ") || "—"}</p>
                {job.waybill ? <p className="mt-1 text-sm font-semibold">{t.common.waybill}: {job.waybill}</p> : null}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">هنوز باری به این راننده تخصیص نیافته.</p>
        )}
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">نظرها و امتیازها</h2>
        {driver.ratings.length ? (
          <SimpleTable
            headers={["امتیاز", "از طرف", "توضیح", t.common.date]}
            rows={driver.ratings.map((rating) => [
              `${rating.overall}/5${rating.punctuality ? ` · وقت‌شناسی ${rating.punctuality}` : ""}`,
              rating.rater,
              rating.comment ?? "—",
              formatDate(rating.createdAt),
            ])}
          />
        ) : (
          <p className="text-sm text-muted">هنوز نظری ثبت نشده است.</p>
        )}
      </Card>
      {pathname.startsWith("/admin") ? (
        <Button asChild variant="secondary">
          <Link href="/admin/drivers">بازگشت به فهرست رانندگان</Link>
        </Button>
      ) : null}
    </div>
  );
}
