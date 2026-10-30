"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CloseIcon, PlayIcon, TrashIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api/client";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import { ApiError } from "@/lib/api/errors";
import { apiErrorText } from "@/lib/i18n/api-errors";
import type { HistoryItem } from "@/lib/api/types";
import { formatDate, isFinished, progressRatio, timeLeft } from "@/lib/format";
import { Link } from "@/components/i18n/navigation";

const LIMIT = 50;

/**
 * Lịch sử xem: mỗi phim một dòng (tập xem gần nhất). Xóa một tập thì phim đó có thể lùi về tập
 * xem trước đó (API quyết định), nên sau khi xóa thì tải lại danh sách.
 */
export function WatchHistory() {
  const t = useT();
  const locale = useLocale();
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
      setError(err instanceof ApiError ? apiErrorText(err, t) : t("history.loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    let active = true;
    api.history(LIMIT).then(
      (res) => active && setItems(res.items),
      (err) => {
        if (!active) return;
        setItems([]);
        setError(err instanceof ApiError ? apiErrorText(err, t) : t("history.loadFailed"));
      },
    );
    return () => {
      active = false;
    };
  }, [t]);

  async function removeOne(item: HistoryItem) {
    setError(null);
    setItems((prev) => (prev ?? []).filter((h) => h.series.id !== item.series.id));
    try {
      await api.removeHistory(item.episode.id);
    } catch (err) {
      setError(err instanceof ApiError ? apiErrorText(err, t) : t("history.removeFailed"));
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
      setError(err instanceof ApiError ? apiErrorText(err, t) : t("history.clearFailed"));
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
        <p className="text-lg font-bold">{t("history.emptyTitle")}</p>
        <p className="max-w-md text-muted">{t("history.emptyText")}</p>
        {error ? <p className="text-sm text-error-soft">{error}</p> : null}
        <ButtonLink href="/browse" size="sm" className="mt-2">
          {t("history.find")}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t("history.count", { n: items.length })}</p>
        {confirmClear ? (
          <div
            role="group"
            aria-label={t("history.confirmGroup")}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-sm font-semibold">{t("history.clearAsk")}</span>
            <Button variant="danger" size="sm" onClick={clearAll} disabled={busy}>
              {busy ? t("history.clearing") : t("history.yesClear")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmClear(false)}
              disabled={busy}
            >
              {t("account.cancel")}
            </Button>
          </div>
        ) : (
          <Button variant="danger" size="sm" onClick={() => setConfirmClear(true)}>
            <TrashIcon size={16} /> {t("history.clearAll")}
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
                aria-label={t("history.continueAria", {
                  title: h.series.title,
                  n: h.episode.number,
                })}
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
                  {t("episodes.episodeN", { n: h.episode.number })} ·{" "}
                  {timeLeft(h.progress_sec, h.episode.duration_sec, locale)}
                </span>
                <span className="text-xs text-muted">
                  {t("history.watched", { date: formatDate(h.updated_at, locale) })}
                </span>
              </div>
              {/* Ẩn/hiện ở thẻ bọc: `hidden` đặt thẳng lên nút bị `inline-flex` của nút đè. */}
              <span className="hidden sm:contents">
                <ButtonLink href={watchHref} size="sm">
                  <PlayIcon /> {done ? t("history.watchAgain") : t("history.continue")}
                </ButtonLink>
              </span>
              <button
                type="button"
                onClick={() => removeOne(h)}
                aria-label={t("history.removeAria", { title: h.series.title, n: h.episode.number })}
                title={t("history.removeTitle")}
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
