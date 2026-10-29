import type { ReactNode } from "react";

/** Màn hình thông báo giữa trang (404, lỗi, cần đăng nhập, cần VIP...). */
export function StatusScreen({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 px-4 py-20 text-center">
      {eyebrow ? (
        <span className="bg-brand bg-clip-text text-[13px] font-extrabold tracking-[0.14em] text-transparent">
          {eyebrow}
        </span>
      ) : null}
      <h1 className="text-[32px] leading-tight font-black tracking-[-0.02em] sm:text-[40px]">
        {title}
      </h1>
      {children ? <div className="text-base leading-relaxed text-fg-soft">{children}</div> : null}
      {actions ? <div className="mt-2 flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </main>
  );
}
