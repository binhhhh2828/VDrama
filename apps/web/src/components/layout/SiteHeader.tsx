import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { AccountArea } from "./AccountArea";
import { HeaderBar } from "./HeaderBar";
import { HeaderSearch, SearchForm } from "./HeaderSearch";
import { MenuDrawer } from "./MenuDrawer";
import { NavLinks } from "./NavLinks";

/**
 * Header theo NetShort mobile (ảnh 01, 02, 04): cao 58px, không có nền riêng, nội dung cuộn phía sau;
 * chỉ ô tìm kiếm có nền. Ô tìm kiếm là form GET thường tới /search (chạy cả khi chưa có JS).
 */
export function SiteHeader() {
  return (
    <HeaderBar>
      <a
        href="#main"
        className="sr-only rounded-full bg-fg px-4 py-2 text-ink focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-40"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-[58px] max-w-[1360px] items-center pr-[17px] pl-1 sm:pl-3 md:gap-6 md:px-6">
        <MenuDrawer />
        <Link href="/" aria-label="VDrama home" className="ml-0.5 shrink-0 leading-none md:ml-0">
          <Logo height={24} preload className="h-6 w-auto md:h-8" />
        </Link>
        <NavLinks />
        <Suspense fallback={<SearchForm />}>
          <HeaderSearch />
        </Suspense>
        <AccountArea />
      </div>
    </HeaderBar>
  );
}
