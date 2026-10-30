import Link from "next/link";

export type Crumb = { label: string; href?: string };

/**
 * Đường dẫn "Home > Series > tên phim" (ảnh 10, 15, 18): chữ xám 15px, mục cuối (trang hiện tại) màu
 * sáng. Truyền tên phim đã viết thường nếu muốn giống ảnh.
 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="pt-3 pb-3.5 text-[15px] text-muted">
      <ol className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li
              key={item.label}
              aria-current={last ? "page" : undefined}
              className={last ? "text-fg" : ""}
            >
              {item.href && !last ? (
                <Link href={item.href} className="text-muted no-underline hover:text-fg">
                  {item.label}
                </Link>
              ) : (
                item.label
              )}
              {!last ? (
                <span aria-hidden className="ml-2.5">
                  &gt;
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
