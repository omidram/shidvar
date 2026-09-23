"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorState, PageHeader } from "@/components/domain/chrome";
import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { ShamsiDateInput } from "@/components/ui/shamsi-date-input";
import { api, formatApiError } from "@/lib/api";
import { IRAN_BANKS } from "@/lib/iran-banks";
import { BANK_STATUS_FA, EXPENSE_CATEGORIES, TXN_STATUS_FA, TXN_TYPE_FA } from "@/lib/wallet-labels";
import { jalaliToIso, toJalali } from "@/lib/shamsi";
import { cn, formatDate, formatMoney, formatNumber } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";
import { useMe } from "@/hooks/use-me";

type Account = { id: string; name: string; kind: string; kindFa: string; balance: number; isDefault: boolean };
type Bank = {
  id: string;
  bankName: string;
  accountHolder: string;
  iban: string;
  cardLast4: string | null;
  zarinpalId: string | null;
  zarinpalStatus: string | null;
  status: string;
  connectedAt: string | null;
};
type Txn = {
  id: string;
  type: string;
  status: string;
  amount: number;
  direction: "in" | "out";
  title: string;
  note: string | null;
  categoryFa: string;
  occurredAt: string;
  account: { name: string };
  bankName: string | null;
};
type Wallet = {
  balance: number;
  currencyCode: string;
  accounts: Account[];
  banks: Bank[];
  transactions: Txn[];
  zarinpal: { sandbox: boolean; paymentReady: boolean; bankReady: boolean; payoutReady: boolean };
  report: {
    totals: { income: number; vehicle: number; travel: number; expense: number; topup: number; withdraw: number; net: number };
    series: Array<{ key: string; label: string; income: number; expense: number }>;
    categories: Array<{ key: string; title: string; amount: number }>;
  };
};

function todayIso() {
  const { jy, jm, jd } = toJalali(new Date());
  return jalaliToIso(jy, jm, jd);
}

function rialInput(value: string) {
  return Number(value.replace(/[^\d]/g, "") || 0);
}

