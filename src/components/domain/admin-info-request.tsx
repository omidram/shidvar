"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { documentsFor, fieldsFor, infoFieldLabel, VEHICLE_OPTIONS, type InfoTarget } from "@/lib/info-fields";
import { formatDate } from "@/lib/utils";
import { INFO_STATUS_LABEL, type InfoRequestRow } from "@/components/domain/info-requests";

function displayValue(key: string, value: string) {
  if (key === "vehicleType") return VEHICLE_OPTIONS.find((o) => o.value === value)?.label ?? value;
  return value;
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function AdminInfoRequestPanel({ companyId, target }: { companyId: string; target: InfoTarget }) {
  const qc = useQueryClient();
  const [fields, setFields] = useState<string[]>([]);
  const [docs, setDocs] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const key = ["admin-info-requests", companyId];
  const q = useQuery({ queryKey: key, queryFn: () => api<InfoRequestRow[]>(`/admin/companies/${companyId}/info-requests`) });

  const create = useMutation({
    mutationFn: () =>
      api("/admin/info-requests", { method: "POST", body: JSON.stringify({ companyId, fields, documents: docs, message: message || undefined }) }),
    onSuccess: () => {
      toast.success("درخواست اطلاعات برای کاربر ارسال شد");
      setFields([]);
      setDocs([]);
      setMessage("");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (error) => toast.error(formatApiError(error, "ارسال نشد")),
  });

  const review = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACCEPTED" | "OPEN" | "CANCELLED" }) =>
      api(`/admin/info-requests/${id}/review`, { method: "POST", body: JSON.stringify({ status, adminNote: notes[id] || undefined }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["admin-info-requests-all"] });
    },
    onError: (error) => toast.error(formatApiError(error, "انجام نشد")),
  });

  const toggle = (list: string[], set: (v: string[]) => void, value: string, on: boolean) =>
    set(on ? [...list, value] : list.filter((v) => v !== value));

  return (
    <Card className="grid gap-4">
      <div>
        <h2 className="text-lg font-black">درخواست اطلاعات تکمیلی</h2>
        <p className="mt-1 text-sm text-muted">موارد لازم را انتخاب کنید تا کاربر از پنل خود تکمیل کند.</p>
      </div>
      <div>
        <p className="mb-2 text-sm font-bold">اطلاعات</p>
        <div className="flex flex-wrap gap-2">
          {fieldsFor(target).map((f) => (
            <Toggle key={f.key} label={f.label} checked={fields.includes(f.key)} onChange={(on) => toggle(fields, setFields, f.key, on)} />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-bold">مدارک</p>
        <div className="flex flex-wrap gap-2">
          {documentsFor(target).map((d) => (
            <Toggle key={d.type} label={d.label} checked={docs.includes(d.type)} onChange={(on) => toggle(docs, setDocs, d.type, on)} />
          ))}
        </div>
      </div>
      <Field label="پیام برای کاربر (اختیاری)">
        <Input value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>
      <div>
        <Button disabled={create.isPending || (!fields.length && !docs.length && !message.trim())} onClick={() => create.mutate()}>
          ارسال درخواست
        </Button>
      </div>

      {(q.data ?? []).length ? (
        <div className="grid gap-3 border-t border-border pt-4">
          <p className="text-sm font-bold">سابقه درخواست‌ها</p>
          {(q.data ?? []).map((row) => (
            <div key={row.id} className="grid gap-2 rounded-2xl border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">{INFO_STATUS_LABEL[row.status]}</span>
                <span className="text-xs text-muted">{formatDate(row.createdAt)}</span>
              </div>
              <p className="text-muted">
                {[...row.fields.map((f) => f.label), ...row.documents.map((d) => d.label)].join("، ") || row.message}
              </p>
              {row.response ? (
                <dl className="grid gap-1 sm:grid-cols-2">
                  {Object.entries(row.response).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="text-muted">{infoFieldLabel(k)}:</dt>
                      <dd className="font-medium">{displayValue(k, v)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {row.status === "SUBMITTED" ? (
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    className="max-w-xs"
                    placeholder="یادداشت (برای درخواست اصلاح)"
                    value={notes[row.id] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [row.id]: e.target.value })}
                  />
                  <Button onClick={() => review.mutate({ id: row.id, status: "ACCEPTED" })}>تأیید پاسخ</Button>
                  <Button variant="secondary" onClick={() => review.mutate({ id: row.id, status: "OPEN" })}>
                    نیاز به اصلاح
                  </Button>
                </div>
              ) : null}
              {row.status === "OPEN" ? (
                <div>
                  <Button variant="outline" onClick={() => review.mutate({ id: row.id, status: "CANCELLED" })}>
                    لغو درخواست
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
