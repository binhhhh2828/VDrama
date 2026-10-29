import Image from "next/image";
import horizontal from "../../../public/brand/logo-horizontal.png";
import icon from "../../../public/brand/logo-icon.png";
import { cn } from "@/lib/cn";

type LogoProps = {
  /** `full`: icon + chữ VDRAMA; `icon`: chỉ ô icon (thanh dưới đáy, chỗ hẹp). */
  variant?: "full" | "icon";
  /** Chiều cao hiển thị (px). Header 40, footer 32. */
  height?: number;
  className?: string;
  preload?: boolean;
};

/** Logo nền trong suốt, chỉ dùng trên nền tối (bản cho nền sáng nằm ở public/brand/*-on-light.png). */
export function Logo({ variant = "full", height = 40, className, preload }: LogoProps) {
  const src = variant === "full" ? horizontal : icon;
  const width = Math.round((src.width / src.height) * height);
  return (
    <Image
      src={src}
      alt="VDrama"
      width={width}
      height={height}
      preload={preload}
      className={cn("block h-auto select-none", className)}
    />
  );
}
