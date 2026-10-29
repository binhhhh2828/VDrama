import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/** Khung trang người xem: header, nội dung, footer, thanh dưới đáy (điện thoại). */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {/* Chừa chỗ cho thanh dưới đáy trên điện thoại. */}
      <div id="main" className="flex flex-1 flex-col pb-20 md:pb-0">
        {children}
      </div>
      <div className="pb-20 md:pb-0">
        <SiteFooter />
      </div>
      <BottomNav />
    </>
  );
}
