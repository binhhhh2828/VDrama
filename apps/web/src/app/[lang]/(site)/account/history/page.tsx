import { titleMetadata } from "@/lib/i18n/server";
import { WatchHistory } from "@/components/account/WatchHistory";

export const generateMetadata = titleMetadata("footer.history");

// Nội dung chỉ có trên trình duyệt sau khi biết ai đăng nhập (xem account/layout.tsx).
export const instant = false;

export default function HistoryPage() {
  return <WatchHistory />;
}
