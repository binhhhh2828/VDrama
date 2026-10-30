import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";

// Khung trang đăng nhập / đăng ký / quên mật khẩu. Điện thoại (ảnh 21): toàn màn hình nền tối, không có
// khung thương hiệu riêng (logo nằm trong nội dung). Từ `md`: bên trái thương hiệu, bên phải form.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <AuthBrandPanel />
      <main
        id="main"
        className="flex flex-1 flex-col rounded-t-[24px] bg-canvas md:items-center md:justify-center md:rounded-none md:px-6 md:py-12"
      >
        <div className="flex w-full flex-1 flex-col md:max-w-[420px] md:flex-none md:gap-6">
          {children}
        </div>
      </main>
    </div>
  );
}
