import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/AuthTabs";
import { PreviewNotice } from "@/components/preview/PreviewNotice";
import { Button, ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Verify your email", robots: { index: false } };

// PREVIEW: màn hình "kiểm tra hộp thư" sau khi đăng ký. Chưa có API gửi email xác thực.
export default function VerifyEmailPage() {
  return (
    <>
      <div
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-2xl bg-brand text-ink"
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
      <AuthHeading
        title="Check your inbox"
        text="We sent a verification link to your email. Open it on this device to confirm your account."
      />
      <PreviewNotice>Email verification is coming soon. No email has been sent.</PreviewNotice>
      <div className="flex flex-col gap-3">
        <Button disabled className="h-[52px]">
          Resend email
        </Button>
        <ButtonLink href="/" variant="secondary" className="h-[52px]">
          Continue to VDrama
        </ButtonLink>
      </div>
    </>
  );
}
