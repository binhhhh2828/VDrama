import { getServerT, titleMetadata } from "@/lib/i18n/server";
import { AuthHeading, AuthPage } from "@/components/auth/AuthTabs";
import { PreviewNotice } from "@/components/preview/PreviewNotice";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Link } from "@/components/i18n/navigation";

export const generateMetadata = titleMetadata("auth.forgotMeta", { robots: { index: false } });

// PREVIEW: chưa có API gửi email đặt lại mật khẩu (plan.md, Giai đoạn 2). Form không gửi đi đâu.
export default async function ForgotPasswordPage({ params }: PageProps<"/[lang]/forgot-password">) {
  const { t } = getServerT((await params).lang);
  return (
    <AuthPage>
      <AuthHeading title={t("auth.forgotTitle")} text={t("auth.forgotText")} />
      <PreviewNotice>{t("auth.forgotNotice")}</PreviewNotice>
      {/* Không dùng <form>: màn hình Preview không được gửi dữ liệu đi đâu (kể cả vào URL). */}
      <div className="flex flex-col gap-4">
        <Field
          id="forgot-email"
          name="email"
          label={t("auth.email")}
          type="email"
          autoComplete="email"
          placeholder={t("auth.emailPlaceholder")}
        />
        <Button disabled className="h-[52px]">
          {t("auth.forgotSend")}
        </Button>
      </div>
      <p className="text-center text-sm text-muted">
        {t("auth.remembered")} <Link href="/signin">{t("auth.backToSignIn")}</Link>
      </p>
    </AuthPage>
  );
}
