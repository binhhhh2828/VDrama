"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CloseIcon } from "@/components/ui/icons";
import { PosterCard } from "@/components/ui/PosterCard";
import { PosterGridSkeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api/client";
import { useT } from "@/components/i18n/I18nProvider";
import { ApiError } from "@/lib/api/errors";
import { apiErrorText } from "@/lib/i18n/api-errors";
import type { SeriesCard } from "@/lib/api/types";

const PAGE = 18;

/** My List (yêu thích): mới thêm trước, Load more theo con trỏ, bỏ khỏi danh sách cập nhật ngay. */
export function MyList() {
  const t = useT();
  const [items, setItems] = useState<SeriesCard[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.favorites(null, PAGE).then(
      (page) => {
        if (!active) return;
        setItems(page.items);
        setCursor(page.next_cursor);
      },
      (err) => {
        if (!active) return;
        setItems([]);
        setError(err instanceof ApiError ? apiErrorText(err, t) : t("myList.loadFailed"));
      },
    );
    return () => {
      active = false;
    };
  }, [t]);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    try {
      const page = await api.favorites(cursor, PAGE);
      setItems((prev) => {
        const seen = new Set((prev ?? []).map((s) => s.id));
        return [...(prev ?? []), ...page.items.filter((s) => !seen.has(s.id))];
      });
      setCursor(page.next_cursor);
    } catch (err) {
      setError(err instanceof ApiError ? apiErrorText(err, t) : t("myList.moreFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function remove(series: SeriesCard) {
    const before = items;
    setItems((prev) => (prev ?? []).filter((s) => s.id !== series.id));
    try {
      await api.removeFavorite(series.id);
    } catch (err) {
      setItems(before);
      setError(err instanceof ApiError ? apiErrorText(err, t) : t("myList.removeFailed"));
    }
  }

  if (items === null) return <PosterGridSkeleton count={6} />;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-panel border border-line bg-surface px-6 py-16 text-center">
        <p className="text-lg font-bold">{t("myList.emptyTitle")}</p>
        <p className="max-w-md text-muted">{t("myList.emptyText")}</p>
        {error ? <p className="text-sm text-error-soft">{error}</p> : null}
        <ButtonLink href="/browse" size="sm" className="mt-2">
          {t("notFound.browse")}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <p role="alert" className="text-sm text-error-soft">
          {error}
        </p>
      ) : null}
      <ul className="grid grid-cols-3 gap-x-2.5 gap-y-5 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-x-5 sm:gap-y-6">
        {items.map((s) => (
          <li key={s.id} className="relative">
            <PosterCard
              href={`/series/${s.slug}`}
              title={s.title}
              posterUrl={s.poster_url}
              genres={s.genres}
              variant="grid"
            />
            <button
              type="button"
              onClick={() => remove(s)}
              aria-label={t("myList.removeAria", { title: s.title })}
              title={t("myList.removeTitle")}
              className="absolute top-1.5 right-1.5 flex size-9 items-center justify-center rounded-full border border-fg/25 bg-canvas/75 text-fg backdrop-blur hover:bg-canvas"
            >
              <CloseIcon size={16} />
            </button>
          </li>
        ))}
      </ul>
      {cursor ? (
        <Button variant="secondary" onClick={loadMore} disabled={loading} className="self-center">
          {loading ? t("browse.loading") : t("browse.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
