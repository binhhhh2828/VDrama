import type { Metadata } from "next";
import { Placeholder } from "@/components/legal/LegalPage";
import { Link } from "@/components/i18n/navigation";

export const metadata: Metadata = { title: "Contact" };

const TOPICS = [
  { title: "Payments and VIP", text: "Paid but VIP isn't on, wrong transfer note, refunds." },
  { title: "Account help", text: "Can't sign in, change email, close your account." },
  { title: "Watching problems", text: "Videos not playing, buffering, subtitles." },
  { title: "Business and press", text: "Partnerships, licensing and media enquiries." },
];

export default function ContactPage() {
  return (
    <main className="mx-auto flex w-full max-w-[820px] flex-col gap-8 px-4 pt-10 pb-16 sm:px-6 md:pt-14">
      <header className="flex flex-col gap-3">
        <h1 className="text-[32px] font-black tracking-[-0.02em] md:text-[44px]">Contact us</h1>
        <p className="text-base text-fg-soft">
          We usually reply within one business day. For payment issues, include your transfer note
          (order code) so we can find it quickly.
        </p>
      </header>

      <section
        aria-labelledby="channels-h"
        className="flex flex-col gap-3 rounded-panel border border-line bg-surface p-6"
      >
        <h2 id="channels-h" className="text-lg font-extrabold">
          Support email
        </h2>
        <Placeholder>
          Support email address and business hours, set up together with the domain email
        </Placeholder>
        <p className="text-sm text-muted">
          Questions about refunds? See the <Link href="/refunds">Refund Policy</Link>.
        </p>
      </section>

      <section aria-labelledby="topics-h" className="flex flex-col gap-4">
        <h2 id="topics-h" className="text-lg font-extrabold">
          What can we help with?
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {TOPICS.map((t) => (
            <li key={t.title} className="rounded-card border border-line bg-surface p-5">
              <p className="font-bold">{t.title}</p>
              <p className="mt-1 text-sm text-muted">{t.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
