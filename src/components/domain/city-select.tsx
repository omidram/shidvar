"use client";

import { useMemo, useState } from "react";
import { Field, Input } from "@/components/ui/input";
import { IRAN_CITY_NAMES } from "@/lib/geo/city-coords";

function fold(value: string) {
  return value.replace(/ي/g, "ی").replace(/ك/g, "ک").trim();
}

export function CitySelect({
  label,
  value,
  onChange,
  placeholder = "نام شهر را بنویسید یا از فهرست انتخاب کنید",
  required,
}: {
  label: string;
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => {
    const query = fold(value);
    const exact = IRAN_CITY_NAMES.some((city) => fold(city) === query);
    const matched = !query || exact ? IRAN_CITY_NAMES : IRAN_CITY_NAMES.filter((city) => fold(city).includes(query));
    return matched;
  }, [value]);

  return (
    <Field label={label}>
      <div className="relative">
        <Input
          value={value}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
        />
        {open ? (
          <ul className="absolute z-40 mt-1 max-h-56 w-full max-w-full overflow-auto rounded-2xl border border-border bg-card py-1 shadow-lg">
            {options.length ? (
              options.map((city) => (
                <li key={city}>
                  <button
                    type="button"
                    className="w-full break-words px-3 py-2 text-start text-sm hover:bg-primary/10"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(city);
                      setOpen(false);
                    }}
                  >
                    {city}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-sm text-muted">شهری با این نام پیدا نشد</li>
            )}
          </ul>
        ) : null}
      </div>
    </Field>
  );
}
