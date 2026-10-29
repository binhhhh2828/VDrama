"use client";

import { useEffect, useRef, useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export type GenreChip = { label: string; href: string; active: boolean };

/** Chip cao 33px, khoảng cách dọc 10px: ba hàng = 3×33 + 2×10. */
const COLLAPSED_PX = 119;

/**
 * Nhóm chip thể loại ở trang Series (ảnh 18): chip chữ nhật xếp nhiều dòng, thu gọn còn 3 dòng và có
 * nút tròn mũi tên ở góc phải dưới để mở hết; không đủ dài để tràn thì không có nút.
 */
export function GenreChips({ items }: { items: GenreChip[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight > COLLAPSED_PX + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="Genres" className="relative">
      <div
        ref={listRef}
        style={expanded ? undefined : { maxHeight: COLLAPSED_PX }}
        className="flex flex-wrap gap-x-2.5 gap-y-2.5 overflow-hidden"
      >
        {items.map((c) => (
          <Chip key={c.label} href={c.href} active={c.active} className="shrink-0">
            {c.label}
          </Chip>
        ))}
        {/* Chừa chỗ cho nút ở cuối dòng cuối để không che chip. */}
        {overflows ? <span aria-hidden className="h-[33px] w-11 shrink-0" /> : null}
      </div>
      {overflows ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? "Show fewer genres" : "Show all genres"}
          onClick={() => setExpanded((v) => !v)}
          className="hit-44 absolute right-0 bottom-0 flex size-9 items-center justify-center rounded-full bg-surface-3 text-fg"
        >
          <ChevronDownIcon
            size={20}
            className={cn("transition-transform", expanded && "rotate-180")}
          />
        </button>
      ) : null}
    </nav>
  );
}
