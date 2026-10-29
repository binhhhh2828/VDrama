"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import type { ComponentType } from "react";
import { BookmarkIcon, GridIcon, HomeIcon, UserIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { isActive } from "./nav";

const ITEMS: Array<{ href: string; label: string; Icon: ComponentType<{ size?: number }> }> = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/browse", label: "Browse", Icon: GridIcon },
  { href: "/account/list", label: "My List", Icon: BookmarkIcon },
  { href: "/account", label: "Account", Icon: UserIcon },
];

function activeHref(pathname: string): string | null {
  // "/account/list" khớp My List, không tô cả Account.
  const matches = ITEMS.filter((i) => isActive(pathname, i.href));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

function Items({ pathname }: { pathname: string | null }) {
  const current = pathname === null ? null : activeHref(pathname);
  return (
    <>
      {ITEMS.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={current === href ? "page" : undefined}
          className={cn(
            "flex min-h-12 flex-col items-center justify-center gap-1 text-xs no-underline",
            current === href ? "font-bold text-link" : "font-semibold text-muted hover:text-fg",
          )}
        >
          <Icon size={22} />
          {label}
        </Link>
      ))}
    </>
  );
}

function ActiveItems() {
  return <Items pathname={usePathname()} />;
}

/** Thanh điều hướng dưới đáy, chỉ trên điện thoại. */
export function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-canvas/96 px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),10px)] backdrop-blur md:hidden"
    >
      <Suspense fallback={<Items pathname={null} />}>
        <ActiveItems />
      </Suspense>
    </nav>
  );
}
