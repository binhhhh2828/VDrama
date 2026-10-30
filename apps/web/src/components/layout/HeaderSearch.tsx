"use client";

import { SearchIcon } from "@/components/ui/icons";
import { localePath } from "@/lib/i18n/paths";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import { usePathname, useSearchParams } from "@/components/i18n/navigation";

/** Ô tìm kiếm viên thuốc 183×36 ở header. Là form GET thường tới /search (chạy cả khi chưa có JS). */
export function SearchForm({
  defaultValue = "",
  autoFocus = false,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  const locale = useLocale();
  const t = useT();
  return (
    <form
      role="search"
      action={localePath(locale, "/search")}
      className="ml-auto flex h-8 max-w-[150px] min-w-0 flex-1 items-center gap-1.5 rounded-full bg-surface-2 px-3 focus-within:ring-2 focus-within:ring-link md:max-w-[360px]"
    >
      <SearchIcon size={16} className="shrink-0 text-muted" />
      <label htmlFor="site-search" className="sr-only">
        {t("nav.searchLabel")}
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
        placeholder={t("nav.search")}
        className="-my-1 h-11 min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-muted"
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
