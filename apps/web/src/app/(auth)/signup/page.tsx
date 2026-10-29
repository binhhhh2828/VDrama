import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthHeading, AuthTabs } from "@/components/auth/AuthTabs";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { Skeleton } from "@/components/ui/Skeleton";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function SignUpPage({ searchParams }: PageProps<"/signup">) {
  return (
    <Suspense fallback={<Skeleton className="h-[520px]" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const next = safeNext((await searchParams).next);
  const qs = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <>
      <AuthTabs active="signup" next={next} />
      <AuthHeading
        title="Create your account"
        text="Save your progress and build your list across devices."
      />
      <SignUpForm next={next} />
      <p className="text-center text-sm text-muted">
        Already have an account? <Link href={`/signin${qs}`}>Sign in</Link>
      </p>
    </>
  );
}
