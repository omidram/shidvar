"use client";

import Link from "next/link";
import { BellRing, Building2, FileText, LockKeyhole, Package, Palette, UserRound, Warehouse } from "lucide-react";
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

export default function RequesterSettingsPage() {
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
        description={t.settings.requesterHint}
        actions={
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t.common.loading : t.settings.saveAll}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t.auth.company} value={data.company?.tradeName ?? "—"} hint={`${statusFa(data.company?.type)} · ${statusFa(data.company?.status)}`} />
        <StatCard label={t.menu.warehouses} value={formatNumber(data.company?.warehouseCount ?? 0)} hint={`${formatNumber(data.company?.storeCount ?? 0)} فروشگاه`} />
        <StatCard label="اعضای سازمان" value={formatNumber(data.company?.memberCount ?? 0)} hint={data.user.email ?? data.user.phone ?? "—"} />
      </div>

      <SettingsSection title={t.settings.personal} icon={<UserRound className="h-5 w-5" />}>
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

      <SettingsSection title={t.settings.company} description={t.settings.legalLocked} icon={<Building2 className="h-5 w-5" />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نام تجاری">
            <Input value={draft.tradeName} onChange={(e) => setDraft({ ...draft, tradeName: e.target.value })} />
          </Field>
          <Field label="نام حقوقی">
            <Input value={data.company?.legalName ?? ""} disabled />
          </Field>
          <Field label="شناسه ملی">
            <Input value={data.company?.taxId ?? "—"} disabled />
          </Field>
          <Field label="شماره ثبت">
            <Input value={data.company?.registrationNumber ?? "—"} disabled />
          </Field>
          <Field label={t.common.phone}>
            <Input value={draft.companyPhone} onChange={(e) => setDraft({ ...draft, companyPhone: e.target.value })} />
          </Field>
          <Field label={t.common.email}>
            <Input value={draft.companyEmail} onChange={(e) => setDraft({ ...draft, companyEmail: e.target.value })} />
          </Field>
          <Field label="وب‌سایت">
            <Input value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value })} />
          </Field>
          <Field label="ارز پیش‌فرض">
            <Input value={data.company?.defaultCurrency === "IRR" ? "ریال ایران" : (data.company?.defaultCurrency ?? "—")} disabled />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection title={t.settings.shipmentDefaults} icon={<Package className="h-5 w-5" />}>
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
        <SettingToggle label={t.settings.insurance} checked={draft.prefs.requireInsurance} onChange={(requireInsurance) => setDraft({ ...draft, prefs: { ...draft.prefs, requireInsurance } })} />
        <SettingToggle label={t.settings.workers} checked={draft.prefs.requireWorkers} onChange={(requireWorkers) => setDraft({ ...draft, prefs: { ...draft.prefs, requireWorkers } })} />
        <SettingToggle label={t.settings.cover} checked={draft.prefs.requireCover} onChange={(requireCover) => setDraft({ ...draft, prefs: { ...draft.prefs, requireCover } })} />
        <SettingToggle label={t.settings.autoPublish} checked={draft.prefs.autoPublish} onChange={(autoPublish) => setDraft({ ...draft, prefs: { ...draft.prefs, autoPublish } })} />
        <SettingToggle label={t.settings.weekend} checked={draft.prefs.weekendDelivery} onChange={(weekendDelivery) => setDraft({ ...draft, prefs: { ...draft.prefs, weekendDelivery } })} />
      </SettingsSection>

      <SettingsSection title={t.common.notifications} icon={<BellRing className="h-5 w-5" />}>
        <SettingToggle label={t.settings.jobSms} checked={draft.notifications.jobSms} onChange={(jobSms) => setDraft({ ...draft, notifications: { ...draft.notifications, jobSms } })} />
        <SettingToggle label={t.settings.jobInApp} checked={draft.notifications.jobInApp} onChange={(jobInApp) => setDraft({ ...draft, notifications: { ...draft.notifications, jobInApp } })} />
        <SettingToggle label={t.settings.jobEmail} checked={draft.notifications.jobEmail} onChange={(jobEmail) => setDraft({ ...draft, notifications: { ...draft.notifications, jobEmail } })} />
        <SettingToggle label={t.settings.docsInApp} checked={draft.notifications.docsInApp} onChange={(docsInApp) => setDraft({ ...draft, notifications: { ...draft.notifications, docsInApp } })} />
        <SettingToggle label={t.settings.docsEmail} checked={draft.notifications.docsEmail} onChange={(docsEmail) => setDraft({ ...draft, notifications: { ...draft.notifications, docsEmail } })} />
        <SettingToggle label={t.settings.sound} checked={draft.prefs.soundAlerts} onChange={(soundAlerts) => setDraft({ ...draft, prefs: { ...draft.prefs, soundAlerts } })} />
        <SettingToggle label={t.settings.marketingEmail} checked={draft.notifications.marketingEmail} onChange={(marketingEmail) => setDraft({ ...draft, notifications: { ...draft.notifications, marketingEmail } })} />
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

      <SettingsSection title={t.settings.shortcuts} icon={<Warehouse className="h-5 w-5" />}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Button asChild variant="secondary">
            <Link href="/requester/requests/new">{t.menu.newRequest}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/requester/warehouses">{t.menu.warehouses}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/requester/price-book">{t.menu.priceBook}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/requester/invoices">
              <FileText className="h-4 w-4" />
              {t.menu.invoices}
            </Link>
          </Button>
        </div>
      </SettingsSection>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">مشخصات سازمان، ترجیح بار و اعلان‌ها با یک ذخیره ثبت می‌شود.</p>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? t.common.loading : t.settings.saveAll}
        </Button>
      </Card>
    </form>
  );
}
