"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { createT, type T } from "@/lib/i18n/translate";

type Value = { locale: Locale; t: T };
const Ctx = createContext<Value | null>(null);

/** Cấp ngôn ngữ và hàm dịch cho cây client (từ điển được server truyền xuống một lần ở layout). */
export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, t: createT(dictionary, locale) }), [locale, dictionary]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useI18n(): Value {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Cần <I18nProvider> ở layout gốc.");
  return ctx;
}

export const useLocale = (): Locale => useI18n().locale;
export const useT = (): T => useI18n().t;
