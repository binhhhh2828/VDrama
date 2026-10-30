"use client";

import type { Genre } from "@/lib/api/types";
import { genreLabel } from "@/lib/i18n/labels";
import { useT } from "./I18nProvider";

/** Tên thể loại theo ngôn ngữ của trang (dùng trong server component). */
export function GenreName({ genre }: { genre: Genre }) {
  return <>{genreLabel(useT(), genre)}</>;
}

/** Danh sách tên thể loại nối bằng " • " (thẻ phim). */
export function GenreList({ genres, separator = " • " }: { genres: Genre[]; separator?: string }) {
  const t = useT();
  return <>{genres.map((g) => genreLabel(t, g)).join(separator)}</>;
}
