import Image from "next/image";
import Link from "next/link";
import stacked from "../../../public/brand/logo-stacked.png";

// Khung trang đăng nhập / đăng ký / quên mật khẩu. Điện thoại (ảnh 21): toàn màn hình nền tối, không có
// khung thương hiệu riêng (logo nằm trong nội dung). Từ `md`: bên trái thương hiệu, bên phải form.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <section
        aria-label="VDrama"
        className="hidden flex-col items-center justify-center gap-7 bg-black px-8 py-12 md:flex md:flex-1"
        style={{
          backgroundImage:
            "radial-gradient(60% 60% at 70% 25%, rgba(244,48,94,.35), transparent 70%), radial-gradient(55% 55% at 15% 90%, rgba(255,130,37,.22), transparent 70%)",
        }}
      >
        <Link href="/" aria-label="VDrama home" className="leading-none">
          <Image
            src={stacked}
            alt="VDrama — AI Drama · Endless Stories"
            preload
            className="h-auto w-[300px]"
          />
        </Link>
        <p className="max-w-[400px] text-center text-[17px] leading-relaxed text-fg-soft">
          Short AI dramas you can binge in an evening. The first episodes of every series are free.
        </p>
      </section>
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
