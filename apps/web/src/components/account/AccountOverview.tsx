"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { useSession } from "@/components/session/SessionProvider";
import { useVipSheet } from "@/components/vip/VipSheetProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import {
  BookmarkIcon,
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  CrownIcon,
  GridIcon,
  HeadsetIcon,
  HistoryIcon,
  InfoIcon,
  LockIcon,
  LogOutIcon,
  UserIcon,
} from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import type { User } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { DeleteAccountRow } from "./DeleteAccountRow";

const DAY = 86_400_000;

function daysLeft(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / DAY));
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / DAY));
}

const VIP_PERKS_SHORT = ["All episodes", "No ads", "Full HD 1080p", "2 devices"];

/**
 * Trang tài khoản theo NetShort (ảnh 06 và 20): avatar + tên + mã tài khoản, thẻ VIP vàng, thẻ "My VIP"
 * (thay thẻ Ví vì VDrama chưa có xu), các hàng liên kết, nút Sign in (khách) hoặc Sign out ở đáy.
 * Khách vẫn xem được trang này; các hàng cần đăng nhập chỉ hiện sau khi đăng nhập.
 */
export function AccountOverview() {
  const session = useSession();
  const vipSheet = useVipSheet();
  const router = useRouter();

  if (session.status === "loading") {
    return (
      <div className="flex flex-col gap-4 px-[13px]" aria-busy="true">
        <Skeleton className="h-[72px] w-2/3" />
        <Skeleton className="h-[155px] rounded-[20px]" />
        <Skeleton className="h-[140px] rounded-[20px]" />
      </div>
    );
  }

  const user = session.status === "user" ? session.user : null;

  return (
    <div className="flex min-h-[calc(100dvh-58px)] flex-col px-[13px] pb-8">
      <Profile user={user} />
      <VipCard user={user} onOpen={vipSheet.open} />
      <MyVipCard user={user} onOpen={vipSheet.open} />

      <ul className="mt-3 flex flex-col">
        {user ? (
          <>
            <Row href="/account/list" icon={BookmarkIcon}>
              My List
            </Row>
            <Row href="/account/history" icon={HistoryIcon}>
              Watch history
            </Row>
          </>
        ) : null}
        <Row href="/contact" icon={HeadsetIcon}>
          Contact us
        </Row>
        {user && !user.email_verified ? (
          <Row href="/verify-email" icon={InfoIcon}>
            Verify email
          </Row>
        ) : null}
        {user ? (
          <Row href="/forgot-password" icon={LockIcon}>
            Change password
          </Row>
        ) : null}
        {user?.role === "admin" ? (
          <Row href="/admin" icon={GridIcon}>
            Admin
          </Row>
        ) : null}
        {user ? <DeleteAccountRow /> : null}
      </ul>

      <div className="mt-auto flex justify-center pt-10">
        {user ? (
          <Button
            variant="secondary"
            className="h-12 w-full max-w-[400px] border-fg/30 bg-transparent text-lg"
            onClick={async () => {
              await session.signOut();
              router.push("/");
              router.refresh();
            }}
          >
            <LogOutIcon size={20} /> Sign out
          </Button>
        ) : (
          <ButtonLink
            href="/signin?next=%2Faccount"
            className="h-12 w-full max-w-[400px] bg-linear-to-r from-accent to-[#fe4f32] text-lg"
          >
            Sign in
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

function Profile({ user }: { user: User | null }) {
  const [copied, setCopied] = useState(false);
  const uid = user ? `UID:${user.id}` : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(String(user?.id ?? ""));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // trình duyệt chặn clipboard: bỏ qua
    }
  }

  return (
    <div className="flex items-center gap-3.5 pt-2">
      <span className="flex size-[72px] shrink-0 items-center justify-center rounded-full border border-fg/15 bg-fg/10 text-fg-soft">
        {user ? (
          <span className="text-[28px] font-semibold text-fg">
            {user.display_name.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <UserIcon size={34} />
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[28px] leading-9 font-semibold">
          {user ? user.display_name : "Visitor"}
        </p>
        {uid ? (
          <p className="flex items-center text-[15px] text-muted">
            {uid}
            <button
              type="button"
              aria-label={copied ? "Copied" : "Copy account ID"}
              onClick={copy}
              className="hit-44 relative ml-2 flex size-6 items-center justify-center text-muted hover:text-fg"
            >
              {copied ? <CheckIcon size={16} className="text-success" /> : <CopyIcon size={16} />}
            </button>
          </p>
        ) : (
          <p className="text-[15px] text-muted">Sign in to save your list</p>
        )}
      </div>
    </div>
  );
}

/** Thẻ VIP vàng: "Activate" mở bảng VIP; đã là VIP thì ghi ngày hết hạn và nút "Extend". */
function VipCard({ user, onOpen }: { user: User | null; onOpen: () => void }) {
  const isVip = user?.is_vip === true;
  return (
    <section
      aria-labelledby="vip-card-h"
      className="mt-5 rounded-[20px] bg-vip-gold p-[14px] pb-3 text-vip-ink"
    >
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 id="vip-card-h" className="flex items-center gap-2 text-[22px] leading-8 font-bold">
            <CrownIcon size={22} strokeWidth={2.2} /> VDrama VIP
          </h2>
          <p className="mt-0.5 text-[15px]">
            {isVip ? `Active until ${formatDate(user?.vip_expires_at)}` : "Exclusive perks"}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="hit-44 relative h-11 shrink-0 rounded-full bg-vip-ink/90 px-5 text-lg text-vip"
        >
          {isVip ? "Extend" : "Activate"}
        </button>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-[14px] bg-white/25 px-3.5 py-2.5 text-[15px]">
        {VIP_PERKS_SHORT.map((perk) => (
          <li key={perk} className="flex items-center gap-2">
            <CheckIcon size={16} strokeWidth={2.6} className="shrink-0" />
            <span className="truncate">{perk}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Thẻ thay cho thẻ Ví: số ngày VIP còn lại và số ngày đã ở cùng VDrama. */
function MyVipCard({ user, onOpen }: { user: User | null; onOpen: () => void }) {
  const left = user ? daysLeft(user.vip_expires_at) : null;
  const member = user ? daysSince(user.created_at) : null;
  return (
    <section aria-labelledby="my-vip-h" className="mt-3 rounded-[20px] bg-wallet p-[14px] pb-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 id="my-vip-h" className="text-[22px] leading-8 font-semibold">
          My VIP
        </h2>
        <Button variant="gradient" size="sm" className="h-11 px-5 text-lg" onClick={onOpen}>
          {user?.is_vip ? "Extend VIP" : "Get VIP"}
        </Button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 px-1">
        <Stat value={left} label="Days left" />
        <Stat value={member} label="Days with us" />
      </dl>
    </section>
  );
}

function Stat({ value, label }: { value: number | null; label: string }) {
  return (
    <div>
      <dd className="order-1 text-[32px] leading-10 font-medium text-[#ffb53a]">
        {value === null ? "–" : value}
      </dd>
      <dt className="text-[15px] text-muted">{label}</dt>
    </div>
  );
}

/** Hàng liên kết: biểu tượng 24px + chữ 22px + mũi tên (ảnh 06). */
export function Row({
  href,
  icon: Icon,
  children,
  className,
}: {
  href: string;
  icon: ComponentType<{ size?: number }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex min-h-14 items-center gap-3.5 px-1 text-[22px] text-fg no-underline hover:text-fg",
          className,
        )}
      >
        <Icon size={24} />
        <span className="min-w-0 flex-1 truncate">{children}</span>
        <ChevronRightIcon size={18} className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}
