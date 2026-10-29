"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DemoAccounts } from "@/components/demo/DemoAccounts";
import { Badge } from "@/components/ui/Badge";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import stacked from "../../../public/brand/logo-stacked.png";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";

type Terms = { accepted: boolean; check: () => boolean };
const TermsCtx = createContext<Terms | null>(null);

/** Ô đồng ý điều khoản ở đáy màn hình: phải tick trước khi đăng nhập hoặc đăng ký. */
export function useTerms(): Terms {
  const ctx = useContext(TermsCtx);
  if (!ctx) throw new Error("useTerms must be used inside <AuthFlow>");
  return ctx;
}

const COPY = {
  signin: {
    title: "Sign in to unlock your own journey",
    text: "Your list, history and VIP follow you on every device.",
    email: "Continue with email",
    switchText: "New to VDrama?",
    switchLink: "Create a free account",
    switchHref: "/signup",
  },
  signup: {
    title: "Create your free account",
    text: "Save your progress and build your list across devices.",
    email: "Sign up with email",
    switchText: "Already have an account?",
    switchLink: "Sign in",
    switchHref: "/signin",
  },
} as const;

function GoogleLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 5.04c1.64 0 3.1.56 4.26 1.66l3.18-3.18C17.5 1.7 14.97.5 12 .5 7.7.5 3.99 2.97 2.18 6.56l3.7 2.87C6.76 6.82 9.14 5.04 12 5.04Z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.8-.07-1.57-.2-2.3H12v4.36h6.46a5.5 5.5 0 0 1-2.4 3.62l3.7 2.87c2.16-2 3.74-4.94 3.74-8.55Z"
      />
      <path
        fill="#FBBC05"
        d="M5.88 14.57A7.1 7.1 0 0 1 5.5 12c0-.9.15-1.76.38-2.57L2.18 6.56A11.5 11.5 0 0 0 .5 12c0 1.9.45 3.7 1.68 5.44l3.7-2.87Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.1 0 5.7-1.02 7.6-2.78l-3.7-2.87c-1.03.7-2.35 1.1-3.9 1.1-2.86 0-5.24-1.78-6.12-4.38l-3.7 2.87C3.99 21.03 7.7 23.5 12 23.5Z"
      />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.6c0-2.3 1.9-3.4 2-3.46-1.1-1.6-2.8-1.8-3.4-1.84-1.44-.15-2.8.85-3.53.85-.73 0-1.85-.83-3.05-.8-1.57.02-3.02.92-3.83 2.33-1.63 2.83-.42 7.02 1.17 9.31.78 1.12 1.7 2.38 2.9 2.33 1.17-.05 1.6-.75 3-.75s1.8.75 3.03.72c1.25-.02 2.04-1.14 2.8-2.27.88-1.3 1.25-2.55 1.27-2.62-.03-.01-2.44-.94-2.46-3.7ZM14.1 5.8c.64-.78 1.07-1.86.95-2.94-.92.04-2.04.61-2.7 1.39-.6.69-1.12 1.8-.98 2.85 1.03.08 2.08-.52 2.73-1.3Z" />
    </svg>
  );
}

/**
 * Màn hình đăng nhập / đăng ký theo ảnh 21: nút quay lại, logo + câu giới thiệu, hai nút viên thuốc
 * Google (xám) và Apple (trắng), rồi "Continue with email" mở biểu mẫu email/mật khẩu thật. Ô đồng ý điều
 * khoản ở đáy là bắt buộc trước khi đăng nhập. Google và Apple là PREVIEW (API chưa có): bấm chỉ hiện
 * thông báo, không gửi gì đi.
 */
