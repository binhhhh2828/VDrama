"use client";

import { IS_DEMO } from "@/lib/demo/config";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useSession } from "@/components/session/SessionProvider";
import { useMyList } from "@/components/series/SeriesActions";
import { useSeriesViewer } from "@/components/series/SeriesViewer";
import { ButtonLink } from "@/components/ui/Button";
import { GenreTag } from "@/components/ui/Chip";
import {
  BookmarkFillIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  FacebookIcon,
  HeartIcon,
  LayersIcon,
  LinkIcon,
  LockIcon,
  PlayIcon,
  XIcon,
} from "@/components/ui/icons";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { Episode, Genre } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import { GenreName } from "@/components/i18n/GenreName";
import { apiErrorText } from "@/lib/i18n/api-errors";
import { compactNumber, isFinished } from "@/lib/format";
import { EpisodeSheet } from "./EpisodeSheet";
import { Player } from "./Player";
import type { PlayerSource } from "./Player";
import { Link, usePathname, useRouter } from "@/components/i18n/navigation";

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
  | { kind: "error"; error: ApiError | null };

async function fetchSource(episodeId: number): Promise<PlayerSource> {
  const info = await api.play(episodeId);
  return { url: info.hls_url, expiresAt: Date.parse(info.expires_at) || null, sample: IS_DEMO };
}

function gateFor(err: unknown): Gate {
  if (!(err instanceof ApiError)) return { kind: "error", error: null };
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
      return { kind: "error", error: err };
  }
}

export type WatchSeries = {
  id: number;
  slug: string;
  title: string;
  genres: Genre[];
  description: string | null;
  favoriteCount: number;
};

/**
 * Trang xem theo NetShort mobile (ảnh 10, 11, 23): player dọc 9:16 giữa nền đen, dải "All episodes"
 * mở bảng danh sách tập, panel bo trên với tên + lượt thích/lưu, thể loại, tóm tắt, nút chia sẻ.
 * `children` (hàng đề xuất, đánh giá...) do server dựng, hiện dưới panel. Desktop: player bên trái,
 * panel bên phải.
 */
