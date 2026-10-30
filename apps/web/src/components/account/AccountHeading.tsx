"use client";

import { useT } from "@/components/i18n/I18nProvider";

/** Tiêu đề trang tài khoản (nhóm /account/*). */
export function AccountHeading() {
  const t = useT();
  return (
    <h1 className="text-[28px] font-extrabold tracking-[-0.01em] md:text-[36px]">
      {t("account.title")}
    </h1>
  );
}
