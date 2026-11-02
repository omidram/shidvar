"use client";

import { Field, Input } from "@/components/ui/input";
import { IRAN_CITY_NAMES } from "@/lib/geo/city-coords";

export function CitySelect({
  label,
  value,
  onChange,
  placeholder = "جستجو و انتخاب شهر",
  required,
}: {
  label: string;
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const listId = `iran-cities-${label.replace(/\s+/g, "-")}`;
  return (
    <Field label={label}>
      <Input list={listId} value={value} placeholder={placeholder} required={required} onChange={(e) => onChange(e.target.value)} />
      <datalist id={listId}>
        {IRAN_CITY_NAMES.map((city) => (
          <option key={city} value={city} />
        ))}
      </datalist>
    </Field>
  );
}
