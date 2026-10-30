import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PosterArtProps = {
  src?: string | null;
  title: string;
  /** "poster" là 3:4 (thẻ phim), "hero" là 3:4 (băng chuyền trang chủ). */
  ratio?: "poster" | "hero";
  /**
   * In tên phim lên ảnh (chữ trắng, bóng đổ, 1/3 dưới) như poster có chữ nghệ thuật. Tắt khi ảnh
   * đã có chữ sẵn (poster thật).
   */
  withTitle?: boolean;
  sizes: string;
  preload?: boolean;
  className?: string;
  /** Chỉnh khối chữ in đè (ví dụ đẩy lên cao để chừa chỗ cho nút ở hero). */
  titleClassName?: string;
  /** Lớp phủ thêm (nhãn góc...). */
  children?: ReactNode;
};

const ratios = { poster: "aspect-[3/4]", hero: "aspect-[3/4]" } as const;

/** Ảnh poster/hero có tên phim in đè, dùng khi ảnh chỉ là ảnh giữ chỗ không có chữ. */
export function PosterArt({
  src,
  title,
  ratio = "poster",
  withTitle = true,
  sizes,
  preload,
  className,
  titleClassName,
  children,
}: PosterArtProps) {
  const hero = ratio === "hero";
  // Poster thật đã có tên phim trong tranh; chỉ ảnh giữ chỗ (picsum) hoặc chưa có ảnh mới in chữ đè.
  const showTitle = withTitle && (!src || src.includes("picsum.photos"));
  return (
    <div className={cn("@container relative overflow-hidden bg-art", ratios[ratio], className)}>
      {src ? (
        <Image src={src} alt="" fill sizes={sizes} preload={preload} className="object-cover" />
      ) : null}
      {showTitle ? (
        <div
          aria-hidden
          className={cn(
            "absolute inset-x-0 bottom-0 flex h-1/2 items-end bg-linear-to-b from-black/0 via-black/35 to-black/80 px-[8%] pb-[9%]",
            titleClassName,
          )}
        >
          <span
            className={cn(
              "line-clamp-3 w-full break-words text-center leading-[1.05] font-black tracking-[-0.02em] text-balance text-white uppercase [text-shadow:0_2px_10px_rgb(0_0_0/0.7),0_1px_2px_rgb(0_0_0/0.8)]",
              hero ? "text-[clamp(18px,9cqw,44px)]" : "text-[clamp(9px,12cqw,22px)]",
            )}
          >
            {title}
          </span>
        </div>
      ) : null}
      {children}
    </div>
  );
}
