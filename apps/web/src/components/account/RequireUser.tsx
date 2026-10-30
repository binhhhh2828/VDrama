"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useSession } from "@/components/session/SessionProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePathname, useRouter } from "@/components/i18n/navigation";

/**
 * Trang chỉ dành cho người đã đăng nhập: khách bị chuyển sang /signin (kèm ?next= để quay lại).
 * Đây chỉ là trải nghiệm; dữ liệu riêng do API bảo vệ (401 nếu chưa đăng nhập).
 */
export function RequireUser({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (session.status !== "guest") return;
    // Vừa tự bấm Sign out (vài giây trước) thì về trang chủ; còn lại (chưa đăng nhập, phiên hết
    // hạn, quay lại đây sau khi đã đăng xuất) thì mời đăng nhập rồi quay lại đây.
    // Dùng thời điểm thay vì cờ vì Next giữ trang cũ trong bộ nhớ khi chuyển trang.
    const justSignedOut =
      session.signedOutAt !== undefined && Date.now() - session.signedOutAt < 3000;
    router.replace(justSignedOut ? "/" : `/signin?next=${encodeURIComponent(pathname)}`);
  }, [session, pathname, router]);

  if (session.status !== "user") {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  return <>{children}</>;
}
