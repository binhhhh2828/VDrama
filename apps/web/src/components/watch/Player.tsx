"use client";

import type Hls from "hls.js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  CloseIcon,
  FullscreenIcon,
  MuteIcon,
  PauseIcon,
  PipIcon,
  PlayIcon,
  VolumeIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/format";
import { useLocale } from "@/components/i18n/I18nProvider";
import { Link } from "@/components/i18n/navigation";
import { localePath } from "@/lib/i18n/paths";

export type PlayerSource = { url: string; expiresAt: number | null; sample: boolean };

type Props = {
  source: PlayerSource;
  /** Tua tới giây này khi video sẵn sàng (tiến độ cũ). */
  startAt: number;
  label: string;
  /** Nút X góc trái trên: thoát về trang phim. */
  closeHref: string;
  prevHref: string | null;
  nextHref: string | null;
  /** Lưu tiến độ; `final`: lúc đóng trang (gửi bằng keepalive). */
  onProgress: (sec: number, final: boolean) => void;
  onEnded: () => void;
  /** Token hết hạn: xin URL mới. Trả về null nếu không xin được. */
  refreshSource: () => Promise<PlayerSource | null>;
  /** Phần đè lên video khi xem xong (Up next). */
  endOverlay?: ReactNode;
};

const SAVE_EVERY_MS = 20_000;
const SEEK_STEP = 10;
const HIDE_CONTROLS_MS = 3000;

/**
 * Player HLS: Safari phát HLS sẵn, trình duyệt khác dùng hls.js (nạp động, chỉ khi cần).
 * Thanh điều khiển tự vẽ theo thiết kế; bàn phím: Space/K phát-dừng, ←/→ tua 10 giây,
 * ↑/↓ âm lượng, M tắt tiếng, F toàn màn hình, N tập kế tiếp.
 */
