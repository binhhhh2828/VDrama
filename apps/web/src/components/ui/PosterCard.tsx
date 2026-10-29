import Image from "next/image";
import Link from "next/link";
import { Badge } from "./Badge";
import { cn } from "@/lib/cn";

export type PosterCardProps = {
  href: string;
  title: string;
  posterUrl?: string | null;
  /** Dòng phụ, ví dụ "12 episodes · Romance". */
  meta?: string;
  rank?: number;
  vip?: boolean;
  isNew?: boolean;
  className?: string;
  /** Ảnh trong khung đầu màn hình thì nạp trước. */
  preload?: boolean;
};

/** Thẻ phim poster 2:3: nhãn TOP/NEW góc trái, VIP góc phải, tên phim đè lên chân ảnh. */
export function PosterCard({
  href,
  title,
  posterUrl,
  meta,
  rank,
  vip,
  isNew,
  className,
  preload,
}: PosterCardProps) {
  return (
    <Link
      href={href}
      className={cn("group flex flex-col gap-2.5 text-fg no-underline hover:text-fg", className)}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-card border border-line bg-art">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt=""
            fill
            sizes="(min-width: 640px) 200px, 50vw"
            preload={preload}
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : null}
        {rank ? (
          <Badge kind="top" className="absolute top-2.5 left-2.5">
            TOP {rank}
          </Badge>
        ) : isNew ? (
          <Badge kind="new" className="absolute top-2.5 left-2.5" />
        ) : null}
        {vip ? <Badge kind="vip" className="absolute top-2.5 right-2.5" /> : null}
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-b from-canvas/0 to-canvas/85 px-3 pt-10 pb-3">
          <span className="line-clamp-2 text-[19px] leading-[1.15] font-extrabold tracking-[-0.02em]">
            {title}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-[3px]">
        <span className="truncate text-[15px] font-semibold">{title}</span>
        {meta ? <span className="truncate text-[13px] text-muted">{meta}</span> : null}
      </div>
    </Link>
  );
}
