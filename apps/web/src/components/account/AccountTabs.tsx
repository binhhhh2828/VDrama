"use client";

import { useT } from "@/components/i18n/I18nProvider";
import { cn } from "@/lib/cn";
import { Link, usePathname } from "@/components/i18n/navigation";

const TABS = [
  { href: "/account", key: "account.overview" },
  { href: "/account/list", key: "nav.myList" },
  { href: "/account/history", key: "footer.history" },
] as const;

export function AccountTabs() {
  const t = useT();
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("account.sections")}
      className="-mx-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line px-4 sm:mx-0 sm:px-0"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3.5 py-3 text-[15px] font-semibold whitespace-nowrap no-underline",
              active
                ? "border-accent text-fg hover:text-fg"
                : "border-transparent text-muted hover:text-fg",
            )}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
