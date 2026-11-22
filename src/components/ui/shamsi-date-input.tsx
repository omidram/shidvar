"use client";

import { NativeSelect } from "@/components/ui/input";
import { JALALI_MONTHS, jalaliMonthDays, jalaliToIso, toFaDigits, toJalali } from "@/lib/shamsi";
import { cn } from "@/lib/utils";

export function ShamsiDateInput({
  value,
  onChange,
  required,
  disabled,
  className,
  notBeforeToday,
}: {
  value: string;
  onChange: (isoDate: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  notBeforeToday?: boolean;
}) {
  const today = toJalali(new Date());
  const parsed = value ? toJalali(value) : today;
  const current = notBeforeToday ? clampToToday(parsed, today) : parsed;
  const years = notBeforeToday
    ? Array.from({ length: 11 }, (_, i) => today.jy + i)
    : Array.from({ length: 16 }, (_, i) => today.jy - 6 + i);
  const months = JALALI_MONTHS.map((month, index) => ({ month, value: index + 1 })).filter(
    (item) => !notBeforeToday || current.jy > today.jy || item.value >= today.jm,
  );
  const firstDay = notBeforeToday && current.jy === today.jy && current.jm === today.jm ? today.jd : 1;
  const days = jalaliMonthDays(current.jy, current.jm);

  function emit(jy: number, jm: number, jd: number) {
    const next = notBeforeToday ? clampToToday({ jy, jm, jd }, today) : { jy, jm, jd };
    const max = jalaliMonthDays(next.jy, next.jm);
    onChange(jalaliToIso(next.jy, next.jm, Math.min(Math.max(next.jd, 1), max)));
  }

  return (
    <div className={cn("grid min-w-0 grid-cols-3 gap-2", className)}>
      <NativeSelect
        required={required}
        disabled={disabled}
        value={current.jd}
        onChange={(e) => emit(current.jy, current.jm, Number(e.target.value))}
        aria-label="روز"
      >
        {Array.from({ length: days - firstDay + 1 }, (_, i) => firstDay + i).map((day) => (
          <option key={day} value={day}>
            {toFaDigits(day)}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        required={required}
        disabled={disabled}
        value={current.jm}
        onChange={(e) => emit(current.jy, Number(e.target.value), current.jd)}
        aria-label="ماه"
      >
        {months.map((item) => (
          <option key={item.month} value={item.value}>
            {item.month}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        required={required}
        disabled={disabled}
        value={current.jy}
        onChange={(e) => emit(Number(e.target.value), current.jm, current.jd)}
        aria-label="سال"
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {toFaDigits(year)}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

function clampToToday(date: { jy: number; jm: number; jd: number }, today: { jy: number; jm: number; jd: number }) {
  if (date.jy < today.jy) return today;
  if (date.jy === today.jy && date.jm < today.jm) return today;
  if (date.jy === today.jy && date.jm === today.jm && date.jd < today.jd) return { ...date, jd: today.jd };
  return date;
}
