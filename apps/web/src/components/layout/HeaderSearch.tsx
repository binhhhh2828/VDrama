"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SearchIcon } from "@/components/ui/icons";
import { copy } from "@/lib/copy";

/** Ô tìm kiếm viên thuốc 183×36 ở header. Là form GET thường tới /search (chạy cả khi chưa có JS). */
export function SearchForm({
  defaultValue = "",
  autoFocus = false,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  return (
    <form
      role="search"
      action="/search"
      className="ml-auto flex h-9 max-w-[183px] min-w-0 flex-1 items-center gap-2 rounded-full bg-surface-2 px-3 focus-within:ring-2 focus-within:ring-link md:max-w-[360px]"
    >
      <SearchIcon size={18} className="shrink-0 text-muted" />
      <label htmlFor="site-search" className="sr-only">
        {copy.nav.searchLabel}
      </label>
      {/* Ô nhập cao 44px (tràn khỏi viên thuốc 36px) để vùng bấm đủ lớn. */}
      <input
        id="site-search"
        name="q"
        type="search"
        minLength={2}
        maxLength={100}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder={copy.nav.search}
        className="-my-1 h-11 min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-muted"
      />
    </form>
  );
}

/**
 * Ở trang kết quả tìm kiếm, ô tìm kiếm giữ từ khóa đang tìm (ảnh 22); mở trang /search khi chưa có từ
 * khóa thì gõ được ngay. Cần `useSearchParams` nên phải nằm trong <Suspense>.
 */
export function HeaderSearch() {
  const pathname = usePathname();
  const params = useSearchParams();
  const onSearch = pathname === "/search";
  const q = onSearch ? (params.get("q") ?? "") : "";
  // `key`: tìm từ khóa mới thì ô nhập lấy lại giá trị mới.
  return <SearchForm key={q} defaultValue={q} autoFocus={onSearch && !q} />;
}
