import Link from "next/link";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy";

/**
 * Tiêu đề hàng theo NetShort. `lg` (trang chủ, ảnh 02, 03): 24px đậm vừa, thụt vào hơn thẻ phim
 * (x=32 trong khi thẻ ở x=22; ảnh NetShort lệch 21px, VDrama chủ động lệch ít hơn). `sm` (trang xem,
 * ảnh 11): 16px đậm, thẳng hàng với thẻ. Có `href` thì thêm link "See all" bên phải.
 */
export function SectionHeader({
  id,
  title,
  href,
  size = "lg",
}: {
  id: string;
  title: string;
  href?: string;
  size?: "lg" | "sm";
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 pr-1 sm:pl-0",
        size === "lg" ? "pl-4" : "pl-1.5",
      )}
    >
      <h2
        id={id}
        className={cn(size === "lg" ? "text-2xl leading-8 font-semibold" : "text-base font-bold")}
      >
        {title}
      </h2>
      {href ? (
        <Link href={href} className="text-sm font-medium no-underline">
          {copy.home.seeAll}
        </Link>
      ) : null}
    </div>
  );
}
