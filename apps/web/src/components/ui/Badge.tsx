import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeKind = "top" | "vip" | "free" | "new" | "preview" | "original";

const kinds: Record<BadgeKind, string> = {
  top: "rounded-tag bg-brand px-2 py-1 text-[11px] font-extrabold tracking-[0.04em] text-ink",
  vip: "rounded-tag bg-vip px-2 py-1 text-[11px] font-extrabold text-vip-ink",
  free: "rounded-tag border border-success/35 bg-success/12 px-2 py-1 text-[11px] font-bold text-success",
  new: "rounded-tag border border-fg/25 bg-canvas/60 px-2 py-1 text-[11px] font-bold text-fg",
  // Nhãn cho màn hình chưa nối API (giao diện tĩnh): luôn nổi bật để không bị hiểu nhầm là đã chạy thật.
  preview:
    "rounded-full border border-vip/45 bg-vip/10 px-2.5 py-1 text-[11px] font-extrabold tracking-[0.1em] text-vip",
  original:
    "rounded-full border border-fg/18 bg-fg/8 px-3 py-[7px] text-xs font-bold tracking-[0.12em] text-fg",
};

const defaultLabel: Record<BadgeKind, string> = {
  top: "TOP",
  vip: "VIP",
  free: "FREE",
  new: "NEW",
  preview: "PREVIEW",
  original: "AI ORIGINAL",
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
      {children ?? defaultLabel[kind]}
    </span>
  );
}
