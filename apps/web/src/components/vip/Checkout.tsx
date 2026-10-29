"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PreviewNotice } from "@/components/preview/PreviewNotice";
import { useSession } from "@/components/session/SessionProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatClock, formatVnd } from "@/lib/format";
import { PREVIEW_PLANS, PREVIEW_TRANSFER } from "@/lib/preview-data";

/**
 * PREVIEW trang thanh toán (Giai đoạn 5: SePay + VietQR). Không tạo đơn, không gửi gì, không bao
 * giờ báo "đã thanh toán". Mã QR là hình vẽ giữ chỗ, không quét được, không chứa tài khoản thật.
 */
export function Checkout() {
  const session = useSession();
  const pathname = usePathname();
  const search = useSearchParams();
  const plan = PREVIEW_PLANS.find((p) => p.id === search.get("plan")) ?? PREVIEW_PLANS[1];
  const [method, setMethod] = useState<"transfer" | "paypal">("transfer");
  const [left, setLeft] = useState(PREVIEW_TRANSFER.expiresInSec);

  useEffect(() => {
    const t = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (session.status === "loading") return <Skeleton className="h-[520px]" />;
  if (session.status === "guest") {
    const next = encodeURIComponent(`${pathname}?plan=${plan.id}`);
    return (
      <div className="flex flex-col items-center gap-4 rounded-panel border border-line bg-surface px-6 py-14 text-center">
        <p className="text-xl font-extrabold">Sign in to get VIP</p>
        <p className="max-w-md text-muted">
          Your VIP is added to your account, so sign in or create a free account first.
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <ButtonLink href={`/signin?next=${next}`}>Sign in</ButtonLink>
          <ButtonLink href={`/signup?next=${next}`} variant="secondary">
            Create account
          </ButtonLink>
        </div>
      </div>
    );
  }

  const rows: Array<[string, string]> = [
    ["Bank", PREVIEW_TRANSFER.bank],
    ["Account name", PREVIEW_TRANSFER.accountName],
    ["Account number", PREVIEW_TRANSFER.accountNumber],
    ["Amount", formatVnd(plan.priceVnd)],
    ["Transfer note", PREVIEW_TRANSFER.orderCode],
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/vip"
        className="inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-medium text-muted no-underline hover:text-fg"
      >
        <ChevronLeftIcon size={16} /> All plans
      </Link>

      <PreviewNotice>
        Payments are not live yet. This shows how checkout will work. No order is created and the QR
        code below is a placeholder, not a real bank account.
      </PreviewNotice>

      <div className="grid gap-5 md:grid-cols-[1fr_340px]">
        <section className="flex flex-col gap-5 rounded-panel border border-line bg-surface p-5 md:p-7">
          <div
            role="tablist"
            aria-label="Payment method"
            className="flex gap-1.5 rounded-full border border-line bg-canvas p-[5px]"
          >
            {(
              [
                ["transfer", "Bank transfer (QR)"],
                ["paypal", "PayPal / card"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={method === key}
                onClick={() => setMethod(key)}
                className={cn(
                  "h-11 flex-1 rounded-full text-sm",
                  method === key
                    ? "bg-surface-2 font-bold text-fg"
                    : "font-semibold text-muted hover:text-fg",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {method === "transfer" ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center gap-2">
                <PlaceholderQr />
                <span className="text-xs text-muted">Scan with your banking app</span>
              </div>
              <div className="flex flex-1 flex-col gap-4">
                <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-[15px]">
                  {rows.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted">{k}</dt>
                      <dd className="font-semibold break-all">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-sm text-fg-soft">
                  Include the transfer note exactly. VIP turns on automatically within a minute of
                  the payment arriving. You can keep this page open.
                </p>
                <p className="text-sm" aria-live="polite">
                  Order expires in{" "}
                  <span className="font-bold text-vip tabular-nums">{formatClock(left)}</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-lg font-bold">Card and PayPal payments are coming later</p>
              <p className="max-w-sm text-sm text-muted">
                For international viewers. Until then, VIP can be bought by bank transfer.
              </p>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4 rounded-panel border border-vip-line bg-vip-panel p-5 md:p-6">
          <span className="text-[13px] font-extrabold tracking-[0.1em] text-vip">
            ORDER SUMMARY
          </span>
          <p className="text-2xl font-extrabold">VIP · {plan.name}</p>
          <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-[15px]">
            <dt className="text-muted">Price</dt>
            <dd className="font-semibold">{plan.priceUsd}</dd>
            <dt className="text-muted">Bank transfer</dt>
            <dd className="font-semibold">{formatVnd(plan.priceVnd)}</dd>
            <dt className="text-muted">Adds</dt>
            <dd className="font-semibold">{plan.days} days</dd>
          </dl>
          <p className="text-sm text-fg-soft">
            {session.user.is_vip
              ? "Added on top of your current VIP, so you don't lose any days."
              : "Starts the moment payment goes through. No automatic renewal."}
          </p>
          <Button variant="vip" disabled className="mt-auto">
            Waiting for payment…
          </Button>
          <p className="text-center text-xs text-muted">
            By paying you agree to the <Link href="/terms">Terms</Link> and{" "}
            <Link href="/refunds">Refund Policy</Link>.
          </p>
        </aside>
      </div>
    </div>
  );
}

/** Hình giữ chỗ trông giống mã QR, cố ý KHÔNG quét được (không có ô định vị chuẩn, có chữ SAMPLE). */
function PlaceholderQr() {
  const cells: Array<[number, number]> = [];
  let seed = 7;
  for (let y = 0; y < 21; y++)
    for (let x = 0; x < 21; x++) {
      seed = (seed * 9301 + 49297) % 233280;
      if (seed / 233280 > 0.55) cells.push([x, y]);
    }
  return (
    <div
      className="relative rounded-card bg-white p-3"
      role="img"
      aria-label="Sample QR code placeholder"
    >
      <svg
        width="168"
        height="168"
        viewBox="0 0 21 21"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        {cells.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#16060d" opacity="0.35" />
        ))}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="rotate-[-18deg] rounded-md border-2 border-pink bg-white/90 px-2.5 py-1 text-sm font-black tracking-[0.2em] text-pink">
          SAMPLE
        </span>
      </span>
    </div>
  );
}
