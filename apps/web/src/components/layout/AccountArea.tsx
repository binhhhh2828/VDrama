"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useSession } from "@/components/session/SessionProvider";
import { ButtonLink } from "@/components/ui/Button";
import {
  BookmarkIcon,
  CrownIcon,
  GridIcon,
  HistoryIcon,
  LogOutIcon,
  UserIcon,
} from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";

/** Góc phải header: khách thấy Sign in + Get VIP; đã đăng nhập thấy avatar có menu. */
export function AccountArea() {
  const session = useSession();

  if (session.status === "loading") {
    return <Skeleton className="h-11 w-20 shrink-0 rounded-full md:w-[168px]" />;
  }

  // Ẩn/hiện theo cỡ màn hình đặt ở thẻ bọc: class `hidden` đặt thẳng lên nút bị `inline-flex`
  // của nút đè mất.
  if (session.status === "guest") {
    return (
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="hidden sm:contents">
          <ButtonLink href="/signin" variant="secondary" size="sm">
            Sign in
          </ButtonLink>
        </span>
        <span className="hidden md:contents">
          <ButtonLink href="/vip" size="sm">
            Get VIP
          </ButtonLink>
        </span>
        <span className="contents md:hidden">
          <MobileVipPill />
        </span>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2.5">
      {session.user.is_vip ? null : (
        <span className="hidden md:contents">
          <ButtonLink href="/vip" size="sm">
            Get VIP
          </ButtonLink>
        </span>
      )}
      <UserMenu />
    </div>
  );
}

/** Nút VIP vàng nhỏ trên header điện thoại (theo bảng mobile của canvas). */
function MobileVipPill() {
  return (
    <Link
      href="/vip"
      className="inline-flex min-h-11 items-center rounded-full bg-vip px-3.5 text-[13px] font-extrabold text-vip-ink no-underline hover:text-vip-ink"
    >
      VIP
    </Link>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function UserMenu() {
  const session = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (session.status !== "user") return null;
  const { user } = session;

  const item =
    "flex min-h-11 items-center gap-3 rounded-input px-3 text-[15px] font-medium text-fg no-underline hover:bg-surface-2 hover:text-fg";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${user.display_name}`}
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-11 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-ink"
      >
        {initials(user.display_name)}
        {user.is_vip ? (
          <span className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full border-2 border-canvas bg-vip text-vip-ink">
            <CrownIcon size={11} strokeWidth={2.5} />
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute top-[calc(100%+8px)] right-0 z-30 w-64 rounded-card border border-line bg-surface p-2 shadow-2xl shadow-black/50"
        >
          <div className="border-b border-line px-3 pt-2 pb-3">
            <p className="truncate font-semibold">{user.display_name}</p>
            <p className="truncate text-[13px] text-muted">{user.email}</p>
            {user.is_vip ? (
              <p className="mt-1.5 text-[13px] font-semibold text-vip">
                VIP until {formatDate(user.vip_expires_at)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col pt-2" onClick={() => setOpen(false)}>
            <Link role="menuitem" href="/account" className={item}>
              <UserIcon size={18} /> Account
            </Link>
            <Link role="menuitem" href="/account/list" className={item}>
              <BookmarkIcon size={18} /> My List
            </Link>
            <Link role="menuitem" href="/account/history" className={item}>
              <HistoryIcon size={18} /> Watch history
            </Link>
            {user.role === "admin" ? (
              <Link role="menuitem" href="/admin" className={item}>
                <GridIcon size={18} /> Admin
              </Link>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className={`${item} w-full text-left`}
              onClick={async () => {
                await session.signOut();
                router.push("/");
                router.refresh();
              }}
            >
              <LogOutIcon size={18} /> Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
