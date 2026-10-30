import { describe, expect, it } from "vitest";
import { copy } from "../copy";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./config";
import { getDictionary } from "./dictionaries";
import { fromAcceptLanguage, pickLocale } from "./negotiate";
import { localePath, splitLocale, switchLocale } from "./paths";
import { createT, interpolate } from "./translate";

/** Mọi chuỗi lá của cây từ điển, kèm đường dẫn (plural trải thành `.one`, `.other`). */
function leaves(node: unknown, path = ""): [string, string][] {
  if (typeof node === "string") return [[path, node]];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, path ? `${path}.${k}` : k),
  );
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("từ điển", () => {
  const base = leaves(getDictionary(DEFAULT_LOCALE));

  it.each(LOCALES)("%s có đủ khóa như bản gốc, không chuỗi rỗng", (locale) => {
    const mine = leaves(getDictionary(locale));
    expect(mine.map(([k]) => k)).toEqual(base.map(([k]) => k));
    for (const [key, value] of mine) expect(value.trim(), `${locale}:${key}`).not.toBe("");
  });

  it.each(LOCALES)("%s dùng đúng các {tham_số} của bản gốc", (locale) => {
    const mine = Object.fromEntries(leaves(getDictionary(locale)));
    for (const [key, value] of base) {
      expect(placeholders(mine[key]), `${locale}:${key}`).toEqual(placeholders(value));
    }
  });

  it("bản tiếng Việt đã dịch thật: chỉ các thuật ngữ giữ nguyên mới trùng bản tiếng Anh", () => {
    const en = Object.fromEntries(leaves(getDictionary("en")));
    const vi = Object.fromEntries(leaves(getDictionary("vi")));
    const same = Object.keys(en).filter((k) => en[k] === vi[k]);
    expect(same.sort()).toEqual(["badge.hot", "nav.menu", "nav.vip"]);
  });

  it("copy.ts cũ khớp từ điển tiếng Anh (chưa chuyển hết thì không được lệch)", () => {
    const en = getDictionary("en");
    for (const group of ["nav", "footer", "home", "watch", "promo", "badge"] as const) {
      expect(copy[group]).toEqual(en[group]);
    }
    for (const key of ["playNow", "watchNow", "allEpisodes", "episodeList", "summary"] as const) {
      expect(copy.series[key]).toBe(en.series[key]);
    }
  });
});

describe("hàm dịch", () => {
  it("thay tham số và chọn số nhiều", () => {
    const t = createT(getDictionary("en"), "en");
    expect(t("series.totalEpisodes", { n: 1 })).toBe("1 episode");
    expect(t("series.totalEpisodes", { n: 12 })).toBe("12 episodes");
    expect(t("series.episode", { n: 3 })).toBe("EP 3");
    const vi = createT(getDictionary("vi"), "vi");
    expect(vi("series.totalEpisodes", { n: 12 })).toBe("12 tập");
    expect(vi("nav.home")).toBe("Trang chủ");
  });

  it("khóa lạ trả lại chính khóa, tham số thiếu giữ nguyên", () => {
    const t = createT(getDictionary("en"), "en");
    expect(t("nav.khong.co" as never)).toBe("nav.khong.co");
    expect(interpolate("{a} và {b}", { a: 1 })).toBe("1 và {b}");
  });
});

describe("đường dẫn theo ngôn ngữ", () => {
  it("tiếng Anh ở gốc, ngôn ngữ khác có tiền tố", () => {
    expect(localePath("en", "/series/a")).toBe("/series/a");
    expect(localePath("vi", "/series/a")).toBe("/vi/series/a");
    expect(localePath("vi", "/")).toBe("/vi");
    expect(localePath("vi", "/search?q=sói#top")).toBe("/vi/search?q=sói#top");
  });

  it("không chồng tiền tố và không đụng địa chỉ ngoài", () => {
    expect(localePath("vi", "/vi/browse")).toBe("/vi/browse");
    expect(localePath("en", "/vi/browse")).toBe("/browse");
    expect(localePath("vi", "https://example.com/x")).toBe("https://example.com/x");
    expect(localePath("vi", "#main")).toBe("#main");
    expect(localePath("vi", "mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(localePath("vi", "//cdn.example.com/x")).toBe("//cdn.example.com/x");
  });

  it("admin, dev và API không có tiền tố ngôn ngữ", () => {
    expect(localePath("vi", "/admin")).toBe("/admin");
    expect(localePath("vi", "/admin/series/a?x=1")).toBe("/admin/series/a?x=1");
    expect(localePath("vi", "/dev/ui")).toBe("/dev/ui");
    expect(localePath("vi", "/api/v1/series")).toBe("/api/v1/series");
    expect(localePath("vi", "/administrator")).toBe("/vi/administrator");
  });

  it("tách tiền tố đúng đoạn, không nhầm với đường dẫn bắt đầu bằng 'vi'", () => {
    expect(splitLocale("/vi")).toEqual({ lang: "vi", path: "/" });
    expect(splitLocale("/vi/browse?x=1")).toEqual({ lang: "vi", path: "/browse?x=1" });
    expect(splitLocale("/vi?x=1")).toEqual({ lang: "vi", path: "/?x=1" });
    expect(splitLocale("/video")).toEqual({ lang: null, path: "/video" });
    expect(splitLocale("/browse")).toEqual({ lang: null, path: "/browse" });
    expect(splitLocale("/en/browse")).toEqual({ lang: "en", path: "/browse" });
  });

  it("đổi ngôn ngữ giữ nguyên trang", () => {
    expect(switchLocale("/series/a/episode/3", "vi")).toBe("/vi/series/a/episode/3");
    expect(switchLocale("/vi/series/a/episode/3", "en")).toBe("/series/a/episode/3");
    expect(switchLocale("/vi", "en")).toBe("/");
    const all: Locale[] = [...LOCALES];
    for (const to of all) expect(switchLocale(switchLocale("/browse", to), "en")).toBe("/browse");
  });
});

describe("chọn ngôn ngữ", () => {
  it("đọc Accept-Language theo thứ tự ưu tiên", () => {
    expect(fromAcceptLanguage("vi-VN,vi;q=0.9,en;q=0.8")).toBe("vi");
    expect(fromAcceptLanguage("en-US,en;q=0.9,vi;q=0.8")).toBe("en");
    expect(fromAcceptLanguage("fr;q=0.9,vi;q=0.5")).toBe("vi");
    expect(fromAcceptLanguage("vi;q=0,en;q=0.5")).toBe("en");
    expect(fromAcceptLanguage("fr-FR,de;q=0.8")).toBeNull();
    expect(fromAcceptLanguage("*")).toBeNull();
    expect(fromAcceptLanguage("")).toBeNull();
    expect(fromAcceptLanguage(null)).toBeNull();
  });

  it("cookie thắng, rồi tới trình duyệt, cuối cùng mặc định", () => {
    expect(pickLocale("en", "vi-VN")).toBe("en");
    expect(pickLocale("vi", "en-US")).toBe("vi");
    expect(pickLocale(undefined, "vi-VN")).toBe("vi");
    expect(pickLocale("xx", "fr")).toBe(DEFAULT_LOCALE);
    expect(pickLocale(null, null)).toBe(DEFAULT_LOCALE);
  });
});
