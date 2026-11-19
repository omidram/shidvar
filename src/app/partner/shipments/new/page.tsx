"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/chrome";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { ShamsiDateInput } from "@/components/ui/shamsi-date-input";
import { api, formatApiError } from "@/lib/api";

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
    receivedAt: "",
    promisedDeliveryAt: "",
    shipAt: "",
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
      <PageHeader title="ثبت بار طرف قرارداد" description="همین فرم، برگه اکسل است. بار را به انبار شیدرو (شورآباد) می‌آورید و فاکتور را ثبت می‌کنید. راننده، لوکیشن و صورتحساب را مدیریت پر می‌کند." />
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
          <Field label="استان مقصد">
            <Input value={form.province} onChange={(e) => set("province", e.target.value)} required />
          </Field>
          <Field label="شهرستان">
            <Input value={form.county} onChange={(e) => set("county", e.target.value)} />
          </Field>
          <Field label="شهر مقصد">
            <Input value={form.city} onChange={(e) => set("city", e.target.value)} required />
          </Field>
        </div>
        <Field label="انبار تحویلی">
          <Input value={form.warehouseName} onChange={(e) => set("warehouseName", e.target.value)} required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="تاریخ تحویل بار به انبار">
            <ShamsiDateInput value={form.receivedAt} onChange={(value) => set("receivedAt", value)} />
          </Field>
          <Field label="تاریخ تحویل">
            <ShamsiDateInput value={form.promisedDeliveryAt} onChange={(value) => set("promisedDeliveryAt", value)} />
          </Field>
        </div>
        <Field label="تاریخ ارسال">
          <ShamsiDateInput value={form.shipAt} onChange={(value) => set("shipAt", value)} required />
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
