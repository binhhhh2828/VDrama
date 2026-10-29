"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { ChevronRightIcon, PlayIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export type HeroSlide = {
  slug: string;
  title: string;
  bannerUrl: string | null;
  meta: string;
  tagline: string | null;
};

const ROTATE_MS = 7000;

/**
 * Banner trang chủ: tối đa 5 phim, tự chuyển sau 7 giây (dừng khi rê chuột, khi đang focus bên trong,
 * hoặc khi người dùng bật giảm chuyển động). Slide đầu được server render sẵn trong HTML.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused, slides.length]);

  if (slides.length === 0) return null;
  const slide = slides[index];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured series"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative flex h-[460px] items-end overflow-hidden rounded-panel border border-line bg-art md:h-[520px] md:rounded-hero"
    >
      {slides.map((s, i) =>
        s.bannerUrl ? (
          <Image
            key={s.slug}
            src={s.bannerUrl}
            alt=""
            fill
            preload={i === 0}
            sizes="(min-width: 1400px) 1360px, 100vw"
            className={cn(
              "object-cover transition-opacity duration-700",
              i === index ? "opacity-100" : "opacity-0",
            )}
          />
        ) : null,
      )}
      {/* Điện thoại: tối dần từ dưới lên; desktop: tối từ trái sang để chữ dễ đọc. */}
      <div className="absolute inset-0 bg-linear-to-b from-canvas/0 from-30% to-canvas/95 md:bg-linear-to-r md:from-canvas/92 md:from-0% md:via-canvas/55 md:to-canvas/0 md:to-75%" />

      <div
        key={slide.slug}
        aria-live="polite"
        className="relative flex w-full max-w-[620px] flex-col gap-3 p-[22px] md:gap-[18px] md:p-14"
      >
        <Badge kind="original" className="self-start" />
        <h1 className="text-[42px] leading-[1.05] font-black tracking-[-0.02em] md:text-[72px] md:leading-[1.02]">
          {slide.title}
        </h1>
        {slide.meta ? (
          <p className="text-sm font-medium text-fg-soft md:text-[15px]">{slide.meta}</p>
        ) : null}
        {slide.tagline ? (
          <p className="line-clamp-2 hidden text-[19px] leading-normal md:block">{slide.tagline}</p>
        ) : null}
        <div className="mt-1 flex gap-2.5 md:mt-2 md:gap-3">
          <ButtonLink href={`/series/${slide.slug}/episode/1`} className="flex-1 md:flex-none">
            <PlayIcon /> <span className="md:hidden">Watch</span>
            <span className="hidden md:inline">Watch Episode 1</span>
          </ButtonLink>
          <ButtonLink href={`/series/${slide.slug}`} variant="secondary">
            Details <ChevronRightIcon size={16} />
          </ButtonLink>
        </div>
      </div>

      {slides.length > 1 ? (
        <div className="absolute top-5 right-5 flex gap-1 md:top-auto md:right-8 md:bottom-8">
          {slides.map((s, i) => (
            <button
              key={s.slug}
              type="button"
              aria-label={`Show ${s.title}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => setIndex(i)}
              className="flex h-11 items-center px-1"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-all",
                  i === index ? "w-7 bg-pink" : "w-1.5 bg-fg/35",
                )}
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** Banner dự phòng khi chưa có phim nào có ảnh banner. */
export function HeroFallback() {
  return (
    <section className="relative flex h-[460px] items-end overflow-hidden rounded-panel border border-line bg-art md:h-[520px] md:rounded-hero">
      <div className="relative flex max-w-[620px] flex-col gap-4 p-[22px] md:p-14">
        <h1 className="text-[42px] leading-[1.05] font-black tracking-[-0.02em] md:text-[64px]">
          AI dramas you can binge tonight
        </h1>
        <p className="text-lg text-fg-soft">Short series, new episodes every week.</p>
        <Link href="/browse" className="text-base font-semibold">
          Browse all series
        </Link>
      </div>
    </section>
  );
}
