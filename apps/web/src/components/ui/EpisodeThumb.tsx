import Image from "next/image";
import { Badge } from "./Badge";
import { LockIcon, PlayIcon } from "./icons";
import { ProgressBar } from "./ProgressBar";
import { cn } from "@/lib/cn";
import { Link } from "@/components/i18n/navigation";

export type EpisodeThumbProps = {
  href: string;
  title: string;
  /** Dòng phụ, ví dụ "EP 3 · 21 min" hoặc "12 min left". */
  meta?: string;
  thumbnailUrl?: string | null;
  /** Tiến độ đã xem, 0–1. Không truyền thì không hiện thanh. */
  progress?: number;
  access?: "free" | "vip";
  /** Người xem hiện tại chưa mở được tập này (hiện ổ khóa). */
  locked?: boolean;
  current?: boolean;
  className?: string;
};

/** Thumbnail tập 16:9: nút play giữa, thanh tiến độ ở chân, nhãn FREE/VIP, ổ khóa khi chưa có quyền. */
export function EpisodeThumb({
  href,
  title,
  meta,
  thumbnailUrl,
  progress,
  access,
  locked,
  current,
  className,
}: EpisodeThumbProps) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn("group flex flex-col gap-2.5 text-fg no-underline hover:text-fg", className)}
    >
      <div
        className={cn(
          "relative aspect-video overflow-hidden rounded-card border bg-art",
          current ? "border-accent" : "border-line",
        )}
      >
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt=""
            fill
            sizes="(min-width: 640px) 280px, 100vw"
            className="object-cover"
          />
        ) : null}
        {access ? <Badge kind={access} className="absolute top-2.5 right-2.5" /> : null}
        <span className="absolute top-1/2 left-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-fg/30 bg-canvas/60 transition group-hover:bg-canvas/80">
          {locked ? <LockIcon size={18} /> : <PlayIcon size={16} />}
        </span>
        {progress !== undefined ? (
          <ProgressBar value={progress} thin className="absolute inset-x-0 bottom-0 rounded-none" />
        ) : null}
      </div>
      <div className="flex flex-col gap-[3px]">
        <span className="truncate text-[15px] font-semibold">{title}</span>
        {meta ? <span className="truncate text-[13px] text-muted">{meta}</span> : null}
      </div>
    </Link>
  );
}
