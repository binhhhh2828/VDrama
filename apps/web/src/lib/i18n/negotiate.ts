import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "./config";

/** Ngôn ngữ ưu tiên đầu tiên trong header Accept-Language mà web hỗ trợ ("vi-VN,en;q=0.8" → "vi"). */
export function fromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => /^\s*q=([\d.]+)/.exec(p)?.[1]).find(Boolean);
      return {
        lang: tag.trim().toLowerCase().split("-")[0],
        q: q === undefined ? 1 : Number(q),
        index,
      };
    })
    .filter((x) => x.lang && x.lang !== "*" && x.q > 0 && Number.isFinite(x.q))
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { lang } of ranked) {
    if ((LOCALES as readonly string[]).includes(lang)) return lang as Locale;
  }
  return null;
}

/**
 * Chọn ngôn ngữ cho người vào trang không tiền tố: lựa chọn đã lưu (cookie) thắng, rồi tới
 * Accept-Language của trình duyệt, cuối cùng là ngôn ngữ mặc định.
 */
export function pickLocale(
  cookie: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  if (isLocale(cookie)) return cookie;
  return fromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}
