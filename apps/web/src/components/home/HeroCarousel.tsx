"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { PlayIcon } from "@/components/ui/icons";
import { PosterArt } from "@/components/ui/PosterArt";
import { cn } from "@/lib/cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Link } from "@/components/i18n/navigation";

export type HeroSlide = {
  slug: string;
  title: string;
  bannerUrl: string | null;
  hot: boolean;
};

const ROTATE_MS = 6000;

/** Kéo hero lên nằm dưới header trong suốt (header cao 58px, ảnh 01). Desktop thì nằm dưới header. */
const UNDER_HEADER = "-mt-[58px] md:mt-0";

/**
 * Hero trang chủ theo ảnh 01: ảnh 3:4 tràn hai mép, header đè lên trên; tên phim + nhãn HOT, nút
 * "Play now" viên thuốc, chấm báo trang (đang chọn là thanh trắng dài). Vuốt bằng cuộn ngang có điểm
 * dừng (scroll-snap) nên đi theo ngón tay và mượt như cuộn gốc. Tự chuyển sau 6 giây; dừng khi đang
 * chạm/rê chuột/focus bên trong hoặc khi bật giảm chuyển động. Desktop: các thẻ 3:4 xếp cạnh nhau.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const t = useT();
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((i: number) => {
    const track = trackRef.current;
    const slide = track?.children[i] as HTMLElement | undefined;
    if (!track || !slide) return;
    track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: "smooth" });
  }, []);

  // Slide đang chọn = slide có mép trái gần vị trí cuộn nhất.
  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const items = Array.from(track.children) as HTMLElement[];
    let best = 0;
    let bestDist = Infinity;
    items.forEach((el, i) => {
      const dist = Math.abs(el.offsetLeft - track.offsetLeft - track.scrollLeft);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setIndex(best);
  };

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => goTo((index + 1) % slides.length), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused, slides.length, goTo]);

  if (slides.length === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("hero.label")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn("relative", UNDER_HEADER)}
    >
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] md:gap-3 md:px-6 md:scroll-px-6 [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s, i) => (
          <div
            key={s.slug}
            role="group"
            aria-roledescription="slide"
            aria-label={t("hero.slide", { i: i + 1, n: slides.length, title: s.title })}
            className="relative w-full shrink-0 snap-start snap-always md:w-[400px] md:overflow-hidden md:rounded-hero"
          >
            <PosterArt
              src={s.bannerUrl}
              title={s.title}
              ratio="hero"
              preload={i === 0}
              sizes="(min-width: 768px) 400px, 100vw"
              titleClassName="h-3/4! pb-[118px]!"
            >
              {/* Tối nhẹ ở đỉnh để logo/ô tìm kiếm đọc được; tối dần ở đáy để hòa vào nền trang. */}
              <div className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/55 to-black/0 md:hidden" />
              <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-b from-canvas/0 to-canvas" />
            </PosterArt>
            <div className="absolute inset-x-0 bottom-[26px] flex flex-col items-center gap-3 px-6">
              <p className="flex max-w-full items-center gap-1.5 text-sm font-bold">
                <span className="truncate">{s.title}</span>
                {s.hot ? <Badge kind="hot" className="shrink-0" /> : null}
              </p>
              <ButtonLink
                href={`/series/${s.slug}/episode/1`}
                size="xs"
                className="w-60 max-w-full text-sm"
              >
                <PlayIcon size={14} /> {t("series.playNow")}
              </ButtonLink>
            </div>
          </div>
        ))}
      </div>

      {slides.length > 1 ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1 md:hidden"
        >
          {slides.map((s, i) => (
            <span
              key={s.slug}
              className={cn(
                "h-[3px] rounded-full transition-all duration-300",
                i === index ? "w-[26px] bg-fg" : "w-2 bg-fg/35",
              )}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** Hero dự phòng khi chưa có phim nào có ảnh banner. */
export function HeroFallback() {
  return (
    <section
      className={cn(
        "relative flex aspect-[3/4] items-end bg-art md:mx-6 md:aspect-auto md:h-[500px] md:rounded-hero",
        UNDER_HEADER,
      )}
    >
      <div className="flex flex-col gap-3 p-6">
        <h1 className="text-[32px] leading-tight font-bold">AI dramas you can binge tonight</h1>
        <Link href="/browse" className="text-base font-semibold">
          Browse all series
        </Link>
      </div>
    </section>
  );
}

/** Khung giữ chỗ cùng kích thước khi đang tải hero. */
export function HeroSkeleton() {
  return (
    <div
      className={cn(
        "aspect-[3/4] animate-pulse bg-surface md:mx-6 md:aspect-auto md:h-[500px] md:rounded-hero",
        UNDER_HEADER,
      )}
    />
  );
}
