"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api/client";
import { useT } from "@/components/i18n/I18nProvider";
import { ApiError } from "@/lib/api/errors";
import { apiErrorText } from "@/lib/i18n/api-errors";
import type { Page, SeriesCard } from "@/lib/api/types";
import { PosterGrid } from "./PosterGrid";

/**
 * Danh sách phim có nút "Load more" theo con trỏ. Trang đầu do server render (có trong HTML);
 * các trang sau lấy trên trình duyệt, giữ nguyên bộ lọc. Đổi bộ lọc = URL mới = component mới
 * (trang gọi với `key` theo bộ lọc), nên luôn bắt đầu lại từ trang đầu.
 */
export function SeriesList({
  initial,
  params,
  pageSize,
}: {
  initial: Page<SeriesCard>;
  params: { sort?: string; genre?: string };
  pageSize: number;
}) {
  const t = useT();
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.next_cursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const page = await api.listSeries({ ...params, limit: pageSize, cursor });
      // Phòng trùng nếu bấm hai lần nhanh: bỏ phim đã có.
      setItems((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        return [...prev, ...page.items.filter((s) => !seen.has(s.id))];
      });
      setCursor(page.next_cursor);
    } catch (err) {
      setError(err instanceof ApiError ? apiErrorText(err, t) : t("browse.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PosterGrid series={items} preloadFirst={6} />
      {cursor || error ? (
        <div className="flex flex-col items-center gap-3">
          {error ? (
            <p role="alert" className="text-sm text-error-soft">
              {error}
            </p>
          ) : null}
          {cursor ? (
            <Button variant="secondary" onClick={loadMore} disabled={loading} aria-busy={loading}>
              {loading ? t("browse.loading") : t("browse.loadMore")}
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-center text-sm text-muted">{t("browse.end")}</p>
      )}
    </div>
  );
}
