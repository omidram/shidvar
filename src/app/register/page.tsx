"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ChoiceTile } from "@/components/domain/chrome";
import { api, formatApiError, getApiError } from "@/lib/api";
import { homePath } from "@/lib/portal";
import { useI18n } from "@/i18n/provider";
import type { Me } from "@/hooks/use-me";
import { BrandMark, TruckIcon, WarehouseIcon } from "@/components/visual/icons";
import { RegisterMotion } from "@/components/visual/register-motion";
import { ThemeToggle } from "@/components/theme/theme-toggle";

function RegisterForm() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [form, setForm] = useState({
    portal: params.get("portal") === "DRIVER" ? "DRIVER" : "REQUESTER",
    phone: "",
    nationalId: "",
    password: "",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFieldErrors({});
    try {
      await api("/auth/register", { method: "POST", body: JSON.stringify(form) });
      const me = await api<Me>("/auth/me");
      toast.success("ثبت‌نام انجام شد و ۱۰۰۰ سکه هدیه به حساب شما واریز شد");
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
            <BrandMark className="h-28" />
            <h1 className="mt-8 text-4xl font-black">{t.auth.registerTitle}</h1>
            <p className="mt-4 text-white/75">{t.auth.sideBody}</p>
          </div>
        </div>
      </aside>
      <main className="relative grid place-items-center bg-background px-4 py-12 text-foreground">
        <div className="absolute end-4 top-4">
          <ThemeToggle />
        </div>
        <form className="grid w-full max-w-md gap-4" onSubmit={onSubmit}>
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
          <Field label="شماره موبایل" error={fieldErrors.phone?.[0]}>
            <Input
              dir="ltr"
              inputMode="tel"
              placeholder="09121234567"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
          </Field>
          <Field label={form.portal === "DRIVER" ? "کد ملی" : "کد ملی مدیر شرکت"} error={fieldErrors.nationalId?.[0]}>
            <Input
              dir="ltr"
              inputMode="numeric"
              maxLength={12}
              value={form.nationalId}
              onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
              required
            />
          </Field>
          <Field label={t.auth.password} hint={t.auth.passwordHint} error={fieldErrors.password?.join(" · ")}>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </Field>
          <p className="rounded-2xl border border-border bg-surface-soft p-3 text-sm text-muted">
            بعد از ثبت‌نام، مدیریت اطلاعات و مدارک تکمیلی را از داخل پنل از شما می‌خواهد. هر حساب تازه ۱۰۰۰ سکه هدیه می‌گیرد.
          </p>
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
