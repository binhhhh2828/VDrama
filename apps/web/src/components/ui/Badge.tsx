import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { FlameIcon } from "./icons";

export type BadgeKind = "top" | "vip" | "free" | "new" | "preview" | "original" | "hot";

const kinds: Record<BadgeKind, string> = {
  top: "rounded-tag bg-brand px-2 py-1 text-[11px] font-extrabold tracking-[0.04em] text-on-accent",
  vip: "rounded-tag bg-vip px-2 py-1 text-[11px] font-extrabold text-vip-ink",
  free: "rounded-tag border border-success/35 bg-success/12 px-2 py-1 text-[11px] font-bold text-success",
  new: "rounded-tag border border-fg/25 bg-canvas/60 px-2 py-1 text-[11px] font-bold text-fg",
  // Nhãn cho màn hình chưa nối API (giao diện tĩnh): luôn nổi bật để không bị hiểu nhầm là đã chạy thật.
  preview:
    "rounded-full border border-vip/45 bg-vip/10 px-2.5 py-1 text-[11px] font-extrabold tracking-[0.1em] text-vip",
  // Nhãn phim độc quyền, nhỏ, đặt ở góc/đáy poster (như nhãn ĐỘC QUYỀN của NetShort).
  original:
    "rounded-tag bg-accent px-1.5 py-[3px] text-[10px] font-bold tracking-[0.06em] text-on-accent",
  // Nhãn HOT cạnh tên phim ở hero: đỏ gạch, chữ trắng nghiêng, có ngọn lửa.
  hot: "gap-0.5 rounded-tag bg-hot px-1.5 py-[3px] text-[11px] font-extrabold italic text-white",
};

const defaultLabel: Record<BadgeKind, string> = {
  top: "TOP",
  vip: "VIP",
  free: "FREE",
  new: "NEW",
  preview: "PREVIEW",
  original: "ORIGINAL",
  hot: "HOT",
};

export function Badge({
  kind,
  children,
  className,
}: {
  kind: BadgeKind;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center leading-none", kinds[kind], className)}>
      {kind === "hot" ? <FlameIcon size={11} /> : null}
      {children ?? defaultLabel[kind]}
    </span>
  );
}
