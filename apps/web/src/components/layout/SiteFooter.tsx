import Link from "next/link";
import { ChevronDownIcon } from "@/components/ui/icons";
import { copy } from "@/lib/copy";
import { FOOTER_GROUPS } from "./nav";

/**
 * Chân trang theo ảnh 04: đường kẻ, các hàng accordion (chữ 18px, mũi tên xuống), dòng bản quyền xám.
 * Accordion dùng `<details>` nên chạy cả khi chưa có JS. Không có phần tải app và mạng xã hội
 * (VDrama chưa có).
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1360px] px-[13px] pt-3 pb-6 sm:px-6">
        <div className="border-b border-line pb-2">
          {FOOTER_GROUPS.map((group) => (
            <details key={group.title} className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm text-fg [&::-webkit-details-marker]:hidden">
                {group.title}
                <ChevronDownIcon
                  size={16}
                  className="text-muted transition-transform group-open:rotate-180"
                />
              </summary>
              <ul className="flex flex-col pb-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="flex min-h-10 items-center text-[13px] text-muted no-underline hover:text-fg"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
        <p className="pt-6 text-center text-xs text-muted">{copy.footer.rights}</p>
      </div>
    </footer>
  );
}
