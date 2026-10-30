"use client";

import type { ReactNode } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import { Link } from "@/components/i18n/navigation";

/** Khung nội dung cho các trang phụ của nhóm (auth) (quên mật khẩu, đặt lại, xác thực email). */
export function AuthPage({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-6 px-5 pt-4 pb-10 md:p-0">
      <Link
        href="/"
        className="text-sm font-medium text-muted no-underline hover:text-fg md:hidden"
      >
        {t("auth.backTo")}
      </Link>
      {children}
    </div>
  );
}

export function AuthHeading({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-[24px] leading-snug font-semibold md:text-[28px]">{title}</h1>
      <p className="text-[15px] text-muted">{text}</p>
    </div>
  );
}

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-input border border-error/40 bg-error/10 px-4 py-3 text-sm text-error-soft"
    >
      {children}
    </p>
  );
}
