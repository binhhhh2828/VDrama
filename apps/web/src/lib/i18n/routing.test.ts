import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { decideRoute } from "./routing";

const route = (
  pathname: string,
  extra: Partial<Parameters<typeof decideRoute>[0]> = {},
  search = "",
) => decideRoute({ pathname, search, method: "GET", ...extra });

describe("định tuyến theo ngôn ngữ", () => {
  it("tiếng Anh ở gốc: rewrite nội bộ sang /en, URL không đổi", () => {
    expect(route("/")).toEqual({ type: "rewrite", to: "/en" });
    expect(route("/series/a", {}, "?x=1")).toEqual({ type: "rewrite", to: "/en/series/a?x=1" });
    expect(route("/", { acceptLanguage: "en-US,en;q=0.9" })).toEqual({
      type: "rewrite",
      to: "/en",
    });
  });

  it("/vi/... đi thẳng", () => {
    expect(route("/vi")).toEqual({ type: "next" });
    expect(route("/vi/series/a")).toEqual({ type: "next" });
  });

  it("/en/... chuyển vĩnh viễn về địa chỉ không tiền tố", () => {
    expect(route("/en")).toEqual({ type: "redirect", to: "/", status: 308 });
    expect(route("/en/browse", {}, "?genre=drama")).toEqual({
      type: "redirect",
      to: "/browse?genre=drama",
      status: 308,
    });
  });

  it("trình duyệt tiếng Việt chưa chọn gì thì chuyển sang /vi (giữ query)", () => {
    expect(route("/", { acceptLanguage: "vi-VN,vi;q=0.9" })).toEqual({
      type: "redirect",
      to: "/vi",
      status: 307,
    });
    expect(route("/search", { acceptLanguage: "vi" }, "?q=sói")).toEqual({
      type: "redirect",
      to: "/vi/search?q=sói",
      status: 307,
    });
  });

  it("cookie người dùng chọn thắng trình duyệt", () => {
    expect(route("/browse", { cookie: "en", acceptLanguage: "vi-VN" })).toEqual({
      type: "rewrite",
      to: "/en/browse",
    });
    expect(route("/browse", { cookie: "vi", acceptLanguage: "en-US" })).toEqual({
      type: "redirect",
      to: "/vi/browse",
      status: 307,
    });
  });

  it("yêu cầu không phải GET/HEAD không bị chuyển hướng", () => {
    expect(route("/x", { method: "POST", cookie: "vi" })).toEqual({
      type: "rewrite",
      to: "/en/x",
    });
  });

  it("admin, dev, API và tài nguyên tĩnh không bị đụng", () => {
    for (const p of [
      "/admin",
      "/admin/series/a",
      "/dev/ui",
      "/api/v1/series",
      "/_next/static/x.js",
      "/demo/posters/a/thumb.webp",
      "/robots.txt",
      "/sitemap.xml",
      "/icon.png",
    ]) {
      expect(route(p, { cookie: "vi", acceptLanguage: "vi" }), p).toEqual({ type: "next" });
    }
  });

  it("đường dẫn lạ vẫn được rewrite để hiện 404 đúng ngôn ngữ; /video không bị nhầm là /vi", () => {
    expect(route("/video")).toEqual({ type: "rewrite", to: "/en/video" });
    expect(route("/administrator")).toEqual({ type: "rewrite", to: "/en/administrator" });
  });
});

// Mọi liên kết và điều hướng của giao diện người xem phải qua bộ bọc có tiền tố ngôn ngữ.
describe("không dùng liên kết thô", () => {
  const src = join(__dirname, "..", "..");
  const files: string[] = [];
  (function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")) files.push(full);
    }
  })(src);
  const viewer = files.filter((f) => {
    const rel = relative(src, f).replaceAll("\\", "/");
    return !/^(components\/admin\/|components\/i18n\/|app\/\(internal\)\/)/.test(rel);
  });

  it("không import next/link ngoài khu admin", () => {
    const bad = viewer.filter((f) => readFileSync(f, "utf8").includes('from "next/link"'));
    expect(bad.map((f) => relative(src, f))).toEqual([]);
  });

  it("không import useRouter/usePathname/useSearchParams thẳng từ next/navigation", () => {
    const bad = viewer.filter((f) =>
      /import\s*\{[^}]*\b(useRouter|usePathname|useSearchParams)\b[^}]*\}\s*from\s*"next\/navigation"/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(bad.map((f) => relative(src, f))).toEqual([]);
  });
});
