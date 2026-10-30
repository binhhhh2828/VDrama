import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { StatusScreen } from "@/components/layout/StatusScreen";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Page not found" };

// 404 cho mọi đường dẫn không có (và khi trang gọi notFound()).
export default function NotFound() {
  return (
    <SiteShell>
      <StatusScreen
        eyebrow="404"
        title="This page took a plot twist"
        actions={
          <>
            <ButtonLink href="/">Back to home</ButtonLink>
            <ButtonLink href="/browse" variant="secondary">
              Browse series
            </ButtonLink>
          </>
        }
      >
        <p>The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
      </StatusScreen>
    </SiteShell>
  );
}
