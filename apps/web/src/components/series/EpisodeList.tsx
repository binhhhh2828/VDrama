"use client";

import Image from "next/image";
import { useSession } from "@/components/session/SessionProvider";
import { LockIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { Episode } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import { episodeTitle } from "@/lib/i18n/labels";
import { formatDuration, isFinished, progressRatio, timeLeft } from "@/lib/format";
import { resumeTarget } from "./SeriesActions";
import { useSeriesViewer } from "./SeriesViewer";
import { Link } from "@/components/i18n/navigation";

/**
 * Danh sách tập. Server render sẵn (nhãn FREE / VIP như khách thấy); trên trình duyệt thêm phần
 * riêng: ổ khóa ở tập VIP khi chưa có VIP, tiến độ từng tập, tô tập đang xem dở.
 * Ổ khóa chỉ là gợi ý; quyền xem thật do API `play` kiểm tra.
 */
export function EpisodeList({ slug, episodes }: { slug: string; episodes: Episode[] }) {
  const t = useT();
  const locale = useLocale();
  const session = useSession();
  const viewer = useSeriesViewer();
  // Khách chỉ thấy nhãn FREE / VIP (mọi tập đều cần đăng nhập); user thường thấy ổ khóa ở tập VIP.
  const lockVip = session.status === "user" && !session.user.is_vip;
  const current = viewer.progress.size ? resumeTarget(episodes, viewer.progress) : null;

  return (
    <ol className="grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:gap-3.5">
      {episodes.map((ep) => {
        const p = viewer.progress.get(ep.id);
        const watched = p ? isFinished(p.progress_sec, ep.duration_sec) : false;
        const isCurrent = current?.resume && current.episode.id === ep.id;
        const locked = ep.access === "vip" && lockVip;
        const duration = formatDuration(ep.duration_sec, locale);
        const meta = p
          ? [
              duration,
              watched ? t("format.watched") : timeLeft(p.progress_sec, ep.duration_sec, locale),
            ]
          : [duration];

        return (
          <li key={ep.id}>
            <Link
              href={`/series/${slug}/episode/${ep.number}`}
              aria-current={isCurrent ? "true" : undefined}
              className={cn(
                "flex items-center gap-4 rounded-card border p-3 text-fg no-underline transition hover:text-fg md:p-3.5",
                isCurrent
                  ? "border-accent/55 bg-accent/8"
                  : "border-line bg-surface hover:border-fg/25",
              )}
            >
              <div className="relative aspect-video w-[32%] max-w-28 min-w-20 shrink-0 overflow-hidden rounded-[10px] bg-art">
                {ep.thumbnail_url ? (
                  <Image
                    src={ep.thumbnail_url}
                    alt=""
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                ) : null}
                {p ? (
                  <ProgressBar
                    value={progressRatio(p.progress_sec, ep.duration_sec)}
                    thin
                    className="absolute inset-x-0 bottom-0 rounded-none"
                  />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[13px] font-bold text-link">
                  {t("episodes.episodeN", { n: ep.number })}
                </span>
                <span className="truncate text-[15px] font-semibold">{episodeTitle(t, ep)}</span>
                <span className="text-[13px] text-muted">{meta.filter(Boolean).join(" · ")}</span>
              </div>
              {ep.access === "free" ? (
                <span className="rounded-tag border border-success/35 bg-success/12 px-2 py-1 text-xs font-bold text-success">
                  {t("badge.free")}
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 rounded-tag bg-vip px-2 py-1 text-xs font-extrabold text-vip-ink"
                  title={locked ? t("episodes.vipOnly") : undefined}
                >
                  {locked ? <LockIcon size={12} strokeWidth={2.6} /> : null}
                  VIP
                  {locked ? <span className="sr-only"> {t("episodes.locked")}</span> : null}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
