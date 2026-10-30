import type { Metadata } from "next";
import { PreviewNotice } from "@/components/preview/PreviewNotice";
import { CheckIcon } from "@/components/ui/icons";
import { MembershipBar } from "@/components/vip/MembershipBar";
import { VipPanel } from "@/components/vip/VipPanel";
import { cn } from "@/lib/cn";
import { PREVIEW_PLANS } from "@/lib/preview-data";
import { getServerT } from "@/lib/i18n/server";
import { Link } from "@/components/i18n/navigation";

export async function generateMetadata({ params }: PageProps<"/[lang]/vip">): Promise<Metadata> {
  const { t } = getServerT((await params).lang);
  return { title: t("vipPage.metaTitle"), description: t("vipPage.metaDescription") };
}

const FAQ = [
  ["vipPage.q1", "vipPage.a1"],
  ["vipPage.q2", "vipPage.a2"],
  ["vipPage.q3", "vipPage.a3"],
  ["vipPage.q4", "vipPage.a4"],
] as const;

const PERK_KEYS = ["vip.perk1", "vip.perk2", "vip.perk3", "vip.perk4"] as const;
const PERIOD_KEY = {
  monthly: "vipPage.periodMonthly",
  quarterly: "vipPage.periodQuarterly",
  yearly: "vipPage.periodYearly",
} as const;

// Trang VIP. PREVIEW: giá là giá mẫu (preview-data.ts), chưa có API gói / thanh toán (Giai đoạn 5).
export default async function VipPage({ params }: PageProps<"/[lang]/vip">) {
  const { t } = getServerT((await params).lang);
  return (
    <main className="mx-auto flex w-full max-w-[1160px] flex-col gap-8 px-4 pt-10 pb-16 max-md:px-0 max-md:pt-2 max-md:pb-0 sm:px-6 md:gap-10 md:pt-14">
      {/* Điện thoại: cùng nội dung với bảng VIP (ảnh 08, 09) nhưng nằm sẵn trong trang. */}
      <VipPanel className="md:hidden" />
      <div className="hidden flex-col gap-8 md:flex md:gap-10">
        <section className="flex flex-col items-center gap-3.5 text-center">
          <span className="text-[13px] font-extrabold tracking-[0.14em] text-vip">VDRAMA VIP</span>
          <h1 className="max-w-[760px] text-[38px] leading-[1.08] font-black tracking-[-0.02em] md:text-[56px]">
            {t("vipPage.heading")}
          </h1>
          <p className="max-w-[620px] text-base leading-relaxed text-muted md:text-lg">
            {t("vipPage.sub")}
          </p>
        </section>

        <MembershipBar />

        <PreviewNotice>{t("vipPage.notice")}</PreviewNotice>

        <section aria-label={t("vipPage.plans")} className="grid gap-5 pt-2 md:grid-cols-3">
          {PREVIEW_PLANS.map((plan) => (
            <article
              key={plan.id}
              className={cn(
                "relative flex flex-col gap-[18px] rounded-panel border p-7",
                plan.featured
                  ? "border-accent/60 bg-linear-to-b from-accent/12 to-surface to-55%"
                  : "border-line bg-surface",
              )}
            >
              {plan.featured ? (
                <span className="absolute -top-3.5 left-7 rounded-full bg-brand px-3 py-1.5 text-xs font-extrabold tracking-[0.06em] text-on-accent">
                  {t("vipPage.popular")}
                </span>
              ) : null}
              <h2 className="text-xl font-extrabold">{t("vip.months", { n: plan.months })}</h2>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[44px] font-extrabold tracking-[-0.02em]">
                  {plan.priceUsd}
                </span>
                <span className="text-[15px] text-muted">
                  / {t(PERIOD_KEY[plan.id as keyof typeof PERIOD_KEY])}
                </span>
              </div>
              <span className="text-sm text-muted">
                {plan.savePercent
                  ? t("vipPage.noteSave", { n: plan.days, p: plan.savePercent })
                  : t("vipPage.noteBase", { n: plan.days })}
              </span>
              <Link
                href={`/vip/checkout?plan=${plan.id}`}
                className={cn(
                  "mt-auto flex min-h-[52px] items-center justify-center rounded-full text-base font-bold no-underline",
                  plan.featured
                    ? "bg-brand text-on-accent hover:text-on-accent hover:brightness-110"
                    : "border border-line bg-fg/6 text-fg hover:bg-fg/12 hover:text-fg",
                )}
              >
                {t("vipPage.choose", { name: t("vip.months", { n: plan.months }) })}
              </Link>
            </article>
          ))}
        </section>

        <section
          aria-labelledby="perks-h"
          className="flex flex-col gap-[18px] rounded-panel border border-line bg-surface p-7"
        >
          <h2 id="perks-h" className="text-xl font-extrabold">
            {t("vipPage.perksTitle")}
          </h2>
          <ul className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
            {PERK_KEYS.map((key) => (
              <li key={key} className="flex items-center gap-3 text-base">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success/14 text-success">
                  <CheckIcon size={16} strokeWidth={2.6} />
                </span>
                {t(key)}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="faq-h" className="flex flex-col gap-3">
          <h2 id="faq-h" className="mb-1 text-xl font-extrabold">
            {t("vipPage.faqTitle")}
          </h2>
          {FAQ.map(([q, a], i) => (
            <details
              key={q}
              open={i === 0}
              className="group rounded-card border border-line bg-surface px-5 py-[18px]"
            >
              <summary className="cursor-pointer text-base font-semibold">{t(q)}</summary>
              <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{t(a)}</p>
            </details>
          ))}
        </section>
      </div>
    </main>
  );
}
