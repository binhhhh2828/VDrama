import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/** Tiêu đề trang admin: tiêu đề, mô tả, nút hành động bên phải. */
export function AdminHeader({
  title,
  text,
  back,
  actions,
}: {
  title: string;
  text?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      {back ? (
        <Link
          href={back.href}
          className="inline-flex min-h-9 items-center gap-1.5 self-start text-sm font-medium text-muted no-underline hover:text-fg"
        >
          <ChevronLeftIcon size={14} /> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-extrabold md:text-[28px]">{title}</h1>
          {text ? <p className="text-sm text-muted">{text}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Panel({
  title,
  children,
  className,
  actions,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-panel border border-line bg-surface p-5",
        className,
      )}
    >
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title ? <h2 className="text-base font-extrabold">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

const STATUS_STYLES: Record<string, string> = {
  green: "border-success/35 bg-success/12 text-success",
  amber: "border-vip/40 bg-vip/10 text-vip",
  red: "border-error/40 bg-error/10 text-error-soft",
  gray: "border-fg/20 bg-fg/6 text-fg-soft",
  pink: "border-pink/45 bg-pink/12 text-link",
};

export function StatusPill({
  tone,
  children,
}: {
  tone: keyof typeof STATUS_STYLES;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap",
        STATUS_STYLES[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Bảng cuộn ngang trên màn hẹp. */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    // `relative`: giữ các phần tử ẩn (sr-only, position absolute) trong vùng cuộn, không làm trang rộng ra.
    <div className="relative -mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export const th =
  "border-b border-line py-2.5 pr-4 text-xs font-bold tracking-[0.04em] text-muted uppercase";
export const td = "border-b border-line/60 py-3 pr-4 align-middle";
