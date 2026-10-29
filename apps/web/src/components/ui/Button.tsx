import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "vip" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2.5 rounded-full font-bold no-underline transition " +
  "disabled:cursor-not-allowed aria-disabled:cursor-not-allowed whitespace-nowrap";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-ink hover:text-ink hover:brightness-110 disabled:bg-none disabled:bg-surface-2 disabled:text-faint",
  secondary:
    "border border-fg/20 bg-fg/8 font-semibold text-fg hover:bg-fg/14 hover:text-fg disabled:text-faint",
  vip: "bg-vip text-vip-ink hover:text-vip-ink hover:brightness-105 disabled:bg-surface-2 disabled:text-faint",
  ghost: "font-semibold text-fg hover:bg-fg/8 hover:text-fg disabled:text-faint",
  danger:
    "border border-error/50 font-semibold text-error-soft hover:bg-error/10 hover:text-error-soft",
};

// Cỡ md giữ vùng bấm ≥ 48px, sm ≥ 44px.
const sizes: Record<ButtonSize, string> = {
  md: "min-h-12 px-6 text-base",
  sm: "min-h-11 px-[18px] text-[15px]",
};

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return cn(base, variants[variant], sizes[size]);
}

/** Nút thật (`<button>`). */
export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...rest
}: Common & ComponentProps<"button">) {
  return <button type={type} className={cn(buttonClass(variant, size), className)} {...rest} />;
}

/** Link trông như nút (điều hướng). */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: Common & ComponentProps<typeof Link>) {
  return <Link className={cn(buttonClass(variant, size), className)} {...rest} />;
}
