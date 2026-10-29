"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/components/session/SessionProvider";

/** Đã đăng nhập mà vào trang đăng nhập/đăng ký thì đi thẳng tới `next`. */
export function useRedirectIfSignedIn(next: string) {
  const session = useSession();
  const router = useRouter();
  useEffect(() => {
    if (session.status === "user") router.replace(next);
  }, [session.status, next, router]);
}
