"use client";

import { Suspense, useCallback, useEffect, useRef, type ComponentType } from "react";
import { Logo } from "@/components/brand/Logo";
import { useSession } from "@/components/session/SessionProvider";
import {
  CloseIcon,
  DownloadBoxIcon,
  GridIcon,
  MenuIcon,
  NewsIcon,
  PlaySquareIcon,
  ReelIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useT } from "@/components/i18n/I18nProvider";
import type { TKey } from "@/lib/i18n/translate";
import { activeHref } from "./nav";
import { LanguageRow } from "@/components/i18n/LanguageSheet";
import { Link, usePathname } from "@/components/i18n/navigation";

type Item = { href: string; label: string; Icon: ComponentType<{ size?: number }> };

// Bốn mục như ngăn kéo NetShort (ảnh 05): Home, Series (Phim bộ), Download (Tải xuống), News (Thông tin).
// My List, VIP và tài khoản nằm ở avatar và trang tài khoản.
const BASE_ITEMS: { href: string; key: TKey; Icon: Item["Icon"] }[] = [
  { href: "/", key: "nav.home", Icon: ReelIcon },
  { href: "/browse", key: "nav.browse", Icon: PlaySquareIcon },
  { href: "/download", key: "nav.download", Icon: DownloadBoxIcon },
  { href: "/news", key: "nav.news", Icon: NewsIcon },
];
const ADMIN_ITEM = { href: "/admin", key: "nav.admin", Icon: GridIcon } as const;

/** Vuốt sang trái quá chừng này (px) thì đóng ngăn kéo. */
const SWIPE_CLOSE = 60;

function Items({ pathname, items }: { pathname: string | null; items: Item[] }) {
  const current =
    pathname === null
      ? null
      : activeHref(
          pathname,
          items.map((i) => i.href),
        );
  return (
    <>
      {items.map(({ href, label, Icon }, i) => (
        <li key={href}>
          <Link
            href={href}
            aria-current={current === href ? "page" : undefined}
            className={cn(
              "mx-3.5 flex h-[81px] items-center gap-[18px] text-xl no-underline",
              i < items.length - 1 && "border-b border-line",
              current === href ? "text-accent hover:text-accent" : "text-fg hover:text-fg",
            )}
          >
            <span className="text-fg">
              <Icon size={24} />
            </span>
            {label}
          </Link>
        </li>
      ))}
    </>
  );
}

function ActiveItems({ items }: { items: Item[] }) {
  return <Items pathname={usePathname()} items={items} />;
}

/** Đóng ngăn kéo mỗi khi đổi trang (bấm link trong ngăn kéo, hoặc nút Back). */
function CloseOnNavigate({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onNavigate();
  }, [pathname, onNavigate]);
  return null;
}

/**
 * Nút hamburger + ngăn kéo menu bên trái (ảnh 05): rộng 82% màn hình, mỗi mục cao 81px, mục đang chọn
 * màu accent, nền sau phủ tối. Đóng bằng nút X, phím Esc, chạm nền phủ hoặc vuốt sang trái; khóa cuộn
 * trang khi mở (globals.css). Chỉ có trên điện thoại; desktop dùng menu ngang.
 */
export function MenuDrawer() {
  const session = useSession();
  const ref = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);

  const t = useT();
  const items: Item[] = (
    session.status === "user" && session.user.role === "admin"
      ? [...BASE_ITEMS, ADMIN_ITEM]
      : BASE_ITEMS
  ).map(({ href, key, Icon }) => ({ href, label: t(key), Icon }));

  const open = () => ref.current?.showModal();
  const close = useCallback(() => ref.current?.close(), []);

  return (
    <>
      <button
        type="button"
        aria-label={t("nav.openMenu")}
        aria-haspopup="dialog"
        onClick={open}
        className="flex size-11 shrink-0 items-center justify-center text-fg md:hidden"
      >
        <MenuIcon size={24} />
      </button>
      <dialog
        ref={ref}
        aria-label={t("nav.menu")}
        // Bấm vào nền phủ (::backdrop) thì sự kiện rơi vào chính thẻ dialog.
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start !== null && end !== undefined && start - end > SWIPE_CLOSE) close();
        }}
        className={cn(
          "fixed inset-y-0 right-auto left-0 m-0 h-dvh max-h-none w-[82%] max-w-[360px] bg-surface p-0 text-fg md:hidden",
          "backdrop:bg-black/60 backdrop:transition-opacity",
          "-translate-x-full transition-[translate,display,overlay] transition-discrete duration-250 ease-out",
          "open:translate-x-0 starting:open:-translate-x-full",
        )}
      >
        <Suspense fallback={null}>
          <CloseOnNavigate onNavigate={close} />
        </Suspense>
        <div className="flex h-[52px] items-center justify-between pr-1.5 pl-[17px]">
          <Logo height={22} className="h-[22px] w-auto" />
          <button
            type="button"
            aria-label={t("nav.closeMenu")}
            onClick={close}
            className="flex size-11 items-center justify-center text-fg"
          >
            <CloseIcon size={26} />
          </button>
        </div>
        <nav aria-label={t("nav.main")}>
          <ul>
            <Suspense fallback={<Items pathname={null} items={items} />}>
              <ActiveItems items={items} />
            </Suspense>
          </ul>
        </nav>
        <LanguageRow className="h-[72px] border-t border-line px-3.5 text-base" />
      </dialog>
    </>
  );
}