export default function DriverWalletPage() {
  const { t } = useI18n();
  const me = useMe();
  const qc = useQueryClient();
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: () => api<Wallet>("/wallet") });
  const [tab, setTab] = useState<"charge" | "expense" | "transfer" | "bank">("charge");
  const [filter, setFilter] = useState("ALL");

  const [topupAmount, setTopupAmount] = useState("");
  const [topupAccount, setTopupAccount] = useState("");
  const [topupBank, setTopupBank] = useState("");

  const [expKind, setExpKind] = useState<"VEHICLE" | "TRAVEL">("VEHICLE");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("fuel");
  const [expAccount, setExpAccount] = useState("");
  const [expDate, setExpDate] = useState(todayIso());
  const [expNote, setExpNote] = useState("");

  const [fromAccount, setFromAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawBank, setWithdrawBank] = useState("");
  const [withdrawAccount, setWithdrawAccount] = useState("");

  const [newAccountName, setNewAccountName] = useState("");
  const [bankName, setBankName] = useState<string>(IRAN_BANKS[1]);
  const [iban, setIban] = useState("");
  const [cardLast4, setCardLast4] = useState("");

  const data = wallet.data;
  const connectedBanks = data?.banks.filter((b) => b.status === "CONNECTED") ?? [];
  const categories = EXPENSE_CATEGORIES[expKind];

  const txns = useMemo(() => {
    const rows = data?.transactions ?? [];
    if (filter === "ALL") return rows;
    if (filter === "IN") return rows.filter((row) => row.direction === "in");
    if (filter === "OUT") return rows.filter((row) => row.direction === "out");
    return rows.filter((row) => row.type === filter);
  }, [data?.transactions, filter]);

  const mutate = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) =>
      api<Record<string, unknown>>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
    onSuccess: async (result) => {
      if (typeof result?.redirectUrl === "string") {
        toast.success("در حال انتقال به درگاه زرین‌پال...");
        window.location.assign(result.redirectUrl);
        return;
      }
      toast.success("ثبت شد");
      await qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (error) => toast.error(formatApiError(error, t.common.error)),
  });

  useEffect(() => {
    const pay = new URLSearchParams(window.location.search).get("pay");
    if (pay === "ok") toast.success("شارژ زرین‌پال با موفقیت ثبت شد");
    if (pay === "fail") toast.error("پرداخت زرین‌پال انجام نشد یا لغو شد");
    if (pay) window.history.replaceState({}, "", "/driver/wallet");
  }, []);

  if (wallet.isLoading) return <p>{t.common.loading}</p>;
  if (wallet.isError || !data) return <ErrorState message={t.common.error} />;

  const holder = `${me.data?.firstName ?? ""} ${me.data?.lastName ?? ""}`.trim();

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t.menu.wallet}
        description="موجودی ریالی، شارژ از درگاه زرین‌پال، هزینه ماشین و رفت‌وآمد، درآمد سفرها و ثبت شبا."
      />
      {data.zarinpal.sandbox ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          محیط آزمایشی زرین‌پال فعال است. پرداخت واقعی انجام نمی‌شود تا وقتی ZARINPAL_SANDBOX=false باشد.
        </p>
      ) : null}
      {!data.zarinpal.paymentReady ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          شناسه مرچنت زرین‌پال تنظیم نشده. برای شارژ، ZARINPAL_MERCHANT_ID را در فایل محیطی بگذارید.
        </p>
      ) : null}

      <Card className="overflow-hidden bg-ink text-white">
        <p className="text-sm text-white/70">موجودی کل</p>
        <p className="mt-2 text-3xl font-black tracking-tight">{formatMoney(data.balance)}</p>
        <p className="mt-2 text-sm text-white/60">واحد پول ریال است. درآمد بارهای تکمیل‌شده خودکار به حساب «درآمد حمل» می‌نشیند.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button className="bg-primary text-primary-foreground" onClick={() => setTab("charge")}>
            شارژ کیف پول
          </Button>
          <Button variant="outline" className="border-white/20 text-white" onClick={() => setTab("expense")}>
            ثبت هزینه
          </Button>
          <Button variant="outline" className="border-white/20 text-white" onClick={() => setTab("bank")}>
            اتصال بانک
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="درآمد حمل" value={formatMoney(data.report.totals.income)} hint="کرایه سفرهای تکمیل‌شده" />
        <StatCard label="هزینه ماشین" value={formatMoney(data.report.totals.vehicle)} hint="سوخت، تعمیر، بیمه" />
        <StatCard label="رفت‌وآمد" value={formatMoney(data.report.totals.travel)} hint="عوارض، خوراک، اقامت" />
        <StatCard label="مانده خالص" value={formatMoney(data.report.totals.net)} hint="درآمد و شارژ منهای هزینه و برداشت" />
      </div>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold">حساب‌های شما</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.accounts.map((account) => (
            <Card key={account.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold">{account.name}</div>
                  <p className="mt-1 text-xs text-muted">{account.kindFa}{account.isDefault ? " · پیش‌فرض" : ""}</p>
                </div>
                <div className="text-end font-bold">{formatMoney(account.balance)}</div>
              </div>
              {!account.isDefault ? (
                <Button
                  variant="secondary"
                  className="mt-3 h-9 px-3 text-xs"
                  onClick={() =>
                    api(`/wallet/accounts/${account.id}`, { method: "PATCH", body: JSON.stringify({ isDefault: true }) }).then(() => {
                      toast.success("حساب پیش‌فرض عوض شد");
                      qc.invalidateQueries({ queryKey: ["wallet"] });
                    })
                  }
                >
                  پیش‌فرض شود
                </Button>
              ) : null}
            </Card>
          ))}
        </div>
        <Card className="flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1">
            <Field label="حساب جدید">
              <Input value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} placeholder="مثلاً پس‌انداز تعمیرات" />
            </Field>
          </div>
          <Button
            variant="secondary"
            disabled={mutate.isPending || newAccountName.trim().length < 2}
            onClick={() =>
              mutate.mutate(
                { path: "/wallet/accounts", body: { name: newAccountName.trim(), kind: "CUSTOM" } },
                { onSuccess: () => setNewAccountName("") },
              )
            }
          >
            ساخت حساب
          </Button>
        </Card>
      </section>

      <Card>
        <h2 className="font-bold">گزارش مالی شش ماه اخیر</h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.report.series}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={11} tickFormatter={(v) => formatNumber(v)} />
              <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} />
              <Bar dataKey="income" name="ورود پول" fill="#16a34a" radius={6} />
              <Bar dataKey="expense" name="هزینه" fill="#d97706" radius={6} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {data.report.categories.length ? (
          <div className="mt-4 grid gap-2">
            {data.report.categories.map((row) => (
              <div key={row.key} className="flex items-center justify-between text-sm">
                <span>{row.title}</span>
                <span className="font-semibold">{formatMoney(row.amount)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <div className="flex flex-wrap gap-2">
        {[
          { id: "charge", label: "شارژ و برداشت" },
          { id: "expense", label: "ثبت هزینه" },
          { id: "transfer", label: "انتقال بین حساب" },
          { id: "bank", label: "حساب بانکی" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as typeof tab)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold",
              tab === item.id ? "bg-primary text-primary-foreground" : "bg-card border border-border",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "charge" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="grid gap-3">
            <h3 className="font-bold">شارژ کیف پول با زرین‌پال</h3>
            <p className="text-sm text-muted">حداقل مبلغ ۵۰٬۰۰۰ ریال است. بعد از ثبت، به درگاه زرین‌پال می‌روید و پس از پرداخت به کیف پول برمی‌گردید.</p>
            <Field label="مبلغ (ریال)">
              <Input inputMode="numeric" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} placeholder="۵۰۰۰۰۰۰" />
            </Field>
            <Field label="حساب مقصد">
              <NativeSelect value={topupAccount} onChange={(e) => setTopupAccount(e.target.value)}>
                <option value="">حساب اصلی</option>
                {data.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="حساب بانکی مرتبط (اختیاری)">
              <NativeSelect value={topupBank} onChange={(e) => setTopupBank(e.target.value)}>
                <option value="">فقط درگاه زرین‌پال</option>
                {connectedBanks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.bankName} · {bank.iban.slice(-4)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Button
              disabled={mutate.isPending}
              onClick={() =>
                mutate.mutate(
                  {
                    path: "/wallet/topup",
                    body: {
                      amount: rialInput(topupAmount),
                      accountId: topupAccount || undefined,
                      bankAccountId: topupBank || undefined,
                    },
                  },
                  { onSuccess: () => setTopupAmount("") },
                )
              }
            >
              رفتن به درگاه زرین‌پال
            </Button>
          </Card>
          <Card className="grid gap-3">
            <h3 className="font-bold">برداشت آنی به شبا</h3>
            <p className="text-sm text-muted">برداشت فقط به شبایی انجام می‌شود که در زرین‌پال تأیید شده باشد.</p>
            {!data.zarinpal.payoutReady ? (
              <p className="text-sm text-amber-800">برای برداشت آنی، ZARINPAL_ACCESS_TOKEN و ZARINPAL_TERMINAL_ID را تنظیم کنید.</p>
            ) : null}
            <Field label="مبلغ (ریال)">
              <Input inputMode="numeric" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
            </Field>
            <Field label="از حساب">
              <NativeSelect value={withdrawAccount} onChange={(e) => setWithdrawAccount(e.target.value)}>
                <option value="">حساب اصلی</option>
                {data.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="به شبا">
              <NativeSelect value={withdrawBank} onChange={(e) => setWithdrawBank(e.target.value)}>
                <option value="">انتخاب کنید</option>
                {connectedBanks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.bankName} · {bank.accountHolder}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Button
              variant="secondary"
              disabled={mutate.isPending || !withdrawBank}
              onClick={() =>
                mutate.mutate(
                  {
                    path: "/wallet/withdraw",
                    body: { amount: rialInput(withdrawAmount), bankAccountId: withdrawBank, accountId: withdrawAccount || undefined },
                  },
                  { onSuccess: () => setWithdrawAmount("") },
                )
              }
            >
              برداشت
            </Button>
          </Card>
        </div>
      ) : null}

      {tab === "expense" ? (
        <Card className="grid gap-3">
          <div className="flex gap-2">
            {(["VEHICLE", "TRAVEL"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  setExpKind(kind);
                  setExpCategory(EXPENSE_CATEGORIES[kind][0].key);
                }}
                className={cn(
                  "rounded-2xl px-4 py-2 text-sm font-semibold",
                  expKind === kind ? "bg-primary text-primary-foreground" : "bg-background",
                )}
              >
                {kind === "VEHICLE" ? "هزینه ماشین" : "رفت‌وآمد"}
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="مبلغ (ریال)">
              <Input inputMode="numeric" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} />
            </Field>
            <Field label="نوع هزینه">
              <NativeSelect value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
                {categories.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="از حساب">
              <NativeSelect value={expAccount} onChange={(e) => setExpAccount(e.target.value)}>
                <option value="">حساب پیشنهادی</option>
                {data.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="تاریخ">
              <ShamsiDateInput value={expDate} onChange={setExpDate} />
            </Field>
          </div>
          <Field label="توضیح">
            <Input value={expNote} onChange={(e) => setExpNote(e.target.value)} placeholder="مثلاً پمپ بنزین قم" />
          </Field>
          <Button
            disabled={mutate.isPending}
            onClick={() =>
              mutate.mutate(
                {
                  path: "/wallet/expenses",
                  body: {
                    amount: rialInput(expAmount),
                    kind: expKind,
                    category: expCategory,
                    accountId: expAccount || undefined,
                    occurredAt: expDate,
                    note: expNote || undefined,
                  },
                },
                {
                  onSuccess: () => {
                    setExpAmount("");
                    setExpNote("");
                  },
                },
              )
            }
          >
            ثبت هزینه
          </Button>
        </Card>
      ) : null}

      {tab === "transfer" ? (
        <Card className="grid gap-3">
          <h3 className="font-bold">انتقال بین حساب‌های خودتان</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="از">
              <NativeSelect value={fromAccount} onChange={(e) => setFromAccount(e.target.value)}>
                <option value="">انتخاب کنید</option>
                {data.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="به">
              <NativeSelect value={toAccount} onChange={(e) => setToAccount(e.target.value)}>
                <option value="">انتخاب کنید</option>
                {data.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="مبلغ (ریال)">
              <Input inputMode="numeric" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} />
            </Field>
          </div>
          <Button
            disabled={mutate.isPending || !fromAccount || !toAccount}
            onClick={() =>
              mutate.mutate(
                { path: "/wallet/transfer", body: { fromAccountId: fromAccount, toAccountId: toAccount, amount: rialInput(transferAmount) } },
                { onSuccess: () => setTransferAmount("") },
              )
            }
          >
            انتقال بده
          </Button>
        </Card>
      ) : null}

      {tab === "bank" ? (
        <div className="grid gap-3">
          <Card className="grid gap-3">
            <h3 className="font-bold">ثبت شبا در زرین‌پال</h3>
            <p className="text-sm text-muted">شبا به‌عنوان حساب شریک تجاری در پنل زرین‌پال ثبت می‌شود. اتصال وقتی فعال است که وضعیت آن ACTIVE باشد.</p>
            {!data.zarinpal.bankReady ? (
              <p className="text-sm text-amber-800">برای ثبت شبا، ZARINPAL_ACCESS_TOKEN را در فایل محیطی بگذارید.</p>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="بانک">
                <NativeSelect value={bankName} onChange={(e) => setBankName(e.target.value)}>
                  {IRAN_BANKS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="شبا">
                <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="IR120120000000005412398761" dir="ltr" />
              </Field>
              <Field label="چهار رقم آخر کارت">
                <Input value={cardLast4} onChange={(e) => setCardLast4(e.target.value)} maxLength={4} dir="ltr" />
              </Field>
            </div>
            <Button
              disabled={mutate.isPending}
              onClick={() =>
                mutate.mutate(
                  {
                    path: "/wallet/banks",
                    body: { bankName, accountHolder: holder || "راننده", iban, cardLast4: cardLast4 || undefined },
                  },
                  { onSuccess: () => setIban("") },
                )
              }
            >
              ثبت شبا
            </Button>
          </Card>
          {data.banks.map((bank) => (
            <Card key={bank.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold">
                  {bank.bankName} · {BANK_STATUS_FA[bank.status] ?? bank.status}
                </div>
                <p className="mt-1 text-sm text-muted" dir="ltr">
                  {bank.iban}
                  {bank.cardLast4 ? ` · ****${bank.cardLast4}` : ""}
                </p>
                <p className="text-xs text-muted">{bank.accountHolder}</p>
                {bank.zarinpalStatus ? (
                  <p className="mt-1 text-xs text-muted">وضعیت زرین‌پال: {bank.zarinpalStatus}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted">هنوز در زرین‌پال ثبت نشده</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {bank.status !== "CONNECTED" || !bank.zarinpalId ? (
                  <Button
                    onClick={() => mutate.mutate({ path: `/wallet/banks/${bank.id}/connect` })}
                    disabled={mutate.isPending}
                  >
                    {bank.zarinpalId ? "بررسی وضعیت زرین‌پال" : "ثبت در زرین‌پال"}
                  </Button>
                ) : null}
                {bank.status === "CONNECTED" ? (
                  <Button
                    variant="secondary"
                    onClick={() => mutate.mutate({ path: `/wallet/banks/${bank.id}/disconnect` })}
                    disabled={mutate.isPending}
                  >
                    قطع اتصال
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">گردش حساب</h2>
          <NativeSelect className="w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="ALL">همه</option>
            <option value="IN">واریز</option>
            <option value="OUT">برداشت و هزینه</option>
            <option value="INCOME">درآمد سفر</option>
            <option value="VEHICLE_EXPENSE">هزینه ماشین</option>
            <option value="TRAVEL_EXPENSE">رفت‌وآمد</option>
            <option value="TOPUP">شارژ</option>
          </NativeSelect>
        </div>
        {txns.length === 0 ? <p className="text-sm text-muted">{t.common.empty}</p> : null}
        {txns.map((row) => (
          <Card key={row.id} className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-bold">{row.title}</div>
              <p className="mt-1 text-xs text-muted">
                {TXN_TYPE_FA[row.type] ?? row.type} · {TXN_STATUS_FA[row.status] ?? row.status} · {row.account.name}
                {row.categoryFa !== "—" ? ` · ${row.categoryFa}` : ""}
                {row.bankName ? ` · ${row.bankName}` : ""}
              </p>
              {row.note ? <p className="mt-1 text-xs text-muted">{row.note}</p> : null}
            </div>
            <div className="text-end">
              <div className={cn("font-bold", row.direction === "in" ? "text-primary" : "text-amber-800")}>
                {row.direction === "in" ? "+" : "−"}
                {formatMoney(row.amount)}
              </div>
              <div className="mt-1 text-xs text-muted">{formatDate(row.occurredAt)}</div>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
