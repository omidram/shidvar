"use client";

import type { ReactNode } from "react";
import { Mail, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/i18n/provider";
import type { TwoFactorChannel } from "@/lib/settings";
import { cn } from "@/lib/utils";

export function SettingsSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="grid gap-4">
      <div className="flex items-start gap-3">
        {icon ? <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">{icon}</div> : null}
        <div>
          <h2 className="font-bold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
      </div>
      {children}
    </Card>
  );
}

export function SettingToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-start transition",
        checked ? "border-primary/40 bg-primary/10" : "border-border bg-background",
      )}
    >
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
      </span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-primary" : "bg-border")}>
        <span
          className="absolute top-0.5 size-5 rounded-full bg-white shadow transition-[inset-inline-start]"
          style={{ insetInlineStart: checked ? "1.35rem" : "0.15rem" }}
        />
      </span>
    </button>
  );
}

export function TwoFactorSettings({
  enabled,
  channel,
  phone,
  email,
  onEnabled,
  onChannel,
}: {
  enabled: boolean;
  channel: TwoFactorChannel;
  phone?: string | null;
  email?: string | null;
  onEnabled: (value: boolean) => void;
  onChannel: (value: TwoFactorChannel) => void;
}) {
  const { t } = useI18n();
  const canSms = Boolean(phone);
  const canEmail = Boolean(email);

  function enable(next: boolean) {
    if (!next) {
      onEnabled(false);
      return;
    }
    const fallback: TwoFactorChannel | null = canEmail ? "EMAIL" : canSms ? "SMS" : null;
    const nextChannel = (channel === "SMS" && canSms) || (channel === "EMAIL" && canEmail) ? channel : fallback;
    if (!nextChannel) return;
    onChannel(nextChannel);
    onEnabled(true);
  }

  return (
    <div className="grid gap-3">
      <SettingToggle label={t.settings.twoFactor} hint={t.settings.twoFactorHint} checked={enabled} onChange={enable} />
      {enabled ? (
        <>
          <p className="text-sm font-medium">{t.settings.twoFactorChannel}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={!canSms}
              onClick={() => onChannel("SMS")}
              className={cn(
                "grid gap-1 rounded-2xl border px-4 py-3 text-start text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50",
                channel === "SMS" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
              )}
            >
              <span className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                {t.settings.twoFactorSms}
              </span>
              <span className={cn("text-xs font-normal", channel === "SMS" ? "text-primary-foreground/80" : "text-muted")}>
                {canSms ? `${t.settings.twoFactorSmsHint} ${phone}` : t.settings.twoFactorNeedPhone}
              </span>
            </button>
            <button
              type="button"
              disabled={!canEmail}
              onClick={() => onChannel("EMAIL")}
              className={cn(
                "grid gap-1 rounded-2xl border px-4 py-3 text-start text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50",
                channel === "EMAIL" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
              )}
            >
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {t.settings.twoFactorEmail}
              </span>
              <span className={cn("text-xs font-normal", channel === "EMAIL" ? "text-primary-foreground/80" : "text-muted")}>
                {canEmail ? `${t.settings.twoFactorEmailHint} ${email}` : t.settings.twoFactorNeedEmail}
              </span>
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
