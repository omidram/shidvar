"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api, formatApiError } from "@/lib/api";
import { homePath, safeInternalPath } from "@/lib/portal";
import { useI18n } from "@/i18n/provider";
import type { Me } from "@/hooks/use-me";
import { BrandMark } from "@/components/visual/icons";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { TwoFactorChannel } from "@/lib/settings";

type LoginResponse = {
  authenticated?: boolean;
  requiresTwoFactor?: boolean;
  challengeId?: string;
  channel?: TwoFactorChannel;
  destination?: string;
  devCode?: string;
};

function otpDigits(value: string) {
  const normalized = value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
  return normalized.replace(/\D/g, "").slice(0, 6);
}

function LoginForm() {
  const { t } = useI18n();
  const params = useSearchParams();
  const portal = params.get("portal") === "DRIVER" ? "DRIVER" : params.get("portal") === "REQUESTER" ? "REQUESTER" : null;
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState<LoginResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function finishLogin() {
    const me = await api<Me>("/auth/me");
    toast.success(t.auth.loginTitle);
    window.location.replace(safeInternalPath(params.get("next")) || homePath(me));
  }

  const challengeId = challenge?.challengeId;
  const challengeChannel = challenge?.channel;

  useEffect(() => {
    if (!challengeId || challengeChannel !== "SMS") return;
    const fill = (raw: string) => {
      const code = otpDigits(raw);
      if (code.length < 4) return;
      const el = document.getElementById("shidro-otp") as HTMLInputElement | null;
      if (el && el.value !== code) el.value = code;
      setOtp(code);
    };
    const host = window as Window & { __shidroFillOtp?: (code: string) => void; Shidro?: { requestOtp?: () => void } };
    host.__shidroFillOtp = fill;
    host.Shidro?.requestOtp?.();
    const watch = window.setInterval(() => {
      const el = document.getElementById("shidro-otp") as HTMLInputElement | null;
      const code = otpDigits(el?.value ?? "");
      if (code.length === 6) fill(code);
    }, 200);
    const onField = (event: Event) => {
      const el = event.target as HTMLInputElement | null;
      if (el?.id !== "shidro-otp") return;
      const code = otpDigits(el.value);
      if (code.length === 6) fill(code);
    };
    document.addEventListener("input", onField, true);
    document.addEventListener("change", onField, true);
    let ac: AbortController | undefined;
    if (window.isSecureContext && "OTPCredential" in window) {
      ac = new AbortController();
      const credentials = navigator.credentials as CredentialsContainer & {
        get: (options: CredentialRequestOptions & { otp?: { transport: string[] } }) => Promise<(Credential & { code?: string }) | null>;
      };
      credentials
        .get({ otp: { transport: ["sms"] }, signal: ac.signal })
        .then((cred) => {
          if (cred?.code) fill(cred.code);
        })
        .catch(() => undefined);
    }
    return () => {
      window.clearInterval(watch);
      document.removeEventListener("input", onField, true);
      document.removeEventListener("change", onField, true);
      ac?.abort();
      delete host.__shidroFillOtp;
    };
  }, [challengeId, challengeChannel]);

  function showOtp(result: LoginResponse) {
    setChallenge(result);
    setOtp(result.devCode ?? "");
    toast.success(result.channel === "SMS" ? `${t.auth.otpSentSms} ${result.destination ?? ""}` : `${t.auth.otpSentEmail} ${result.destination ?? ""}`);
    if (result.devCode) toast.message(`کد آزمایشی: ${result.devCode}`);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (challenge?.challengeId) {
        const code = otpDigits((document.getElementById("shidro-otp") as HTMLInputElement | null)?.value || otp);
        await api("/auth/login/otp", { method: "POST", body: JSON.stringify({ challengeId: challenge.challengeId, code }) });
        await finishLogin();
        return;
      }
      const result = await api<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password, otpHost: window.location.hostname }),
      });
      if (result.requiresTwoFactor && result.challengeId) {
        showOtp(result);
        return;
      }
      await finishLogin();
    } catch (error) {
      toast.error(formatApiError(error, challenge ? t.auth.otpInvalid : t.common.error));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!challenge?.challengeId) return;
    setLoading(true);
    try {
      const result = await api<LoginResponse>("/auth/login/otp/resend", {
        method: "POST",
        body: JSON.stringify({ challengeId: challenge.challengeId, otpHost: window.location.hostname }),
      });
      showOtp(result);
    } catch (error) {
      toast.error(formatApiError(error, t.auth.otpInvalid));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden lg:block">
        <img src="/media/tracking-phone.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-ink/70" />
        <div className="relative flex h-full items-center p-12 text-white">
          <div className="max-w-md">
            <BrandMark className="h-28" />
            <h1 className="mt-8 text-4xl font-black">{t.auth.sideTitle}</h1>
            <p className="mt-4 text-lg text-white/85">{t.auth.sideBody}</p>
          </div>
        </div>
      </aside>
      <main className="relative grid place-items-center bg-background px-4 py-12 text-foreground">
        <div className="absolute end-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 block lg:hidden">
            <BrandMark />
          </Link>
          <Button asChild variant="secondary" className="mb-6">
            <Link href="/">بازگشت به صفحه اصلی</Link>
          </Button>
          <h1 className="text-2xl font-black">
            {challenge ? t.auth.otpTitle : portal === "DRIVER" ? "ورود راننده" : portal === "REQUESTER" ? "ورود صاحب بار" : t.auth.loginTitle}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {challenge
              ? `${challenge.channel === "SMS" ? t.auth.otpSentSms : t.auth.otpSentEmail} ${challenge.destination ?? ""}`
              : t.auth.loginHint}
          </p>
          <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
            {challenge ? (
              <Field label={t.auth.otpCode}>
                <Input
                  key={challenge.challengeId}
                  id="shidro-otp"
                  name="one-time-code"
                  defaultValue={otp}
                  onChange={(e) => {
                    const next = otpDigits(e.target.value);
                    if (e.target.value !== next) e.target.value = next;
                    setOtp(next);
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  required
                />
                {challenge.channel === "SMS" ? <p className="text-xs leading-6 text-muted">اگر پیامک روی همین گوشی بیاید، کد خودش در این جا نوشته می‌شود.</p> : null}
              </Field>
            ) : (
              <>
                <Field label={t.auth.identifier}>
                  <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required />
                </Field>
                <Field label={t.auth.password}>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                </Field>
              </>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? t.common.loading : challenge ? t.auth.otpSubmit : t.auth.submit}
            </Button>
          </form>
          {challenge ? (
            <div className="mt-4 flex justify-between text-sm">
              <button type="button" className="text-primary" onClick={resend} disabled={loading}>
                {t.auth.otpResend}
              </button>
              <button
                type="button"
                onClick={() => {
                  setChallenge(null);
                  setOtp("");
                }}
              >
                {t.auth.otpBack}
              </button>
            </div>
          ) : (
            <>
              <div className="mt-5 flex justify-between text-sm">
                <Link href="/forgot-password" className="text-primary">
                  {t.auth.forgot}
                </Link>
                <Link href={portal === "DRIVER" ? "/register?portal=DRIVER" : portal === "REQUESTER" ? "/register?portal=REQUESTER" : "/register"}>{t.auth.noAccount}</Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
