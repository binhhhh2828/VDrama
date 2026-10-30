import type { Metadata } from "next";
import { AuthHeading, AuthPage } from "@/components/auth/AuthTabs";
import { PreviewNotice } from "@/components/preview/PreviewNotice";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Link } from "@/components/i18n/navigation";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

// PREVIEW: chưa có API gửi email đặt lại mật khẩu (plan.md, Giai đoạn 2). Form không gửi đi đâu.
export default function ForgotPasswordPage() {
  return (
    <AuthPage>
      <AuthHeading
        title="Forgot your password?"
        text="Enter the email you signed up with and we'll send you a link to set a new one."
      />
      <PreviewNotice>
        Email sign-in help is coming soon. This form doesn&apos;t send anything yet.
      </PreviewNotice>
      {/* Không dùng <form>: màn hình Preview không được gửi dữ liệu đi đâu (kể cả vào URL). */}
      <div className="flex flex-col gap-4">
        <Field
          id="forgot-email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
        />
        <Button disabled className="h-[52px]">
          Send reset link
        </Button>
      </div>
      <p className="text-center text-sm text-muted">
        Remembered it? <Link href="/signin">Back to sign in</Link>
      </p>
    </AuthPage>
  );
}
