import Link from "next/link";
import { cn } from "@/lib/cn";

/** Chuyển giữa Sign in / Create account, giữ nguyên `?next=`. */
export function AuthTabs({ active, next }: { active: "signin" | "signup"; next: string }) {
  const qs = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  const tab = (key: "signin" | "signup", label: string) => (
    <Link
      href={`/${key}${qs}`}
      aria-current={active === key ? "page" : undefined}
      className={cn(
        "flex h-11 flex-1 items-center justify-center rounded-full text-[15px] no-underline",
        active === key
          ? "bg-brand font-bold text-ink hover:text-ink"
          : "font-semibold text-muted hover:text-fg",
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav
      aria-label="Account"
      className="flex gap-1.5 rounded-full border border-line bg-surface p-[5px]"
    >
      {tab("signin", "Sign in")}
      {tab("signup", "Create account")}
    </nav>
  );
}

export function AuthHeading({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-[26px] font-extrabold md:text-[30px]">{title}</h1>
      <p className="text-[15px] text-muted">{text}</p>
    </div>
  );
}

export function FormAlert({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-input border border-error/40 bg-error/10 px-4 py-3 text-sm text-error-soft"
    >
      {children}
    </p>
  );
}
