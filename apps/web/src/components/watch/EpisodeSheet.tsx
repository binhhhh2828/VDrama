"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BarsIcon, ChevronRightIcon, CloseIcon, LockIcon } from "@/components/ui/icons";
import type { Episode } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy";

const TAB_SIZE = 30;
/** Vuốt xuống quá chừng này (px) thì đóng bảng. */
const SWIPE_CLOSE = 70;

/** Khoảng tập của mỗi tab: 1–30, 31–60... (chỉ tab cuối có thể ngắn hơn). */
export function episodeTabs(count: number): { from: number; to: number }[] {
  const tabs: { from: number; to: number }[] = [];
  for (let from = 1; from <= count; from += TAB_SIZE) {
    tabs.push({ from, to: Math.min(from + TAB_SIZE - 1, count) });
  }
  return tabs;
}

/**
 * Bảng danh sách tập theo ảnh 23: bottom sheet đen bo trên, các tab khoảng tập, lưới 6 cột; tập đang
 * xem nền accent có biểu tượng thanh nhạc, tập VIP chưa mở khóa có ổ khóa góc trên phải. Đóng bằng nút
 * X, phím Esc, chạm nền phủ, vuốt xuống hoặc khi đổi trang. Từ `md` là hộp thoại giữa màn hình.
 */
export function EpisodeSheet({
  open,
  onClose,
  slug,
  episodes,
  currentNumber,
  isVip,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  episodes: Episode[];
  currentNumber: number;
  isVip: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const touchY = useRef<number | null>(null);
  const pathname = usePathname();

  const count = episodes.length ? Math.max(...episodes.map((e) => e.number)) : 0;
  const tabs = episodeTabs(count);
  const currentTab = Math.max(
    0,
    tabs.findIndex((t) => currentNumber >= t.from && currentNumber <= t.to),
  );
  const [picked, setPicked] = useState<{ number: number; tab: number } | null>(null);
  // Mở lại (hoặc sang tập khác) thì về tab chứa tập đang xem; người dùng chọn tab khác thì giữ.
  const tab = picked && picked.number === currentNumber ? picked.tab : currentTab;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Đổi trang (bấm một tập) thì đóng.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onClose();
  }, [pathname, onClose]);

  const range = tabs[tab] ?? { from: 1, to: 0 };
  const shown = episodes.filter((e) => e.number >= range.from && e.number <= range.to);

  const swipeEnd = useCallback(
    (endY: number | undefined) => {
      const start = touchY.current;
      touchY.current = null;
      if (start !== null && endY !== undefined && endY - start > SWIPE_CLOSE) onClose();
    },
    [onClose],
  );

  return (
    <dialog
      ref={ref}
      aria-label={copy.series.episodeList}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={(e) => {
        // Chỉ tính vuốt khi lưới đang ở đầu (không phải đang cuộn nội dung).
        touchY.current = e.currentTarget.scrollTop <= 0 ? (e.touches[0]?.clientY ?? null) : null;
      }}
      onTouchEnd={(e) => swipeEnd(e.changedTouches[0]?.clientY)}
      className={cn(
        "fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-[24px] bg-canvas-black p-0 text-fg",
        "backdrop:bg-black/60",
        "translate-y-full transition-[translate,display,overlay] transition-discrete duration-250 ease-out",
        "open:translate-y-0 starting:open:translate-y-full",
        "md:inset-auto md:m-auto md:max-w-[560px] md:translate-y-0 md:rounded-[24px] md:border md:border-line md:transition-none",
      )}
    >
      <div className="px-[13px] pt-5 pb-6">
        <h2 className="px-0.5 text-base">{copy.series.episodeList}</h2>

        <div className="mt-2 flex items-center border-b border-line">
          <div role="tablist" aria-label="Episode ranges" className="flex items-center">
            {tabs.map((t, i) => (
              <button
                key={t.from}
                type="button"
                role="tab"
                aria-selected={i === tab}
                onClick={() => setPicked({ number: currentNumber, tab: i })}
                className={cn(
                  "relative flex h-11 items-center px-3.5 text-[13px]",
                  i === tab ? "text-accent" : "text-fg",
                )}
              >
                {t.from} - {t.to}
                {i === tab ? (
                  <span className="absolute inset-x-3.5 bottom-0 h-0.5 rounded-full bg-accent" />
                ) : null}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Close episode list"
            onClick={onClose}
            className="flex size-11 items-center justify-center text-fg"
          >
            <CloseIcon size={20} />
          </button>
          <Link
            href={`/series/${slug}`}
            className="ml-auto flex min-h-11 items-center gap-0.5 text-[13px] text-muted no-underline hover:text-fg"
          >
            {copy.series.allEpisodes} <ChevronRightIcon size={14} />
          </Link>
        </div>

        <ol className="mt-3.5 grid grid-cols-6 gap-[7px]">
          {shown.map((e) => {
            const current = e.number === currentNumber;
            const locked = e.access === "vip" && !isVip;
            return (
              <li key={e.id}>
                <Link
                  href={`/series/${slug}/episode/${e.number}`}
                  aria-current={current ? "page" : undefined}
                  aria-label={`Episode ${e.number}${locked ? ", VIP" : ""}`}
                  className={cn(
                    "hit-44 relative flex h-[33px] items-center justify-center rounded-md text-sm font-semibold no-underline",
                    current
                      ? "bg-accent text-on-accent hover:text-on-accent"
                      : locked
                        ? "bg-[#232323] text-fg hover:text-fg"
                        : "bg-[#272727] text-fg hover:text-fg",
                  )}
                >
                  {current ? <BarsIcon size={18} /> : e.number}
                  {locked ? (
                    <LockIcon size={11} className="absolute top-1 right-1 text-muted" aria-hidden />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </dialog>
  );
}
