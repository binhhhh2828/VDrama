"use client";

import { useState } from "react";
import { useSession } from "@/components/session/SessionProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CheckIcon, PlayIcon, PlusIcon } from "@/components/ui/icons";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { Episode } from "@/lib/api/types";
import { isFinished } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useT } from "@/components/i18n/I18nProvider";
import { apiErrorText } from "@/lib/i18n/api-errors";
import { useSeriesViewer } from "./SeriesViewer";
import { usePathname, useRouter } from "@/components/i18n/navigation";

/** Tập nên phát tiếp: tập xem gần nhất (xem xong thì tập sau nó), không có thì tập đầu. */
export function resumeTarget(
  episodes: Episode[],
  progress: Map<number, { progress_sec: number; updated_at: string }>,
): { episode: Episode; resume: boolean } | null {
  if (episodes.length === 0) return null;
  let latest: { ep: Episode; at: string; sec: number } | null = null;
  for (const ep of episodes) {
    const p = progress.get(ep.id);
    if (p && (!latest || p.updated_at > latest.at))
      latest = { ep, at: p.updated_at, sec: p.progress_sec };
  }
  if (!latest) return { episode: episodes[0], resume: false };
  if (isFinished(latest.sec, latest.ep.duration_sec)) {
    const next = episodes.find((e) => e.number > latest.ep.number);
    return next ? { episode: next, resume: true } : { episode: latest.ep, resume: true };
  }
  return { episode: latest.ep, resume: true };
}

/** Nút "Watch now" (ảnh 15): phát tiếp tập đang xem dở, chưa xem thì phát tập đầu. */
export function WatchNowButton({ slug, episodes }: { slug: string; episodes: Episode[] }) {
  const t = useT();
  const viewer = useSeriesViewer();
  const target = resumeTarget(episodes, viewer.progress);
  const shape = "h-[46px] w-[182px] max-w-full rounded-[14px]! text-base";

  if (!target) {
    return (
      <Button variant="cta" disabled className={shape}>
        {t("seriesPage.comingSoonButton")}
      </Button>
    );
  }
  return (
    <ButtonLink
      href={`/series/${slug}/episode/${target.episode.number}`}
      variant="cta"
      className={shape}
    >
      <PlayIcon size={18} />
      {target.resume
        ? t("seriesPage.continueEp", { n: target.episode.number })
        : t("series.watchNow")}
    </ButtonLink>
  );
}

/** Bật/tắt My List của một phim. Khách bấm thì chuyển sang đăng nhập rồi quay lại trang này. */
export function useMyList(seriesId: number) {
  const t = useT();
  const session = useSession();
  const viewer = useSeriesViewer();
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = viewer.favorited;

  async function toggle() {
    if (session.status !== "user") {
      router.push(`/signin?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setBusy(true);
    setError(null);
    viewer.setFavorited(!on); // cập nhật ngay, lỗi thì trả lại
    try {
      if (on) await api.removeFavorite(seriesId);
      else await api.addFavorite(seriesId);
    } catch (err) {
      viewer.setFavorited(on);
      setError(err instanceof ApiError ? apiErrorText(err, t) : t("seriesPage.listFailed"));
    } finally {
      setBusy(false);
    }
  }

  return {
    on,
    busy,
    error,
    toggle,
    disabled: busy || (session.status === "user" && !viewer.ready),
  };
}

export function MyListButton({ seriesId }: { seriesId: number }) {
  const t = useT();
  const { on, error, toggle, disabled } = useMyList(seriesId);

  return (
    <>
      <button
        type="button"
        aria-pressed={on}
        disabled={disabled}
        onClick={toggle}
        className={cn(
          "inline-flex min-h-12 items-center gap-2.5 rounded-full border px-[22px] text-base font-semibold transition disabled:opacity-70",
          on
            ? "border-accent/55 bg-accent/12 text-fg"
            : "border-fg/22 bg-fg/8 text-fg hover:bg-fg/14",
        )}
      >
        {on ? <CheckIcon size={18} className="text-accent" /> : <PlusIcon size={18} />}
        {on ? t("seriesPage.inList") : t("nav.myList")}
      </button>
      {error ? (
        <p role="alert" className="w-full text-sm text-error-soft">
          {error}
        </p>
      ) : null}
    </>
  );
}

export function ShareButton({ title }: { title: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${title} · VDrama`, url });
      } catch {
        // người dùng đóng hộp chia sẻ
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // trình duyệt chặn clipboard: bỏ qua
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? t("seriesPage.linkCopied") : t("seriesPage.share")}
      className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full border border-line bg-fg/6 px-3.5 text-fg hover:bg-fg/12"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
      </svg>
      {copied ? <span className="text-sm font-semibold">{t("seriesPage.copied")}</span> : null}
    </button>
  );
}
