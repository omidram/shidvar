"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CargoBadges } from "@/components/domain/cargo-badges";
import { SETTLEMENT_FA, SETTLEMENT_METHODS, type SettlementMethod, settlementLabel } from "@/lib/settlement";
import { formatMoney, formatNumber } from "@/lib/utils";

export type LoadSummary = {
  id: string;
  number: string;
  originCity?: string | null;
  destinationCity?: string | null;
  originLine1?: string | null;
  destinationLine1?: string | null;
  cargoOwner?: { name: string } | null;
  cargoItems?: Array<{ name: string; quantity: number; unitCode: string; qualityNotes?: string | null; packagingNotes?: string | null }>;
  items?: Array<{ name: string; quantity: number; unitCode: string }>;
  cargoWeight?: number;
  cargoUnit?: string;
  compensationAmount?: number | string | null;
  requestNotes?: string | null;
  qualityNotes?: string | null;
  packagingNotes?: string | null;
  loadType?: string;
  dispatchMode?: string;
  needsWaybill?: boolean;
  needsInsurance?: boolean;
  settlementMethod?: string | null;
};

/** The driver must see what the load is, and confirm it, before taking it. */
export function LoadAcceptDialog({
  job,
  cost = 100,
  busy,
  onConfirm,
  onClose,
}: {
  job: LoadSummary;
  cost?: number;
  busy?: boolean;
  onConfirm: (settlementMethod: SettlementMethod) => void;
  onClose: () => void;
}) {
  const required = (SETTLEMENT_METHODS as readonly string[]).includes(job.settlementMethod ?? "")
    ? (job.settlementMethod as SettlementMethod)
    : null;
  const [method, setMethod] = useState<SettlementMethod | "">(required ?? "");
  const [agreed, setAgreed] = useState(false);
  const items: Array<{ name: string; quantity: number; unitCode: string; qualityNotes?: string | null; packagingNotes?: string | null }> =
    job.cargoItems ?? job.items ?? [];
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/50 p-3 sm:place-items-center" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-xl">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold">محتوای بار {job.number}</h2>
          <CargoBadges loadType={job.loadType} dispatchMode={job.dispatchMode} needsWaybill={job.needsWaybill} needsInsurance={job.needsInsurance} />
        </div>
        <p className="mt-1 text-sm text-muted">لطفاً پیش از قبول بار، محتوای آن را با دقت ببینید.</p>

        <div className="mt-4 grid gap-2 rounded-2xl bg-background p-4 text-sm">
          <div>
            <span className="text-muted">مسیر: </span>
            <span className="font-bold">
              {job.originCity ?? "مبدأ"} ← {job.destinationCity ?? "مقصد"}
            </span>
          </div>
          {job.cargoOwner ? (
            <div>
              <span className="text-muted">صاحب بار: </span>
              <span className="font-bold">{job.cargoOwner.name}</span>
            </div>
          ) : null}
          {job.cargoWeight != null ? (
            <div>
              <span className="text-muted">وزن: </span>
              <span className="font-bold">
                {formatNumber(job.cargoWeight)} {job.cargoUnit ?? ""}
              </span>
            </div>
          ) : null}
          {job.compensationAmount != null ? (
            <div>
              <span className="text-muted">کرایه: </span>
              <span className="font-bold">{formatMoney(job.compensationAmount)}</span>
            </div>
          ) : null}
        </div>

        <h3 className="mt-4 text-sm font-bold">اقلام بار</h3>
        <div className="mt-2 grid gap-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted">قلمی ثبت نشده است.</p>
          ) : (
            items.map((item, index) => (
              <div key={`${item.name}-${index}`} className="rounded-2xl border border-border p-3 text-sm">
                <div className="font-bold">
                  {item.name} · {formatNumber(item.quantity)} {item.unitCode}
                </div>
                {item.qualityNotes ? <div className="mt-1 text-muted">کیفیت: {item.qualityNotes}</div> : null}
                {item.packagingNotes ? <div className="mt-1 text-muted">بسته‌بندی: {item.packagingNotes}</div> : null}
              </div>
            ))
          )}
        </div>
        {job.requestNotes || job.qualityNotes || job.packagingNotes ? (
          <div className="mt-3 rounded-2xl bg-background p-3 text-sm text-muted">
            {[job.requestNotes, job.qualityNotes, job.packagingNotes].filter(Boolean).join(" · ")}
          </div>
        ) : null}

        <fieldset className="mt-4 grid gap-2">
          <legend className="text-sm font-bold">نحوه تسویه</legend>
          {required ? <p className="text-sm text-muted">صاحب بار «{settlementLabel(required)}» را ثبت کرده است. همان را تأیید کنید.</p> : null}
          {SETTLEMENT_METHODS.map((value) => (
            <label key={value} className="flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-sm">
              <input
                type="radio"
                name="settlement"
                checked={method === value}
                disabled={Boolean(required && required !== value)}
                onChange={() => setMethod(value)}
              />
              {SETTLEMENT_FA[value]}
            </label>
          ))}
        </fieldset>

        <label className="mt-4 flex items-start gap-2 rounded-2xl border border-border p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            محتوای بار و نحوه تسویه را کامل دیدم و تأیید می‌کنم؛ بعد از این، بارگیری را شروع می‌کنم.
            <span className="mt-1 block text-xs text-muted">با قبول بار، {formatNumber(cost)} اعتبار از حساب شما کسر می‌شود.</span>
          </span>
        </label>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button type="button" disabled={!agreed || !method || busy} onClick={() => method && onConfirm(method)}>
            تأیید و قبول بار
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            انصراف
          </Button>
        </div>
      </div>
    </div>
  );
}
