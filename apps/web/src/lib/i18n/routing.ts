import { DEFAULT_LOCALE, type Locale } from "./config";
import { pickLocale } from "./negotiate";
import { localePath, splitLocale, UNLOCALIZED } from "./paths";

export type RouteDecision =
  | { type: "next" }
  | { type: "rewrite"; to: string }
  | { type: "redirect"; to: string; status: 307 | 308 };

/**
 * Quy tắc định tuyến theo ngôn ngữ (docs/plans/gd4-i18n.md), tách khỏi `proxy.ts` để test được:
 * - `/vi/...` đi thẳng;
 * - `/en/...` chuyển vĩnh viễn về địa chỉ không tiền tố (mỗi trang chỉ có một địa chỉ);
 * - địa chỉ không tiền tố: ngôn ngữ mặc định thì rewrite nội bộ sang `/en/...` (URL không đổi),
 *   ngôn ngữ khác (theo cookie hoặc trình duyệt) thì chuyển hướng tạm sang `/<lang>/...`;
 * - admin, dev, API, tài nguyên tĩnh không chia ngôn ngữ.
 */
export function decideRoute(input: {
  pathname: string;
  search: string;
  method: string;
  cookie?: string | null;
  acceptLanguage?: string | null;
}): RouteDecision {
  const { pathname, search } = input;
  if (
    UNLOCALIZED.test(pathname) ||
    pathname.startsWith("/_next") ||
    /\.[a-z0-9]+$/i.test(pathname)
  ) {
    return { type: "next" };
  }
  const { lang, path } = splitLocale(pathname);
  if (lang === DEFAULT_LOCALE) {
    return { type: "redirect", to: `${path}${search}`, status: 308 };
  }
  if (lang) return { type: "next" };

  const wanted: Locale = pickLocale(input.cookie, input.acceptLanguage);
  const readOnly = input.method === "GET" || input.method === "HEAD";
  if (wanted !== DEFAULT_LOCALE && readOnly) {
    return { type: "redirect", to: `${localePath(wanted, pathname)}${search}`, status: 307 };
  }
  return { type: "rewrite", to: `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}${search}` };
}
