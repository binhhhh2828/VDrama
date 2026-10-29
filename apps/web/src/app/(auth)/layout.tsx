import Image from "next/image";
import Link from "next/link";
import stacked from "../../../public/brand/logo-stacked.png";

// Khung trang đăng nhập / đăng ký / quên mật khẩu: bên trái thương hiệu, bên phải form.
// Trên điện thoại: logo nhỏ ở trên, form ở dưới.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <section
        aria-label="VDrama"
        className="flex flex-col items-center justify-center gap-4 bg-black px-6 py-8 md:flex-1 md:gap-7 md:px-8 md:py-12"
        style={{
          backgroundImage:
            "radial-gradient(60% 60% at 70% 25%, rgba(250,46,80,.35), transparent 70%), radial-gradient(55% 55% at 15% 90%, rgba(249,104,31,.25), transparent 70%)",
        }}
      >
        <Link href="/" aria-label="VDrama home" className="leading-none">
          <Image
            src={stacked}
            alt="VDrama — AI Drama · Endless Stories"
            preload
            className="h-auto w-[150px] md:w-[300px]"
          />
        </Link>
        <p className="hidden max-w-[400px] text-center text-[17px] leading-relaxed text-fg-soft md:block">
          Short AI dramas you can binge in an evening. The first episodes of every series are free.
        </p>
      </section>
      <main
        id="main"
        className="flex flex-1 items-start justify-center px-4 py-8 md:items-center md:px-6 md:py-12"
      >
        <div className="flex w-full max-w-[420px] flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
