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
  placeholder = "نام را بنویسید یا از فهرست انتخاب کنید",
  required,
  options: source = IRAN_CITY_NAMES,
  emptyText = "موردی با این نام در فهرست نیست؛ می‌توانید همان را بنویسید",
}: {
  label: string;
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => {
    const query = fold(value);
    const exact = source.some((city) => fold(city) === query);
    return !query || exact ? source : source.filter((city) => fold(city).includes(query));
  }, [source, value]);

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
              <li className="px-3 py-2 text-sm text-muted">{emptyText}</li>
            )}
          </ul>
        ) : null}
      </div>
    </Field>
  );
}
