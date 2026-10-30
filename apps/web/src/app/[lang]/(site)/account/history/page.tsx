import type { Metadata } from "next";
import { WatchHistory } from "@/components/account/WatchHistory";

export const metadata: Metadata = { title: "Watch history" };

// Nội dung chỉ có trên trình duyệt sau khi biết ai đăng nhập (xem account/layout.tsx).
export const instant = false;

export default function HistoryPage() {
  return <WatchHistory />;
}
