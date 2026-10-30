"use client";

import { Logo } from "@/components/brand/Logo";
import { useT } from "@/components/i18n/I18nProvider";
import { Link } from "@/components/i18n/navigation";

/** Logo bấm về trang chủ. */
export function BrandLink() {
  const t = useT();
  return (
    <Link
      href="/"
      aria-label={t("nav.homeAria")}
      className="ml-0.5 mr-3 shrink-0 leading-none md:mr-0 md:ml-0"
    >
      <Logo height={17} preload className="h-[17px] w-auto md:h-8" />
    </Link>
  );
}

/** Liên kết "nhảy tới nội dung" cho bàn phím và trình đọc màn hình (chỉ hiện khi được focus). */
export function SkipLink() {
  const t = useT();
  return (
    <a
      href="#main"
      className="sr-only rounded-full bg-fg px-4 py-2 text-ink focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-40"
    >
      {t("nav.skip")}
    </a>
  );
}
