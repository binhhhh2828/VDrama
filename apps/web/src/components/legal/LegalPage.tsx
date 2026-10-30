"use client";

import type { ReactNode } from "react";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import { InfoIcon } from "@/components/ui/icons";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getLegalDoc, type LegalKey } from "@/lib/legal-content";

/**
 * Khung trang pháp lý. Nội dung thật cần luật sư duyệt (plan.md mục 2.5); hiện chỉ có đề mục và
 * phần giữ chỗ, có thông báo rõ ở đầu trang. Bản không phải tiếng Anh có thêm ghi chú "bản dịch tham khảo".
 */
export function LegalPage({ docKey }: { docKey: LegalKey }) {
  const t = useT();
  const locale = useLocale();
  const doc = getLegalDoc(locale, docKey);
  return (
    <main className="mx-auto flex w-full max-w-[820px] flex-col gap-8 px-4 pt-10 pb-16 sm:px-6 md:pt-14">
      <header className="flex flex-col gap-3">
        <h1 className="text-[32px] font-black tracking-[-0.02em] md:text-[44px]">{doc.title}</h1>
        <p className="text-sm text-muted">{t("legal.updated", { value: t("legal.draftValue") })}</p>
      </header>
      <div
        role="note"
        className="flex items-start gap-3 rounded-input border border-vip/35 bg-vip/8 px-4 py-3 text-sm text-fg-soft"
      >
        <InfoIcon size={18} className="mt-0.5 shrink-0 text-vip" />
        <p>
          <strong className="text-vip">{t("legal.draftLabel")}</strong> {t("legal.draftNote")}
          {locale !== DEFAULT_LOCALE ? ` ${t("legal.translationNote")}` : ""}
        </p>
      </div>
      <p className="text-base leading-relaxed text-fg-soft">{doc.intro}</p>
      <nav
        aria-label={t("legal.onThisPage")}
        className="rounded-card border border-line bg-surface p-5"
      >
        <p className="mb-2 text-sm font-bold">{t("legal.onThisPage")}</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {doc.sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      {doc.sections.map((s, i) => (
        <section key={s.id} id={s.id} className="flex scroll-mt-24 flex-col gap-3">
          <h2 className="text-xl font-extrabold">
            {i + 1}. {s.title}
          </h2>
          <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-fg-soft">
            {s.paragraphs?.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {s.placeholder ? <Placeholder>{s.placeholder}</Placeholder> : null}
          </div>
        </section>
      ))}
    </main>
  );
}

/** Đoạn giữ chỗ cho nội dung pháp lý chưa có. */
export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-input border border-dashed border-line px-4 py-3 text-muted italic">
      [{children}]
    </p>
  );
}
