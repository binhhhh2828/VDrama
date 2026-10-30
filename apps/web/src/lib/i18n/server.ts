import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { getDictionary } from "./dictionaries";
import { createT, type T } from "./translate";

/** Ngôn ngữ và hàm dịch cho server component (từ `params.lang` của route `[lang]`). */
export function getServerT(lang: string): { locale: Locale; t: T } {
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  return { locale, t: createT(getDictionary(locale), locale) };
}
