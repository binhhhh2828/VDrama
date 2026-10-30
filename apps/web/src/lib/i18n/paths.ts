import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

/**
 * Đường dẫn theo ngôn ngữ: tiếng Anh ở gốc, ngôn ngữ khác có tiền tố (`/vi/series/a`).
 * Giữ nguyên địa chỉ ngoài, `#mục`, `mailto:`... và phần `?query#hash` phía sau.
 */
export function localePath(locale: Locale, href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  // Đã có tiền tố ngôn ngữ thì đổi sang ngôn ngữ đích thay vì chồng hai tiền tố.
  const { path } = splitLocale(href);
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/**
 * Tách tiền tố ngôn ngữ khỏi đường dẫn (có thể kèm `?query#hash`): `/vi/series/a?x=1` →
 * `{ lang: "vi", path: "/series/a?x=1" }`; không có tiền tố thì `lang` là null.
 */
export function splitLocale(href: string): { lang: Locale | null; path: string } {
  const match = /^\/([^/?#]+)(?=[/?#]|$)/.exec(href);
  if (!match || !isLocale(match[1])) return { lang: null, path: href };
  const rest = href.slice(match[0].length);
  if (rest === "" || rest.startsWith("?") || rest.startsWith("#"))
    return { lang: match[1], path: `/${rest}` };
  return { lang: match[1], path: rest };
}

/** Cùng trang ở ngôn ngữ khác (cho nút đổi ngôn ngữ): `/vi/series/a` + "en" → `/series/a`. */
export function switchLocale(href: string, to: Locale): string {
  return localePath(to, splitLocale(href).path);
}
