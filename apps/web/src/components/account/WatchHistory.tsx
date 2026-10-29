"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CloseIcon, PlayIcon, TrashIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { HistoryItem } from "@/lib/api/types";
import { formatDate, isFinished, progressRatio, timeLeft } from "@/lib/format";

const LIMIT = 50;

/**
 * Lịch sử xem: mỗi phim một dòng (tập xem gần nhất). Xóa một tập thì phim đó có thể lùi về tập
 * xem trước đó (API quyết định), nên sau khi xóa thì tải lại danh sách.
 */
export function WatchHistory() {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await api.history(LIMIT);
      setItems(res.items);
    } catch (err) {
      setItems((prev) => prev ?? []);
      setError(err instanceof ApiError ? err.userMessage : "Couldn't load your history.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.history(LIMIT).then(
      (res) => active && setItems(res.items),
      (err) => {
        if (!active) return;
        setItems([]);
        setError(err instanceof ApiError ? err.userMessage : "Couldn't load your history.");
      },
    );
    return () => {
      active = false;
    };
  }, []);

  async function removeOne(item: HistoryItem) {
    setError(null);
    setItems((prev) => (prev ?? []).filter((h) => h.series.id !== item.series.id));
    try {
      await api.removeHistory(item.episode.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : "Couldn't remove that.");
    }
    await reload();
  }

  async function clearAll() {
    setBusy(true);
    setError(null);
    try {
      await api.clearHistory();
      setItems([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : "Couldn't clear your history.");
    } finally {
      setBusy(false);
      setConfirmClear(false);
    }
  }

  if (items === null) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[104px]" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-panel border border-line bg-surface px-6 py-16 text-center">
        <p className="text-lg font-bold">Nothing here yet</p>
        <p className="max-w-md text-muted">
          Episodes you watch will show up here so you can pick up where you left off.
        </p>
        {error ? <p className="text-sm text-error-soft">{error}</p> : null}
        <ButtonLink href="/browse" size="sm" className="mt-2">
          Find something to watch
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {items.length} {items.length === 1 ? "series" : "series"} · most recent first
        </p>
        {confirmClear ? (
          <div
            role="group"
            aria-label="Confirm clearing history"
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-sm font-semibold">Clear all watch history?</span>
            <Button variant="danger" size="sm" onClick={clearAll} disabled={busy}>
              {busy ? "Clearing…" : "Yes, clear"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmClear(false)}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="danger" size="sm" onClick={() => setConfirmClear(true)}>
            <TrashIcon size={16} /> Clear all
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-error-soft">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {items.map((h) => {
          const watchHref = `/series/${h.series.slug}/episode/${h.episode.number}`;
          const done = isFinished(h.progress_sec, h.episode.duration_sec);
          return (
            <li
              key={h.series.id}
              className="flex items-center gap-3 rounded-card border border-line bg-surface p-3 sm:gap-4"
            >
              <Link
                href={watchHref}
                aria-label={`Continue ${h.series.title}, episode ${h.episode.number}`}
                className="relative aspect-video w-[34%] max-w-40 min-w-24 shrink-0 overflow-hidden rounded-[10px] bg-art sm:w-40"
              >
                {h.episode.thumbnail_url ? (
                  <Image
                    src={h.episode.thumbnail_url}
                    alt=""
                    fill
                    sizes="160px"
                    className="object-cover"
                  />
                ) : null}
                <ProgressBar
                  value={progressRatio(h.progress_sec, h.episode.duration_sec)}
                  thin
                  className="absolute inset-x-0 bottom-0 rounded-none"
                />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link
                  href={`/series/${h.series.slug}`}
                  className="truncate font-bold text-fg no-underline hover:text-fg"
                >
                  {h.series.title}
                </Link>
                <span className="text-sm text-fg-soft">
                  Episode {h.episode.number} · {timeLeft(h.progress_sec, h.episode.duration_sec)}
                </span>
                <span className="text-xs text-muted">Watched {formatDate(h.updated_at)}</span>
              </div>
              {/* Ẩn/hiện ở thẻ bọc: `hidden` đặt thẳng lên nút bị `inline-flex` của nút đè. */}
              <span className="hidden sm:contents">
                <ButtonLink href={watchHref} size="sm">
                  <PlayIcon /> {done ? "Watch again" : "Continue"}
                </ButtonLink>
              </span>
              <button
                type="button"
                onClick={() => removeOne(h)}
                aria-label={`Remove ${h.series.title} episode ${h.episode.number} from history`}
                title="Remove from history"
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-fg/8 hover:text-fg"
              >
                <CloseIcon size={18} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
