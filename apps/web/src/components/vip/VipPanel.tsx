"use client";

import { useState } from "react";
import { useSession } from "@/components/session/SessionProvider";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon, CloseIcon, HeadsetIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { PREVIEW_PLANS } from "@/lib/preview-data";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import { Link, useRouter } from "@/components/i18n/navigation";

const PERK_KEYS = ["vip.perk1", "vip.perk2", "vip.perk3", "vip.perk4"] as const;
/** Bốn ý của "How VIP works" (ảnh 09), viết lại theo cách VDrama bán VIP. */
const GUIDE_KEYS = ["vip.guide1", "vip.guide2", "vip.guide3", "vip.guide4"] as const;

/**
 * Nội dung bảng VIP theo ảnh 08 và 09: tình trạng VIP + hỗ trợ + nút đóng, các gói (chọn một, viền
 * vàng), ghi chú không tự gia hạn, quyền lợi, hướng dẫn, rồi chọn cách thanh toán ở chân bảng.
 * PREVIEW: giá là giá mẫu; chọn "Bank transfer" chuyển sang trang thanh toán mẫu (chưa có API).
 * Dùng cho bottom sheet (có `onClose`) và cho trang /vip trên điện thoại (không có `onClose`).
 */
export function VipPanel({ onClose, className }: { onClose?: () => void; className?: string }) {
  const session = useSession();
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [planId, setPlanId] = useState(
    (PREVIEW_PLANS.find((p) => p.featured) ?? PREVIEW_PLANS[0]).id,
  );

  const user = session.status === "user" ? session.user : null;
  const status = user?.is_vip
    ? t("vip.activeUntil", { date: formatDate(user.vip_expires_at, locale) })
    : user
      ? t("vip.notVipStatus")
      : t("vip.signInStatus");

  function pay() {
    onClose?.();
    router.push(`/vip/checkout?plan=${planId}`);
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col bg-linear-to-b from-plum-2 via-canvas to-canvas to-[280px] text-fg",
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-[15px] text-fg-soft">{status}</p>
          <Link
            href="/contact"
            aria-label={t("vip.support")}
            className="hit-44 relative flex size-9 items-center justify-center text-fg-soft hover:text-fg"
          >
            <HeadsetIcon size={24} />
          </Link>
          {onClose ? (
            <button
              type="button"
              aria-label={t("common.close")}
              onClick={onClose}
              className="hit-44 relative flex size-9 items-center justify-center text-fg-soft hover:text-fg"
            >
              <CloseIcon size={22} />
            </button>
          ) : null}
        </div>

        <div role="radiogroup" aria-label={t("vip.plan")} className="mt-4 grid grid-cols-3 gap-2.5">
          {PREVIEW_PLANS.map((plan) => {
            const selected = plan.id === planId;
            return (
              <button
                key={plan.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPlanId(plan.id)}
                className={cn(
                  "relative flex min-h-[104px] flex-col items-start justify-center gap-1 rounded-[14px] border px-3 py-3 text-left transition",
                  selected
                    ? "border-vip bg-[#3a2e1c]"
                    : "border-vip-line/70 bg-linear-to-br from-[#2a2118] to-[#151210]",
                )}
              >
                {plan.featured ? (
                  <span className="absolute top-0 right-0 rounded-tr-[13px] rounded-bl-[10px] bg-accent px-2 py-0.5 text-[11px] font-semibold text-on-accent">
                    {t("vip.bestValue")}
                  </span>
                ) : null}
                <span className="text-[15px] font-semibold text-vip">
                  {t("vip.months", { n: plan.months })}
                </span>
                <span className="text-[22px] leading-7 font-bold">{plan.priceUsd}</span>
                <span className="text-[11px] text-muted">{t("vip.days", { n: plan.days })}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <span aria-hidden className="size-1 rounded-full bg-muted" />
          {t("vip.noRenew")}
        </p>

        <ul className="mt-5 flex flex-col">
          {PERK_KEYS.map((key) => (
            <li
              key={key}
              className="flex min-h-[52px] items-center gap-3 border-b border-fg/12 text-base"
            >
              <CheckIcon size={18} className="shrink-0 text-vip" strokeWidth={2.4} />
              {t(key)}
            </li>
          ))}
        </ul>

        <section aria-labelledby="vip-guide-h" className="mt-4">
          <h2 id="vip-guide-h" className="text-sm text-muted">
            {t("vip.howTitle")}
          </h2>
          <ol className="mt-2 flex flex-col gap-2 text-sm leading-6 text-muted">
            {GUIDE_KEYS.map((key, i) => (
              <li key={key}>
                {i + 1}. {t(key)}
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted">
          <Badge kind="preview" />
          <span>{t("vip.previewNote")}</span>
        </div>
      </div>

      <div className="border-t border-fg/10 px-5 pt-4 pb-5">
        <p className="mb-3 text-[15px] text-muted">{t("vip.payMethod")}</p>
        {user ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={pay}
              className="h-[46px] rounded-md bg-white text-[15px] font-semibold text-ink"
            >
              {t("vip.bank")}
            </button>
            <button
              type="button"
              disabled
              className="h-[46px] rounded-md bg-white/70 text-[15px] font-semibold text-ink/60"
            >
              {t("vip.cardSoon")}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <Link
              href={`/signin?next=${encodeURIComponent("/vip")}`}
              onClick={onClose}
              className="flex h-[46px] items-center justify-center rounded-full bg-accent text-base font-semibold text-on-accent no-underline hover:text-on-accent"
            >
              {t("vip.signInToGet")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
