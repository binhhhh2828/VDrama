import { getServerT, titleMetadata } from "@/lib/i18n/server";
import { AuthHeading, AuthPage } from "@/components/auth/AuthTabs";
import { PreviewNotice } from "@/components/preview/PreviewNotice";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Link } from "@/components/i18n/navigation";

export const generateMetadata = titleMetadata("auth.resetMeta", { robots: { index: false } });

// PREVIEW: trang mở từ link trong email đặt lại mật khẩu. Chưa có API, form không gửi đi đâu.
export default async function ResetPasswordPage({ params }: PageProps<"/[lang]/reset-password">) {
  const { t } = getServerT((await params).lang);
  return (
    <AuthPage>
      <AuthHeading title={t("auth.resetMeta")} text={t("auth.resetText")} />
      <PreviewNotice>{t("auth.resetNotice")}</PreviewNotice>
      {/* Không dùng <form>: màn hình Preview không được gửi dữ liệu đi đâu (kể cả vào URL). */}
      <div className="flex flex-col gap-4">
        <Field
          id="reset-password"
          name="password"
          label={t("auth.newPassword")}
          type="password"
          autoComplete="new-password"
          hint={t("auth.passwordHint", { n: 8 })}
        />
        <Field
          id="reset-confirm"
          name="confirm"
          label={t("auth.confirmPassword")}
          type="password"
          autoComplete="new-password"
        />
        <Button disabled className="h-[52px]">
          {t("auth.savePassword")}
        </Button>
      </div>
      <p className="text-center text-sm text-muted">
        <Link href="/signin">{t("auth.backToSignIn")}</Link>
      </p>
    </AuthPage>
  );
}
