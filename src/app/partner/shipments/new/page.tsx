"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/chrome";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { ShamsiDateInput } from "@/components/ui/shamsi-date-input";
import { CitySelect } from "@/components/domain/city-select";
import { api, formatApiError } from "@/lib/api";
import { IRAN_PROVINCES, provinceOf } from "@/lib/geo/iran-provinces";
import { todayIso } from "@/lib/shamsi";

export default function NewPartnerShipmentPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    invoiceNumber: "",
    brandName: "",
    storeName: "",
    cargoType: "",
    cartonCount: "",
    cargoAmount: "",
    province: "",
    county: "",
    city: "",
    warehouseName: "شورآباد",
    receivedAt: todayIso(),
    promisedDeliveryAt: todayIso(),
    shipAt: todayIso(),
    notes: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await api<{ id: string }>("/partner/shipments", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          cartonCount: Number(form.cartonCount),
          cargoAmount: Number(form.cargoAmount),
          county: form.county || undefined,
          receivedAt: form.receivedAt || undefined,
          promisedDeliveryAt: form.promisedDeliveryAt || undefined,
          notes: form.notes || undefined,
        }),
      });
      toast.success("بار ثبت شد. مدیریت راننده را تخصیص می‌دهد.");
      router.push(`/partner/shipments/${created.id}`);
    } catch (error) {
      toast.error(formatApiError(error, "ثبت بار انجام نشد"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void onSubmit(event)}>
      <PageHeader title="ثبت بار طرف قرارداد" />
      <Card className="grid gap-3">
        <Field label="شماره فاکتور">
          <Input value={form.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} required />
        </Field>
        <Field label="نام شرکت (برند)">
          <Input value={form.brandName} onChange={(e) => set("brandName", e.target.value)} required />
        </Field>
        <Field label="نام فروشگاه">
          <Input value={form.storeName} onChange={(e) => set("storeName", e.target.value)} required />
        </Field>
        <Field label="نوع بار">
          <Input value={form.cargoType} onChange={(e) => set("cargoType", e.target.value)} required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="تعداد کارتن">
            <Input inputMode="numeric" value={form.cartonCount} onChange={(e) => set("cartonCount", e.target.value)} required />
          </Field>
          <Field label="مبلغ فاکتور (ریال)">
            <Input inputMode="numeric" value={form.cargoAmount} onChange={(e) => set("cargoAmount", e.target.value)} required />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <CitySelect
            label="استان مقصد"
            value={form.province}
            onChange={(value) => set("province", value)}
            options={IRAN_PROVINCES}
            placeholder="استان را بنویسید یا انتخاب کنید"
            emptyText="این استان در فهرست نیست؛ همان نوشته ذخیره می‌شود"
            required
          />
          <CitySelect
            label="شهرستان"
            value={form.county}
            onChange={(value) => set("county", value)}
            placeholder="شهرستان را بنویسید یا انتخاب کنید"
            required
          />
          <CitySelect
            label="شهر مقصد"
            value={form.city}
            onChange={(value) => {
              set("city", value);
              const province = provinceOf(value);
              if (province && !form.province) set("province", province);
            }}
            placeholder="شهر را بنویسید یا انتخاب کنید"
            required
          />
        </div>
        <Field label="انبار تحویلی">
          <Input value={form.warehouseName} onChange={(e) => set("warehouseName", e.target.value)} required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="تاریخ تحویل بار به انبار">
            <ShamsiDateInput value={form.receivedAt} onChange={(value) => set("receivedAt", value)} notBeforeToday required />
          </Field>
          <Field label="تاریخ تحویل">
            <ShamsiDateInput value={form.promisedDeliveryAt} onChange={(value) => set("promisedDeliveryAt", value)} notBeforeToday required />
          </Field>
        </div>
        <Field label="تاریخ ارسال">
          <ShamsiDateInput value={form.shipAt} onChange={(value) => set("shipAt", value)} notBeforeToday required />
        </Field>
        <Field label="توضیحات">
          <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <Button type="submit" disabled={saving}>
          {saving ? "در حال ثبت…" : "ثبت بار"}
        </Button>
      </Card>
    </form>
  );
}
