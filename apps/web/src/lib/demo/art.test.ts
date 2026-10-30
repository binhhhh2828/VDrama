import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SeriesDetail } from "@/lib/api/types";
import { demoHeroUrl, demoPosterDetailUrl, demoPosterUrl } from "./art";
import rawData from "./data.json";
import { demoExtras, demoExtrasSlugs } from "./extras";

const series = (rawData as unknown as { series: SeriesDetail[] }).series;

/** Đọc kích thước từ URL picsum `/seed/<seed>/<w>/<h>`. */
const size = (url: string) => {
  const m = /^https:\/\/picsum\.photos\/seed\/[a-z0-9-]+\/(\d+)\/(\d+)$/.exec(url);
  expect(m, url).not.toBeNull();
  return { w: Number(m![1]), h: Number(m![2]) };
};

const publicFile = (url: string) => join(process.cwd(), "public", url);

describe("ảnh demo", () => {
  it("phim lạ dùng ảnh giữ chỗ picsum theo seed cố định", () => {
    expect(demoPosterUrl("abc")).toBe("https://picsum.photos/seed/abc/600/800");
    expect(demoHeroUrl("abc")).toBe("https://picsum.photos/seed/abc-hero/800/1000");
    const p = size(demoPosterUrl("abc"));
    expect(p.w / p.h).toBeCloseTo(3 / 4);
  });

  it("mọi phim trong data.json dùng đúng URL của bộ dựng và file ảnh có thật", () => {
    expect(series.length).toBeGreaterThan(0);
    for (const s of series) {
      expect(s.poster_url).toBe(demoPosterUrl(s.slug));
      expect(s.poster_detail_url).toBe(demoPosterDetailUrl(s.slug));
      expect(s.banner_url).toBe(demoHeroUrl(s.slug));
      for (const url of [s.poster_url, s.poster_detail_url, s.banner_url]) {
        expect(existsSync(publicFile(url!)), url!).toBe(true);
      }
    }
  });

  it("5 poster được xoay vòng cho các phim demo", () => {
    const posters = series.map((s) => s.poster_url);
    expect(new Set(posters).size).toBe(5);
    expect(posters[5]).toBe(posters[0]);
  });
});

describe("dữ liệu phụ demo", () => {
  it("khớp đúng danh sách phim, không thừa không thiếu", () => {
    expect([...demoExtrasSlugs()].sort()).toEqual(series.map((s) => s.slug).sort());
  });

  it("có cả nhãn HOT và Original, có bài đánh giá mẫu", () => {
    const all = series.map((s) => demoExtras(s.slug));
    expect(all.some((e) => e.badge === "hot")).toBe(true);
    expect(all.some((e) => e.badge === "original")).toBe(true);
    expect(all.some((e) => e.reviews.length > 0)).toBe(true);
    for (const e of all) expect(e.likes).toBeGreaterThan(0);
  });

  it("phim lạ trả giá trị rỗng", () => {
    expect(demoExtras("khong-co")).toEqual({ badge: null, likes: 0, reviews: [] });
  });
});
