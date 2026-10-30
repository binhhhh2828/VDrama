"use client";

import { cn } from "@/lib/cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Link } from "@/components/i18n/navigation";

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
  const t = useT();
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 pr-1 sm:pl-0",
        size === "lg" ? "pl-4" : "pl-1.5",
      )}
    >
      <h2
        id={id}
        className={cn(size === "lg" ? "text-xl leading-7 font-semibold" : "text-base font-bold")}
      >
        {title}
      </h2>
      {href ? (
        <Link href={href} className="text-[13px] font-medium no-underline">
          {t("home.seeAll")}
        </Link>
      ) : null}
    </div>
  );
}
