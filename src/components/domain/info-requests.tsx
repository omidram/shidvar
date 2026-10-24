"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, formatApiError, getApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { INFO_FIELDS, VEHICLE_OPTIONS } from "@/lib/info-fields";
import { CITY_COORDS } from "@/lib/geo/city-coords";

export type InfoRequestRow = {
  id: string;
  companyId: string;
  status: "OPEN" | "SUBMITTED" | "ACCEPTED" | "CANCELLED";
  fields: Array<{ key: string; label: string }>;
  documents: Array<{ type: string; label: string }>;
  message: string | null;
  adminNote: string | null;
  response: Record<string, string> | null;
  createdAt: string;
  respondedAt: string | null;
  company?: { id: string; tradeName: string; type: string; phone: string | null };
};

export const INFO_STATUS_LABEL: Record<InfoRequestRow["status"], string> = {
  OPEN: "منتظر پاسخ",
  SUBMITTED: "پاسخ داده شده",
  ACCEPTED: "تأیید شد",
  CANCELLED: "لغو شد",
};

const CITIES = Object.keys(CITY_COORDS);

function FieldInput({ fieldKey, value, onChange }: { fieldKey: string; value: string; onChange: (v: string) => void }) {
  const def = INFO_FIELDS.find((f) => f.key === fieldKey);
  if (def?.type === "vehicle") {
    return (
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">انتخاب کنید</option>
        {VEHICLE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    );
  }
  if (fieldKey === "city") {
    return (
      <>
        <Input list="info-cities" value={value} onChange={(e) => onChange(e.target.value)} required />
        <datalist id="info-cities">
          {CITIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </>
    );
  }
  return (
    <Input
      type={def?.type === "email" ? "email" : "text"}
      dir={def?.type === "email" ? "ltr" : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
    />
  );
}

function OpenRequest({ row }: { row: InfoRequestRow }) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const respond = useMutation({
    mutationFn: () => api(`/info-requests/${row.id}/respond`, { method: "POST", body: JSON.stringify({ values }) }),
    onSuccess: () => {
      toast.success("اطلاعات برای مدیریت ارسال شد");
      qc.invalidateQueries({ queryKey: ["info-requests"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error) => {
      setErrors(getApiError(error)?.fields ?? {});
      toast.error(formatApiError(error, "ارسال نشد"));
    },
  });

  return (
    <Card className="grid gap-4 border-amber-400/60">
      <div>
        <h2 className="text-lg font-black">مدیریت اطلاعات تکمیلی خواسته است</h2>
        {row.message ? <p className="mt-2 text-sm leading-7">{row.message}</p> : null}
        {row.adminNote ? <p className="mt-2 text-sm text-danger">یادداشت مدیریت: {row.adminNote}</p> : null}
      </div>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          respond.mutate();
        }}
      >
        {row.fields.map((field) => (
          <Field key={field.key} label={field.label} error={errors[field.key]?.[0]}>
            <FieldInput fieldKey={field.key} value={values[field.key] ?? ""} onChange={(v) => setValues({ ...values, [field.key]: v })} />
          </Field>
        ))}
        {row.documents.length ? (
          <div className="rounded-2xl border border-border bg-surface-soft p-3 text-sm sm:col-span-2">
            <p className="font-bold">مدارک خواسته‌شده</p>
            <p className="mt-1 text-muted">این مدارک را در بخش مدارک پایین همین صفحه بارگذاری کنید، سپس دکمه ارسال را بزنید:</p>
            <ul className="mt-2 list-inside list-disc">
              {row.documents.map((doc) => (
                <li key={doc.type}>{doc.label}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={respond.isPending}>
            {respond.isPending ? "در حال ارسال…" : "ارسال برای مدیریت"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function useOwnInfoRequests() {
  return useQuery({ queryKey: ["info-requests"], queryFn: () => api<InfoRequestRow[]>("/info-requests") });
}

export function InfoRequestsPanel({ onlyOpen = false }: { onlyOpen?: boolean }) {
  const q = useOwnInfoRequests();
  const rows = q.data ?? [];
  const open = rows.filter((r) => r.status === "OPEN");
  const waiting = rows.filter((r) => r.status === "SUBMITTED");
  if (!open.length && (onlyOpen || !waiting.length)) return null;
  return (
    <div className="grid gap-4">
      {open.map((row) => (
        <OpenRequest key={row.id} row={row} />
      ))}
      {!onlyOpen && waiting.length ? (
        <Card className="text-sm text-muted">اطلاعات شما ارسال شده و منتظر بررسی مدیریت است.</Card>
      ) : null}
    </div>
  );
}
