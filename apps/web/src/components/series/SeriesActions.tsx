"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/session/SessionProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CheckIcon, PlayIcon, PlusIcon } from "@/components/ui/icons";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { Episode } from "@/lib/api/types";
import { isFinished } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useSeriesViewer } from "./SeriesViewer";

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

export function SeriesActions({
  slug,
  seriesId,
  title,
  episodes,
}: {
  slug: string;
  seriesId: number;
  title: string;
  episodes: Episode[];
}) {
  const viewer = useSeriesViewer();
  const target = resumeTarget(episodes, viewer.progress);

  return (
    <div className="flex flex-wrap gap-3">
      {target ? (
        <ButtonLink href={`/series/${slug}/episode/${target.episode.number}`}>
          <PlayIcon />
          {target.resume
            ? `Continue Episode ${target.episode.number}`
            : `Play Episode ${target.episode.number}`}
        </ButtonLink>
      ) : (
        <Button disabled>Episodes coming soon</Button>
      )}
      <MyListButton seriesId={seriesId} />
      <ShareButton title={title} />
    </div>
  );
}

function MyListButton({ seriesId }: { seriesId: number }) {
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
      setError(err instanceof ApiError ? err.userMessage : "Couldn't update My List.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-pressed={on}
        disabled={busy || (session.status === "user" && !viewer.ready)}
        onClick={toggle}
        className={cn(
          "inline-flex min-h-12 items-center gap-2.5 rounded-full border px-[22px] text-base font-semibold transition disabled:opacity-70",
          on ? "border-pink/55 bg-pink/12 text-fg" : "border-fg/22 bg-fg/8 text-fg hover:bg-fg/14",
        )}
      >
        {on ? <CheckIcon size={18} className="text-pink" /> : <PlusIcon size={18} />}
        {on ? "In My List" : "My List"}
      </button>
      {error ? (
        <p role="alert" className="w-full text-sm text-error-soft">
          {error}
        </p>
      ) : null}
    </>
  );
}

function ShareButton({ title }: { title: string }) {
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
      aria-label={copied ? "Link copied" : "Share"}
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
      {copied ? <span className="text-sm font-semibold">Copied</span> : null}
    </button>
  );
}