export function Player({
  source,
  startAt,
  label,
  closeHref,
  prevHref,
  nextHref,
  onProgress,
  onEnded,
  refreshSource,
  endOverlay,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const srcRef = useRef(source);
  const startRef = useRef(startAt);
  const refreshingRef = useRef(false);
  const onProgressRef = useRef(onProgress);
  // Vị trí xem gần nhất. Lúc rời tập, effect dọn dẹp chạy sau khi phần tử video đã bị gỡ khỏi trang
  // (videoRef = null) và hls.js đã reset video, nên không đọc currentTime ở đó được.
  const lastTimeRef = useRef(0);
  const renewRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [waiting, setWaiting] = useState(true);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  // --- Gắn nguồn video (và gắn lại khi đổi URL vì token hết hạn) ---
  const attach = useCallback(async (src: PlayerSource, resumeAt: number) => {
    const video = videoRef.current;
    if (!video) return;
    hlsRef.current?.destroy();
    hlsRef.current = null;
    setFailed(false);

    const seek = () => {
      if (resumeAt > 0 && Number.isFinite(video.duration) && resumeAt < video.duration - 5) {
        video.currentTime = resumeAt;
      }
    };

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src.url;
      video.addEventListener("loadedmetadata", seek, { once: true });
      return;
    }
    const { default: HlsCtor } = await import("hls.js");
    if (!HlsCtor.isSupported()) {
      setFailed(true);
      return;
    }
    const hls = new HlsCtor({ capLevelToPlayerSize: true });
    hlsRef.current = hls;
    hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
      if (resumeAt > 0) hls.startLoad(resumeAt);
    });
    video.addEventListener("loadedmetadata", seek, { once: true });
    hls.on(HlsCtor.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      const status = (data.response as { code?: number } | undefined)?.code;
      // Token hết hạn hoặc bị từ chối: xin URL mới rồi phát tiếp từ chỗ cũ.
      if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR && (status === 401 || status === 403)) {
        void renewRef.current();
      } else if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
      } else {
        setFailed(true);
      }
    });
    hls.loadSource(src.url);
    hls.attachMedia(video);
  }, []);

  const renew = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    const video = videoRef.current;
    const at = video?.currentTime ?? 0;
    const wasPlaying = video ? !video.paused : false;
    try {
      const next = await refreshSource();
      if (!next) {
        setFailed(true);
        return;
      }
      srcRef.current = next;
      await attach(next, at);
      if (wasPlaying) void videoRef.current?.play().catch(() => {});
    } finally {
      refreshingRef.current = false;
    }
  }, [attach, refreshSource]);

  useEffect(() => {
    renewRef.current = renew;
  }, [renew]);

  useEffect(() => {
    srcRef.current = source;
    void attach(source, startRef.current);
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [source, attach]);

  // Token sắp hết hạn trong lúc tab mở lâu: xin trước khi hết (1 phút).
  useEffect(() => {
    const exp = source.expiresAt;
    if (!exp) return;
    const ms = exp - Date.now() - 60_000;
    const timer = window.setTimeout(() => void renew(), Math.max(ms, 5_000));
    return () => window.clearTimeout(timer);
  }, [source, renew]);

  // --- Lưu tiến độ: mỗi 20 giây khi đang phát, khi dừng, khi rời trang ---
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const v = videoRef.current;
      if (v) onProgressRef.current(v.currentTime, false);
    }, SAVE_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    const flush = () => {
      const t = lastTimeRef.current;
      if (t > 0) onProgressRef.current(t, true);
    };
    const onHidden = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      flush(); // chuyển sang tập khác trong app
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, []);

  // --- Điều khiển ---
  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) void v.play().catch(() => {});
    else v.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.min(Math.max(v.currentTime + delta, 0), v.duration - 0.5);
  }, []);

  const setVol = useCallback((value: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = Math.min(Math.max(value, 0), 1);
    v.muted = v.volume === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (v) v.muted = !v.muted;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    const video = videoRef.current as
      (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (el?.requestFullscreen) void el.requestFullscreen();
    else video?.webkitEnterFullscreen?.(); // iPhone chỉ cho video toàn màn hình
  }, []);

  const [canPip, setCanPip] = useState(false);
  useEffect(() => {
    // Chỉ biết trình duyệt có hỗ trợ hình-trong-hình sau khi gắn vào trang.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanPip(typeof document !== "undefined" && document.pictureInPictureEnabled === true);
  }, []);
  const togglePip = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) void document.exitPictureInPicture();
    else void v.requestPictureInPicture?.().catch(() => {});
  }, []);

  // Hiện thanh điều khiển khi rê chuột / chạm, ẩn sau 3 giây khi đang phát.
  const hideTimer = useRef<number | undefined>(undefined);
  const poke = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!videoRef.current?.paused) setControlsVisible(false);
    }, HIDE_CONTROLS_MS);
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.target instanceof HTMLInputElement && e.key !== " ") return;
    const map: Record<string, () => void> = {
      " ": toggle,
      k: toggle,
      ArrowLeft: () => seekBy(-SEEK_STEP),
      ArrowRight: () => seekBy(SEEK_STEP),
      ArrowUp: () => setVol((videoRef.current?.volume ?? 1) + 0.1),
      ArrowDown: () => setVol((videoRef.current?.volume ?? 1) - 0.1),
      m: toggleMute,
      f: toggleFullscreen,
      n: () => nextHref && (window.location.href = localePath(locale, nextHref)),
      p: () => prevHref && (window.location.href = localePath(locale, prevHref)),
    };
    const fn = map[e.key] ?? map[e.key.toLowerCase()];
    if (fn) {
      e.preventDefault();
      fn();
      poke();
    }
  }

  const progress = duration ? time / duration : 0;
  const showControls = controlsVisible || !playing;
  const circle = "flex size-11 items-center justify-center rounded-full text-fg transition-opacity";

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      role="region"
      aria-label={`Video player: ${label}`}
      onKeyDown={onKeyDown}
      onMouseMove={poke}
      onTouchStart={poke}
      className={cn(
        "group relative aspect-[9/16] w-full overflow-hidden bg-black outline-none",
        "focus-visible:ring-2 focus-visible:ring-link",
        !showControls && "cursor-none",
      )}
    >
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full bg-black object-contain"
        onClick={toggle}
        onDoubleClick={toggleFullscreen}
        onPlay={() => {
          setPlaying(true);
          setEnded(false);
          poke();
        }}
        onPause={() => {
          setPlaying(false);
          const v = videoRef.current;
          if (v && !v.ended) onProgressRef.current(v.currentTime, false);
        }}
        onEnded={() => {
          setPlaying(false);
          setEnded(true);
          const v = videoRef.current;
          if (v) {
            lastTimeRef.current = v.duration;
            onProgressRef.current(v.duration, false);
          }
          onEnded();
        }}
        onTimeUpdate={(e) => {
          lastTimeRef.current = e.currentTarget.currentTime;
          setTime(e.currentTarget.currentTime);
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onProgress={(e) => {
          const b = e.currentTarget.buffered;
          if (b.length) setBuffered(b.end(b.length - 1));
        }}
        onWaiting={() => setWaiting(true)}
        onCanPlay={() => setWaiting(false)}
        onPlaying={() => setWaiting(false)}
        onVolumeChange={(e) => {
          setMuted(e.currentTarget.muted);
          setVolume(e.currentTarget.volume);
        }}
        onError={() => setFailed(true)}
      />

      {/* Nút X (thoát về trang phim), góc trái trên như ảnh 10. */}
      <Link
        href={closeHref}
        aria-label="Close player"
        className={cn(circle, "absolute top-1.5 left-1.5 bg-black/45 hover:text-fg")}
      >
        <CloseIcon size={20} />
      </Link>
      {source.sample ? (
        <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/45 px-2 py-1 text-[10px] font-semibold tracking-[0.06em] uppercase">
          Sample video
        </span>
      ) : null}

      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-canvas/85 p-6 text-center">
          <p className="font-semibold">This video couldn&apos;t be played.</p>
          <button
            type="button"
            onClick={() => void renew()}
            className="min-h-11 rounded-full border border-fg/25 px-5 font-semibold hover:bg-fg/10"
          >
            Try again
          </button>
        </div>
      ) : ended && endOverlay ? (
        <div className="absolute inset-0 flex items-center justify-center bg-canvas/80 p-4">
          {endOverlay}
        </div>
      ) : (
        <>
          {waiting && playing ? (
            <span
              aria-hidden="true"
              className="absolute top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-4 border-fg/20 border-t-accent"
            />
          ) : null}
          {!playing ? (
            <button
              type="button"
              aria-label="Play"
              onClick={toggle}
              className="absolute top-1/2 left-1/2 flex size-[58px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-fg"
            >
              <PlayIcon size={26} />
            </button>
          ) : null}
        </>
      )}

      {/* Hàng điều khiển: phát, thời gian, thanh tua, PiP, âm lượng, toàn màn hình (ảnh 10). */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex items-center gap-1 bg-linear-to-b from-black/0 to-black/75 px-1 pt-8 pb-1 transition-opacity",
          showControls ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <CtrlButton label={playing ? "Pause" : "Play"} onClick={toggle}>
          {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
        </CtrlButton>
        <span className="text-[11px] text-fg tabular-nums">{formatClock(time)}</span>
        <SeekBar
          time={time}
          duration={duration}
          buffered={buffered}
          progress={progress}
          onSeek={(t) => {
            const v = videoRef.current;
            if (v) v.currentTime = t;
          }}
        />
        <span className="text-[11px] text-fg tabular-nums">{formatClock(duration)}</span>
        {canPip ? (
          <CtrlButton label="Picture in picture" onClick={togglePip}>
            <PipIcon size={18} />
          </CtrlButton>
        ) : null}
        <CtrlButton label={muted || volume === 0 ? "Unmute" : "Mute"} onClick={toggleMute}>
          {muted || volume === 0 ? <MuteIcon size={18} /> : <VolumeIcon size={18} />}
        </CtrlButton>
        <CtrlButton label="Full screen" onClick={toggleFullscreen}>
          <FullscreenIcon size={18} />
        </CtrlButton>
      </div>
    </div>
  );
}

function CtrlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-fg hover:bg-fg/10"
    >
      {children}
    </button>
  );
}

/** Thanh tua mảnh: input range (bàn phím, trình đọc màn hình dùng được) phủ lên thanh vẽ. */
function SeekBar({
  time,
  duration,
  buffered,
  progress,
  onSeek,
}: {
  time: number;
  duration: number;
  buffered: number;
  progress: number;
  onSeek: (t: number) => void;
}) {
  const pct = `${progress * 100}%`;
  return (
    <div className="relative flex h-9 min-w-0 flex-1 items-center">
      <div className="relative h-[3px] w-full rounded-full bg-fg/25">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-fg/25"
          style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }}
        />
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: pct }} />
        <span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
          style={{ left: pct }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={1}
        value={Math.min(time, duration || 0)}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-label="Seek"
        aria-valuetext={`${formatClock(time)} of ${formatClock(duration)}`}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
