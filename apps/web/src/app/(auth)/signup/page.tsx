import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFlow } from "@/components/auth/AuthFlow";
import { Skeleton } from "@/components/ui/Skeleton";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function SignUpPage({ searchParams }: PageProps<"/signup">) {
  return (
    <Suspense fallback={<Skeleton className="m-5 h-[520px]" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const next = safeNext((await searchParams).next);
  return <AuthFlow mode="signup" next={next} />;
}
