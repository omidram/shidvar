"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive } from "lucide-react";
import { toast } from "sonner";
import { SettingsSection } from "@/components/domain/settings-controls";
import { Button } from "@/components/ui/button";
import { api, formatApiError } from "@/lib/api";
import { useMe } from "@/hooks/use-me";

type BackupRecord = {
  id: string;
  createdAt: string;
  automatic: boolean;
  hasDatabase: boolean;
  hasFiles: boolean;
  bytes: number;
};

function when(value: string) {
  return new Date(value).toLocaleString("fa-IR", { timeZone: "Asia/Tehran", dateStyle: "medium", timeStyle: "short" });
}

function size(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toLocaleString("fa-IR", { maximumFractionDigits: mb >= 10 ? 0 : 1 })} مگابایت`;
}

export function AdminBackups() {
  const me = useMe();
  const qc = useQueryClient();
  const allowed = Boolean(me.data?.isPlatformStaff && me.data.permissions.includes("settings.manage"));
  const backups = useQuery({
    queryKey: ["admin-backups"],
    queryFn: () => api<BackupRecord[]>("/admin/backups"),
    enabled: allowed,
  });
  const create = useMutation({
    mutationFn: () => api<BackupRecord>("/admin/backups", { method: "POST" }),
    onSuccess: () => {
      toast.success("بک‌آپ تازه گرفته شد");
      qc.invalidateQueries({ queryKey: ["admin-backups"] });
    },
    onError: (error) => toast.error(formatApiError(error, "گرفتن بک‌آپ انجام نشد")),
  });
  const restore = useMutation({
    mutationFn: (id: string) => api(`/admin/backups/${id}/restore`, { method: "POST", body: JSON.stringify({ confirm: true }) }),
    onSuccess: () => {
      toast.success("سامانه به این بک‌آپ برگشت. صفحه را یک‌بار تازه کنید.");
      qc.invalidateQueries();
    },
    onError: (error) => toast.error(formatApiError(error, "بازیابی انجام نشد")),
  });

  if (!allowed) return null;

  return (
    <SettingsSection
      title="بک‌آپ کل سامانه"
      description="پایگاه و فایل‌های آپلودشده با هم ذخیره می‌شوند. هر شب ساعت ۱۲ به وقت تهران یک بک‌آپ گرفته می‌شود، ۱۰ روز می‌ماند و قدیمی‌تر از آن پاک می‌شود."
      icon={<Archive className="h-5 w-5" />}
    >
      <Button type="button" disabled={create.isPending || restore.isPending} onClick={() => create.mutate()}>
        {create.isPending ? "در حال گرفتن بک‌آپ…" : "گرفتن بک‌آپ الان"}
      </Button>
      <div className="mt-3 grid gap-3">
        {backups.isLoading ? <p className="text-sm text-muted">در حال خواندن بک‌آپ‌ها…</p> : null}
        {backups.isError ? <p className="text-sm text-muted">فهرست بک‌آپ خوانده نشد. صفحه را دوباره باز کنید.</p> : null}
        {(backups.data ?? []).length === 0 && !backups.isLoading ? <p className="text-sm text-muted">هنوز بک‌آپی گرفته نشده است.</p> : null}
        {(backups.data ?? []).map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
            <div className="min-w-0">
              <div className="font-semibold">{when(item.createdAt)}</div>
              <p className="mt-1 text-sm text-muted">
                {item.automatic ? "شبانه" : "دستی"} · {size(item.bytes)}
                {item.hasFiles ? " · همراه فایل‌ها" : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={restore.isPending || create.isPending}
              onClick={() => {
                if (window.confirm("سامانه به این بک‌آپ برگردد؟ داده‌های فعلی با همین نسخه عوض می‌شود.")) restore.mutate(item.id);
              }}
            >
              {restore.isPending ? "در حال بازیابی…" : "بازیابی"}
            </Button>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}
