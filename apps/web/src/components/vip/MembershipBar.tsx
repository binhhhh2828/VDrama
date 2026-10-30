"use client";

import { useSession } from "@/components/session/SessionProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import { formatDate } from "@/lib/format";
import { Link } from "@/components/i18n/navigation";

/** Dải "gói của bạn" trên trang VIP (đọc /me trên trình duyệt). */
export function MembershipBar() {
  const t = useT();
  const locale = useLocale();
  const session = useSession();
  if (session.status === "loading") return <Skeleton className="h-[62px] rounded-2xl" />;

  const box = "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4";
  if (session.status === "guest") {
    return (
      <section aria-label={t("membership.label")} className={`${box} border-line bg-surface`}>
        <span className="text-[15px]">{t("membership.guest")}</span>
        <Link href="/signup?next=%2Fvip" className="text-sm font-semibold">
          {t("auth.signinSwitchLink")}
        </Link>
      </section>
    );
  }
  const { user } = session;
  return user.is_vip ? (
    <section aria-label={t("membership.label")} className={`${box} border-vip-line bg-vip-panel`}>
      <span className="text-[15px] font-semibold text-vip">
        {t("membership.vipUntil", { date: formatDate(user.vip_expires_at, locale) })}
      </span>
      <span className="text-sm text-muted">{t("membership.stack")}</span>
    </section>
  ) : (
    <section aria-label={t("membership.label")} className={`${box} border-line bg-surface`}>
      <span className="text-[15px]">{t("membership.notVip")}</span>
      {user.vip_expires_at ? (
        <span className="text-sm text-muted">
          {t("membership.ended", { date: formatDate(user.vip_expires_at, locale) })}
        </span>
      ) : null}
    </section>
  );
}
