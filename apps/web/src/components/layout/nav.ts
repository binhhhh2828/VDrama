// Menu của site người xem: ngăn kéo (điện thoại), menu ngang (desktop) và chân trang.

import { copy } from "@/lib/copy";

export type NavItem = { href: string; label: string };

/** Menu ngang trên header desktop (VIP vẽ riêng màu vàng). */
export const MAIN_NAV: NavItem[] = [
  { href: "/", label: copy.nav.home },
  { href: "/browse", label: copy.nav.browse },
  { href: "/account/list", label: copy.nav.myList },
];

/** Các nhóm accordion ở chân trang. */
export const FOOTER_GROUPS: { title: string; links: NavItem[] }[] = [
  {
    title: copy.footer.about,
    links: [
      { href: "/terms", label: "Terms of Use" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/refunds", label: "Refund Policy" },
    ],
  },
  {
    title: copy.footer.contact,
    links: [{ href: "/contact", label: "Contact us" }],
  },
  {
    title: copy.footer.explore,
    links: [
      { href: "/browse", label: "Browse all series" },
      { href: "/vip", label: "VIP plans" },
      { href: "/account/history", label: "Watch history" },
    ],
  },
];

/** Link có đang được chọn không: "/" chỉ khớp đúng trang chủ, link khác khớp cả trang con. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Trong một danh sách link, link khớp dài nhất là link đang chọn ("/account/list" thắng "/account"). */
export function activeHref(pathname: string, hrefs: string[]): string | null {
  const matches = hrefs.filter((h) => isActive(pathname, h));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}
