// Cấu hình ngôn ngữ (docs/plans/gd4-i18n.md). Thêm ngôn ngữ mới: thêm mã vào LOCALES, một file
// trong dictionaries/ (phải thỏa kiểu Dictionary) và một dòng trong LOCALE_INFO.

export const LOCALES = ["en", "vi"] as const;
export type Locale = (typeof LOCALES)[number];

/** Ngôn ngữ mặc định: ở gốc đường dẫn (`/series/...`), không có tiền tố. */
export const DEFAULT_LOCALE: Locale = "en";

/** Cookie ghi ngôn ngữ người dùng đã chọn tay (1 năm). */
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LOCALE_INFO: Record<Locale, { name: string; intl: string }> = {
  // `name` luôn viết bằng chính ngôn ngữ đó để người xem tìm ra ngôn ngữ của mình.
  en: { name: "English", intl: "en-US" },
  vi: { name: "Tiếng Việt", intl: "vi-VN" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
