"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { ChevronLeftIcon } from "@/components/ui/icons";

/** Header riêng của trang tài khoản (ảnh 06): nút quay lại bên trái, logo ở giữa. */
export function AccountHeader() {
  const router = useRouter();
  return (
    <header className="relative flex h-[58px] items-center justify-center">
      <button
        type="button"
        aria-label="Back"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
        className="absolute left-1 flex size-11 items-center justify-center text-fg"
      >
        <ChevronLeftIcon size={26} />
      </button>
      <Link href="/" aria-label="VDrama home" className="leading-none">
        <Logo height={28} preload className="h-7 w-auto" />
      </Link>
    </header>
  );
}
