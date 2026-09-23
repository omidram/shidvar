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
}: {
  value: string;
  onChange: (isoDate: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const today = toJalali(new Date());
  const current = value ? toJalali(value) : today;
  const years = Array.from({ length: 16 }, (_, i) => today.jy - 6 + i);
  const days = jalaliMonthDays(current.jy, current.jm);

  function emit(jy: number, jm: number, jd: number) {
    const max = jalaliMonthDays(jy, jm);
    onChange(jalaliToIso(jy, jm, Math.min(jd, max)));
  }

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      <NativeSelect
        required={required}
        disabled={disabled}
        value={current.jd}
        onChange={(e) => emit(current.jy, current.jm, Number(e.target.value))}
        aria-label="روز"
      >
        {Array.from({ length: days }, (_, i) => i + 1).map((day) => (
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
        {JALALI_MONTHS.map((month, index) => (
          <option key={month} value={index + 1}>
            {month}
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
