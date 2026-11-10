"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SettingsSection } from "@/components/domain/settings-controls";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { useMe } from "@/hooks/use-me";

const SECTIONS = [
  { id: "loads", title: "بارها", detail: "درخواست‌ها، سفارش‌ها، سفرها و رهگیری. فاکتور می‌ماند، ولی دیگر به سفارش وصل نیست." },
  { id: "invoices", title: "فاکتورها", detail: "فاکتورها، پرداخت‌ها و سندهای مالی." },
  { id: "drivers", title: "راننده‌ها", detail: "حساب راننده، ماشین و کیف پول. بارها می‌مانند و راننده از آن‌ها برداشته می‌شود." },
  { id: "owners", title: "صاحب بارها", detail: "شرکت صاحب بار و کاربرانش، همراه بارها و فاکتورهای همان شرکت‌ها. حساب مدیر می‌ماند." },
  { id: "chats", title: "چت‌ها", detail: "گفتگوها و پیام‌ها." },
  { id: "notifications", title: "اعلان‌ها", detail: "اعلان‌های داخل سامانه." },
  { id: "tickets", title: "تیکت‌ها", detail: "تیکت‌های پشتیبانی و پاسخ‌هایشان." },
  { id: "documents", title: "مدارک", detail: "پرونده‌های آپلودشده و فایل‌هایشان." },
  { id: "logs", title: "لاگ‌ها", detail: "گزارش فعالیت و تاریخچهٔ وضعیت." },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function AdminDataPurge() {
  const me = useMe();
  const qc = useQueryClient();
  const allowed = Boolean(me.data?.isPlatformStaff && me.data.permissions.includes("settings.manage"));
  const counts = useQuery({
    queryKey: ["admin-data-purge"],
    queryFn: () => api<Array<{ id: SectionId; count: number }>>("/admin/data-purge"),
    enabled: allowed,
  });
  const purge = useMutation({
    mutationFn: (section: SectionId) =>
      api<{ section: SectionId; removed: number }>("/admin/data-purge", {
        method: "POST",
        body: JSON.stringify({ section, confirm: true }),
      }),
    onSuccess: (result) => {
      const title = SECTIONS.find((item) => item.id === result.section)?.title ?? "بخش";
      toast.success(`${title} پاک شد`);
      qc.invalidateQueries({ queryKey: ["admin-data-purge"] });
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!allowed) return null;
  const countOf = (id: SectionId) => counts.data?.find((row) => row.id === id)?.count ?? 0;
  if (counts.isError) {
    return (
      <SettingsSection title="پاک کردن بخش‌های پایگاه" description="فهرست بخش‌ها خوانده نشد. صفحه را دوباره باز کنید." icon={<Trash2 className="h-5 w-5" />} />
    );
  }

  return (
    <SettingsSection title="پاک کردن بخش‌های پایگاه" description="هر دکمه فقط همان بخش را پاک می‌کند. حساب مدیر و تنظیمات سامانه می‌مانند و این کار برگشت ندارد." icon={<Trash2 className="h-5 w-5" />}>
      <div className="grid gap-3">
        {SECTIONS.map((section) => {
          const count = countOf(section.id);
          return (
            <div key={section.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
              <div className="min-w-0">
                <div className="break-words font-semibold">
                  {section.title}
                  <span className="ms-2 text-sm font-normal text-muted">{counts.isLoading ? "…" : formatNumber(count)}</span>
                </div>
                <p className="mt-1 break-words text-sm leading-6 text-muted">{section.detail}</p>
              </div>
              <Button
                type="button"
                variant="danger"
                disabled={purge.isPending || count === 0}
                onClick={() => {
                  const extra = section.id === "owners" ? " بارها و فاکتورهایشان هم پاک می‌شود." : "";
                  if (window.confirm(`${section.title} پاک شود؟${extra} این کار برگشت ندارد.`)) purge.mutate(section.id);
                }}
              >
                {purge.isPending ? "در حال پاک کردن…" : "پاک کردن"}
              </Button>
            </div>
          );
        })}
      </div>
    </SettingsSection>
  );
}
