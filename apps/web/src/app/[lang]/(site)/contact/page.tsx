import { getServerT, titleMetadata } from "@/lib/i18n/server";
import { Placeholder } from "@/components/legal/LegalPage";
import { Link } from "@/components/i18n/navigation";

export const generateMetadata = titleMetadata("contact.metaTitle");

const TOPICS = [
  ["contact.paymentsTitle", "contact.paymentsText"],
  ["contact.accountTitle", "contact.accountText"],
  ["contact.watchingTitle", "contact.watchingText"],
  ["contact.businessTitle", "contact.businessText"],
] as const;

export default async function ContactPage({ params }: PageProps<"/[lang]/contact">) {
  const { t } = getServerT((await params).lang);
  return (
    <main className="mx-auto flex w-full max-w-[820px] flex-col gap-8 px-4 pt-10 pb-16 sm:px-6 md:pt-14">
      <header className="flex flex-col gap-3">
        <h1 className="text-[32px] font-black tracking-[-0.02em] md:text-[44px]">
          {t("contact.heading")}
        </h1>
        <p className="text-base text-fg-soft">{t("contact.intro")}</p>
      </header>

      <section
        aria-labelledby="channels-h"
        className="flex flex-col gap-3 rounded-panel border border-line bg-surface p-6"
      >
        <h2 id="channels-h" className="text-lg font-extrabold">
          {t("contact.emailTitle")}
        </h2>
        <Placeholder>{t("contact.emailPlaceholder")}</Placeholder>
        <p className="text-sm text-muted">
          {t("contact.refundsNote")} <Link href="/refunds">{t("footer.refunds")}</Link>.
        </p>
      </section>

      <section aria-labelledby="topics-h" className="flex flex-col gap-4">
        <h2 id="topics-h" className="text-lg font-extrabold">
          {t("contact.help")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {TOPICS.map(([title, text]) => (
            <li key={title} className="rounded-card border border-line bg-surface p-5">
              <p className="font-bold">{t(title)}</p>
              <p className="mt-1 text-sm text-muted">{t(text)}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
