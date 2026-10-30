"use client";

import Image from "next/image";
import { useT } from "@/components/i18n/I18nProvider";
import { Link } from "@/components/i18n/navigation";
import stacked from "../../../public/brand/logo-stacked.png";

/** Khung thương hiệu bên trái của trang đăng nhập (từ `md`). */
export function AuthBrandPanel() {
  const t = useT();
  return (
    <section
      aria-label="VDrama"
      className="hidden flex-col items-center justify-center gap-7 bg-black px-8 py-12 md:flex md:flex-1"
      style={{
        backgroundImage:
          "radial-gradient(60% 60% at 70% 25%, rgba(244,48,94,.35), transparent 70%), radial-gradient(55% 55% at 15% 90%, rgba(255,130,37,.22), transparent 70%)",
      }}
    >
      <Link href="/" aria-label={t("nav.homeAria")} className="leading-none">
        <Image src={stacked} alt={t("auth.brandAlt")} preload className="h-auto w-[300px]" />
      </Link>
      <p className="max-w-[400px] text-center text-[17px] leading-relaxed text-fg-soft">
        {t("auth.tagline")}
      </p>
    </section>
  );
}