export function AuthFlow({ mode, next }: { mode: "signin" | "signup"; next: string }) {
  const copy = COPY[mode];
  const router = useRouter();
  const [showEmail, setShowEmail] = useState(false);
  const [providerNote, setProviderNote] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const termsRef = useRef<HTMLInputElement>(null);
  const qs = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  const check = useCallback(() => {
    if (accepted) return true;
    setTermsError(true);
    termsRef.current?.focus();
    return false;
  }, [accepted]);
  const terms = useMemo(() => ({ accepted, check }), [accepted, check]);

  const provider =
    "relative flex h-[46px] w-full items-center justify-center rounded-full pr-16 pl-9 text-base";

  return (
    <TermsCtx.Provider value={terms}>
      <div className="flex min-h-full flex-1 flex-col px-5 pb-6 md:min-h-0 md:flex-none md:px-0 md:pb-0">
        <div className="flex h-[58px] items-center md:hidden">
          <button
            type="button"
            aria-label="Back"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
            className="-ml-3 flex size-11 items-center justify-center text-fg-soft"
          >
            <ChevronLeftIcon size={26} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2.5 pt-10 text-center md:pt-0 md:text-left">
          <Link href="/" aria-label="VDrama home" className="leading-none md:hidden">
            <Image src={stacked} alt="VDrama" preload className="h-auto w-[140px]" />
          </Link>
          <h1 className="text-[22px] leading-snug font-semibold md:text-[28px]">{copy.title}</h1>
          <p className="text-[15px] text-muted">{copy.text}</p>
        </div>

        <div className="mx-auto mt-8 flex w-full max-w-[325px] flex-col gap-3 md:mx-0 md:max-w-none">
          <button
            type="button"
            onClick={() => setProviderNote("Google sign-in")}
            className={cn(provider, "bg-[#303030] text-fg")}
          >
            <span className="absolute left-5">
              <GoogleLogo />
            </span>
            Continue with Google
            <Badge kind="preview" className="absolute right-3 scale-75" />
          </button>
          <button
            type="button"
            onClick={() => setProviderNote("Apple sign-in")}
            className={cn(provider, "bg-white text-ink")}
          >
            <span className="absolute left-5">
              <AppleLogo />
            </span>
            Continue with Apple
            <Badge kind="preview" className="absolute right-3 scale-75 bg-white!" />
          </button>
          {providerNote ? (
            <p role="status" className="text-center text-sm text-muted">
              {providerNote} isn&apos;t available yet. Please continue with email.
            </p>
          ) : null}

          {!showEmail ? (
            <button
              type="button"
              onClick={() => setShowEmail(true)}
              className={cn(provider, "border border-fg/30 text-fg hover:bg-fg/8")}
            >
              {copy.email}
            </button>
          ) : (
            <div className="mt-2 flex flex-col gap-4">
              {mode === "signin" ? <SignInForm next={next} /> : <SignUpForm next={next} />}
            </div>
          )}

          <p className="mt-1 text-center text-sm text-muted">
            {copy.switchText} <Link href={`${copy.switchHref}${qs}`}>{copy.switchLink}</Link>
          </p>
          {mode === "signin" && showEmail ? (
            <p className="text-center text-sm">
              <Link href="/forgot-password">Forgot password?</Link>
            </p>
          ) : null}
        </div>

        <div className="mx-auto mt-auto w-full max-w-[325px] pt-10 md:mx-0 md:max-w-none md:pt-8">
          <DemoAccounts next={next} />
          <TermsCheck error={termsError}>
            <input
              ref={termsRef}
              id="auth-terms"
              type="checkbox"
              checked={accepted}
              aria-invalid={termsError ? true : undefined}
              aria-describedby={termsError ? "auth-terms-error" : undefined}
              onChange={(e) => {
                setAccepted(e.target.checked);
                if (e.target.checked) setTermsError(false);
              }}
              className="mt-0.5 size-5 shrink-0 accent-accent"
            />
          </TermsCheck>
        </div>
      </div>
    </TermsCtx.Provider>
  );
}

function TermsCheck({ children, error }: { children: ReactNode; error: boolean }) {
  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <label
        htmlFor="auth-terms"
        className="flex items-start gap-2.5 text-[13px] leading-5 text-muted"
      >
        {children}
        <span>
          If you continue, you agree to the{" "}
          <Link href="/terms" className="text-fg-soft underline">
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-fg-soft underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      {error ? (
        <span id="auth-terms-error" role="alert" className="text-[13px] text-error-soft">
          Please agree to the Terms of Use and Privacy Policy to continue.
        </span>
      ) : null}
    </div>
  );
}
