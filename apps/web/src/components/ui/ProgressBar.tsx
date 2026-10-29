import { cn } from "@/lib/cn";

/** Thanh tiến độ xem. `value` từ 0 đến 1. */
export function ProgressBar({
  value,
  label,
  className,
  thin = false,
}: {
  value: number;
  /** Nhãn cho trình đọc màn hình, ví dụ "62% watched". Bỏ trống khi chỉ để trang trí. */
  label?: string;
  className?: string;
  thin?: boolean;
}) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div
      className={cn("overflow-hidden rounded-full bg-fg/18", thin ? "h-1" : "h-1.5", className)}
      {...(label
        ? {
            role: "progressbar",
            "aria-valuenow": pct,
            "aria-valuemin": 0,
            "aria-valuemax": 100,
            "aria-label": label,
          }
        : { "aria-hidden": true })}
    >
      <div className="h-full rounded-full bg-brand-x" style={{ width: `${pct}%` }} />
    </div>
  );
}
