import type { ReactNode } from "react";
import { InfoIcon } from "@/components/ui/icons";

export type LegalSection = { id: string; title: string; body: ReactNode };

/**
 * Khung trang pháp lý. Nội dung thật cần luật sư duyệt (plan.md mục 2.5); hiện chỉ có đề mục và
 * phần giữ chỗ, có thông báo rõ ở đầu trang.
 */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <main className="mx-auto flex w-full max-w-[820px] flex-col gap-8 px-4 pt-10 pb-16 sm:px-6 md:pt-14">
      <header className="flex flex-col gap-3">
        <h1 className="text-[32px] font-black tracking-[-0.02em] md:text-[44px]">{title}</h1>
        <p className="text-sm text-muted">Last updated: {updated}</p>
      </header>

      <div
        role="note"
        className="flex items-start gap-3 rounded-input border border-vip/35 bg-vip/8 px-4 py-3 text-sm text-fg-soft"
      >
        <InfoIcon size={18} className="mt-0.5 shrink-0 text-vip" />
        <p>
          <strong className="text-vip">Draft.</strong> This page shows the structure only. The final
          text is being prepared with legal counsel and will replace the placeholders below before
          launch.
        </p>
      </div>

      <div className="text-base leading-relaxed text-fg-soft">{intro}</div>

      <nav aria-label="On this page" className="rounded-card border border-line bg-surface p-5">
        <p className="mb-2 text-sm font-bold">On this page</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((s, i) => (
        <section key={s.id} id={s.id} className="flex scroll-mt-24 flex-col gap-3">
          <h2 className="text-xl font-extrabold">
            {i + 1}. {s.title}
          </h2>
          <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-fg-soft">
            {s.body}
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
