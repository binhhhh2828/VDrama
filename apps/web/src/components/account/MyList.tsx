"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CloseIcon } from "@/components/ui/icons";
import { PosterCard } from "@/components/ui/PosterCard";
import { PosterGridSkeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { SeriesCard } from "@/lib/api/types";
import { seriesMeta } from "@/lib/format";

const PAGE = 18;

/** My List (yêu thích): mới thêm trước, Load more theo con trỏ, bỏ khỏi danh sách cập nhật ngay. */
export function MyList() {
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
        setError(err instanceof ApiError ? err.userMessage : "Couldn't load My List.");
      },
    );
    return () => {
      active = false;
    };
  }, []);

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
      setError(err instanceof ApiError ? err.userMessage : "Couldn't load more.");
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
      setError(err instanceof ApiError ? err.userMessage : "Couldn't remove that series.");
    }
  }

  if (items === null) return <PosterGridSkeleton count={6} />;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-panel border border-line bg-surface px-6 py-16 text-center">
        <p className="text-lg font-bold">Your list is empty</p>
        <p className="max-w-md text-muted">
          Tap <strong className="text-fg">My List</strong> on any series to save it here for later.
        </p>
        {error ? <p className="text-sm text-error-soft">{error}</p> : null}
        <ButtonLink href="/browse" size="sm" className="mt-2">
          Browse series
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
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-5">
        {items.map((s) => (
          <li key={s.id} className="relative">
            <PosterCard
              href={`/series/${s.slug}`}
              title={s.title}
              posterUrl={s.poster_url}
              meta={seriesMeta(s)}
            />
            <button
              type="button"
              onClick={() => remove(s)}
              aria-label={`Remove ${s.title} from My List`}
              title="Remove from My List"
              className="absolute top-1.5 right-1.5 flex size-9 items-center justify-center rounded-full border border-fg/25 bg-canvas/75 text-fg backdrop-blur hover:bg-canvas"
            >
              <CloseIcon size={16} />
            </button>
          </li>
        ))}
      </ul>
      {cursor ? (
        <Button variant="secondary" onClick={loadMore} disabled={loading} className="self-center">
          {loading ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
