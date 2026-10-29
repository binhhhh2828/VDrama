"use client";

import { usePathname } from "next/navigation";
import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { VipPanel } from "./VipPanel";

type VipSheetApi = { open: () => void };

const Ctx = createContext<VipSheetApi | null>(null);

/** Mở bảng VIP (bottom sheet) từ bất kỳ nút nào, ví dụ "Get VIP" ở thanh dính đáy và trang tài khoản. */
export function useVipSheet(): VipSheetApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useVipSheet must be used inside <VipSheetProvider>");
  return ctx;
}

/**
 * Đóng bảng mỗi khi đổi trang. Cần `usePathname` nên tách riêng và đặt trong <Suspense> (đường dẫn hiện
 * tại chỉ biết lúc request; nếu không có Suspense thì cả trang không dựng sẵn được).
 */
function CloseOnNavigate({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onNavigate();
  }, [pathname, onNavigate]);
  return null;
}

/** Vuốt xuống quá chừng này (px) thì đóng bảng. */
const SWIPE_CLOSE = 70;

/**
 * Giữ một bảng VIP duy nhất cho cả site (ảnh 08, 09): bottom sheet bo trên 24px trượt từ đáy, đóng bằng
 * nút X, phím Esc, chạm nền phủ, vuốt xuống hoặc khi đổi trang. Từ `md` là hộp thoại giữa màn hình.
 */
export function VipSheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const touchY = useRef<number | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const api = useMemo<VipSheetApi>(() => ({ open: () => setOpen(true) }), []);

  return (
    <Ctx.Provider value={api}>
      {children}
      <Suspense fallback={null}>
        <CloseOnNavigate onNavigate={close} />
      </Suspense>
      <dialog
        ref={ref}
        aria-label="VIP plans"
        onClose={close}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className={cn(
          "fixed inset-x-0 top-auto bottom-0 m-0 max-h-[88dvh] w-full max-w-none overflow-hidden rounded-t-[24px] bg-canvas p-0 text-fg open:flex open:flex-col",
          "backdrop:bg-black/60",
          "translate-y-full transition-[translate,display,overlay] transition-discrete duration-250 ease-out",
          "open:translate-y-0 starting:open:translate-y-full",
          "md:inset-auto md:m-auto md:max-w-[520px] md:translate-y-0 md:rounded-[24px] md:border md:border-line md:transition-none",
        )}
      >
        {open ? (
          <>
            {/* Tay nắm: vuốt xuống từ đây để đóng (vuốt trong nội dung là cuộn, không đóng). */}
            <div
              onTouchStart={(e) => {
                touchY.current = e.touches[0]?.clientY ?? null;
              }}
              onTouchEnd={(e) => {
                const start = touchY.current;
                const end = e.changedTouches[0]?.clientY;
                touchY.current = null;
                if (start !== null && end !== undefined && end - start > SWIPE_CLOSE) close();
              }}
              className="flex h-7 shrink-0 touch-none justify-center pt-2.5 md:hidden"
            >
              <span aria-hidden className="h-1 w-10 rounded-full bg-fg/25" />
            </div>
            <VipPanel onClose={close} className="max-h-[calc(88dvh-28px)]" />
          </>
        ) : null}
      </dialog>
    </Ctx.Provider>
  );
}
