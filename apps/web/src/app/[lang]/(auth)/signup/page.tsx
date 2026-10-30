import { titleMetadata } from "@/lib/i18n/server";
import { Suspense } from "react";
import { AuthFlow } from "@/components/auth/AuthFlow";
import { Skeleton } from "@/components/ui/Skeleton";
import { safeNext } from "@/lib/safe-next";

export const generateMetadata = titleMetadata("auth.signUpMeta", { robots: { index: false } });

export default function SignUpPage({ searchParams }: PageProps<"/[lang]/signup">) {
  return (
    <Suspense fallback={<Skeleton className="m-5 h-[520px]" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({
  searchParams,
}: {
  searchParams: PageProps<"/[lang]/signup">["searchParams"];
}) {
  const next = safeNext((await searchParams).next);
  return <AuthFlow mode="signup" next={next} />;
}
