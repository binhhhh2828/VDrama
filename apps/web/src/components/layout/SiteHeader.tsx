import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { SearchIcon } from "@/components/ui/icons";
import { copy } from "@/lib/copy";
import { AccountArea } from "./AccountArea";
import { HeaderBar } from "./HeaderBar";
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
        <form
          role="search"
          action="/search"
          className="ml-auto flex h-9 max-w-[183px] min-w-0 flex-1 items-center gap-2 rounded-full bg-surface-2 px-3 focus-within:ring-2 focus-within:ring-link md:max-w-[360px]"
        >
          <SearchIcon size={18} className="shrink-0 text-muted" />
          {/* Ô nhập cao 44px (tràn khỏi viên thuốc 36px) để vùng bấm đủ lớn. */}
          <label htmlFor="site-search" className="sr-only">
            {copy.nav.searchLabel}
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            minLength={2}
            maxLength={100}
            placeholder={copy.nav.search}
            className="-my-1 h-11 min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-muted"
          />
        </form>
        <AccountArea />
      </div>
    </HeaderBar>
  );
}
