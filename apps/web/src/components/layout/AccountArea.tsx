"use client";

import { useSession } from "@/components/session/SessionProvider";
import { CrownIcon, UserIcon } from "@/components/ui/icons";
import { copy } from "@/lib/copy";
import { Link } from "@/components/i18n/navigation";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

const ring =
  "hit-44 relative ml-2.5 flex size-7 shrink-0 items-center justify-center rounded-full no-underline";

/**
 * Avatar tròn 28px sát phải header (ảnh 01), mở trang tài khoản. Khách (và lúc đang tải phiên) thấy
 * avatar xám; đã đăng nhập thấy chữ viết tắt, VIP có thêm vương miện nhỏ.
 */
export function AccountArea() {
  const session = useSession();

  if (session.status !== "user") {
    return (
      <Link
        href="/account"
        aria-label={copy.nav.account}
        className={`${ring} border border-fg/25 bg-surface-2 text-muted hover:text-fg`}
      >
        <UserIcon size={16} />
      </Link>
    );
  }

  const { user } = session;
  return (
    <Link
      href="/account"
      aria-label={`${copy.nav.account}: ${user.display_name}`}
      className={`${ring} bg-brand text-[11px] font-bold text-on-accent hover:text-on-accent`}
    >
      {initials(user.display_name)}
      {user.is_vip ? (
        <span className="absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full border border-canvas bg-vip text-vip-ink">
          <CrownIcon size={8} strokeWidth={3} />
        </span>
      ) : null}
    </Link>
  );
}
