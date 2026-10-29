import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Ô nhập có nhãn và lỗi theo style guide. Lỗi nối với ô qua aria-describedby. */
export function Field({
  id,
  label,
  error,
  hint,
  className,
  ...input
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
} & ComponentProps<"input">) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-[50px] rounded-input border bg-surface px-4 text-[15px] text-fg placeholder:text-faint",
          "outline-none focus-visible:border-link",
          error ? "border-error" : "border-line",
        )}
        {...input}
      />
      {error ? (
        <span id={`${id}-error`} className="text-[13px] text-error-soft">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="text-[13px] text-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
