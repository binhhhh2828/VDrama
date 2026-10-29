import type { Metadata } from "next";
import { Suspense } from "react";
import { EpisodeAdmin } from "@/components/admin/EpisodeAdmin";
import { Skeleton } from "@/components/ui/Skeleton";

type Props = PageProps<"/admin/series/[slug]/episodes/[number]">;

export const metadata: Metadata = { title: "Episode video" };
export const instant = false;

export default function AdminEpisodePage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-80" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Props["params"] }) {
  const { slug, number } = await params;
  return <EpisodeAdmin slug={slug} number={Number(number)} />;
}
