import type { Metadata } from "next";
import { Suspense } from "react";
import { SeriesAdmin } from "@/components/admin/SeriesAdmin";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Series" };
export const instant = false;

export default function AdminSeriesDetail({ params }: PageProps<"/admin/series/[slug]">) {
  return (
    <Suspense fallback={<Skeleton className="h-80" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: PageProps<"/admin/series/[slug]">["params"] }) {
  const { slug } = await params;
  return <SeriesAdmin slug={slug} />;
}
