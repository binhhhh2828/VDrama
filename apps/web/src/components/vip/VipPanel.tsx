"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/session/SessionProvider";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon, CloseIcon, HeadsetIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { PREVIEW_PLANS, VIP_PERKS } from "@/lib/preview-data";

/** Bốn ý của "How VIP works" (ảnh 09), viết lại theo cách VDrama bán VIP. */
const GUIDE = [
  "VIP is added to your account the moment your payment goes through. It unlocks every VIP episode on every series.",
  "You can only buy VIP for the account you are signed in to.",
  "VIP never renews automatically. We remind you 5 days before it ends, and renewing early adds days on top.",
  "Bank transfers can take up to a minute to show up. Keep the transfer note exactly as shown.",
];

/**
 * Nội dung bảng VIP theo ảnh 08 và 09: tình trạng VIP + hỗ trợ + nút đóng, các gói (chọn một, viền
 * vàng), ghi chú không tự gia hạn, quyền lợi, hướng dẫn, rồi chọn cách thanh toán ở chân bảng.
 * PREVIEW: giá là giá mẫu; chọn "Bank transfer" chuyển sang trang thanh toán mẫu (chưa có API).
 * Dùng cho bottom sheet (có `onClose`) và cho trang /vip trên điện thoại (không có `onClose`).
 */
export function VipPanel({ onClose, className }: { onClose?: () => void; className?: string }) {
  const session = useSession();
  const router = useRouter();
  const [planId, setPlanId] = useState(
    (PREVIEW_PLANS.find((p) => p.featured) ?? PREVIEW_PLANS[0]).id,
  );

  const user = session.status === "user" ? session.user : null;
  const status = user?.is_vip
    ? `VIP until ${formatDate(user.vip_expires_at)}`
    : user
      ? "Not a VIP member yet"
      : "Sign in to add VIP to your account";

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
            aria-label="Contact support"
            className="hit-44 relative flex size-9 items-center justify-center text-fg-soft hover:text-fg"
          >
            <HeadsetIcon size={24} />
          </Link>
          {onClose ? (
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="hit-44 relative flex size-9 items-center justify-center text-fg-soft hover:text-fg"
            >
              <CloseIcon size={22} />
            </button>
          ) : null}
        </div>

        <div role="radiogroup" aria-label="VIP plan" className="mt-4 grid grid-cols-3 gap-2.5">
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
                    Best value
                  </span>
                ) : null}
                <span className="text-[15px] font-semibold text-vip">{plan.name}</span>
                <span className="text-[22px] leading-7 font-bold">{plan.priceUsd}</span>
                <span className="text-[11px] text-muted">{plan.days} days</span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <span aria-hidden className="size-1 rounded-full bg-muted" />
          No automatic renewals. Renew early and keep every day.
        </p>

        <ul className="mt-5 flex flex-col">
          {VIP_PERKS.map((perk) => (
            <li
              key={perk}
              className="flex min-h-[52px] items-center gap-3 border-b border-fg/12 text-base"
            >
              <CheckIcon size={18} className="shrink-0 text-vip" strokeWidth={2.4} />
              {perk}
            </li>
          ))}
        </ul>

        <section aria-labelledby="vip-guide-h" className="mt-4">
          <h2 id="vip-guide-h" className="text-sm text-muted">
            How VIP works
          </h2>
          <ol className="mt-2 flex flex-col gap-2 text-sm leading-6 text-muted">
            {GUIDE.map((text, i) => (
              <li key={i}>
                {i + 1}. {text}
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted">
          <Badge kind="preview" />
          <span>Prices are examples and payments aren&apos;t live yet.</span>
        </div>
      </div>

      <div className="border-t border-fg/10 px-5 pt-4 pb-5">
        <p className="mb-3 text-[15px] text-muted">Choose payment method</p>
        {user ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={pay}
              className="h-[46px] rounded-md bg-white text-[15px] font-semibold text-ink"
            >
              Bank transfer (QR)
            </button>
            <button
              type="button"
              disabled
              className="h-[46px] rounded-md bg-white/70 text-[15px] font-semibold text-ink/60"
            >
              Card / PayPal soon
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <Link
              href={`/signin?next=${encodeURIComponent("/vip")}`}
              onClick={onClose}
              className="flex h-[46px] items-center justify-center rounded-full bg-accent text-base font-semibold text-on-accent no-underline hover:text-on-accent"
            >
              Sign in to get VIP
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
