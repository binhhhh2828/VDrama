import { titleMetadata } from "@/lib/i18n/server";
import { Suspense } from "react";
import { AuthFlow } from "@/components/auth/AuthFlow";
import { Skeleton } from "@/components/ui/Skeleton";
import { safeNext } from "@/lib/safe-next";

export const generateMetadata = titleMetadata("auth.signInMeta", { robots: { index: false } });

export default function SignInPage({ searchParams }: PageProps<"/[lang]/signin">) {
  return (
    <Suspense fallback={<Skeleton className="m-5 h-[420px]" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({
  searchParams,
}: {
  searchParams: PageProps<"/[lang]/signin">["searchParams"];
}) {
  const next = safeNext((await searchParams).next);
  return <AuthFlow mode="signin" next={next} />;
}
