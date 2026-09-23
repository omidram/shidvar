"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, SimpleTable } from "@/components/domain/chrome";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { ShamsiDateInput } from "@/components/ui/shamsi-date-input";
import { api } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/utils";

export type PriceBookDto = {
  id?: string;
  name: string;
  status: string;
  validFrom?: string | null;
  validTo?: string | null;
  currencyCode: string;
  unitCode: string;
  channels: string[];
  terms?: string | null;
  settlementDays?: number | null;
  stopAfterUnpaidDays?: number | null;
  serviceAmount?: number | null;
  applied?: { requests: number; jobs: number };
  lines: Array<{
    zoneName: string;
    provinces: string[];
    minQuantity: number;
    maxQuantity?: number | null;
    rateType: string;
    unitPrice?: number | null;
    sortOrder?: number;
  }>;
};

const EMPTY_LINE: PriceBookDto["lines"][number] = {
  zoneName: "",
  provinces: [],
  minQuantity: 0,
  maxQuantity: null,
  rateType: "PER_UNIT",
  unitPrice: null,
};

const BADR_TEMPLATE: PriceBookDto = {
  name: "هزینه حمل محصولات بدر ۱۴۰۵",
  status: "ACTIVE",
  validFrom: "2026-05-04",
  validTo: "2026-09-05",
  currencyCode: "IRR",
  unitCode: "carton",
  channels: ["اتکا", "هایپرمی", "هایپراستار", "افق کوروش", "جانبو", "فستیوال"],
  settlementDays: 10,
  stopAfterUnpaidDays: 3,
  serviceAmount: 2500000,
  terms: "هزینه‌ها به جز فروشگاه‌های راه آبی است.\nارسال زیر ۱۵ کارتن سرویسی است.\nارسال در تعطیل انجام نمی‌شود.\nافق کوروش، جانبو و هایپراستار: تحویل ۴۸ ساعت کاری پس از ورود به انبار.\nتسویه هر ۱۰ روز. توقف ارسال پس از ۳ روز عدم پرداخت.\nاعتبار: ۱۴۰۵/۰۲/۱۴ تا ۱۴۰۵/۰۶/۱۴",
  lines: [
    { zoneName: "تهران و البرز", provinces: ["تهران", "البرز"], minQuantity: 0, maxQuantity: 15, rateType: "SERVICE", unitPrice: null },
    { zoneName: "تهران و البرز", provinces: ["تهران", "البرز"], minQuantity: 16, maxQuantity: 50, rateType: "PER_UNIT", unitPrice: 540000 },
    { zoneName: "تهران و البرز", provinces: ["تهران", "البرز"], minQuantity: 51, maxQuantity: null, rateType: "PER_UNIT", unitPrice: 510000 },
    { zoneName: "قزوین، قم، اصفهان، مازندران، گیلان و همدان", provinces: ["قزوین", "قم", "اصفهان", "مازندران", "گیلان", "همدان"], minQuantity: 0, maxQuantity: 15, rateType: "SERVICE", unitPrice: null },
    { zoneName: "قزوین، قم، اصفهان، مازندران، گیلان و همدان", provinces: ["قزوین", "قم", "اصفهان", "مازندران", "گیلان", "همدان"], minQuantity: 16, maxQuantity: 50, rateType: "PER_UNIT", unitPrice: 510000 },
    { zoneName: "قزوین، قم، اصفهان، مازندران، گیلان و همدان", provinces: ["قزوین", "قم", "اصفهان", "مازندران", "گیلان", "همدان"], minQuantity: 51, maxQuantity: null, rateType: "PER_UNIT", unitPrice: 500000 },
    { zoneName: "اردبیل، آذربایجان، گلستان، مرکزی، سمنان و زنجان", provinces: ["اردبیل", "آذربایجان شرقی", "آذربایجان غربی", "گلستان", "مرکزی", "سمنان", "زنجان"], minQuantity: 0, maxQuantity: 15, rateType: "SERVICE", unitPrice: null },
    { zoneName: "اردبیل، آذربایجان، گلستان، مرکزی، سمنان و زنجان", provinces: ["اردبیل", "آذربایجان شرقی", "آذربایجان غربی", "گلستان", "مرکزی", "سمنان", "زنجان"], minQuantity: 16, maxQuantity: 50, rateType: "PER_UNIT", unitPrice: 560000 },
    { zoneName: "اردبیل، آذربایجان، گلستان، مرکزی، سمنان و زنجان", provinces: ["اردبیل", "آذربایجان شرقی", "آذربایجان غربی", "گلستان", "مرکزی", "سمنان", "زنجان"], minQuantity: 51, maxQuantity: null, rateType: "PER_UNIT", unitPrice: 550000 },
    { zoneName: "چهارمحال، خراسان، لرستان، کردستان، ایلام، یزد و کرمانشاه", provinces: ["چهارمحال و بختیاری", "خراسان شمالی", "خراسان رضوی", "لرستان", "کردستان", "ایلام", "یزد", "کرمانشاه"], minQuantity: 0, maxQuantity: 15, rateType: "SERVICE", unitPrice: null },
    { zoneName: "چهارمحال، خراسان، لرستان، کردستان، ایلام، یزد و کرمانشاه", provinces: ["چهارمحال و بختیاری", "خراسان شمالی", "خراسان رضوی", "لرستان", "کردستان", "ایلام", "یزد", "کرمانشاه"], minQuantity: 16, maxQuantity: 50, rateType: "PER_UNIT", unitPrice: 640000 },
    { zoneName: "چهارمحال، خراسان، لرستان، کردستان، ایلام، یزد و کرمانشاه", provinces: ["چهارمحال و بختیاری", "خراسان شمالی", "خراسان رضوی", "لرستان", "کردستان", "ایلام", "یزد", "کرمانشاه"], minQuantity: 51, maxQuantity: null, rateType: "PER_UNIT", unitPrice: 630000 },
    { zoneName: "جنوب و شرق دور", provinces: ["سیستان و بلوچستان", "هرمزگان", "فارس", "خراسان جنوبی", "خوزستان", "کهگیلویه و بویراحمد", "کرمان", "بوشهر"], minQuantity: 0, maxQuantity: 15, rateType: "SERVICE", unitPrice: null },
    { zoneName: "جنوب و شرق دور", provinces: ["سیستان و بلوچستان", "هرمزگان", "فارس", "خراسان جنوبی", "خوزستان", "کهگیلویه و بویراحمد", "کرمان", "بوشهر"], minQuantity: 16, maxQuantity: 50, rateType: "PER_UNIT", unitPrice: 850000 },
    { zoneName: "جنوب و شرق دور", provinces: ["سیستان و بلوچستان", "هرمزگان", "فارس", "خراسان جنوبی", "خوزستان", "کهگیلویه و بویراحمد", "کرمان", "بوشهر"], minQuantity: 51, maxQuantity: null, rateType: "PER_UNIT", unitPrice: 840000 },
  ],
};

function dateInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export function PriceBookEditor({ companyId, readOnly }: { companyId: string; readOnly?: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["price-book", companyId],
    queryFn: () => api<PriceBookDto | null>(`/admin/companies/${companyId}/price-book`),
  });
  const [book, setBook] = useState<PriceBookDto | null>(null);
  useEffect(() => {
    if (q.data) setBook(q.data);
    else if (q.data === null && q.isSuccess) setBook({ ...BADR_TEMPLATE, name: "دفترچه قیمت حمل", status: "DRAFT", lines: [] });
  }, [q.data, q.isSuccess]);

  const save = useMutation({
    mutationFn: () =>
      api<PriceBookDto>(`/admin/companies/${companyId}/price-book`, {
        method: "PUT",
        body: JSON.stringify({
          ...book,
          validFrom: book?.validFrom || null,
          validTo: book?.validTo || null,
          lines: (book?.lines ?? []).map((line, index) => ({
            ...line,
            maxQuantity: line.maxQuantity || null,
            unitPrice: line.rateType === "SERVICE" ? line.unitPrice : Number(line.unitPrice ?? 0),
            sortOrder: index,
          })),
        }),
      }),
    onSuccess: (saved) => {
      const applied = saved.applied;
      toast.success(
        applied
          ? `دفترچه ذخیره شد و نرخ جدید روی ${applied.requests} درخواست و ${applied.jobs} بار باز اعمال شد`
          : "دفترچه قیمت ذخیره شد",
      );
      qc.invalidateQueries({ queryKey: ["price-book", companyId] });
      qc.invalidateQueries({ queryKey: ["company", companyId] });
      qc.invalidateQueries({ queryKey: ["price-quote"] });
      qc.invalidateQueries({ queryKey: ["requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading || !book) return <p>در حال بارگذاری دفترچه قیمت…</p>;

  function patchLine(index: number, patch: Partial<PriceBookDto["lines"][number]>) {
    setBook({
      ...book!,
      lines: book!.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    });
  }

  return (
    <Card className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">دفترچه قیمت حمل</h2>
          <p className="mt-1 text-sm text-muted">همه فیلدها قابل ویرایش‌اند. بعد از ذخیره، نرخ جدید روی درخواست‌ها و بارهای باز همان شرکت اعمال می‌شود.</p>
        </div>
        {readOnly ? null : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setBook({ ...BADR_TEMPLATE })}>
              الگوی بدر ۱۴۰۵
            </Button>
            <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
              ذخیره دفترچه
            </Button>
          </div>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="عنوان دفترچه">
          <Input value={book.name} onChange={(e) => setBook({ ...book, name: e.target.value })} disabled={readOnly} />
        </Field>
        <Field label="وضعیت">
          <NativeSelect value={book.status} onChange={(e) => setBook({ ...book, status: e.target.value })} disabled={readOnly}>
            <option value="DRAFT">پیش‌نویس</option>
            <option value="ACTIVE">فعال</option>
          </NativeSelect>
        </Field>
        <Field label="اعتبار از">
          <ShamsiDateInput
            value={dateInput(book.validFrom)}
            onChange={(value) => setBook({ ...book, validFrom: value || null })}
            disabled={readOnly}
          />
        </Field>
        <Field label="اعتبار تا">
          <ShamsiDateInput
            value={dateInput(book.validTo)}
            onChange={(value) => setBook({ ...book, validTo: value || null })}
            disabled={readOnly}
          />
        </Field>
        <Field label="ارز">
          <NativeSelect value={book.currencyCode} onChange={(e) => setBook({ ...book, currencyCode: e.target.value })} disabled={readOnly}>
            <option value="IRR">ریال</option>
            <option value="IRT">تومان</option>
          </NativeSelect>
        </Field>
        <Field label="واحد شمارش">
          <NativeSelect value={book.unitCode} onChange={(e) => setBook({ ...book, unitCode: e.target.value })} disabled={readOnly}>
            <option value="carton">کارتن</option>
            <option value="box">جعبه</option>
            <option value="pallet">پالت</option>
            <option value="kg">کیلوگرم</option>
          </NativeSelect>
        </Field>
        <Field label="مبلغ سرویسی (زیر حداقل کارتن)">
          <Input type="number" value={book.serviceAmount ?? ""} onChange={(e) => setBook({ ...book, serviceAmount: e.target.value ? Number(e.target.value) : null })} disabled={readOnly} />
        </Field>
        <Field label="فروشگاه‌های مشمول (با ویرگول)">
          <Input value={book.channels.join("، ")} onChange={(e) => setBook({ ...book, channels: e.target.value.split(/[،,]/).map((s) => s.trim()).filter(Boolean) })} disabled={readOnly} />
        </Field>
        <Field label="تسویه هر چند روز">
          <Input type="number" value={book.settlementDays ?? ""} onChange={(e) => setBook({ ...book, settlementDays: e.target.value ? Number(e.target.value) : null })} disabled={readOnly} />
        </Field>
        <Field label="توقف ارسال پس از چند روز عدم پرداخت">
          <Input type="number" value={book.stopAfterUnpaidDays ?? ""} onChange={(e) => setBook({ ...book, stopAfterUnpaidDays: e.target.value ? Number(e.target.value) : null })} disabled={readOnly} />
        </Field>
      </div>
      <Field label="شرایط و تبصره‌ها">
        <Textarea rows={5} value={book.terms ?? ""} onChange={(e) => setBook({ ...book, terms: e.target.value })} disabled={readOnly} />
      </Field>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="text-muted">
              <th className="p-2 text-start">پهنه</th>
              <th className="p-2 text-start">استان‌ها</th>
              <th className="p-2 text-start">از</th>
              <th className="p-2 text-start">تا</th>
              <th className="p-2 text-start">نوع نرخ</th>
              <th className="p-2 text-start">مبلغ واحد</th>
              {readOnly ? null : <th className="p-2" />}
            </tr>
          </thead>
          <tbody>
            {book.lines.map((line, i) => (
              <tr key={`${line.zoneName}-${i}`} className="border-t border-border align-top">
                <td className="p-2">
                  <Input value={line.zoneName} disabled={readOnly} onChange={(e) => patchLine(i, { zoneName: e.target.value })} />
                </td>
                <td className="p-2">
                  <Input value={line.provinces.join("، ")} disabled={readOnly} onChange={(e) => patchLine(i, { provinces: e.target.value.split(/[،,]/).map((s) => s.trim()).filter(Boolean) })} />
                </td>
                <td className="p-2">
                  <Input type="number" value={line.minQuantity} disabled={readOnly} onChange={(e) => patchLine(i, { minQuantity: Number(e.target.value || 0) })} />
                </td>
                <td className="p-2">
                  <Input type="number" value={line.maxQuantity ?? ""} disabled={readOnly} placeholder="باز" onChange={(e) => patchLine(i, { maxQuantity: e.target.value ? Number(e.target.value) : null })} />
                </td>
                <td className="p-2">
                  <NativeSelect value={line.rateType} disabled={readOnly} onChange={(e) => patchLine(i, { rateType: e.target.value })}>
                    <option value="SERVICE">سرویسی</option>
                    <option value="PER_UNIT">به ازای واحد</option>
                  </NativeSelect>
                </td>
                <td className="p-2">
                  <Input type="number" value={line.unitPrice ?? ""} disabled={readOnly} onChange={(e) => patchLine(i, { unitPrice: e.target.value ? Number(e.target.value) : null })} />
                </td>
                {readOnly ? null : (
                  <td className="p-2">
                    <button type="button" className="text-xs text-danger" onClick={() => setBook({ ...book, lines: book.lines.filter((_, j) => j !== i) })}>
                      حذف
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {readOnly ? null : (
        <Button type="button" variant="secondary" onClick={() => setBook({ ...book, lines: [...book.lines, { ...EMPTY_LINE }] })}>
          افزودن ردیف نرخ
        </Button>
      )}
    </Card>
  );
}

export function PriceBookReadView() {
  const q = useQuery({ queryKey: ["price-book-me"], queryFn: () => api<PriceBookDto | null>("/price-books/me") });
  if (q.isLoading) return <p>در حال بارگذاری…</p>;
  if (!q.data) {
    return (
      <div>
        <PageHeader title="دفترچه قیمت" description="هنوز دفترچه‌ای برای شرکت شما ثبت نشده. مدیریت باید نرخ‌ها را ست کند." />
      </div>
    );
  }
  const book = q.data;
  return (
    <div className="grid gap-4">
      <PageHeader title={book.name} description={book.status === "ACTIVE" ? "نرخ فعال شرکت شما" : "این دفترچه هنوز فعال نشده"} />
      <PriceBookStatic book={book} />
    </div>
  );
}

export function PriceBookStatic({ book }: { book: PriceBookDto }) {
  return (
    <Card className="grid gap-4">
      <p className="text-sm text-muted">
        فروشگاه‌ها: {book.channels.join("، ") || "—"}
        {book.serviceAmount != null ? ` · سرویسی ${formatMoney(book.serviceAmount)}` : ""}
        {book.settlementDays ? ` · تسویه هر ${book.settlementDays} روز` : ""}
        {book.validFrom || book.validTo ? ` · اعتبار ${formatDate(book.validFrom)} تا ${formatDate(book.validTo)}` : ""}
      </p>
      {book.terms ? <p className="whitespace-pre-line text-sm leading-7">{book.terms}</p> : null}
      <SimpleTable
        headers={["پهنه", "استان‌ها", "بازه کارتن", "نرخ"]}
        rows={book.lines.map((line) => [
          line.zoneName,
          line.provinces.join("، "),
          `${line.minQuantity} تا ${line.maxQuantity ?? "∞"}`,
          line.rateType === "SERVICE" ? "سرویسی" : line.unitPrice != null ? `${formatMoney(line.unitPrice)} / کارتن` : "—",
        ])}
      />
    </Card>
  );
}
