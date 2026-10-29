import type { Metadata } from "next";
import Link from "next/link";
import { PreviewNotice } from "@/components/preview/PreviewNotice";
import { CheckIcon } from "@/components/ui/icons";
import { MembershipBar } from "@/components/vip/MembershipBar";
import { VipPanel } from "@/components/vip/VipPanel";
import { cn } from "@/lib/cn";
import { PREVIEW_PLANS, VIP_PERKS } from "@/lib/preview-data";

export const metadata: Metadata = {
  title: "VIP plans",
  description: "Unlock every VDrama episode in Full HD, with no ads. No automatic renewals.",
};

const FAQ = [
  {
    q: "Does my plan renew automatically?",
    a: "No. We never charge you automatically. We remind you 5 days before your plan ends, and you can renew early without losing any days.",
  },
  {
    q: "How do I pay?",
    a: "Bank transfer by QR code comes first. Card and PayPal payments for international viewers are planned next.",
  },
  {
    q: "How many devices can I use?",
    a: "You can be signed in on up to 2 devices at the same time.",
  },
  {
    q: "What happens when my plan ends?",
    a: "VIP episodes lock again, but your history and My List stay. Free episodes keep working.",
  },
];

// Trang VIP. PREVIEW: giá là giá mẫu (preview-data.ts), chưa có API gói / thanh toán (Giai đoạn 5).
export default function VipPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1160px] flex-col gap-8 px-4 pt-10 pb-16 max-md:px-0 max-md:pt-2 max-md:pb-0 sm:px-6 md:gap-10 md:pt-14">
      {/* Điện thoại: cùng nội dung với bảng VIP (ảnh 08, 09) nhưng nằm sẵn trong trang. */}
      <VipPanel className="md:hidden" />
      <div className="hidden flex-col gap-8 md:flex md:gap-10">
        <section className="flex flex-col items-center gap-3.5 text-center">
          <span className="text-[13px] font-extrabold tracking-[0.14em] text-vip">VDRAMA VIP</span>
          <h1 className="max-w-[760px] text-[38px] leading-[1.08] font-black tracking-[-0.02em] md:text-[56px]">
            Every episode. Every story. No waiting.
          </h1>
          <p className="max-w-[620px] text-base leading-relaxed text-muted md:text-lg">
            Unlock all VIP episodes across every series, in Full HD and without ads.
          </p>
        </section>

        <MembershipBar />

        <PreviewNotice>
          Prices are examples and payments are not live yet. Choosing a plan shows what checkout
          will look like.
        </PreviewNotice>

        <section aria-label="Plans" className="grid gap-5 pt-2 md:grid-cols-3">
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
                  MOST POPULAR
                </span>
              ) : null}
              <h2 className="text-xl font-extrabold">{plan.name}</h2>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[44px] font-extrabold tracking-[-0.02em]">
                  {plan.priceUsd}
                </span>
                <span className="text-[15px] text-muted">/ {plan.period}</span>
              </div>
              <span className="text-sm text-muted">{plan.note}</span>
              <Link
                href={`/vip/checkout?plan=${plan.id}`}
                className={cn(
                  "mt-auto flex min-h-[52px] items-center justify-center rounded-full text-base font-bold no-underline",
                  plan.featured
                    ? "bg-brand text-on-accent hover:text-on-accent hover:brightness-110"
                    : "border border-line bg-fg/6 text-fg hover:bg-fg/12 hover:text-fg",
                )}
              >
                Choose {plan.name}
              </Link>
            </article>
          ))}
        </section>

        <section
          aria-labelledby="perks-h"
          className="flex flex-col gap-[18px] rounded-panel border border-line bg-surface p-7"
        >
          <h2 id="perks-h" className="text-xl font-extrabold">
            Every plan includes
          </h2>
          <ul className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
            {VIP_PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-3 text-base">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success/14 text-success">
                  <CheckIcon size={16} strokeWidth={2.6} />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="faq-h" className="flex flex-col gap-3">
          <h2 id="faq-h" className="mb-1 text-xl font-extrabold">
            Questions
          </h2>
          {FAQ.map((item, i) => (
            <details
              key={item.q}
              open={i === 0}
              className="group rounded-card border border-line bg-surface px-5 py-[18px]"
            >
              <summary className="cursor-pointer text-base font-semibold">{item.q}</summary>
              <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </section>
      </div>
    </main>
  );
}
