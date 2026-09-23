"use client";

import Link from "next/link";
import {
  BellRing,
  Clock3,
  LockKeyhole,
  MapPinned,
  Palette,
  ShieldCheck,
  Truck,
  UserRound,
  Wallet,
} from "lucide-react";
import { ErrorState, PageHeader } from "@/components/domain/chrome";
import { SettingsSection, SettingToggle, TwoFactorSettings } from "@/components/domain/settings-controls";
import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { useSettingsForm } from "@/hooks/use-settings";
import { useTheme } from "@/components/theme/theme-provider";
import { useI18n } from "@/i18n/provider";
import { SETTINGS_VEHICLES } from "@/lib/settings";
import { statusFa } from "@/lib/status-fa";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";

export default function DriverSettingsPage() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const { query, draft, setDraft, save } = useSettingsForm();
  const data = query.data;

  if (query.isError) return <ErrorState message={t.common.error} />;
  if (!draft || !data) return <p className="text-sm text-muted">{t.common.loading}</p>;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <PageHeader
        title={t.menu.settings}
        description={t.settings.driverHint}
        actions={
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t.common.loading : t.settings.saveAll}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t.common.status} value={statusFa(data.driver?.status ?? data.user.status)} hint={data.user.email ?? data.user.phone ?? "—"} />
        <StatCard label="بارهای تکمیل‌شده" value={formatNumber(data.driver?.completedJobs ?? 0)} hint={data.driver ? `امتیاز ${formatNumber(data.driver.ratingAvg)}` : "—"} />
        <StatCard label={t.common.license} value={data.driver?.licenseNumber ?? "—"} hint={data.driver?.licenseType ?? t.settings.availability} />
      </div>

      <SettingsSection title={t.settings.personal} description="نام و موبایل همین حساب راننده" icon={<UserRound className="h-5 w-5" />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.auth.firstName}>
            <Input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} required />
          </Field>
          <Field label={t.auth.lastName}>
            <Input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} required />
          </Field>
          <Field label={t.auth.phone}>
            <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </Field>
          <Field label={t.auth.email}>
            <Input value={data.user.email ?? ""} disabled />
          </Field>
        </div>
        <p className="text-xs text-muted">آخرین ورود: {data.user.lastLoginAt ? formatDateTime(data.user.lastLoginAt) : "—"}</p>
      </SettingsSection>

      <SettingsSection title={t.settings.availability} description="کِی بار جدید ببینید و پیشنهاد بگیرید" icon={<Clock3 className="h-5 w-5" />}>
        <SettingToggle
          label={t.settings.available}
          hint={t.settings.availableHint}
          checked={draft.prefs.acceptingLoads}
          onChange={(acceptingLoads) => setDraft({ ...draft, prefs: { ...draft.prefs, acceptingLoads } })}
        />
        <SettingToggle label={t.settings.nightShift} hint={t.settings.nightHint} checked={draft.prefs.nightShift} onChange={(nightShift) => setDraft({ ...draft, prefs: { ...draft.prefs, nightShift } })} />
        <SettingToggle label={t.settings.autoAccept} checked={draft.prefs.autoAcceptNearby} onChange={(autoAcceptNearby) => setDraft({ ...draft, prefs: { ...draft.prefs, autoAcceptNearby } })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.settings.fromHour}>
            <Input type="time" value={draft.availableFrom} onChange={(e) => setDraft({ ...draft, availableFrom: e.target.value })} />
          </Field>
          <Field label={t.settings.toHour}>
            <Input type="time" value={draft.availableTo} onChange={(e) => setDraft({ ...draft, availableTo: e.target.value })} />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection title={t.settings.privacy} description="موقعیت فقط با اجازه گوشی و برای سفر فعال" icon={<MapPinned className="h-5 w-5" />}>
        <SettingToggle label={t.settings.trackingDefault} hint={t.settings.trackingHint} checked={draft.trackingAllowed} onChange={(trackingAllowed) => setDraft({ ...draft, trackingAllowed })} />
        <SettingToggle label={t.settings.hidePhone} checked={draft.prefs.hidePhoneUntilAccept} onChange={(hidePhoneUntilAccept) => setDraft({ ...draft, prefs: { ...draft.prefs, hidePhoneUntilAccept } })} />
      </SettingsSection>

      <SettingsSection title={t.settings.fleetDefaults} icon={<Truck className="h-5 w-5" />}>
        <p className="text-sm text-muted">{t.settings.defaultVehicle}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SETTINGS_VEHICLES.map((vehicle) => (
            <button
              key={vehicle}
              type="button"
              onClick={() => setDraft({ ...draft, prefs: { ...draft.prefs, defaultVehicle: vehicle } })}
              className={cn(
                "rounded-2xl border px-3 py-3 text-sm font-semibold",
                draft.prefs.defaultVehicle === vehicle ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
              )}
            >
              {t.vehicle[vehicle]}
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={t.common.notifications} icon={<BellRing className="h-5 w-5" />}>
        <SettingToggle label={t.settings.jobSms} checked={draft.notifications.jobSms} onChange={(jobSms) => setDraft({ ...draft, notifications: { ...draft.notifications, jobSms } })} />
        <SettingToggle label={t.settings.jobInApp} checked={draft.notifications.jobInApp} onChange={(jobInApp) => setDraft({ ...draft, notifications: { ...draft.notifications, jobInApp } })} />
        <SettingToggle label={t.settings.walletSms} checked={draft.notifications.walletSms} onChange={(walletSms) => setDraft({ ...draft, notifications: { ...draft.notifications, walletSms } })} />
        <SettingToggle label={t.settings.walletInApp} checked={draft.notifications.walletInApp} onChange={(walletInApp) => setDraft({ ...draft, notifications: { ...draft.notifications, walletInApp } })} />
        <SettingToggle label={t.settings.docsInApp} checked={draft.notifications.docsInApp} onChange={(docsInApp) => setDraft({ ...draft, notifications: { ...draft.notifications, docsInApp } })} />
        <SettingToggle label={t.settings.sound} checked={draft.prefs.soundAlerts} onChange={(soundAlerts) => setDraft({ ...draft, prefs: { ...draft.prefs, soundAlerts } })} />
        <SettingToggle label={t.settings.weeklyReport} checked={draft.prefs.shareWeeklyReport} onChange={(shareWeeklyReport) => setDraft({ ...draft, prefs: { ...draft.prefs, shareWeeklyReport } })} />
      </SettingsSection>

      <SettingsSection title={t.settings.appearance} description={t.settings.themeHint} icon={<Palette className="h-5 w-5" />}>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setTheme("light")} className={cn("rounded-2xl border px-4 py-3 text-sm font-semibold", theme === "light" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background")}>
            {t.common.themeLight}
          </button>
          <button type="button" onClick={() => setTheme("dark")} className={cn("rounded-2xl border px-4 py-3 text-sm font-semibold", theme === "dark" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background")}>
            {t.common.themeDark}
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title={t.settings.security} icon={<LockKeyhole className="h-5 w-5" />}>
        <TwoFactorSettings
          enabled={draft.twoFactorEnabled}
          channel={draft.twoFactorChannel}
          phone={draft.phone || data.user.phone}
          email={data.user.email}
          onEnabled={(twoFactorEnabled) => setDraft({ ...draft, twoFactorEnabled })}
          onChannel={(twoFactorChannel) => setDraft({ ...draft, twoFactorChannel })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.settings.currentPassword}>
            <Input type="password" value={draft.currentPassword} onChange={(e) => setDraft({ ...draft, currentPassword: e.target.value })} autoComplete="current-password" />
          </Field>
          <Field label={t.settings.newPassword} hint={t.auth.passwordHint}>
            <Input type="password" value={draft.newPassword} onChange={(e) => setDraft({ ...draft, newPassword: e.target.value })} autoComplete="new-password" />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection title={t.settings.shortcuts} icon={<ShieldCheck className="h-5 w-5" />}>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button asChild variant="secondary">
            <Link href="/driver/profile">{t.common.viewProfile}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/driver/wallet">{t.menu.wallet}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/driver/jobs">{t.menu.jobs}</Link>
          </Button>
        </div>
      </SettingsSection>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">تغییر شیفت، اعلان و رمز با یک ذخیره اعمال می‌شود.</p>
        <Button type="submit" disabled={save.isPending}>
          <Wallet className="h-4 w-4" />
          {save.isPending ? t.common.loading : t.settings.saveAll}
        </Button>
      </Card>
    </form>
  );
}
