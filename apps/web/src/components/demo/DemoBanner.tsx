"use client";

import { IS_DEMO } from "@/lib/demo/config";

/** Dải nhãn ở đầu mọi trang của bản demo: dữ liệu mẫu, không có gì là thật. */
export function DemoBanner() {
  if (!IS_DEMO) return null;

  async function reset() {
    if (process.env.NEXT_PUBLIC_DEMO !== "true") return;
    const { demoFetch } = await import("@/lib/demo/instance");
    demoFetch.store.reset();
    // Tải lại cả trang (không điều hướng trong app) để trạng thái đăng nhập trong bộ nhớ cũng được xóa.
    window.location.reload();
  }

  return (
    <div
      role="note"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-vip/35 bg-vip/10 px-4 py-2 text-center text-xs text-fg-soft"
    >
      <span>
        <strong className="font-extrabold tracking-[0.08em] text-vip">DEMO</strong> · Sample data
        only. Nothing here is real and nothing is sent to a server.
      </span>
      <button
        type="button"
        onClick={reset}
        className="min-h-8 rounded-full border border-vip/40 px-3 font-semibold text-vip hover:bg-vip/15"
      >
        Reset demo
      </button>
    </div>
  );
}
