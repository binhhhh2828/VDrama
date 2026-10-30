"use client";

import { cn } from "@/lib/cn";
import { Link, usePathname } from "@/components/i18n/navigation";

const TABS = [
  { href: "/account", label: "Overview" },
  { href: "/account/list", label: "My List" },
  { href: "/account/history", label: "Watch history" },
];

export function AccountTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Account sections"
      className="-mx-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line px-4 sm:mx-0 sm:px-0"
    >
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3.5 py-3 text-[15px] font-semibold whitespace-nowrap no-underline",
              active
                ? "border-accent text-fg hover:text-fg"
                : "border-transparent text-muted hover:text-fg",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
