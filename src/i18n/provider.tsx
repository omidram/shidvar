"use client";

import { createContext, useContext } from "react";
import { fa, type Locale, type Messages } from "@/i18n/messages";

const I18nContext = createContext<{ locale: Locale; t: Messages; setLocale: (locale: Locale) => void }>({
  locale: "fa",
  t: fa,
  setLocale: () => undefined,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale: "fa", t: fa, setLocale: () => undefined }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
