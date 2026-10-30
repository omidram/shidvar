"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { EmptyState, ErrorState, PageHeader, SimpleTable } from "@/components/domain/chrome";

type CoinTxn = {
  id: string;
  kind: "SIGNUP_BONUS" | "ADMIN_GRANT" | "ADMIN_DEDUCT" | "SPEND" | "EARN" | "REFUND";
  amount: number;
  balanceAfter: number;
  reason: string | null;
  createdAt: string;
};

type CoinWalletView = { companyId: string; balance: number; transactions: CoinTxn[] };

const KIND_LABEL: Record<CoinTxn["kind"], string> = {
  SIGNUP_BONUS: "هدیه ثبت‌نام",
  ADMIN_GRANT: "افزایش توسط مدیریت",
  ADMIN_DEDUCT: "کسر توسط مدیریت",
  SPEND: "خرج",
  EARN: "دریافت",
  REFUND: "بازگشت",
};

const fa = (n: number) => n.toLocaleString("fa-IR");

function TxnTable({ rows }: { rows: CoinTxn[] }) {
  if (!rows.length) return <EmptyState title="هنوز تراکنشی ثبت نشده است" />;
  return (
    <SimpleTable
      headers={["تاریخ", "نوع", "مقدار", "مانده", "توضیح"]}
      rows={rows.map((row) => [
        formatDateTime(row.createdAt),
        KIND_LABEL[row.kind],
        <span key="a" className={row.amount > 0 ? "font-bold text-emerald-600" : "font-bold text-danger"} dir="ltr">
          {row.amount > 0 ? "+" : ""}
          {fa(row.amount)}
        </span>,
        fa(row.balanceAfter),
        row.reason ?? "—",
      ])}
    />
  );
}

function BalanceCard({ balance }: { balance: number }) {
  return (
    <Card className="flex items-center gap-4">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-400/15 text-amber-600">
        <Coins className="h-7 w-7" />
      </span>
      <div>
        <p className="text-sm text-muted">موجودی اعتبار</p>
        <p className="text-3xl font-black">{fa(balance)}</p>
      </div>
    </Card>
  );
}

export function CoinsView() {
  const q = useQuery({ queryKey: ["coins"], queryFn: () => api<CoinWalletView>("/coins") });
  return (
    <div className="grid gap-4">
      <PageHeader title="اعتبارها" description="ارز داخلی shidro. هر حساب تازه ۱۰۰۰ اعتبار هدیه می‌گیرد." />
      {q.isLoading ? <p>در حال بارگذاری…</p> : null}
      {q.error ? <ErrorState message={formatApiError(q.error, "اعتبارها بارگذاری نشد")} /> : null}
      {q.data ? (
        <>
          <BalanceCard balance={q.data.balance} />
          <TxnTable rows={q.data.transactions} />
        </>
      ) : null}
    </div>
  );
}

export function AdminCoinsPanel({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const q = useQuery({
    queryKey: ["admin-coins", companyId],
    queryFn: () => api<CoinWalletView>(`/admin/companies/${companyId}/coins`),
  });
  const adjust = useMutation({
    mutationFn: (sign: 1 | -1) =>
      api<CoinWalletView>(`/admin/companies/${companyId}/coins`, {
        method: "POST",
        body: JSON.stringify({ amount: sign * Math.abs(Math.trunc(Number(amount))), reason }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["admin-coins", companyId], data);
      setAmount("");
      setReason("");
      toast.success("موجودی اعتبار به‌روز شد");
    },
    onError: (error) => toast.error(formatApiError(error, "تغییر اعتبار انجام نشد")),
  });
  const valid = Number(amount) > 0 && reason.trim().length >= 2;

  return (
    <Card className="grid gap-4">
      <h2 className="text-lg font-black">اعتبارها</h2>
      {q.data ? <BalanceCard balance={q.data.balance} /> : <p className="text-sm text-muted">در حال بارگذاری…</p>}
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto_auto] sm:items-end">
        <Field label="تعداد اعتبار">
          <Input type="number" min={1} dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="علت">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Button disabled={!valid || adjust.isPending} onClick={() => adjust.mutate(1)}>
          افزودن
        </Button>
        <Button variant="outline" disabled={!valid || adjust.isPending} onClick={() => adjust.mutate(-1)}>
          کسر
        </Button>
      </div>
      {q.data ? <TxnTable rows={q.data.transactions.slice(0, 10)} /> : null}
    </Card>
  );
}
