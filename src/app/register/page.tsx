"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { ChoiceTile } from "@/components/domain/chrome";
import { api, formatApiError, getApiError } from "@/lib/api";
import { homePath } from "@/lib/portal";
import { useI18n } from "@/i18n/provider";
import type { Me } from "@/hooks/use-me";
import { BrandMark, TruckIcon, WarehouseIcon } from "@/components/visual/icons";
import { RegisterMotion } from "@/components/visual/register-motion";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { slotsFor } from "@/lib/documents";

type FileMap = Record<string, File | undefined>;

async function uploadSlot(file: File, documentType: string, entityType: string, entityId: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("documentType", documentType);
  form.append("entityType", entityType);
  form.append("entityId", entityId);
  const res = await fetch("/api/v1/documents/upload", { method: "POST", body: form, credentials: "include" });
  const json = (await res.json()) as { success: boolean; error?: { message: string } };
  if (!res.ok || !json.success) throw new Error(json.error?.message ?? "بارگذاری مدرک ناموفق بود");
}

function RegisterForm() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [files, setFiles] = useState<FileMap>({});
  const [form, setForm] = useState({
    portal: params.get("portal") === "DRIVER" ? "DRIVER" : "REQUESTER",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyName: "",
    password: "",
    nationalId: "",
    taxId: "",
    registrationNumber: "",
    licenseNumber: "",
    licenseType: "پایه دو",
    plateNumber: "",
    vehicleType: "TRUCK",
  });

  const requiredSlots = useMemo(
    () => (form.portal === "DRIVER" ? slotsFor("driver", true) : slotsFor("company", true)),
    [form.portal],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing = requiredSlots.filter((slot) => !files[slot.type]);
    if (missing.length) {
      toast.error(`مدارک الزامی ناقص است: ${missing.map((s) => s.label).join("، ")}`);
      return;
    }
    setLoading(true);
    setFieldErrors({});
    try {
      const created = await api<{ userId: string; companyId: string; driverProfileId?: string; vehicleId?: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          portal: form.portal,
          phone: form.phone || undefined,
        }),
      });
      const entityType = form.portal === "DRIVER" ? "DriverProfile" : "Company";
      const entityId = form.portal === "DRIVER" ? created.driverProfileId : created.companyId;
      if (entityId) {
        for (const slot of requiredSlots) {
          const file = files[slot.type];
          if (!file) continue;
          const targetType = slot.kinds.includes("vehicle") && created.vehicleId ? "Vehicle" : entityType;
          const targetId = targetType === "Vehicle" && created.vehicleId ? created.vehicleId : entityId;
          await uploadSlot(file, slot.type, targetType, targetId);
        }
      }
      const me = await api<Me>("/auth/me");
      toast.success("حساب و مدارک ثبت شد");
      router.replace(homePath(me));
    } catch (error) {
      setFieldErrors(getApiError(error)?.fields ?? {});
      toast.error(formatApiError(error, t.common.error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-ink lg:block">
        <RegisterMotion />
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-ink via-ink/85 to-transparent p-12 pt-32 text-white">
          <div className="max-w-md">
            <BrandMark className="text-white" />
            <h1 className="mt-8 text-4xl font-black">{t.auth.registerTitle}</h1>
            <p className="mt-4 text-white/75">{t.auth.sideBody}</p>
          </div>
        </div>
      </aside>
      <main className="relative grid place-items-center bg-background px-4 py-12 text-foreground">
        <div className="absolute end-4 top-4">
          <ThemeToggle />
        </div>
        <form className="w-full max-w-xl grid gap-4" onSubmit={onSubmit}>
          <Link href="/" className="lg:hidden">
            <BrandMark />
          </Link>
          <h1 className="text-2xl font-black">{t.auth.registerTitle}</h1>
          <div className="grid gap-2 sm:grid-cols-2">
            <ChoiceTile
              title={t.auth.requester}
              icon={<WarehouseIcon className="h-6 w-6" />}
              active={form.portal === "REQUESTER"}
              onClick={() => setForm({ ...form, portal: "REQUESTER" })}
            />
            <ChoiceTile
              title={t.auth.driver}
              icon={<TruckIcon className="h-6 w-6" />}
              active={form.portal === "DRIVER"}
              onClick={() => setForm({ ...form, portal: "DRIVER" })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.auth.firstName} error={fieldErrors.firstName?.[0]}>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </Field>
            <Field label={t.auth.lastName} error={fieldErrors.lastName?.[0]}>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </Field>
          </div>
          <Field label={t.auth.email} error={fieldErrors.email?.[0]}>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label={t.auth.phone} error={fieldErrors.phone?.[0]}>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </Field>
          <Field label={t.auth.company} error={fieldErrors.companyName?.[0]}>
            <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
          </Field>
          {form.portal === "REQUESTER" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="شناسه ملی شرکت">
                <Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} required />
              </Field>
              <Field label="شماره ثبت">
                <Input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} required />
              </Field>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="کد ملی راننده">
                <Input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} required />
              </Field>
              <Field label="شماره گواهینامه">
                <Input value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} required />
              </Field>
              <Field label="نوع گواهینامه">
                <Input value={form.licenseType} onChange={(e) => setForm({ ...form, licenseType: e.target.value })} />
              </Field>
              <Field label="پلاک خودرو">
                <Input value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} required />
              </Field>
              <Field label="نوع ناوگان">
                <NativeSelect value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}>
                  <option value="VAN">وانت سبک</option>
                  <option value="LIGHT_TRUCK">وانت سنگین</option>
                  <option value="TRUCK">کامیون</option>
                  <option value="HEAVY_TRUCK">تریلی سبک</option>
                  <option value="REFRIGERATED">یخچال‌دار</option>
                </NativeSelect>
              </Field>
            </div>
          )}
          <Field label={t.auth.password} hint={t.auth.passwordHint} error={fieldErrors.password?.join(" · ")}>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </Field>
          <div className="rounded-2xl border border-border p-4">
            <h2 className="font-bold">مدارک الزامی</h2>
            <p className="mt-1 text-sm text-muted">بدون این مدارک ثبت‌نام کامل نمی‌شود. تصویر یا PDF.</p>
            <div className="mt-3 grid gap-3">
              {requiredSlots.map((slot) => (
                <label key={slot.type} className="grid gap-1 text-sm">
                  <span className="font-medium">
                    {slot.label} <span className="text-danger">*</span>
                  </span>
                  <span className="text-xs text-muted">{slot.hint}</span>
                  <Input type="file" accept="image/*,application/pdf" required onChange={(e) => setFiles({ ...files, [slot.type]: e.target.files?.[0] })} />
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t.common.loading : t.auth.submit}
          </Button>
          <p className="text-sm">
            {t.auth.haveAccount}{" "}
            <Link href="/login" className="text-primary">
              {t.nav.login}
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
