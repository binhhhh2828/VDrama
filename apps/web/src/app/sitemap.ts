import type { MetadataRoute } from "next";
import { listSeries } from "@/lib/api/catalog";
import type { SeriesCard } from "@/lib/api/types";

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

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${ORIGIN}/`, changeFrequency: "daily", priority: 1 },
    { url: `${ORIGIN}/browse`, changeFrequency: "daily", priority: 0.8 },
    { url: `${ORIGIN}/vip`, changeFrequency: "monthly", priority: 0.6 },
    ...["/terms", "/privacy", "/refunds", "/contact"].map((path) => ({
      url: `${ORIGIN}${path}`,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];

  return [
    ...staticPages,
    ...series.map((s) => ({
      url: `${ORIGIN}/series/${s.slug}`,
      lastModified: s.published_at ?? undefined,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
