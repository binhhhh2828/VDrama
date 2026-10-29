import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFlow } from "@/components/auth/AuthFlow";
import { Skeleton } from "@/components/ui/Skeleton";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <Suspense fallback={<Skeleton className="m-5 h-[420px]" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/signin">["searchParams"] }) {
  const next = safeNext((await searchParams).next);
  return <AuthFlow mode="signin" next={next} />;
}
