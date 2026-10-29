import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { SearchIcon } from "@/components/ui/icons";
import { AccountArea } from "./AccountArea";
import { NavLinks } from "./NavLinks";

/** Header site người xem. Ô tìm kiếm là form GET thường tới /search (chạy cả khi chưa có JS). */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/92 backdrop-blur">
      <a
        href="#main"
        className="sr-only rounded-full bg-fg px-4 py-2 text-ink focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-30"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-[1360px] items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6 md:gap-7 md:py-3.5">
        <Link href="/" aria-label="VDrama home" className="shrink-0 leading-none">
          <Logo height={40} preload className="h-[34px] w-auto md:h-10" />
        </Link>
        <NavLinks />
        <form
          role="search"
          action="/search"
          className="ml-auto hidden h-11 max-w-[420px] min-w-[200px] flex-1 items-center gap-2.5 rounded-full border border-line bg-surface px-4 focus-within:border-link md:flex"
        >
          <SearchIcon size={18} className="shrink-0 text-muted" />
          <label htmlFor="site-search" className="sr-only">
            Search series
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            minLength={2}
            maxLength={100}
            placeholder="Search series, genres…"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-faint"
          />
        </form>
        <Link
          href="/search"
          aria-label="Search"
          className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-fg hover:text-fg md:hidden"
        >
          <SearchIcon size={18} />
        </Link>
        <AccountArea />
      </div>
    </header>
  );
}
