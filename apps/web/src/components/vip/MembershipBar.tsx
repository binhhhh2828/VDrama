"use client";

import { useSession } from "@/components/session/SessionProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { Link } from "@/components/i18n/navigation";

/** Dải "gói của bạn" trên trang VIP (đọc /me trên trình duyệt). */
export function MembershipBar() {
  const session = useSession();
  if (session.status === "loading") return <Skeleton className="h-[62px] rounded-2xl" />;

  const box = "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4";
  if (session.status === "guest") {
    return (
      <section aria-label="Your membership" className={`${box} border-line bg-surface`}>
        <span className="text-[15px]">
          The first episodes of every series are free with an account.
        </span>
        <Link href="/signup?next=%2Fvip" className="text-sm font-semibold">
          Create a free account
        </Link>
      </section>
    );
  }
  const { user } = session;
  return user.is_vip ? (
    <section aria-label="Your membership" className={`${box} border-vip-line bg-vip-panel`}>
      <span className="text-[15px] font-semibold text-vip">
        You&apos;re VIP until {formatDate(user.vip_expires_at)}
      </span>
      <span className="text-sm text-muted">Buying another plan adds its days on top.</span>
    </section>
  ) : (
    <section aria-label="Your membership" className={`${box} border-line bg-surface`}>
      <span className="text-[15px]">
        You&apos;re not a VIP member yet. The first episodes of each series stay free.
      </span>
      {user.vip_expires_at ? (
        <span className="text-sm text-muted">
          Your last plan ended {formatDate(user.vip_expires_at)}.
        </span>
      ) : null}
    </section>
  );
}
