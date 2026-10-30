"use client";

import { useEffect, useState } from "react";
import { PreviewNotice } from "@/components/preview/PreviewNotice";
import { useSession } from "@/components/session/SessionProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import { cn } from "@/lib/cn";
import { formatClock, formatVnd } from "@/lib/format";
import { api } from "@/lib/api/client";
import { IS_DEMO } from "@/lib/demo/config";
import { PREVIEW_PLANS, PREVIEW_TRANSFER } from "@/lib/preview-data";
import { Link, usePathname, useSearchParams } from "@/components/i18n/navigation";

/**
 * PREVIEW trang thanh toán (Giai đoạn 5: SePay + VietQR). Không tạo đơn, không gửi gì, không bao
 * giờ báo "đã thanh toán". Mã QR là hình vẽ giữ chỗ, không quét được, không chứa tài khoản thật.
 */
export function Checkout() {
  const t = useT();
  const locale = useLocale();
  const session = useSession();
  const pathname = usePathname();
  const search = useSearchParams();
  const plan = PREVIEW_PLANS.find((p) => p.id === search.get("plan")) ?? PREVIEW_PLANS[1];
  const [method, setMethod] = useState<"transfer" | "paypal">("transfer");
  const [left, setLeft] = useState(PREVIEW_TRANSFER.expiresInSec);
  const [demoState, setDemoState] = useState<"idle" | "busy" | "done" | "error">("idle");

  useEffect(() => {
    const timer = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (session.status === "loading") return <Skeleton className="h-[520px]" />;
  if (session.status === "guest") {
    const next = encodeURIComponent(`${pathname}?plan=${plan.id}`);
    return (
      <div className="flex flex-col items-center gap-4 rounded-panel border border-line bg-surface px-6 py-14 text-center">
        <p className="text-xl font-extrabold">{t("vip.signInToGet")}</p>
        <p className="max-w-md text-muted">{t("checkout.signInText")}</p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <ButtonLink href={`/signin?next=${next}`}>{t("account.signIn")}</ButtonLink>
          <ButtonLink href={`/signup?next=${next}`} variant="secondary">
            {t("gate.createAccount")}
          </ButtonLink>
        </div>
      </div>
    );
  }

  const rows: Array<[string, string]> = [
    [t("checkout.bank"), t("checkout.sampleBank")],
    [t("checkout.accountName"), PREVIEW_TRANSFER.accountName],
    [t("checkout.accountNumber"), PREVIEW_TRANSFER.accountNumber],
    [t("checkout.amount"), formatVnd(plan.priceVnd, locale)],
    [t("checkout.transferNote"), PREVIEW_TRANSFER.orderCode],
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/vip"
        className="inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-medium text-muted no-underline hover:text-fg"
      >
        <ChevronLeftIcon size={16} /> {t("checkout.allPlans")}
      </Link>

      <PreviewNotice>
        {t("checkout.notice")}
        {IS_DEMO ? ` ${t("checkout.demoNotice")}` : ""}
      </PreviewNotice>

      <div className="grid gap-5 md:grid-cols-[1fr_340px]">
        <section className="flex flex-col gap-5 rounded-panel border border-line bg-surface p-5 md:p-7">
          <div
            role="tablist"
            aria-label={t("checkout.method")}
            className="flex gap-1.5 rounded-full border border-line bg-canvas p-[5px]"
          >
            {(
              [
                ["transfer", t("checkout.tabTransfer")],
                ["paypal", t("checkout.tabPaypal")],
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
                <span className="text-xs text-muted">{t("checkout.scan")}</span>
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
                <p className="text-sm text-fg-soft">{t("checkout.instructions")}</p>
                <p className="text-sm" aria-live="polite">
                  {t("checkout.expires")}{" "}
                  <span className="font-bold text-vip tabular-nums">{formatClock(left)}</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-lg font-bold">{t("checkout.laterTitle")}</p>
              <p className="max-w-sm text-sm text-muted">{t("checkout.laterText")}</p>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4 rounded-panel border border-vip-line bg-vip-panel p-5 md:p-6">
          <span className="text-[13px] font-extrabold tracking-[0.1em] text-vip">
            {t("checkout.summary")}
          </span>
          <p className="text-2xl font-extrabold">
            {t("checkout.planLine", { name: t("vip.months", { n: plan.months }) })}
          </p>
          <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-[15px]">
            <dt className="text-muted">{t("checkout.price")}</dt>
            <dd className="font-semibold">{plan.priceUsd}</dd>
            <dt className="text-muted">{t("checkout.transfer")}</dt>
            <dd className="font-semibold">{formatVnd(plan.priceVnd, locale)}</dd>
            <dt className="text-muted">{t("checkout.adds")}</dt>
            <dd className="font-semibold">{t("vip.days", { n: plan.days })}</dd>
          </dl>
          <p className="text-sm text-fg-soft">
            {session.user.is_vip ? t("checkout.stackNote") : t("checkout.startNote")}
          </p>
          {IS_DEMO ? (
            demoState === "done" ? (
              <div className="mt-auto flex flex-col gap-3" role="status">
                <p className="rounded-input border border-success/35 bg-success/10 px-3 py-2 text-sm text-success">
                  {t("checkout.demoDone", { n: plan.days })}
                </p>
                <ButtonLink href="/browse" variant="vip">
                  {t("checkout.startWatching")}
                </ButtonLink>
              </div>
            ) : (
              <>
                <Button
                  variant="vip"
                  className="mt-auto"
                  disabled={demoState === "busy"}
                  onClick={async () => {
                    setDemoState("busy");
                    try {
                      session.setUser(await api.demoBuyVip(plan.days));
                      setDemoState("done");
                    } catch {
                      setDemoState("error");
                    }
                  }}
                >
                  {demoState === "busy" ? t("checkout.processing") : t("checkout.paidDemo")}
                </Button>
                {demoState === "error" ? (
                  <p role="alert" className="text-center text-sm text-error-soft">
                    {t("checkout.addFailed")}
                  </p>
                ) : null}
                <p className="text-center text-xs text-muted">{t("checkout.demoOnly")}</p>
              </>
            )
          ) : (
            <Button variant="vip" disabled className="mt-auto">
              {t("checkout.waiting")}
            </Button>
          )}
          <p className="text-center text-xs text-muted">
            {t("checkout.agree")} <Link href="/terms">{t("checkout.terms")}</Link> {t("auth.and")}{" "}
            <Link href="/refunds">{t("footer.refunds")}</Link>.
          </p>
        </aside>
      </div>
    </div>
  );
}

/** Hình giữ chỗ trông giống mã QR, cố ý KHÔNG quét được (không có ô định vị chuẩn, có chữ SAMPLE). */
function PlaceholderQr() {
  const t = useT();
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
      aria-label={t("checkout.qrAria")}
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
        <span className="rotate-[-18deg] rounded-md border-2 border-accent bg-white/90 px-2.5 py-1 text-sm font-black tracking-[0.2em] text-accent">
          {t("checkout.sample")}
        </span>
      </span>
    </div>
  );
}
