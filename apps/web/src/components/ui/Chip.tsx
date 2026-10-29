import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Chip lọc (thể loại, sắp xếp): chữ nhật bo 10, nhìn cao 33px, vùng bấm 44px. Đang chọn thì nền accent.
 */
export function Chip({
  active = false,
  className,
  ...rest
}: { active?: boolean } & ComponentProps<typeof Link>) {
  return (
    <Link
      aria-current={active ? "true" : undefined}
      className={cn(
        "hit-44 relative inline-flex h-[33px] items-center rounded-chip px-3.5 text-sm font-medium whitespace-nowrap no-underline transition",
        active
          ? "bg-accent text-on-accent hover:text-on-accent"
          : "bg-surface-2 text-fg-soft hover:bg-surface-3 hover:text-fg",
        className,
      )}
      {...rest}
    />
  );
}

/** Nhãn thể loại nhỏ (chỉ đọc): bo 16, nền surface-3, chữ xám (panel trang xem, kết quả tìm kiếm). */
export function GenreTag({ children, className }: { children: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-2xl bg-surface-3 px-3 py-1 text-[13px] text-fg-soft",
        className,
      )}
    >
      {children}
    </span>
  );
}
