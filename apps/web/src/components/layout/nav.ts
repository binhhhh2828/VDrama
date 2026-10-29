// Menu chính của site người xem (header desktop và thanh dưới đáy trên điện thoại).

export type NavItem = { href: string; label: string };

export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/account/list", label: "My List" },
];

export const FOOTER_LINKS: NavItem[] = [
  { href: "/terms", label: "Terms of Use" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refunds", label: "Refund Policy" },
  { href: "/contact", label: "Contact" },
];

/** Link có đang được chọn không: "/" chỉ khớp đúng trang chủ, link khác khớp cả trang con. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
