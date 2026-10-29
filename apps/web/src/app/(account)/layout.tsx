import type { Metadata } from "next";
import { AccountHeader } from "@/components/account/AccountHeader";

export const metadata: Metadata = { robots: { index: false } };

// Trang tài khoản (ảnh 06, 20) có header riêng (quay lại + logo) và nền tím mận nhạt dần về nền trang.
// Mục con (My List, lịch sử) nằm ở nhóm (site)/account với khung chung của site.
export default function AccountHomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-plum-fade"
      />
      <div className="relative flex flex-1 flex-col">
        <AccountHeader />
        <main id="main" className="mx-auto flex w-full max-w-[560px] flex-1 flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
