import { LOCALE_INFO, type Locale } from "./config";
import type { Dictionary, Plural } from "./dictionaries";

type Leaf = string | Plural;

/** Mọi khóa lá của từ điển dạng "nav.home" (cho `t()` kiểm tra khóa lúc biên dịch). */
export type TKey = Paths<Dictionary>;
type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends Leaf ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TParams = Record<string, string | number>;
export type T = (key: TKey, params?: TParams) => string;

const isPlural = (v: unknown): v is Plural =>
  typeof v === "object" && v !== null && "one" in v && "other" in v;

/** Thay `{tên}` bằng giá trị; tham số thiếu thì giữ nguyên `{tên}` để dễ thấy lỗi. */
export function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/** Hàm dịch gắn với một từ điển: `t("series.totalEpisodes", { n: 12 })` → "12 episodes". */
export function createT(dict: Dictionary, locale: Locale): T {
  const rules = new Intl.PluralRules(LOCALE_INFO[locale].intl);
  return (key, params) => {
    let node: unknown = dict;
    for (const part of key.split(".")) {
      node = (node as Record<string, unknown> | undefined)?.[part];
    }
    if (isPlural(node)) {
      const n = Number(params?.n);
      return interpolate(rules.select(n) === "one" ? node.one : node.other, params);
    }
    return typeof node === "string" ? interpolate(node, params) : key;
  };
}
