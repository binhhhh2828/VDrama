import { getServerT, titleMetadata } from "@/lib/i18n/server";
import { AuthHeading, AuthPage } from "@/components/auth/AuthTabs";
import { PreviewNotice } from "@/components/preview/PreviewNotice";
import { Button, ButtonLink } from "@/components/ui/Button";

export const generateMetadata = titleMetadata("auth.verifyMeta", { robots: { index: false } });

// PREVIEW: màn hình "kiểm tra hộp thư" sau khi đăng ký. Chưa có API gửi email xác thực.
export default async function VerifyEmailPage({ params }: PageProps<"/[lang]/verify-email">) {
  const { t } = getServerT((await params).lang);
  return (
    <AuthPage>
      <div
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-2xl bg-brand text-on-accent"
      >
        <svg
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      </div>
      <AuthHeading title={t("auth.verifyTitle")} text={t("auth.verifyText")} />
      <PreviewNotice>{t("auth.verifyNotice")}</PreviewNotice>
      <div className="flex flex-col gap-3">
        <Button disabled className="h-[52px]">
          {t("auth.resend")}
        </Button>
        <ButtonLink href="/" variant="secondary" className="h-[52px]">
          {t("auth.continueToSite")}
        </ButtonLink>
      </div>
    </AuthPage>
  );
}
