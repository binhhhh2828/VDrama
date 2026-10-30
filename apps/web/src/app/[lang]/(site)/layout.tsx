import { SiteShell } from "@/components/layout/SiteShell";

// Mọi trang người xem (trang chủ, phim, tài khoản...) nằm trong nhóm (site). Admin có khung riêng.
export default function SiteLayout({ children }: LayoutProps<"/[lang]">) {
  return <SiteShell>{children}</SiteShell>;
}
