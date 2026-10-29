"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/cn";
import { MAIN_NAV, isActive } from "./nav";

const base = "px-3.5 py-2.5 text-[15px] font-medium no-underline border-b-2 transition";

function Links({ pathname }: { pathname: string | null }) {
  return (
    <>
      {MAIN_NAV.map((item) => {
        const active = pathname !== null && isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              base,
              active
                ? "border-pink text-fg hover:text-fg"
                : "border-transparent text-muted hover:text-fg",
            )}
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/vip"
        aria-current={pathname !== null && isActive(pathname, "/vip") ? "page" : undefined}
        className={cn(
          base,
          "text-vip hover:text-vip",
          pathname !== null && isActive(pathname, "/vip") ? "border-vip" : "border-transparent",
        )}
      >
        VIP
      </Link>
    </>
  );
}

function ActiveLinks() {
  return <Links pathname={usePathname()} />;
}

/** Menu ngang trên desktop. Đường dẫn hiện tại chỉ biết lúc request nên phần tô đậm nằm trong Suspense. */
export function NavLinks() {
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      <Suspense fallback={<Links pathname={null} />}>
        <ActiveLinks />
      </Suspense>
    </nav>
  );
}
