"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Thẻ `<header>` dính đầu trang: trong suốt ở đầu trang, có lớp tối nhẹ khi đã cuộn để chữ đọc được. */
export function HeaderBar({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 transition-colors duration-200",
        scrolled ? "bg-canvas/80 backdrop-blur-md" : "bg-transparent",
      )}
    >
      {children}
    </header>
  );
}
