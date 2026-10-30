import type { MetadataRoute } from "next";
import { listSeries } from "@/lib/api/catalog";
import type { SeriesCard } from "@/lib/api/types";
import { LOCALES } from "@/lib/i18n/config";
import { localePath } from "@/lib/i18n/paths";

const ORIGIN = (process.env.PUBLIC_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
const MAX_PAGES = 50; // 50 × 50 = 2.500 phim; vượt mức này thì chia sitemap (generateSitemaps)

// sitemap.xml: trang tĩnh + mọi phim đã xuất bản (catalog chỉ trả phim đã xuất bản). Đọc API lúc
// request (listSeries gọi connection()), có cache catalog vài phút. Không có trang tài khoản/admin.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const series: SeriesCard[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await listSeries({ sort: "new", limit: 50, cursor });
    series.push(...page.items);
    if (!page.next_cursor) break;
    cursor = page.next_cursor;
  }

  // Mỗi trang có một mục cho từng ngôn ngữ, kèm `alternates` (hreflang) trỏ sang các bản còn lại.
  const entries = (
    path: string,
    rest: Omit<MetadataRoute.Sitemap[number], "url" | "alternates">,
  ): MetadataRoute.Sitemap => {
    const languages = Object.fromEntries(
      LOCALES.map((locale) => [locale, `${ORIGIN}${localePath(locale, path)}`]),
    );
    return LOCALES.map((locale) => ({
      url: languages[locale],
      alternates: { languages },
      ...rest,
    }));
  };

  return [
    ...entries("/", { changeFrequency: "daily", priority: 1 }),
    ...entries("/browse", { changeFrequency: "daily", priority: 0.8 }),
    ...entries("/vip", { changeFrequency: "monthly", priority: 0.6 }),
    ...["/terms", "/privacy", "/refunds", "/contact"].flatMap((path) =>
      entries(path, { changeFrequency: "yearly", priority: 0.2 }),
    ),
    ...series.flatMap((s) =>
      entries(`/series/${s.slug}`, {
        lastModified: s.published_at ?? undefined,
        changeFrequency: "weekly",
        priority: 0.7,
      }),
    ),
  ];
}
