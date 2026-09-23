"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/chrome";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/provider";
import { RULE_GROUPS, type RuleField } from "@/lib/business-rule-catalog";
import { cn } from "@/lib/utils";

function asNumber(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function NumberField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">
        {label}
        {unit ? <span className="ms-1 text-xs font-normal text-muted">({unit})</span> : null}
      </span>
      <Input
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(asNumber(e.target.value))}
      />
    </label>
  );
}

function RuleEditor({
  field,
  value,
  onSave,
  saving,
}: {
  field: RuleField;
  value: unknown;
  onSave: (value: unknown) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<unknown>(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (field.kind === "boolean") {
    const on = Boolean(value);
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={saving}
        onClick={() => onSave(!on)}
        className={cn(
          "mt-4 flex h-11 items-center justify-between rounded-2xl border px-4 text-sm font-semibold",
          on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
        )}
      >
        <span>{on ? "روشن" : "خاموش"}</span>
        <span className={cn("grid h-6 w-11 rounded-full p-0.5", on ? "bg-white/25" : "bg-border")}>
          <span className={cn("h-5 w-5 rounded-full bg-white shadow transition", on ? "ms-auto" : "")} />
        </span>
      </button>
    );
  }

  if (field.kind === "number") {
    const dirty = asNumber(draft) !== asNumber(value);
    return (
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1">
          <NumberField label="مقدار" unit={field.unit} value={asNumber(draft)} onChange={setDraft} />
        </div>
        <Button disabled={saving || !dirty} onClick={() => onSave(asNumber(draft))}>
          ذخیره
        </Button>
      </div>
    );
  }

  const current = asRecord(value);
  const next = asRecord(draft);
  const dirty = JSON.stringify(next) !== JSON.stringify(current);
  const total = (field.weights ?? []).reduce((sum, w) => sum + asNumber(next[w.key]), 0);

  return (
    <div className="mt-4 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {(field.weights ?? []).map((w) => (
          <NumberField
            key={w.key}
            label={w.title}
            value={asNumber(next[w.key])}
            onChange={(n) => setDraft({ ...next, [w.key]: n })}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">جمع وزن‌ها {total} — نسبت‌ها هنگام امتیازدهی نرمال می‌شوند.</p>
        <Button disabled={saving || !dirty} onClick={() => onSave(next)}>
          ذخیره وزن‌ها
        </Button>
      </div>
    </div>
  );
}

export default function RulesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["rules"], queryFn: () => api<Record<string, unknown>>("/admin/business-rules") });
  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      api(`/admin/business-rules/${encodeURIComponent(key)}`, { method: "PATCH", body: JSON.stringify({ value }) }),
    onSuccess: () => {
      toast.success("قاعده ذخیره شد");
      qc.invalidateQueries({ queryKey: ["rules"] });
    },
    onError: () => toast.error("ذخیره نشد"),
  });
  const rules = q.data ?? {};

  return (
    <div>
      <PageHeader
        title={t.menu.rules}
        description="این صفحه رفتار زندهٔ پلتفرم را عوض می‌کند: چه کسی بار ببیند، پیشنهاد تا کی بماند، و حساب بعد از چند ورود اشتباه قفل شود."
      />
      {q.isLoading ? <p className="text-sm text-muted">{t.common.loading}</p> : null}
      <div className="grid gap-8">
        {RULE_GROUPS.map((group) => (
          <section key={group.id} className="grid gap-3">
            <div>
              <h2 className="text-lg font-bold">{group.title}</h2>
              <p className="mt-1 max-w-3xl text-sm text-muted">{group.body}</p>
            </div>
            {group.fields.map((field) => (
              <Card key={field.key}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">{field.title}</div>
                    <p className="mt-1 text-sm text-muted">{field.body}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      field.live === false ? "bg-amber-50 text-amber-800" : "bg-primary/10 text-primary",
                    )}
                  >
                    {field.live === false ? "رزرو — هنوز اعمال نشده" : "فعال در سیستم"}
                  </span>
                </div>
                {q.isLoading ? null : (
                  <RuleEditor
                    field={field}
                    value={rules[field.key]}
                    saving={save.isPending}
                    onSave={(value) => save.mutate({ key: field.key, value })}
                  />
                )}
              </Card>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
