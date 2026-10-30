import type { Metadata } from "next";
import { AccountHeading } from "@/components/account/AccountHeading";
import { AccountTabs } from "@/components/account/AccountTabs";
import { RequireUser } from "@/components/account/RequireUser";

export const metadata: Metadata = { robots: { index: false } };

// Trang riêng của từng người: nội dung chỉ hiện trên trình duyệt sau khi biết ai đăng nhập, nên
// server không render sẵn được. Tắt kiểm tra "instant navigation" của Next cho khu vực này.
export const instant = false;

// Khu vực tài khoản: chỉ người đã đăng nhập; dữ liệu đều lấy trên trình duyệt.
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 pt-6 pb-16 sm:px-6 md:gap-8 md:pt-10">
      <AccountHeading />
      <AccountTabs />
      <RequireUser>{children}</RequireUser>
    </main>
  );
}
