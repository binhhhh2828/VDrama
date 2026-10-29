import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Chip lọc (thể loại, sắp xếp). Đang chọn thì nền gradient. */
export function Chip({
  active = false,
  className,
  ...rest
}: { active?: boolean } & ComponentProps<typeof Link>) {
  return (
    <Link
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full px-5 text-[15px] no-underline transition",
        active
          ? "bg-brand font-bold text-ink hover:text-ink"
          : "border border-line bg-surface font-semibold text-fg hover:border-fg/30 hover:text-fg",
        className,
      )}
      {...rest}
    />
  );
}

/** Nhãn thể loại nhỏ (chỉ đọc). */
export function GenreTag({ children, className }: { children: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border border-line px-3 py-1.5 text-sm text-fg-soft",
        className,
      )}
    >
      {children}
    </span>
  );
}
