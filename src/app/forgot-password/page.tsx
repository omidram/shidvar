"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PublicHeader } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { api, formatApiError } from "@/lib/api";
import { useI18n } from "@/i18n/provider";

type ResetStart = { sent: boolean; challengeId?: string; destination?: string; devCode?: string };

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [start, setStart] = useState<ResetStart | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await api<ResetStart>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ identifier, otpHost: window.location.hostname }),
      });
      if (!data.challengeId) {
        setStart(null);
        toast.success(t.auth.sent);
        return;
      }
      setStart(data);
      if (data.devCode) setCode(data.devCode);
      toast.success(data.destination ? `کد ورود به ${data.destination} پیامک شد` : t.auth.sent);
    } catch (error) {
      toast.error(formatApiError(error, t.common.error));
    } finally {
      setBusy(false);
    }
  }

  async function applyReset(e: React.FormEvent) {
    e.preventDefault();
    if (!start?.challengeId) return;
    setBusy(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ challengeId: start.challengeId, code, password }),
      });
      toast.success("رمز عوض شد. حالا وارد شوید.");
      router.replace("/login");
    } catch (error) {
      toast.error(formatApiError(error, t.common.error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PublicHeader />
      <main className="mx-auto max-w-md px-4 py-16">
        <Card>
          <h1 className="text-xl font-semibold">{t.auth.forgot}</h1>
          <p className="mt-2 text-sm leading-7 text-muted">کد ورود به موبایل ثبت‌شده همین حساب پیامک می‌شود.</p>
          {!start?.challengeId ? (
            <form className="mt-6 grid gap-4" onSubmit={requestCode}>
              <Field label={t.auth.identifier}>
                <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username" />
              </Field>
              <Button type="submit" disabled={busy}>
                {t.auth.submit}
              </Button>
            </form>
          ) : (
            <form className="mt-6 grid gap-4" onSubmit={applyReset}>
              <Field label="کد ورود" hint={start.destination ? `ارسال‌شده به ${start.destination}` : undefined}>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                />
              </Field>
              <Field label="رمز جدید" hint={t.auth.passwordHint}>
                <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
              </Field>
              <Button type="submit" disabled={busy}>
                ذخیره رمز
              </Button>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
}
