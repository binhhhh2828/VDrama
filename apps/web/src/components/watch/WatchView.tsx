"use client";

import { IS_DEMO } from "@/lib/demo/config";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/session/SessionProvider";
import { MyListButton, ShareButton } from "@/components/series/SeriesActions";
import { useSeriesViewer } from "@/components/series/SeriesViewer";
import { ButtonLink } from "@/components/ui/Button";
import { CheckIcon, LockIcon, PlayIcon } from "@/components/ui/icons";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { Episode } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDuration, isFinished } from "@/lib/format";
import { Player } from "./Player";
import type { PlayerSource } from "./Player";

// Luồng HLS mẫu công khai, CHỈ dùng khi chạy dev mà API báo chưa cấu hình Cloudflare Stream (503).
// Bản build production luôn bỏ qua (NODE_ENV được thay cố định lúc build).
const DEV_SAMPLE_HLS =
  process.env.NODE_ENV === "development" ? process.env.NEXT_PUBLIC_DEV_SAMPLE_HLS || null : null;

type Gate =
  | { kind: "loading" }
  | { kind: "ready"; source: PlayerSource }
  | { kind: "signin" }
  | { kind: "vip" }
  | { kind: "processing" }
  | { kind: "unavailable" }
  | { kind: "error"; message: string };

async function fetchSource(episodeId: number): Promise<PlayerSource> {
  const info = await api.play(episodeId);
  return { url: info.hls_url, expiresAt: Date.parse(info.expires_at) || null, sample: IS_DEMO };
}

function gateFor(err: unknown): Gate {
  if (!(err instanceof ApiError)) return { kind: "error", message: "Something went wrong." };
  switch (err.code) {
    case "not_authenticated":
    case "session_expired":
      return { kind: "signin" };
    case "vip_required":
      return { kind: "vip" };
    case "video_not_ready":
      return { kind: "processing" };
    case "stream_unavailable":
      return DEV_SAMPLE_HLS
        ? { kind: "ready", source: { url: DEV_SAMPLE_HLS, expiresAt: null, sample: true } }
        : { kind: "unavailable" };
    default:
      return { kind: "error", message: err.userMessage };
  }
}

