// Dữ liệu công khai (catalog), chỉ gọi trên server. Gọi API qua mạng nội bộ (API_INTERNAL_URL),
// có cache vài phút: catalog trả cùng nội dung cho mọi người nên cache an toàn.
//
// Mọi hàm export gọi `connection()` trước: dữ liệu chỉ đọc lúc có request, không đọc lúc build,
// nên `pnpm build` (CI) không cần API chạy. Trang dùng các hàm này phải đặt phần đó trong <Suspense>.

import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { ApiError, toApiError } from "./errors";
import type { Episode, Genre, Page, SeriesCard, SeriesDetail, SeriesSort } from "./types";

const API_BASE = (process.env.API_INTERNAL_URL ?? "http://localhost:8000").replace(/\/$/, "");

type Cached<T> = { ok: true; data: T } | { ok: false; status: number };

/**
 * GET có cache. 404 được cache như một kết quả (phim không có); lỗi khác (5xx, mạng) ném ra
 * nên không bị cache.
 */
async function cachedGet<T>(path: string): Promise<Cached<T>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1${path}`, { headers: { Accept: "application/json" } });
  } catch {
    throw new ApiError(0, "network_error");
  }
  if (res.status === 404) return { ok: false, status: 404 };
  if (!res.ok) throw await toApiError(res);
  return { ok: true, data: (await res.json()) as T };
}

async function get<T>(path: string): Promise<T | null> {
  await connection();
  const result = await cachedGet<T>(path);
  return result.ok ? result.data : null;
}

function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export type ListSeriesParams = {
  sort?: SeriesSort;
  genre?: string;
  withBanner?: boolean;
  limit?: number;
  cursor?: string;
};

export async function listSeries(params: ListSeriesParams = {}): Promise<Page<SeriesCard>> {
  const page = await get<Page<SeriesCard>>(
    "/series" +
      query({
        sort: params.sort,
        genre: params.genre,
        with_banner: params.withBanner || undefined,
        limit: params.limit,
        cursor: params.cursor,
      }),
  );
  return page ?? { items: [], next_cursor: null };
}

export async function listGenres(): Promise<Genre[]> {
  return (await get<Genre[]>("/genres")) ?? [];
}

/** null: phim không có, chưa xuất bản hoặc đã xóa (trang hiện 404). */
export async function getSeries(slug: string): Promise<SeriesDetail | null> {
  return get<SeriesDetail>(`/series/${encodeURIComponent(slug)}`);
}

/** Tập đã xuất bản, theo số tập tăng dần. null: phim không có. */
export async function listEpisodes(slug: string): Promise<Episode[] | null> {
  return get<Episode[]>(`/series/${encodeURIComponent(slug)}/episodes`);
}

/** Tìm phim theo tên. Từ khóa dưới 2 ký tự thì không gọi API. */
export async function searchSeries(q: string, limit = 20): Promise<SeriesCard[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const result = await get<{ items: SeriesCard[] }>(
    "/search" + query({ q: term.slice(0, 100), limit }),
  );
  return result?.items ?? [];
}
