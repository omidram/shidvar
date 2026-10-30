"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { ErrorState } from "@/components/domain/chrome";
import { Card, StatCard } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatMoney, formatNumber } from "@/lib/utils";
import type { ProfitLossPayload } from "@/server/domains/reports/profit-loss-service";

type Mode = "daily" | "monthly";

const RANGES: Record<Mode, Array<{ count: number; label: string }>> = {
  daily: [
    { count: 7, label: "۷ روز اخیر" },
    { count: 30, label: "۳۰ روز اخیر" },
    { count: 90, label: "۹۰ روز اخیر" },
  ],
  monthly: [
    { count: 6, label: "۶ ماه اخیر" },
    { count: 12, label: "۱۲ ماه اخیر" },
    { count: 24, label: "۲۴ ماه اخیر" },
  ],
};

export function ProfitLossPanel() {
  const [mode, setMode] = useState<Mode>("daily");
  const [count, setCount] = useState(30);
  const q = useQuery({
    queryKey: ["profit-loss", mode, count],
    queryFn: () => api<ProfitLossPayload>(`/admin/reports/profit-loss?granularity=${mode}&count=${count}`),
  });

  function pickMode(next: Mode) {
    setMode(next);
    setCount(next === "daily" ? 30 : 12);
  }

  const data = q.data;
  return (
    <Card className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">گزارش سود و زیان</h2>
          <p className="mt-1 text-sm text-muted">
            درآمد = صورتحساب حمل + کمیسیون. هزینه = کرایهٔ رانندگان برای بارهای تحویل‌شده. همه مبالغ به ریال.
          </p>
        </div>
        <a
          href={`/api/v1/admin/reports/profit-loss/export?granularity=${mode}&count=${count}`}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          <Download className="h-4 w-4" />
          خروجی اکسل
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ["daily", "روزانه"],
          ["monthly", "ماهانه"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => pickMode(key)}
            className={`h-9 rounded-xl px-4 text-sm font-bold ${mode === key ? "bg-primary text-primary-foreground" : "border border-border bg-background"}`}
          >
            {label}
          </button>
        ))}
        <span className="mx-2 hidden w-px bg-border sm:block" />
        {RANGES[mode].map((range) => (
          <button
            key={range.count}
            type="button"
            onClick={() => setCount(range.count)}
            className={`h-9 rounded-xl px-3 text-sm ${count === range.count ? "bg-ink text-white" : "border border-border bg-background"}`}
          >
            {range.label}
          </button>
        ))}
      </div>

      {q.isLoading ? <p>در حال بارگذاری…</p> : null}
      {q.isError ? <ErrorState message="گزارش سود و زیان بارگذاری نشد" /> : null}
      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="جمع درآمد" value={formatMoney(data.totals.income)} />
            <StatCard label="هزینه کرایه راننده" value={formatMoney(data.totals.driverCost)} />
            <StatCard label={data.totals.profit < 0 ? "زیان" : "سود"} value={formatMoney(Math.abs(data.totals.profit))} />
            <StatCard label="بار تکمیل‌شده" value={formatNumber(data.totals.jobs)} />
          </div>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.rows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} />
                <Bar dataKey="income" name="درآمد" fill="#00b562" radius={[6, 6, 0, 0]} />
                <Bar dataKey="driverCost" name="هزینه" fill="#0b1220" radius={[6, 6, 0, 0]} />
                <Bar dataKey="profit" name="سود / زیان" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-start text-muted">
                  <th className="py-2 text-start">{mode === "daily" ? "روز" : "ماه"}</th>
                  <th className="py-2 text-start">درآمد حمل</th>
                  <th className="py-2 text-start">کمیسیون</th>
                  <th className="py-2 text-start">هزینه راننده</th>
                  <th className="py-2 text-start">سود / زیان</th>
                  <th className="py-2 text-start">بار</th>
                </tr>
              </thead>
              <tbody>
                {[...data.rows].reverse().map((row) => (
                  <tr key={row.key} className="border-b border-border/60">
                    <td className="py-2">{row.label}</td>
                    <td className="py-2">{formatMoney(row.transportIncome)}</td>
                    <td className="py-2">{formatMoney(row.commissionIncome)}</td>
                    <td className="py-2">{formatMoney(row.driverCost)}</td>
                    <td className={`py-2 font-bold ${row.profit < 0 ? "text-danger" : "text-primary"}`}>{formatMoney(row.profit)}</td>
                    <td className="py-2">{formatNumber(row.jobs)}</td>
                  </tr>
                ))}
                <tr className="font-black">
                  <td className="py-2">جمع کل</td>
                  <td className="py-2">{formatMoney(data.totals.transportIncome)}</td>
                  <td className="py-2">{formatMoney(data.totals.commissionIncome)}</td>
                  <td className="py-2">{formatMoney(data.totals.driverCost)}</td>
                  <td className={`py-2 ${data.totals.profit < 0 ? "text-danger" : "text-primary"}`}>{formatMoney(data.totals.profit)}</td>
                  <td className="py-2">{formatNumber(data.totals.jobs)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </Card>
  );
}