export function WatchView({
  series,
  episodes,
  episode,
  likes,
  children,
}: {
  series: WatchSeries;
  episodes: Episode[];
  episode: Episode;
  /** Số lượt thích mẫu (chỉ bản demo; API thật chưa có "thích"). */
  likes: number | null;
  children?: ReactNode;
}) {
  const t = useT();
  const session = useSession();
  const viewer = useSeriesViewer();
  const { recordProgress } = viewer;
  const router = useRouter();
  const userId = session.status === "user" ? session.user.id : null;
  const isVip = session.status === "user" && session.user.is_vip;

  const [result, setResult] = useState<{ key: string; gate: Gate } | null>(null);
  // Có `isVip` trong khóa: mua VIP xong quay lại đúng tập này thì hỏi lại `play`, không dùng kết quả
  // "cần VIP" cũ.
  const key = `${userId}:${isVip}:${episode.id}`;

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

  const idx = episodes.findIndex((e) => e.id === episode.id);
  const prev = idx > 0 ? episodes[idx - 1] : null;
  const next = idx >= 0 && idx < episodes.length - 1 ? episodes[idx + 1] : null;
  const nextLocked = next ? next.access === "vip" && !isVip : false;
  // Chevron "tập sau" luôn đi tới trang tập đó (tập VIP thì trang đó hiện màn hình mời mua);
  // chỉ tự chuyển tập khi tập sau xem được.
  const prevHref = prev ? `/series/${series.slug}/episode/${prev.number}` : null;
  const nextHref = next ? `/series/${series.slug}/episode/${next.number}` : null;

  // Tiến độ cũ của tập này (đã xem xong thì phát lại từ đầu).
  const saved = viewer.progress.get(episode.id);
  const startAt =
    saved && !isFinished(saved.progress_sec, episode.duration_sec) ? saved.progress_sec : 0;

  const lastSaved = useRef({ id: -1, sec: -1 });
  const onProgress = useCallback(
    (sec: number, final: boolean) => {
      if (userId === null || !Number.isFinite(sec) || sec <= 0) return;
      const rounded = Math.floor(sec);
      if (lastSaved.current.id === episode.id && lastSaved.current.sec === rounded) return;
      lastSaved.current = { id: episode.id, sec: rounded };
      recordProgress(episode.id, episode.number, rounded);
      void api.saveProgress(episode.id, rounded, { keepalive: final }).catch(() => {
        lastSaved.current = { id: -1, sec: -1 }; // lần sau thử lại
      });
    },
    [userId, episode.id, episode.number, recordProgress],
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
    if (autoNext === null || !nextHref || nextLocked) return;
    if (autoNext <= 0) {
      router.push(nextHref);
      return;
    }
    const t = window.setTimeout(() => setAutoNext((n) => (n === null ? null : n - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [autoNext, nextHref, nextLocked, router]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const customTitle = episode.title && episode.title !== `Episode ${episode.number}`;
  const label = `${t("series.episode", { n: episode.number })}${customTitle ? ` · ${episode.title}` : ""}`;

  return (
    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-center lg:gap-8 lg:px-6">
      <div className="flex min-w-0 flex-col bg-canvas-black lg:w-[420px] lg:shrink-0 lg:rounded-hero lg:pb-2">
        <div className="flex justify-center pt-0.5">
          <div className="relative w-[min(73.3vw,340px)] lg:w-[min(380px,calc((100dvh-190px)*9/16))]">
            {/* Chờ có tiến độ cũ rồi mới gắn player, để tua đúng chỗ đang xem dở. */}
            {gate.kind === "ready" && viewer.ready ? (
              <Player
                key={episode.id}
                source={gate.source}
                startAt={startAt}
                label={label}
                closeHref={`/series/${series.slug}`}
                prevHref={prevHref}
                nextHref={nextHref}
                onProgress={onProgress}
                onEnded={() => nextHref && !nextLocked && setAutoNext(5)}
                refreshSource={refreshSource}
                endOverlay={
                  next && nextHref ? (
                    <EndCard
                      next={next}
                      locked={nextLocked}
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
            {/* Chevron tập trước/sau nằm ở khoảng đen bên phải player, như ảnh 10, hạ thấp để người cầm tay trái cũng chạm được. */}
            <nav
              aria-label={t("gate.nav")}
              className="absolute top-[72%] left-full ml-1.5 flex -translate-y-1/2 flex-col gap-3"
            >
              {prevHref ? (
                <EpisodeStep href={prevHref} label={t("gate.prev")}>
                  <ChevronUpIcon size={18} />
                </EpisodeStep>
              ) : null}
              {nextHref ? (
                <EpisodeStep href={nextHref} label={t("gate.next")}>
                  <ChevronDownIcon size={18} />
                </EpisodeStep>
              ) : null}
            </nav>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          className="flex min-h-12 items-center gap-2 px-3 py-2 text-left text-[13px] text-fg"
        >
          <LayersIcon size={20} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {t("series.allEpisodes")} • {series.title}
          </span>
          <ChevronRightIcon size={16} className="shrink-0 text-muted" />
        </button>
      </div>

      <EpisodeSheet
        open={sheetOpen}
        onClose={closeSheet}
        slug={series.slug}
        episodes={episodes}
        currentNumber={episode.number}
        isVip={isVip}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-8 lg:max-w-[600px]">
        <InfoPanel series={series} episode={episode} likes={likes} />
        {children}
      </div>
    </div>
  );
}

/** Panel bo trên: tên + tập, lượt thích/lưu, thể loại, tóm tắt, chia sẻ (ảnh 11). */
function InfoPanel({
  series,
  episode,
  likes,
}: {
  series: WatchSeries;
  episode: Episode;
  likes: number | null;
}) {
  const t = useT();
  const locale = useLocale();
  const myList = useMyList(series.id);
  const viewer = useSeriesViewer();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Số lưu của server đã gồm lựa chọn của người xem lúc tải trang; bấm lưu/bỏ lưu thì cộng/trừ 1 so
  // với trạng thái đã tải (lấy ngay lúc đã biết được trạng thái đó).
  const [baseFavorited, setBaseFavorited] = useState<boolean | null>(null);
  if (viewer.ready && baseFavorited === null) setBaseFavorited(viewer.favorited);
  const delta = baseFavorited === null ? 0 : Number(myList.on) - Number(baseFavorited);
  const saves = Math.max(0, series.favoriteCount + delta);

  const customTitle = episode.title && episode.title !== `Episode ${episode.number}`;

  function open(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  const pageUrl = () => encodeURIComponent(window.location.href);
  const shareTitle = encodeURIComponent(
    `${t("episodes.metaTitle", { title: series.title, n: episode.number })} · VDrama`,
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // trình duyệt chặn clipboard: bỏ qua
    }
  }

  const share =
    "flex size-11 items-center justify-center rounded-full text-white transition hover:brightness-110";

  return (
    <section
      aria-label={t("gate.details")}
      className="rounded-t-[24px] bg-surface px-[13px] pt-5 pb-6 lg:rounded-[24px]"
    >
      <h1 className="px-0.5 text-base leading-snug">
        {t("gate.titleLine", { title: series.title, n: episode.number })}
        {customTitle ? ` · ${episode.title}` : ""}
      </h1>

      <div className="mt-3 flex items-center gap-5 px-0.5 text-[13px] text-fg-soft">
        {likes !== null ? (
          <span className="flex items-center gap-1.5">
            <HeartIcon size={18} className="text-fg-soft" />
            <span aria-label={t("gate.likes", { n: likes })}>{compactNumber(likes, locale)}</span>
          </span>
        ) : null}
        <button
          type="button"
          aria-pressed={myList.on}
          aria-label={myList.on ? t("gate.removeFromList") : t("gate.addToList")}
          disabled={myList.disabled}
          onClick={myList.toggle}
          className={cn(
            "hit-44 relative flex items-center gap-1.5 disabled:opacity-70",
            myList.on ? "text-accent" : "text-fg-soft",
          )}
        >
          <BookmarkFillIcon size={18} />
          <span>{compactNumber(saves, locale)}</span>
        </button>
      </div>
      {myList.error ? (
        <p role="alert" className="mt-2 text-sm text-error-soft">
          {myList.error}
        </p>
      ) : null}

      {series.genres.length > 0 ? (
        <div className="mt-3.5 flex flex-wrap gap-2.5">
          {series.genres.map((g) => (
            <GenreTag key={g.slug} className="px-4 py-1.5 text-[13px]">
              <GenreName genre={g} />
            </GenreTag>
          ))}
        </div>
      ) : null}

      {series.description ? (
        <div className="mt-4 px-0.5">
          <p className="text-[13px]">{t("series.summary")}</p>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 flex w-full items-start gap-1 text-left text-[13px] leading-6 text-muted"
          >
            <span className={cn("min-w-0 flex-1", !expanded && "line-clamp-2")}>
              {series.description}
            </span>
            <ChevronDownIcon
              size={18}
              className={cn("mt-1 shrink-0", expanded && "rotate-180")}
              aria-hidden
            />
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          aria-label={t("gate.shareFacebook")}
          onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${pageUrl()}`)}
          className={cn(share, "bg-[#1877f2]")}
        >
          <FacebookIcon size={22} />
        </button>
        <button
          type="button"
          aria-label={t("gate.shareX")}
          onClick={() =>
            open(`https://twitter.com/intent/tweet?url=${pageUrl()}&text=${shareTitle}`)
          }
          className={cn(share, "bg-black ring-1 ring-fg/20")}
        >
          <XIcon size={18} />
        </button>
        <button
          type="button"
          aria-label={copied ? t("seriesPage.linkCopied") : t("gate.copyLink")}
          onClick={copyLink}
          className={cn(share, "bg-accent")}
        >
          <LinkIcon size={20} />
        </button>
        {copied ? <span className="text-sm text-muted">{t("seriesPage.copied")}</span> : null}
      </div>
    </section>
  );
}

/** Màn hình thay cho player khi chưa xem được (khách, cần VIP, video đang xử lý...), cùng khung 9:16. */
function GateScreen({
  gate,
  episode,
  thumbnail,
}: {
  gate: Gate;
  episode: Episode;
  thumbnail: string | null;
}) {
  const t = useT();
  const pathname = usePathname();
  const next = encodeURIComponent(pathname);

  const content = (() => {
    switch (gate.kind) {
      case "loading":
        return (
          <span
            aria-label={t("gate.loading")}
            role="status"
            className="size-12 animate-spin rounded-full border-4 border-fg/20 border-t-accent"
          />
        );
      case "signin":
        return (
          <GateBox
            title={t("gate.signInTitle")}
            text={episode.access === "free" ? t("gate.signInFree") : t("gate.signInVip")}
          >
            <ButtonLink href={`/signin?next=${next}`} size="sm">
              {t("gate.signIn")}
            </ButtonLink>
            <ButtonLink href={`/signup?next=${next}`} variant="secondary" size="sm">
              {t("gate.createAccount")}
            </ButtonLink>
          </GateBox>
        );
      case "vip":
        return (
          <GateBox
            eyebrow={t("gate.vipEyebrow")}
            title={t("gate.vipTitle")}
            text={t("gate.vipText")}
          >
            <ButtonLink href="/vip" variant="vip" size="sm">
              <LockIcon size={16} /> {t("gate.seePlans")}
            </ButtonLink>
          </GateBox>
        );
      case "processing":
        return <GateBox title={t("gate.processingTitle")} text={t("gate.processingText")} />;
      case "unavailable":
        return <GateBox title={t("gate.unavailableTitle")} text={t("gate.unavailableText")} />;
      case "error":
        return (
          <GateBox
            title={t("gate.errorTitle")}
            text={gate.error ? apiErrorText(gate.error, t) : t("gate.genericError")}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <div className="relative flex aspect-[9/16] w-full items-center justify-center overflow-hidden bg-art">
      {thumbnail ? (
        <Image
          src={thumbnail}
          alt=""
          fill
          sizes="(min-width: 1024px) 380px, 340px"
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
  children?: ReactNode;
}) {
  return (
    <div role="status" className="flex max-w-xs flex-col items-center gap-2 text-center">
      {eyebrow ? (
        <span className="text-xs font-bold tracking-[0.12em] text-vip">{eyebrow}</span>
      ) : null}
      <p className="text-base font-bold">{title}</p>
      <p className="text-sm text-fg-soft">{text}</p>
      {children ? (
        <div className="mt-1 flex flex-wrap justify-center gap-2.5">{children}</div>
      ) : null}
    </div>
  );
}

function EndCard({
  next,
  locked,
  seconds,
  href,
  onCancel,
}: {
  next: Episode;
  locked: boolean;
  seconds: number | null;
  href: string;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span
        className={cn("text-xs font-bold tracking-[0.12em]", locked ? "text-vip" : "text-link")}
      >
        {locked ? t("gate.upNextVip") : t("gate.upNext")}
      </span>
      <p className="text-base font-bold">{t("episodes.episodeN", { n: next.number })}</p>
      <div className="flex gap-2.5">
        {locked ? (
          <ButtonLink href="/vip" variant="vip" size="sm">
            <LockIcon size={16} /> {t("gate.unlockVip")}
          </ButtonLink>
        ) : (
          <>
            <ButtonLink href={href} size="sm">
              <PlayIcon />{" "}
              {seconds !== null ? t("gate.playingIn", { n: seconds }) : t("series.playNow")}
            </ButtonLink>
            {seconds !== null ? (
              <button
                type="button"
                onClick={onCancel}
                className="min-h-11 rounded-full border border-fg/25 px-4 text-sm font-semibold hover:bg-fg/10"
              >
                {t("gate.cancel")}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/** Nút chevron tròn nhỏ (nhìn 36px, vùng bấm 44px). */
function EpisodeStep({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="hit-44 relative flex size-9 items-center justify-center rounded-full bg-fg/12 text-fg no-underline hover:bg-fg/20 hover:text-fg"
    >
      {children}
    </Link>
  );
}
