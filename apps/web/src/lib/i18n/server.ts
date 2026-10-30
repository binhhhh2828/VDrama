import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { getDictionary } from "./dictionaries";
import type { Metadata } from "next";
import { createT, type T, type TKey } from "./translate";

/** Ngôn ngữ và hàm dịch cho server component (từ `params.lang` của route `[lang]`). */
export function getServerT(lang: string): { locale: Locale; t: T } {
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  return { locale, t: createT(getDictionary(locale), locale) };
}

/**
 * `generateMetadata` chỉ đặt tiêu đề tab theo ngôn ngữ của trang:
 * `export const generateMetadata = titleMetadata("nav.myList");`
 */
export function titleMetadata(key: TKey, extra: Metadata = {}) {
  return async ({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> => ({
    ...extra,
    title: getServerT((await params).lang).t(key),
  });
}
