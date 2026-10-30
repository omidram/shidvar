"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, formatApiError } from "@/lib/api";

export function SpecialBadge({ note }: { note?: string | null }) {
  return (
    <span
      title={note || "طرف قرارداد ویژه"}
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800"
    >
      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
      ویژه
    </span>
  );
}

export function SpecialToggle({ companyId, isSpecial, note }: { companyId: string; isSpecial: boolean; note?: string | null }) {
  const qc = useQueryClient();
  const [text, setText] = useState(note ?? "");
  const save = useMutation({
    mutationFn: (special: boolean) =>
      api(`/admin/companies/${companyId}/special`, { method: "POST", body: JSON.stringify({ special, note: text || undefined }) }),
    onSuccess: (_data, special) => {
      toast.success(special ? "برچسب ویژه ثبت شد" : "برچسب ویژه برداشته شد");
      qc.invalidateQueries({ queryKey: ["company", companyId] });
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
    },
    onError: (error) => toast.error(formatApiError(error, "ثبت برچسب ناموفق بود")),
  });
  return (
    <Card className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">برچسب ویژه</h2>
          <p className="mt-1 text-sm text-muted">طرف قرارداد یا تأمین‌کنندهٔ مهم را با برچسب «ویژه» در فهرست‌ها مشخص کنید.</p>
        </div>
        {isSpecial ? <SpecialBadge note={note} /> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-sm" placeholder="یادداشت (اختیاری)" value={text} onChange={(e) => setText(e.target.value)} />
        {isSpecial ? (
          <>
            <Button type="button" variant="secondary" disabled={save.isPending} onClick={() => save.mutate(true)}>
              ذخیره یادداشت
            </Button>
            <Button type="button" variant="secondary" disabled={save.isPending} onClick={() => save.mutate(false)}>
              برداشتن برچسب
            </Button>
          </>
        ) : (
          <Button type="button" disabled={save.isPending} onClick={() => save.mutate(true)}>
            ویژه کردن
          </Button>
        )}
      </div>
    </Card>
  );
}
