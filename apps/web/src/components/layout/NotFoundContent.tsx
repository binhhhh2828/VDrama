"use client";

import { useT } from "@/components/i18n/I18nProvider";
import { StatusScreen } from "@/components/layout/StatusScreen";
import { ButtonLink } from "@/components/ui/Button";

/** Nội dung trang 404 (client để dùng ngôn ngữ của trang). */
export function NotFoundContent() {
  const t = useT();
  return (
    <StatusScreen
      eyebrow="404"
      title={t("notFound.title")}
      actions={
        <>
          <ButtonLink href="/">{t("common.backHome")}</ButtonLink>
          <ButtonLink href="/browse" variant="secondary">
            {t("notFound.browse")}
          </ButtonLink>
        </>
      }
    >
      <p>{t("notFound.text")}</p>
    </StatusScreen>
  );
}
