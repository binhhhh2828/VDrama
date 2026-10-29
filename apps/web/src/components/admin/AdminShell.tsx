"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { useSession } from "@/components/session/SessionProvider";
import { ButtonLink } from "@/components/ui/Button";
import {
  BookmarkIcon,
  CrownIcon,
  GridIcon,
  HistoryIcon,
  HomeIcon,
  LockIcon,
  UserIcon,
} from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { RequireUser } from "@/components/account/RequireUser";

type Item = {
  href: string;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  preview?: boolean;
};

const NAV: Item[] = [
  { href: "/admin", label: "Overview", Icon: HomeIcon, preview: true },
  { href: "/admin/series", label: "Series & episodes", Icon: GridIcon },
  { href: "/admin/users", label: "Users", Icon: UserIcon, preview: true },
  { href: "/admin/payments", label: "Payments", Icon: BookmarkIcon, preview: true },
  { href: "/admin/plans", label: "VIP plans", Icon: CrownIcon, preview: true },
  { href: "/admin/audit", label: "Audit log", Icon: HistoryIcon, preview: true },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

/**
 * Khung trang admin: thanh bên (desktop) / thanh trên cuộn ngang (điện thoại).
 * Chặn ở giao diện theo /me.role. Đây chỉ là trải nghiệm: quyền thật do API kiểm tra (AdminUser).
 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AdminTopBar />
      <RequireUser>
        <AdminOnly>
          <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col md:flex-row">
            <AdminNav />
            <main id="main" className="min-w-0 flex-1 px-4 pt-5 pb-16 sm:px-6 md:pt-8">
              {children}
            </main>
          </div>
        </AdminOnly>
      </RequireUser>
    </div>
  );
}

function AdminTopBar() {
  const session = useSession();
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/admin" aria-label="VDrama admin home" className="leading-none">
          <Logo height={32} className="h-7 w-auto sm:h-8" />
        </Link>
        <span className="rounded-tag bg-fg/10 px-2 py-1 text-[11px] font-extrabold tracking-[0.12em]">
          ADMIN
        </span>
        <span className="flex-1" />
        {session.status === "user" ? (
          <span className="hidden text-sm text-muted sm:inline">{session.user.display_name}</span>
        ) : null}
        <Link href="/" className="text-sm font-semibold">
          View site
        </Link>
      </div>
    </header>
  );
}

function AdminNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Admin"
      className="-mb-px flex shrink-0 gap-1 overflow-x-auto border-b border-line px-3 py-2 md:w-[240px] md:flex-col md:overflow-visible md:border-r md:border-b-0 md:px-4 md:py-8"
    >
      {NAV.map(({ href, label, Icon, preview }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-3 rounded-input px-3 text-[15px] font-semibold whitespace-nowrap no-underline",
              active
                ? "bg-pink/14 text-fg hover:text-fg"
                : "text-muted hover:bg-fg/6 hover:text-fg",
            )}
          >
            <Icon size={18} />
            <span className="flex-1">{label}</span>
            {preview ? (
              <span
                className="hidden text-[10px] font-extrabold tracking-[0.08em] text-vip/80 md:inline"
                title="Preview data"
              >
                PREVIEW
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function AdminOnly({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session.status !== "user") return <Skeleton className="m-6 h-64" />;
  if (session.user.role !== "admin") {
    return (
      <main
        id="main"
        className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-fg/8 text-muted">
          <LockIcon size={26} />
        </span>
        <h1 className="text-2xl font-extrabold">Admins only</h1>
        <p className="text-muted">
          You&apos;re signed in as {session.user.email}, which doesn&apos;t have admin access.
        </p>
        <ButtonLink href="/" variant="secondary" size="sm">
          Back to VDrama
        </ButtonLink>
      </main>
    );
  }
  return <>{children}</>;
}
