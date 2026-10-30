"use client";

import { useEffect } from "react";
import { StatusScreen } from "@/components/layout/StatusScreen";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ApiError } from "@/lib/api/errors";
import { useT } from "@/components/i18n/I18nProvider";

// Lỗi bất ngờ trong trang người xem (API không trả lời, lỗi render...). Header/footer vẫn còn.
export default function SiteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const t = useT();
  const unreachable = error instanceof ApiError && error.code === "network_error";
  return (
    <StatusScreen
      eyebrow={t("error.eyebrow")}
      title={unreachable ? t("error.unreachableTitle") : t("error.failedTitle")}
      actions={
        <>
          <Button onClick={() => retry()}>{t("common.tryAgain")}</Button>
          <ButtonLink href="/" variant="secondary">
            {t("common.backHome")}
          </ButtonLink>
        </>
      }
    >
      <p>{unreachable ? t("error.unreachableText") : t("error.failedText")}</p>
    </StatusScreen>
  );
}
