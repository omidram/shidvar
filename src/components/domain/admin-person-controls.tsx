"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SettingToggle } from "@/components/domain/settings-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { api, formatApiError } from "@/lib/api";

type AccountControl = {
  firstName: string;
  lastName: string;
  phone: string | null;
  tradeName: string;
  legalName: string;
  suspended: boolean;
  smsSend: boolean;
  smsReceive: boolean;
};

export function AdminPersonControls({ companyId, driverId }: { companyId?: string; driverId?: string }) {
  const qc = useQueryClient();
  const path = companyId ? `/admin/companies/${companyId}/account` : `/admin/drivers/${driverId}/account`;
  const statusPath = companyId ? `/admin/companies/${companyId}/status` : `/admin/drivers/${driverId}/status`;
  const q = useQuery({ queryKey: ["account-control", path], queryFn: () => api<AccountControl>(path) });
  const [tradeName, setTradeName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [smsSend, setSmsSend] = useState(true);
  const [smsReceive, setSmsReceive] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (!q.data) return;
    setTradeName(q.data.tradeName);
    setLegalName(q.data.legalName);
    setFirstName(q.data.firstName);
    setLastName(q.data.lastName);
    setSmsSend(q.data.smsSend);
    setSmsReceive(q.data.smsReceive);
  }, [q.data]);

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["account-control", path] });
    if (companyId) void qc.invalidateQueries({ queryKey: ["company", companyId] });
    if (driverId) void qc.invalidateQueries({ queryKey: ["driver", driverId] });
  }

  const save = useMutation({
    mutationFn: () => {
      if (password !== confirm) throw new Error("تکرار رمز با رمز جدید یکی نیست");
      const body: Record<string, unknown> = { smsSend, smsReceive };
      if (tradeName.trim()) body.tradeName = tradeName.trim();
      if (legalName.trim()) body.legalName = legalName.trim();
      if (firstName.trim()) body.firstName = firstName.trim();
      if (lastName.trim()) body.lastName = lastName.trim();
      if (password) body.newPassword = password;
      return api(path, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      toast.success("تغییرها ذخیره شد");
      setPassword("");
      setConfirm("");
      refresh();
    },
    onError: (error) => toast.error(formatApiError(error, "ذخیره نشد")),
  });

  const suspend = useMutation({
    mutationFn: (nextSuspended: boolean) =>
      api(statusPath, { method: "POST", body: JSON.stringify({ status: nextSuspended ? "SUSPENDED" : "APPROVED" }) }),
    onSuccess: (_data, nextSuspended) => {
      toast.success(nextSuspended ? "حساب معلق شد" : "تعلیق برداشته شد");
      refresh();
    },
    onError: (error) => toast.error(formatApiError(error, "تغییر وضعیت نشد")),
  });

  if (q.isLoading) return <p className="text-sm text-muted">در حال بارگذاری حساب…</p>;
  if (q.isError || !q.data) return <p className="text-sm text-muted">حساب این شخص خوانده نشد.</p>;
  const person = companyId ? "صاحب بار" : "راننده";

  return (
    <Card className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">مدیریت حساب {person}</h2>
          <p className="mt-1 text-sm text-muted">
            {q.data.suspended ? "این حساب معلق است و نمی‌تواند وارد شود." : "حساب فعال است."}
            {q.data.phone ? ` موبایل ${q.data.phone}` : ""}
          </p>
        </div>
        <Button
          type="button"
          variant={q.data.suspended ? "secondary" : "danger"}
          disabled={suspend.isPending}
          onClick={() => {
            const next = !q.data.suspended;
            const text = next
              ? `حساب این ${person} معلق شود؟ تا رفع تعلیق نمی‌تواند وارد شود.`
              : `تعلیق این ${person} برداشته شود؟`;
            if (!window.confirm(text)) return;
            suspend.mutate(next);
          }}
        >
          {q.data.suspended ? "رفع تعلیق" : "تعلیق حساب"}
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1">
          <Label>{companyId ? "نام صاحب بار" : "نام نمایشی"}</Label>
          <Input value={tradeName} onChange={(event) => setTradeName(event.target.value)} />
        </label>
        <label className="grid gap-1">
          <Label>نام قانونی</Label>
          <Input value={legalName} onChange={(event) => setLegalName(event.target.value)} />
        </label>
        <label className="grid gap-1">
          <Label>نام</Label>
          <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        </label>
        <label className="grid gap-1">
          <Label>نام خانوادگی</Label>
          <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
        </label>
      </div>
      <p className="text-xs text-muted">
        {companyId
          ? "نام صاحب بار بالای صفحه و در فهرست‌ها دیده می‌شود. نام قانونی در شناسنامه است."
          : "نام و نام خانوادگی بالای صفحهٔ راننده دیده می‌شود."}
      </p>
      <div className="grid gap-2">
        <SettingToggle
          label="ارسال پیامک"
          hint="سامانه اعلان بار و کیف پول را برای این حساب پیامک کند."
          checked={smsSend}
          onChange={setSmsSend}
        />
        <SettingToggle
          label="دریافت پیامک"
          hint="کد ورود با پیامک به این شماره برسد."
          checked={smsReceive}
          onChange={setSmsReceive}
        />
      </div>
      <p className="text-xs text-muted">اگر ارسال یا دریافت خاموش باشد، کد ورود پیامک نمی‌شود. اگر ایمیل داشته باشد، کد به ایمیل می‌رود.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1">
          <Label>رمز جدید</Label>
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="خالی بماند اگر نمی‌خواهید عوض شود"
          />
        </label>
        <label className="grid gap-1">
          <Label>تکرار رمز</Label>
          <Input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </label>
      </div>
      <p className="text-xs text-muted">رمز حداقل ۱۰ نویسه است و باید حرف بزرگ، حرف کوچک و عدد داشته باشد. با ذخیرهٔ رمز، ورودهای قبلی این حساب بسته می‌شود.</p>
      <div>
        <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "در حال ذخیره…" : "ذخیره تغییرات"}
        </Button>
      </div>
    </Card>
  );
}
