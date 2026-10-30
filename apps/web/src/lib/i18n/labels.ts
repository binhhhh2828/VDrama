import type { Genre } from "@/lib/api/types";
import { getDictionary } from "./dictionaries";
import type { T } from "./translate";

/** Tên thể loại theo ngôn ngữ (theo `slug`); thể loại chưa có trong từ điển thì dùng tên do API trả. */
export function genreLabel(t: T, genre: Genre): string {
  const known = Object.keys(getDictionary("en").genres);
  return known.includes(genre.slug) ? t(`genres.${genre.slug}` as "genres.action") : genre.name;
}

/** Tên tập: tên mặc định "Episode N" (do hệ thống sinh) thì dịch, tên đặt riêng thì giữ nguyên. */
export function episodeTitle(t: T, ep: { number: number; title: string }): string {
  return !ep.title || ep.title === `Episode ${ep.number}`
    ? t("episodes.episodeN", { n: ep.number })
    : ep.title;
}
