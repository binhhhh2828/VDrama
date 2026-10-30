import { Badge } from "./Badge";
import { PosterArt } from "./PosterArt";
import { cn } from "@/lib/cn";
import { Link } from "@/components/i18n/navigation";

export type PosterCardProps = {
  href: string;
  title: string;
  posterUrl?: string | null;
  /** Thể loại, hiện dưới tên phim ngăn bằng " • " (tối đa 2 dòng). */
  genres?: string[];
  rank?: number;
  vip?: boolean;
  isNew?: boolean;
  /** Phim độc quyền: nhãn nhỏ ở đáy poster. */
  original?: boolean;
  /** `row`: tên đậm 600 (hàng cuộn ngang); `grid`: tên 400 (lưới 3 cột trang Browse). */
  variant?: "row" | "grid";
  /** Ảnh trong khung đầu màn hình thì nạp trước. */
  preload?: boolean;
  className?: string;
};

/**
 * Thẻ phim theo NetShort (ảnh 02, 03, 18): poster 3:4 bo 10 (tên phim in đè ảnh), dưới là tên tối đa
 * 2 dòng và thể loại xám ngăn bằng " • ". Nhãn TOP/NEW góc trái, VIP góc phải, ORIGINAL ở đáy.
 */
export function PosterCard({
  href,
  title,
  posterUrl,
  genres,
  rank,
  vip,
  isNew,
  original,
  variant = "row",
  preload,
  className,
}: PosterCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-w-0 flex-col gap-2 text-fg no-underline hover:text-fg",
        className,
      )}
    >
      <PosterArt
        src={posterUrl}
        title={title}
        sizes="(min-width: 640px) 200px, 128px"
        preload={preload}
        className="rounded-card"
      >
        {rank ? (
          <Badge kind="top" className="absolute top-1.5 left-1.5">
            TOP {rank}
          </Badge>
        ) : isNew ? (
          <Badge kind="new" className="absolute top-1.5 left-1.5" />
        ) : null}
        {vip ? <Badge kind="vip" className="absolute top-1.5 right-1.5" /> : null}
        {original ? <Badge kind="original" className="absolute bottom-1.5 left-1.5" /> : null}
      </PosterArt>
      <div className="flex flex-col gap-1">
        <span
          className={cn(
            "line-clamp-2 text-[13px] leading-[16px]",
            variant === "row" ? "font-semibold" : "font-normal",
          )}
        >
          {title}
        </span>
        {genres && genres.length > 0 ? (
          <span className="line-clamp-2 text-[11px] leading-[13px] text-muted">
            {genres.join(" • ")}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
