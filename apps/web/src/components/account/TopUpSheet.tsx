"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import { Badge } from "@/components/ui/Badge";
import { CloseIcon, HeadsetIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { Link } from "@/components/i18n/navigation";

/** Gói xu mẫu (PREVIEW): VDrama chưa có ví xu nên chưa bán và chưa trừ gì. */
const PACKS = [
  { coins: 1000, bonus: 0, price: "9.99" },
  { coins: 1300, bonus: 0, price: "12.99" },
  { coins: 5000, bonus: 2800, price: "49.99" },
  { coins: 10000, bonus: 10000, price: "99.99" },
] as const;

/** Xu: đồng xu vàng viền kép, ánh kim và chữ V có chân; vẽ bằng SVG nên nét ở mọi cỡ. */
export function Coin({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id="coin-rim" x1="6" y1="2" x2="26" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.45" stopColor="#f5b83a" />
          <stop offset="1" stopColor="#b8691a" />
        </linearGradient>
        <radialGradient id="coin-face" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#ffe9a0" />
          <stop offset="0.55" stopColor="#f2a91f" />
          <stop offset="1" stopColor="#c9741a" />
        </radialGradient>
        <linearGradient id="coin-v" x1="0" y1="8" x2="0" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7a3f06" />
          <stop offset="1" stopColor="#4b2403" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#coin-rim)" />
      <circle
        cx="16"
        cy="16"
        r="12.2"
        fill="url(#coin-face)"
        stroke="#fff3c4"
        strokeOpacity="0.7"
        strokeWidth="0.8"
      />
      <path
        d="M9.2 9.6h4.6l2.2 7.6 2.2-7.6h4.6l-5.6 12.8h-2.4L9.2 9.6Z"
        fill="url(#coin-v)"
        stroke="#fff1b8"
        strokeOpacity="0.55"
        strokeWidth="0.5"
      />
      <path
        d="M8 11.5A9.5 9.5 0 0 1 17 6.6"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.55"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Bảng "Top Up" theo ảnh NetShort: số dư, nút hỗ trợ + đóng, lưới 4 gói xu (gói lớn có nhãn thưởng
 * +56% / +100%), rồi chọn cách thanh toán. PREVIEW: gói chỉ chọn được cho vui, thanh toán chưa bật.
 */
export function TopUpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useT();
  const [picked, setPicked] = useState<number>(0);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={t("topUp.label")}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "fixed inset-x-0 top-auto bottom-0 m-0 max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-[24px] bg-linear-to-b from-plum-2 via-canvas to-canvas to-[200px] p-0 text-fg",
        "backdrop:bg-black/60",
        "translate-y-full transition-[translate,display,overlay] transition-discrete duration-250 ease-out",
        "open:translate-y-0 starting:open:translate-y-full",
        "md:inset-auto md:m-auto md:max-w-[480px] md:translate-y-0 md:rounded-[24px] md:border md:border-line md:transition-none",
      )}
    >
      {open ? (
        <div className="px-5 pt-5 pb-6">
          <div className="flex items-center gap-3">
            <p className="flex flex-1 items-center gap-2 text-[13px] text-fg-soft">
              {t("topUp.balance")} <Coin size={18} /> <span className="text-fg">0</span>
            </p>
            <Link
              href="/contact"
              onClick={onClose}
              aria-label={t("vip.support")}
              className="hit-44 relative flex size-8 items-center justify-center text-fg-soft"
            >
              <HeadsetIcon size={22} />
            </Link>
            <button
              type="button"
              aria-label={t("common.close")}
              onClick={onClose}
              className="hit-44 relative flex size-8 items-center justify-center text-fg-soft"
            >
              <CloseIcon size={20} />
            </button>
          </div>

          <div
            role="radiogroup"
            aria-label={t("topUp.pack")}
            className="mt-4 grid grid-cols-2 gap-3"
          >
            {PACKS.map((p, i) => (
              <button
                key={p.coins}
                type="button"
                role="radio"
                aria-checked={i === picked}
                onClick={() => setPicked(i)}
                className={cn(
                  "relative flex min-h-[78px] flex-col justify-center gap-1.5 rounded-xl bg-surface px-4 text-left",
                  i === picked && "ring-1 ring-vip",
                )}
              >
                {p.bonus > 0 ? (
                  <span className="absolute top-0 right-0 rounded-tr-xl rounded-bl-lg bg-accent px-2 py-0.5 text-[11px] font-semibold text-on-accent">
                    +{Math.round((p.bonus / p.coins) * 100)}%
                  </span>
                ) : null}
                <span className="flex items-center gap-2 text-lg leading-6 font-medium">
                  <Coin size={22} />
                  {p.coins}
                  {p.bonus > 0 ? (
                    <span className="border-l border-fg/20 pl-1.5 text-xs text-fg-soft">
                      +{p.bonus}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-muted">$ {p.price}</span>
              </button>
            ))}
          </div>

          <p className="mt-6 text-[13px] text-muted">{t("topUp.payment")}</p>
          <div className="mt-2.5 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled
              className="h-11 rounded-lg bg-white/70 text-sm font-semibold text-ink/60"
            >
              {t("topUp.bank")}
            </button>
            <button
              type="button"
              disabled
              className="h-11 rounded-lg bg-white/70 text-sm font-semibold text-ink/60"
            >
              {t("topUp.card")}
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted">
            <Badge kind="preview" />
            <span>{t("topUp.note")}</span>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
