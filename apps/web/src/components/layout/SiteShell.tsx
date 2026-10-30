import { Suspense, type ReactNode } from "react";
import { FloatingDock } from "./FloatingDock";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/**
 * Khung trang người xem theo NetShort mobile: header trong suốt (menu nằm trong ngăn kéo), nội dung,
 * chân trang accordion, thanh Get VIP và nút lên đầu trang dính đáy.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div id="main" className="flex flex-1 flex-col">
        {children}
      </div>
      {/* Chừa chỗ để thanh dính đáy không che dòng cuối của chân trang. */}
      <div className="pb-[72px]">
        <SiteFooter />
      </div>
      <Suspense fallback={null}>
        <FloatingDock />
      </Suspense>
    </>
  );
}