export function WatchView({
  series,
  episodes,
  episode,
}: {
  series: { id: number; slug: string; title: string };
  episodes: Episode[];
  episode: Episode;
}) {
  const session = useSession();
  const viewer = useSeriesViewer();
  const router = useRouter();
  const userId = session.status === "user" ? session.user.id : null;
  const isVip = session.status === "user" && session.user.is_vip;

  const [result, setResult] = useState<{ key: string; gate: Gate } | null>(null);
  const key = `${userId}:${episode.id}`;

  // Khách không gọi `play` (chắc chắn 401): hiện mời đăng nhập ngay.
  useEffect(() => {
    if (userId === null) return;
    let active = true;
    fetchSource(episode.id).then(
      (source) => active && setResult({ key, gate: { kind: "ready", source } }),
      (err) => active && setResult({ key, gate: gateFor(err) }),
    );
    return () => {
      active = false;
    };
  }, [userId, episode.id, key]);

  const gate: Gate =
    session.status === "loading"
      ? { kind: "loading" }
      : session.status === "guest"
        ? { kind: "signin" }
        : result?.key === key
          ? result.gate
          : { kind: "loading" };

  const next = episodes.find((e) => e.number > episode.number) ?? null;
  const nextLocked = next ? next.access === "vip" && !isVip : false;
  const nextHref = next && !nextLocked ? `/series/${series.slug}/episode/${next.number}` : null;

  // Tiến độ cũ của tập này (đã xem xong thì phát lại từ đầu).
  const saved = viewer.progress.get(episode.id);
  const startAt =
    saved && !isFinished(saved.progress_sec, episode.duration_sec) ? saved.progress_sec : 0;

  const lastSaved = useRef(-1);
  const onProgress = useCallback(
    (sec: number, final: boolean) => {
      if (userId === null || !Number.isFinite(sec) || sec <= 0) return;
      const rounded = Math.floor(sec);
      if (rounded === lastSaved.current) return;
      lastSaved.current = rounded;
      void api.saveProgress(episode.id, rounded, { keepalive: final }).catch(() => {
        lastSaved.current = -1; // lần sau thử lại
      });
    },
    [userId, episode.id],
  );

  const refreshSource = useCallback(async () => {
    try {
      return await fetchSource(episode.id);
    } catch (err) {
      const g = gateFor(err);
      return g.kind === "ready" ? g.source : null;
    }
  }, [episode.id]);

  const [autoNext, setAutoNext] = useState<number | null>(null);
  useEffect(() => {
    if (autoNext === null || !nextHref) return;
    if (autoNext <= 0) {
      router.push(nextHref);
      return;
    }
    const t = window.setTimeout(() => setAutoNext((n) => (n === null ? null : n - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [autoNext, nextHref, router]);

  const label = `EP ${episode.number}${episode.title && episode.title !== `Episode ${episode.number}` ? ` · ${episode.title}` : ""}`;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-7">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {/* Chờ có tiến độ cũ rồi mới gắn player, để tua đúng chỗ đang xem dở. */}
        {gate.kind === "ready" && viewer.ready ? (
          <Player
            key={episode.id}
            source={gate.source}
            startAt={startAt}
            label={label}
            nextHref={nextHref}
            onProgress={onProgress}
            onEnded={() => nextHref && setAutoNext(5)}
            refreshSource={refreshSource}
            endOverlay={
              nextHref && next ? (
                <EndCard
                  next={next}
                  seconds={autoNext}
                  href={nextHref}
                  onCancel={() => setAutoNext(null)}
                />
              ) : undefined
            }
          />
        ) : (
          <GateScreen
            gate={gate.kind === "ready" ? { kind: "loading" } : gate}
            episode={episode}
            thumbnail={episode.thumbnail_url}
          />
        )}

        <div className="flex flex-col gap-4 px-4 sm:flex-row sm:items-start sm:justify-between sm:px-0">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="text-[22px] font-extrabold sm:text-[28px]">
              Episode {episode.number}
              {episode.title !== `Episode ${episode.number}` ? ` · ${episode.title}` : ""}
            </h1>
            <p className="text-[15px] text-muted">
              <Link
                href={`/series/${series.slug}`}
                className="font-extrabold tracking-[-0.02em] text-fg no-underline hover:text-fg"
              >
                {series.title}
              </Link>
              {episode.duration_sec ? ` · ${formatDuration(episode.duration_sec)}` : ""}
              {` · ${episode.access === "free" ? "Free" : "VIP"}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <MyListButton seriesId={series.id} />
            <ShareButton title={`${series.title} · Episode ${episode.number}`} />
          </div>
        </div>

        {next ? (
          <UpNext next={next} slug={series.slug} locked={nextLocked} />
        ) : (
          <p className="mx-4 rounded-card border border-line bg-surface p-4 text-sm text-muted sm:mx-0">
            You&apos;re on the latest episode. New episodes land weekly.
          </p>
        )}
      </div>

      <EpisodeSidebar
        slug={series.slug}
        episodes={episodes}
        currentId={episode.id}
        isVip={isVip}
        signedIn={userId !== null}
      />
    </div>
  );
}

/** Màn hình thay cho player khi chưa xem được (khách, cần VIP, video đang xử lý...). */
function GateScreen({
  gate,
  episode,
  thumbnail,
}: {
  gate: Gate;
  episode: Episode;
  thumbnail: string | null;
}) {
  const pathname = usePathname();
  const next = encodeURIComponent(pathname);

  const content = (() => {
    switch (gate.kind) {
      case "loading":
        return (
          <span
            aria-label="Loading video"
            role="status"
            className="size-14 animate-spin rounded-full border-4 border-fg/20 border-t-accent"
          />
        );
      case "signin":
        return (
          <GateBox
            title="Sign in to watch"
            text={
              episode.access === "free"
                ? "This episode is free. Create a free account or sign in to start watching."
                : "Sign in first. This episode is for VIP members."
            }
          >
            <ButtonLink href={`/signin?next=${next}`}>Sign in</ButtonLink>
            <ButtonLink href={`/signup?next=${next}`} variant="secondary">
              Create account
            </ButtonLink>
          </GateBox>
        );
      case "vip":
        return (
          <GateBox
            eyebrow="VIP EPISODE"
            title="Unlock this episode with VIP"
            text="VIP gives you every episode, ad-free, in Full HD."
          >
            <ButtonLink href="/vip" variant="vip">
              <LockIcon size={18} /> See VIP plans
            </ButtonLink>
          </GateBox>
        );
      case "processing":
        return (
          <GateBox
            title="This video is still processing"
            text="It usually takes a few minutes after upload. Please check back soon."
          />
        );
      case "unavailable":
        return (
          <GateBox
            title="Video playback isn't set up yet"
            text="The video service isn't connected on this server, so episodes can't play right now."
          />
        );
      case "error":
        return <GateBox title="We couldn't load this video" text={gate.message} />;
      default:
        return null;
    }
  })();

  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-art sm:rounded-[18px] sm:border sm:border-line">
      {thumbnail ? (
        <Image
          src={thumbnail}
          alt=""
          fill
          sizes="(min-width: 1024px) 1000px, 100vw"
          className="object-cover opacity-35 blur-[2px]"
        />
      ) : null}
      <div className="absolute inset-0 bg-canvas/55" />
      <div className="relative flex w-full justify-center p-4">{content}</div>
    </div>
  );
}

function GateBox({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow?: string;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div role="status" className="flex max-w-md flex-col items-center gap-2 text-center sm:gap-3">
      {eyebrow ? (
        <span className="text-xs font-extrabold tracking-[0.12em] text-vip">{eyebrow}</span>
      ) : null}
      <p className="text-lg font-extrabold sm:text-2xl">{title}</p>
      <p className="text-sm text-fg-soft sm:text-base">{text}</p>
      {children ? (
        <div className="mt-1 flex flex-wrap justify-center gap-2.5">{children}</div>
      ) : null}
    </div>
  );
}

function EndCard({
  next,
  seconds,
  href,
  onCancel,
}: {
  next: Episode;
  seconds: number | null;
  href: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="text-xs font-extrabold tracking-[0.12em] text-link">UP NEXT</span>
      <p className="text-lg font-extrabold sm:text-2xl">Episode {next.number}</p>
      <div className="flex gap-2.5">
        <ButtonLink href={href} size="sm">
          <PlayIcon /> {seconds !== null ? `Playing in ${seconds}` : "Play now"}
        </ButtonLink>
        {seconds !== null ? (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-full border border-fg/25 px-4 text-sm font-semibold hover:bg-fg/10"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}

function UpNext({ next, slug, locked }: { next: Episode; slug: string; locked: boolean }) {
  return (
    <section
      aria-label="Up next"
      className={cn(
        "mx-4 flex flex-wrap items-center gap-4 rounded-2xl border p-4 sm:mx-0 sm:gap-5 sm:p-[18px]",
        locked ? "border-vip-line bg-vip-panel" : "border-line bg-surface",
      )}
    >
      <div className="relative flex aspect-video w-[34%] max-w-40 min-w-24 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-art sm:w-40">
        {next.thumbnail_url ? (
          <Image
            src={next.thumbnail_url}
            alt=""
            fill
            sizes="160px"
            className={cn("object-cover", locked && "opacity-40")}
          />
        ) : null}
        {locked ? <LockIcon size={26} className="relative text-vip" /> : null}
      </div>
      <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
        <span
          className={cn(
            "text-[13px] font-extrabold tracking-[0.08em]",
            locked ? "text-vip" : "text-link",
          )}
        >
          UP NEXT{locked ? " · VIP" : ""}
        </span>
        <span className="text-lg font-bold">Episode {next.number}</span>
        <span className="text-sm text-muted">
          {locked ? "VIP members can keep watching." : formatDuration(next.duration_sec)}
        </span>
      </div>
      {locked ? (
        <ButtonLink href="/vip" variant="vip" size="sm">
          Unlock with VIP
        </ButtonLink>
      ) : (
        <ButtonLink href={`/series/${slug}/episode/${next.number}`} variant="secondary" size="sm">
          <PlayIcon /> Play
        </ButtonLink>
      )}
    </section>
  );
}

function EpisodeSidebar({
  slug,
  episodes,
  currentId,
  isVip,
  signedIn,
}: {
  slug: string;
  episodes: Episode[];
  currentId: number;
  isVip: boolean;
  signedIn: boolean;
}) {
  const viewer = useSeriesViewer();
  const watched = useMemo(
    () =>
      episodes.filter((e) => {
        const p = viewer.progress.get(e.id);
        return p ? isFinished(p.progress_sec, e.duration_sec) : false;
      }).length,
    [episodes, viewer.progress],
  );
  return (
    <aside
      aria-labelledby="list-h"
      className="mx-4 flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-4 sm:mx-0 sm:p-[18px] lg:sticky lg:top-6 lg:w-[360px] lg:shrink-0"
    >
      <div className="flex items-baseline justify-between">
        <h2 id="list-h" className="text-lg font-extrabold">
          Episodes
        </h2>
        {signedIn ? (
          <span className="text-[13px] text-muted">
            {watched} / {episodes.length} watched
          </span>
        ) : null}
      </div>
      <ol className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
        {episodes.map((e) => {
          const current = e.id === currentId;
          const p = viewer.progress.get(e.id);
          const done = p ? isFinished(p.progress_sec, e.duration_sec) : false;
          const locked = signedIn && e.access === "vip" && !isVip;
          return (
            <li key={e.id}>
              <Link
                href={`/series/${slug}/episode/${e.number}`}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2.5 text-fg no-underline hover:bg-fg/6 hover:text-fg",
                  current && "bg-accent/14",
                )}
              >
                <span
                  className={cn("w-7 text-[15px] font-bold", current ? "text-link" : "text-muted")}
                >
                  {e.number}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.title}</span>
                {locked ? (
                  <LockIcon
                    size={16}
                    className="text-vip"
                    aria-label="VIP"
                    role="img"
                    aria-hidden={undefined}
                  />
                ) : done ? (
                  <CheckIcon
                    size={16}
                    className="text-success"
                    aria-label="Watched"
                    role="img"
                    aria-hidden={undefined}
                  />
                ) : e.access === "vip" && !signedIn ? (
                  <span className="text-[11px] font-extrabold text-vip">VIP</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
