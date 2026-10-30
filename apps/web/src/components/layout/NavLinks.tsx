"use client";

import { Suspense } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/components/i18n/I18nProvider";
import { mainNav, isActive } from "./nav";
import { Link, usePathname } from "@/components/i18n/navigation";

const base = "px-3.5 py-2.5 text-[15px] font-medium no-underline border-b-2 transition";

function Links({ pathname }: { pathname: string | null }) {
  const t = useT();
  return (
    <>
      {mainNav(t).map((item) => {
        const active = pathname !== null && isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              base,
              active
                ? "border-accent text-fg hover:text-fg"
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
        {t("nav.vip")}
      </Link>
    </>
  );
}

function ActiveLinks() {
  return <Links pathname={usePathname()} />;
}

/** Menu ngang trên desktop. Đường dẫn hiện tại chỉ biết lúc request nên phần tô đậm nằm trong Suspense. */
export function NavLinks() {
  const t = useT();
  return (
    <nav aria-label={t("nav.main")} className="hidden items-center gap-1 md:flex">
      <Suspense fallback={<Links pathname={null} />}>
        <ActiveLinks />
      </Suspense>
    </nav>
  );
}
