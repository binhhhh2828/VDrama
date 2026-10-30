import { Suspense } from "react";
import { AccountArea } from "./AccountArea";
import { BrandLink, SkipLink } from "./BrandLink";
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
      <SkipLink />
      <div className="mx-auto flex h-[58px] max-w-[1360px] items-center pr-[17px] pl-1 sm:pl-3 md:gap-6 md:px-6">
        <MenuDrawer />
        <BrandLink />
        <NavLinks />
        <Suspense fallback={<SearchForm />}>
          <HeaderSearch />
        </Suspense>
        <AccountArea />
      </div>
    </HeaderBar>
  );
}
