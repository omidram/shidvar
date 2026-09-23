"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/chrome";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { statusFa } from "@/lib/status-fa";
import { useI18n } from "@/i18n/provider";

type CompanyRow = {
  id: string;
  tradeName: string;
  legalName?: string;
  type: string;
  status: string;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  priceBooks?: Array<{ status: string; lines: Array<{ id: string }> }>;
};

export default function CompaniesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    tradeName: "",
    legalName: "",
    phone: "",
    email: "",
    taxId: "",
    registrationNumber: "",
    ownerFirstName: "",
    ownerLastName: "",
    ownerEmail: "",
    ownerPhone: "",
    ownerPassword: "DevStore!2026",
  });
  const q = useQuery({
    queryKey: ["admin-companies"],
    queryFn: () => api<CompanyRow[]>("/admin/companies"),
  });
  const create = useMutation({
    mutationFn: () => api<{ id: string }>("/admin/companies", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: (company) => {
      toast.success("شرکت ثبت شد؛ دفترچه قیمت را کامل کنید");
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
      window.location.href = `/admin/companies/${company.id}`;
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div>
      <PageHeader
        title={t.menu.companies}
        description="هر صاحب بار یک دفترچه قیمت دارد که مدیریت ست می‌کند"
        actions={
          <Button type="button" onClick={() => setOpen((v) => !v)}>
            ثبت صاحب بار
          </Button>
        }
      />
      {open ? (
        <Card className="mb-6 grid gap-3 md:grid-cols-2">
          <Field label="نام تجاری">
            <Input value={form.tradeName} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} />
          </Field>
          <Field label="نام قانونی">
            <Input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
          </Field>
          <Field label="تلفن شرکت">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="ایمیل شرکت">
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="شناسه ملی">
            <Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
          </Field>
          <Field label="شماره ثبت">
            <Input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
          </Field>
          <Field label="نام رابط">
            <Input value={form.ownerFirstName} onChange={(e) => setForm({ ...form, ownerFirstName: e.target.value })} />
          </Field>
          <Field label="نام خانوادگی رابط">
            <Input value={form.ownerLastName} onChange={(e) => setForm({ ...form, ownerLastName: e.target.value })} />
          </Field>
          <Field label="ایمیل ورود رابط">
            <Input value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
          </Field>
          <Field label="موبایل رابط">
            <Input value={form.ownerPhone} onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })} />
          </Field>
          <Field label="رمز عبور اولیه">
            <Input type="password" value={form.ownerPassword} onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })} />
          </Field>
          <div className="flex items-end">
            <Button type="button" onClick={() => create.mutate()} disabled={create.isPending || !form.tradeName || !form.ownerEmail}>
              ثبت و رفتن به دفترچه قیمت
            </Button>
          </div>
        </Card>
      ) : null}
      <div className="grid gap-3">
        {(q.data ?? []).map((c) => {
          const book = c.priceBooks?.[0];
          const lines = book?.lines.length ?? 0;
          return (
            <Link key={c.id} href={`/admin/companies/${c.id}`}>
              <Card className="transition hover:-translate-y-0.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold">{c.tradeName}</div>
                    <p className="mt-1 text-sm text-muted">{c.legalName}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <p className="mt-3 text-sm">
                  {statusFa(c.type)}
                  {c.phone ? ` · ${c.phone}` : ""}
                  {c.email ? ` · ${c.email}` : ""}
                </p>
                <p className="mt-2 text-sm">
                  دفترچه قیمت: {book ? `${statusFa(book.status)} · ${lines} ردیف نرخ` : "ست نشده"}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
