import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading, AuthPage } from "@/components/auth/AuthTabs";
import { PreviewNotice } from "@/components/preview/PreviewNotice";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };

// PREVIEW: trang mở từ link trong email đặt lại mật khẩu. Chưa có API, form không gửi đi đâu.
export default function ResetPasswordPage() {
  return (
    <AuthPage>
      <AuthHeading
        title="Set a new password"
        text="Choose a password you haven't used here before. You'll be signed out on other devices."
      />
      <PreviewNotice>
        This is the page people reach from the reset email. Password resets aren&apos;t live yet.
      </PreviewNotice>
      {/* Không dùng <form>: màn hình Preview không được gửi dữ liệu đi đâu (kể cả vào URL). */}
      <div className="flex flex-col gap-4">
        <Field
          id="reset-password"
          name="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
        />
        <Field
          id="reset-confirm"
          name="confirm"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
        />
        <Button disabled className="h-[52px]">
          Save new password
        </Button>
      </div>
      <p className="text-center text-sm text-muted">
        <Link href="/signin">Back to sign in</Link>
      </p>
    </AuthPage>
  );
}
