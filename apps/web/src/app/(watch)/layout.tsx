import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

// Trang xem phim: header của site (trong suốt như các trang khác), nội dung tập trung vào video, chân
// trang ở cuối. Không có thanh Get VIP dính đáy để khỏi che video.
export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </>
  );
}
