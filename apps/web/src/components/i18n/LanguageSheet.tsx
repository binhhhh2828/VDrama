"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronRightIcon, CloseIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_INFO,
  LOCALES,
  type Locale,
} from "@/lib/i18n/config";
import { switchLocale } from "@/lib/i18n/paths";
import { useLocale, useT } from "./I18nProvider";

/** Ghi lựa chọn (cookie 1 năm) rồi mở cùng trang ở ngôn ngữ mới (giữ cả ?query và #mục). */
function chooseLocale(to: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${to}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
  const { pathname, search, hash } = window.location;
  // Tải lại cả trang thay vì chuyển trang mềm: hai ngôn ngữ dùng chung một layout gốc nên chuyển mềm
  // giữ lại cây cũ (kể cả hộp thoại menu đang mở ở lớp trên cùng, làm trang đơ).
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- cố ý tải lại cả trang
  window.location.href = `${switchLocale(pathname, to)}${search}${hash}`;
}

/**
 * Bảng chọn ngôn ngữ dạng bottom sheet (cùng kiểu bảng VIP): mỗi ngôn ngữ một hàng, tên viết bằng chính
 * ngôn ngữ đó, hàng đang dùng có dấu tick. Từ `md` là hộp thoại giữa màn hình.
 */
export function LanguageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const current = useLocale();
  const t = useT();

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
      aria-label={t("language.choose")}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "fixed inset-x-0 top-auto bottom-0 m-0 max-h-[80dvh] w-full max-w-none overflow-y-auto rounded-t-[24px] bg-canvas p-0 text-fg",
        "backdrop:bg-black/60",
        "translate-y-full transition-[translate,display,overlay] transition-discrete duration-250 ease-out",
        "open:translate-y-0 starting:open:translate-y-full",
        "md:inset-auto md:m-auto md:max-w-[400px] md:translate-y-0 md:rounded-[24px] md:border md:border-line md:transition-none",
      )}
    >
      {open ? (
        <div className="px-5 pt-5 pb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{t("language.choose")}</h2>
            <button
              type="button"
              aria-label={t("language.close")}
              onClick={onClose}
              className="hit-44 relative flex size-8 items-center justify-center text-fg-soft"
            >
              <CloseIcon size={20} />
            </button>
          </div>
          <ul role="radiogroup" aria-label={t("language.label")} className="mt-3 flex flex-col">
            {LOCALES.map((locale) => (
              <li key={locale}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={locale === current}
                  lang={locale}
                  onClick={() => (locale === current ? onClose() : chooseLocale(locale))}
                  className={cn(
                    "flex min-h-14 w-full items-center justify-between border-b border-line text-left text-base",
                    locale === current ? "text-accent" : "text-fg",
                  )}
                >
                  {LOCALE_INFO[locale].name}
                  {locale === current ? <CheckIcon size={20} strokeWidth={2.4} /> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </dialog>
  );
}

/** Hàng "Language  English ›" mở bảng chọn; dùng trong ngăn kéo menu và chân trang. */
export function LanguageRow({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const t = useT();
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn("flex w-full items-center justify-between text-left", className)}
      >
        <span>{t("language.label")}</span>
        <span className="flex items-center gap-1 text-muted">
          {LOCALE_INFO[locale].name}
          <ChevronRightIcon size={16} />
        </span>
      </button>
      <LanguageSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
