import Link from "next/link";
import { copy } from "@/lib/copy";

/**
 * Tiêu đề hàng trang chủ theo NetShort (ảnh 02, 03): 24px đậm vừa, thụt vào sâu hơn thẻ phim
 * (x=32 trong khi thẻ ở x=22; ảnh NetShort lệch 21px, VDrama chủ động lệch ít hơn). Có `href` thì thêm link "See all" bên phải.
 */
export function SectionHeader({ id, title, href }: { id: string; title: string; href?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 pr-1 pl-4 sm:pl-0">
      <h2 id={id} className="text-2xl leading-8 font-semibold">
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
