// Menu của site người xem: ngăn kéo (điện thoại), menu ngang (desktop) và chân trang.

import type { T } from "@/lib/i18n/translate";

export type NavItem = { href: string; label: string };

/** Menu ngang trên header desktop (VIP vẽ riêng màu vàng). */
export function mainNav(t: T): NavItem[] {
  return [
    { href: "/", label: t("nav.home") },
    { href: "/browse", label: t("nav.browse") },
    { href: "/account/list", label: t("nav.myList") },
  ];
}

/** Các nhóm accordion ở chân trang. */
export function footerGroups(t: T): { title: string; links: NavItem[] }[] {
  return [
    {
      title: t("footer.about"),
      links: [
        { href: "/terms", label: t("footer.terms") },
        { href: "/privacy", label: t("footer.privacy") },
        { href: "/refunds", label: t("footer.refunds") },
      ],
    },
    {
      title: t("footer.contact"),
      links: [{ href: "/contact", label: t("footer.contact") }],
    },
    {
      title: t("footer.explore"),
      links: [
        { href: "/browse", label: t("footer.browseAll") },
        { href: "/vip", label: t("footer.vipPlans") },
        { href: "/account/history", label: t("footer.history") },
      ],
    },
  ];
}

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
