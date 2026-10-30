"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/domain/chrome";
import { LocationPicker } from "@/components/domain/location-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { WarehouseIcon } from "@/components/visual/icons";
import { api, formatApiError } from "@/lib/api";
import { coordsForCity, type LatLng } from "@/lib/geo/city-coords";
import { formatNumber } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  status?: string;
  address?: {
    city: string;
    region?: string;
    line1?: string;
    line2?: string | null;
    district?: string | null;
    postalCode?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
  };
};

const EMPTY = { name: "", city: "", line1: "", postalCode: "" };

export default function WarehousesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [point, setPoint] = useState<LatLng | null>(null);
  const q = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api<Warehouse[]>("/tenancy/warehouses"),
  });

  function reset() {
    setOpen(false);
    setEditId(null);
    setForm(EMPTY);
    setPoint(null);
  }

  const save = useMutation({
    mutationFn: () => {
      if (!point) throw new Error("موقعیت انبار را روی نقشه مشخص کنید");
      const body = JSON.stringify({ ...form, postalCode: form.postalCode || undefined, latitude: point.lat, longitude: point.lng });
      return editId
        ? api(`/tenancy/warehouses/${editId}`, { method: "PUT", body })
        : api("/tenancy/warehouses", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(editId ? "انبار ویرایش شد" : "انبار ثبت شد");
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      reset();
    },
    onError: (error) => toast.error(formatApiError(error, "ثبت انبار ناموفق بود")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/tenancy/warehouses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("انبار حذف شد");
      qc.invalidateQueries({ queryKey: ["warehouses"] });
    },
    onError: (error) => toast.error(formatApiError(error, "حذف انبار ناموفق بود")),
  });

  function locateMe() {
    if (!navigator.geolocation) {
      toast.error("مرورگر شما موقعیت‌یابی را پشتیبانی نمی‌کند");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setPoint({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) }),
      () => toast.error("اجازهٔ دسترسی به موقعیت داده نشد؛ روی نقشه انتخاب کنید"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function jumpToCity(city: string) {
    const coords = coordsForCity(city);
    if (coords) setPoint(coords);
  }

  function startEdit(w: Warehouse) {
    setEditId(w.id);
    setForm({ name: w.name, city: w.address?.city ?? "", line1: w.address?.line1 ?? "", postalCode: w.address?.postalCode ?? "" });
    const lat = Number(w.address?.latitude);
    const lng = Number(w.address?.longitude);
    setPoint(Number.isFinite(lat) && Number.isFinite(lng) && w.address?.latitude != null ? { lat, lng } : null);
    setOpen(true);
  }

  const rows = q.data ?? [];
  const canSave = form.name.trim().length >= 2 && form.city.trim().length >= 2 && form.line1.trim().length >= 3 && Boolean(point);

  return (
    <div className="grid gap-4">
      <PageHeader
        title={t.menu.warehouses}
        description="انبارهای خود را با نشانی و موقعیت روی نقشه ثبت کنید تا در درخواست بار مبدأ یا مقصد قرار بگیرند."
        actions={
          <Button type="button" onClick={() => (open ? reset() : setOpen(true))}>
            {open ? "بستن" : "ثبت انبار"}
          </Button>
        }
      />

      {open ? (
        <Card className="grid gap-4">
          <h2 className="font-bold">{editId ? "ویرایش انبار" : "انبار جدید"}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="نام انبار">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثلاً انبار مرکزی تهران" />
            </Field>
            <Field label="شهر">
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                onBlur={(e) => !point && jumpToCity(e.target.value)}
                placeholder="تهران"
              />
            </Field>
            <Field label="نشانی کامل">
              <Input value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} />
            </Field>
            <Field label="کد پستی (اختیاری)">
              <Input dir="ltr" inputMode="numeric" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">موقعیت روی نقشه (کلیک کنید یا نشانگر را بکشید)</span>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={locateMe}>
                  موقعیت فعلی من
                </Button>
                <Button type="button" variant="secondary" onClick={() => jumpToCity(form.city)} disabled={!coordsForCity(form.city)}>
                  برو به شهر
                </Button>
              </div>
            </div>
            <LocationPicker value={point} onChange={setPoint} />
            <p className="text-xs text-muted" dir="ltr">
              {point ? `${formatNumber(point.lat)}, ${formatNumber(point.lng)}` : "موقعیتی انتخاب نشده است"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
              {editId ? "ذخیره تغییرات" : "ثبت انبار"}
            </Button>
            <Button type="button" variant="secondary" onClick={reset}>
              انصراف
            </Button>
          </div>
        </Card>
      ) : null}

      {!rows.length ? (
        <EmptyState title={t.common.empty} hint="هنوز انباری ثبت نکرده‌اید. با دکمهٔ «ثبت انبار» شروع کنید." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((w) => (
            <Card key={w.id} className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <WarehouseIcon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold">{w.name}</div>
                <p className="mt-1 text-sm text-muted">{w.code}</p>
                <p className="mt-2 text-sm">{[w.address?.city, w.address?.region, w.address?.district].filter(Boolean).join("، ")}</p>
                <p className="text-sm text-muted">{[w.address?.line1, w.address?.line2, w.address?.postalCode].filter(Boolean).join(" · ")}</p>
                {w.address?.latitude != null && w.address?.longitude != null ? (
                  <a
                    className="mt-2 inline-block text-xs text-primary"
                    dir="ltr"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.openstreetmap.org/?mlat=${w.address.latitude}&mlon=${w.address.longitude}#map=15/${w.address.latitude}/${w.address.longitude}`}
                  >
                    {Number(w.address.latitude).toFixed(5)}, {Number(w.address.longitude).toFixed(5)}
                  </a>
                ) : (
                  <p className="mt-2 text-xs text-danger">موقعیت ثبت نشده؛ ویرایش کنید.</p>
                )}
                <div className="mt-3 flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => startEdit(w)}>
                    ویرایش
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(`انبار «${w.name}» حذف شود؟`)) remove.mutate(w.id);
                    }}
                  >
                    حذف
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
