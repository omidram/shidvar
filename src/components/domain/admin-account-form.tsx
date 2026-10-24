"use client";

import { LockKeyhole, Palette, UserRound } from "lucide-react";
import { ErrorState, PageHeader } from "@/components/domain/chrome";
import { SettingsSection } from "@/components/domain/settings-controls";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useSettingsForm } from "@/hooks/use-settings";
import { useTheme } from "@/components/theme/theme-provider";
import { useI18n } from "@/i18n/provider";
import { cn, formatDateTime } from "@/lib/utils";

export function AdminAccountEditor({ mode }: { mode: "profile" | "settings" }) {
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
        title={mode === "profile" ? t.menu.adminProfile : t.menu.settings}
        description={t.settings.adminHint}
        actions={
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t.common.loading : t.settings.saveAll}
          </Button>
        }
      />

      <SettingsSection title={t.settings.personal} description="نام، موبایل و نام کاربری ورود مدیر" icon={<UserRound className="h-5 w-5" />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.auth.firstName}>
            <Input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} required />
          </Field>
          <Field label={t.auth.lastName}>
            <Input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} required />
          </Field>
          <Field label={t.auth.phone}>
            <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} inputMode="tel" />
          </Field>
          <Field label="نام کاربری" hint="با همین نام وارد می‌شوید">
            <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value.trim() })} required autoComplete="username" />
          </Field>
        </div>
        <p className="text-xs text-muted">آخرین ورود: {data.user.lastLoginAt ? formatDateTime(data.user.lastLoginAt) : "—"}</p>
      </SettingsSection>

      {mode === "settings" ? (
        <>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.settings.currentPassword}>
                <Input type="password" value={draft.currentPassword} onChange={(e) => setDraft({ ...draft, currentPassword: e.target.value })} autoComplete="current-password" />
              </Field>
              <Field label={t.settings.newPassword} hint={t.auth.passwordHint}>
                <Input type="password" value={draft.newPassword} onChange={(e) => setDraft({ ...draft, newPassword: e.target.value })} autoComplete="new-password" />
              </Field>
            </div>
          </SettingsSection>
        </>
      ) : null}
    </form>
  );
}
