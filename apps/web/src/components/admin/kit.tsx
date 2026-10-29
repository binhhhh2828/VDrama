"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { CloseIcon, SearchIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { Panel } from "./ui";

export const inputClass =
  "h-11 w-full rounded-input border border-line bg-canvas px-3 text-[15px] text-fg outline-none placeholder:text-faint focus:border-link";

/** Ô lọc theo chữ (lọc tại chỗ, không gửi đi đâu). */
export function SearchBox({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <label className="flex h-11 w-full items-center gap-2.5 rounded-full border border-line bg-canvas px-4 focus-within:border-link md:w-80">
      <SearchIcon size={16} className="shrink-0 text-muted" />
      <span className="sr-only">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
      />
    </label>
  );
}

/** Nhóm chip lọc chọn một. */
export function FilterChips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition",
              on
                ? "border-accent/60 bg-accent/14 text-fg"
                : "border-line text-fg-soft hover:bg-fg/8 hover:text-fg",
            )}
          >
            {o.label}
            {o.count !== undefined ? (
              <span className="text-xs font-normal text-muted">{o.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Danh sách nhãn → giá trị trong khung chi tiết. */
export function DetailList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 font-medium break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Bố cục bảng + khung chi tiết: máy tính để chi tiết bên phải, điện thoại để bên dưới và cuộn tới
 * khi chọn một dòng.
 */
export function MasterDetail({
  list,
  detail,
  title,
  onClose,
  selectedKey,
}: {
  list: ReactNode;
  detail: ReactNode | null;
  title: string;
  onClose: () => void;
  selectedKey: string | number | null;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selectedKey === null || !ref.current) return;
    if (window.matchMedia("(max-width: 1023px)").matches) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      ref.current.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }, [selectedKey]);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-5">{list}</div>
      <section
        ref={ref}
        aria-label={title}
        className="flex min-w-0 scroll-mt-20 flex-col gap-5 lg:sticky lg:top-20"
      >
        {detail ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close details"
                className="inline-flex size-10 items-center justify-center rounded-full text-muted hover:bg-fg/8 hover:text-fg"
              >
                <CloseIcon size={18} />
              </button>
            </div>
            {detail}
          </>
        ) : (
          <div className="hidden rounded-panel border border-dashed border-line p-8 text-center text-sm text-muted lg:block">
            Select a row to see details.
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * PREVIEW thao tác cần lý do (tặng VIP, hoàn tiền, khóa tài khoản, xóa...). Mọi thao tác admin
 * ghi vào audit_logs kèm lý do, nên ô Reason là bắt buộc. Chưa có API: nút luôn tắt.
 */
export function ReasonAction({
  title,
  text,
  actionLabel,
  variant = "secondary",
  placeholder = "Why are you doing this?",
  danger,
  children,
}: {
  title: string;
  text: ReactNode;
  actionLabel: string;
  variant?: ButtonVariant;
  placeholder?: string;
  danger?: boolean;
  children?: ReactNode;
}) {
  const [reason, setReason] = useState("");
  const missing = reason.trim().length < 3;
  return (
    <Panel title={title} className={danger ? "border-error/30" : undefined}>
      <p className="text-sm text-fg-soft">{text}</p>
      {children}
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Reason (required, saved in the audit log)
        <input
          className={inputClass}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={variant} size="sm" disabled>
          {actionLabel}
        </Button>
        <span className="text-xs text-muted">
          {missing ? "Enter a reason first. " : ""}Preview: not connected yet.
        </span>
      </div>
    </Panel>
  );
}
