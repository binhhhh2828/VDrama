import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthHeading, AuthTabs } from "@/components/auth/AuthTabs";
import { SignInForm } from "@/components/auth/SignInForm";
import { Skeleton } from "@/components/ui/Skeleton";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <Suspense fallback={<Skeleton className="h-[420px]" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/signin">["searchParams"] }) {
  const next = safeNext((await searchParams).next);
  const qs = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <>
      <AuthTabs active="signin" next={next} />
      <AuthHeading title="Welcome back" text="Sign in to keep watching where you left off." />
      <SignInForm next={next} />
      <p className="text-center text-sm text-muted">
        New to VDrama? <Link href={`/signup${qs}`}>Create a free account</Link>
      </p>
    </>
  );
}
