"use client";

import { useEffect } from "react";
import { StatusScreen } from "@/components/layout/StatusScreen";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ApiError } from "@/lib/api/errors";

// Lỗi bất ngờ trong trang người xem (API không trả lời, lỗi render...). Header/footer vẫn còn.
export default function SiteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const unreachable = error instanceof ApiError && error.code === "network_error";
  return (
    <StatusScreen
      eyebrow="SOMETHING WENT WRONG"
      title={unreachable ? "We can't reach VDrama right now" : "This scene didn't load"}
      actions={
        <>
          <Button onClick={() => retry()}>Try again</Button>
          <ButtonLink href="/" variant="secondary">
            Back to home
          </ButtonLink>
        </>
      }
    >
      <p>
        {unreachable
          ? "Please check your connection, or try again in a moment."
          : "Something went wrong on our side. Trying again usually helps."}
      </p>
    </StatusScreen>
  );
}
