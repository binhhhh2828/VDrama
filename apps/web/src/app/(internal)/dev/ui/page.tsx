import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Chip, GenreTag } from "@/components/ui/Chip";
import { EpisodeThumb } from "@/components/ui/EpisodeThumb";
import { Field } from "@/components/ui/Field";
import * as Icons from "@/components/ui/icons";
import { PosterArt } from "@/components/ui/PosterArt";
import { PosterCard } from "@/components/ui/PosterCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PosterGridSkeleton, Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "UI kit", robots: { index: false } };

// Trang xem nhanh các thành phần, chỉ có khi `next dev`. Bản build production trả 404.
export default async function DevUiPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  // Nạp động sau khi kiểm tra NODE_ENV để dữ liệu demo không vào bản build.
  const [{ default: demoData }, { demoExtras }] = await Promise.all([
    import("@/lib/demo/data.json"),
    import("@/lib/demo/extras"),
  ]);
  const demoSeries = demoData.series;

  // Giữ khớp với globals.css và bảng Màu trong docs/design.md.
  const colors: Array<[string, string]> = [
    ["canvas", "#141414"],
    ["canvas-black", "#000000"],
    ["surface", "#252525"],
    ["surface-2", "#2A2A2A"],
    ["surface-3", "#333333"],
    ["line", "#383838"],
    ["fg", "#F3F3F3"],
    ["fg-soft", "#D6D6D6"],
    ["muted", "#828282"],
    ["faint", "#5F5F5F"],
    ["accent", "#F4305E"],
    ["link-hover", "#FF7A96"],
    ["vip", "#F6C781"],
    ["vip-ink", "#4B3625"],
    ["wallet", "#2B262C"],
    ["plum", "#2F111D"],
    ["plum-2", "#4C1623"],
    ["plum-3", "#381624"],
    ["cta-orange", "#FF8225"],
    ["success", "#4FD6A0"],
    ["error", "#FF6B6B"],
  ];
  const gradients: Array<[string, string]> = [
    ["bg-brand", "#F4305E → #FE4F32"],
    ["bg-cta", "#CE6A9E → #FF8225"],
    ["bg-vip-gold", "#FCDEA0 → #F6C781"],
    ["bg-plum-fade", "#2F111D → canvas"],
    ["bg-hot", "#FF5A36 → #D8261F"],
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1360px] flex-col gap-12 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-extrabold tracking-[0.14em] text-link">
            VDRAMA · UI KIT
          </span>
          <h1 className="text-4xl font-black tracking-[-0.02em] sm:text-[52px]">
            Mobile-first, NetShort layout
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Logo height={56} />
          <Logo variant="icon" height={56} />
        </div>
      </div>

      <Section title="Color">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {colors.map(([name, hex]) => (
            <div key={name} className="flex flex-col gap-2">
              <div className="h-16 rounded-card border border-line" style={{ background: hex }} />
              <span className="text-sm font-semibold">{name}</span>
              <span className="font-mono text-xs text-muted">{hex}</span>
            </div>
          ))}
          {gradients.map(([name, value]) => (
            <div key={name} className="flex flex-col gap-2">
              <div className={`h-16 rounded-card border border-line ${name}`} />
              <span className="text-sm font-semibold">{name}</span>
              <span className="font-mono text-xs text-muted">{value}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type (Be Vietnam Pro)">
        <div className="flex flex-col gap-4">
          <span className="text-[28px] leading-tight font-bold">
            Explore genres &amp; short dramas
          </span>
          <span className="text-2xl font-semibold">Hot Shorts</span>
          <span className="text-base font-bold">Recommended for You</span>
          <span className="line-clamp-2 max-w-[117px] text-[15px] leading-[17px] font-semibold">
            Memories of You
          </span>
          <span className="text-xs text-muted">Romance • Drama</span>
          <p className="max-w-prose text-[15px] leading-relaxed text-fg-soft">
            Is love real, or just an algorithm? Short AI dramas you can binge in an evening.
          </p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            <Icons.PlayIcon /> Watch Episode 1
          </Button>
          <Button variant="secondary">
            <Icons.PlusIcon size={16} /> My List
          </Button>
          <Button variant="vip">
            <Icons.CrownIcon size={18} /> Get VIP
          </Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">
            <Icons.TrashIcon size={16} /> Clear history
          </Button>
          <Button variant="gradient">
            <Icons.PlayIcon /> Play now
          </Button>
          <Button variant="cta">Watch now</Button>
          <Button disabled>Disabled</Button>
          <ButtonLink href="/dev/ui" size="sm">
            Small link
          </ButtonLink>
          <ButtonLink href="/dev/ui" size="sm" variant="secondary">
            Sign in
          </ButtonLink>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href="/dev/ui" size="xs" className="w-[56%] max-w-60">
            Play now
          </ButtonLink>
          <ButtonLink href="/dev/ui" size="xs" variant="gradient" className="w-[180px]">
            <Icons.PlayIcon size={12} /> Play now
          </ButtonLink>
          <span className="text-xs text-muted">size xs: nhìn 30px, bấm 44px</span>
        </div>
      </Section>

      <Section title="Labels and chips">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge kind="top">TOP 1</Badge>
          <Badge kind="vip" />
          <Badge kind="free" />
          <Badge kind="new" />
          <Badge kind="preview" />
          <Badge kind="original" />
          <Badge kind="hot" />
          <GenreTag>Romance</GenreTag>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Chip href="/dev/ui" active>
            All
          </Chip>
          <Chip href="/dev/ui">Romance</Chip>
          <Chip href="/dev/ui">Fantasy</Chip>
          <Chip href="/dev/ui">Action</Chip>
          <Chip href="/dev/ui">Comedy</Chip>
          <Chip href="/dev/ui">Family</Chip>
          <Chip href="/dev/ui">Drama</Chip>
        </div>
      </Section>

      <Section title="Form">
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <Field id="ui-email" label="Email" type="email" placeholder="you@example.com" />
          <Field
            id="ui-pw"
            label="Password"
            type="password"
            defaultValue="short"
            error="Use at least 8 characters."
          />
        </div>
        <div className="flex max-w-md flex-col gap-1.5">
          <span className="text-xs text-muted">Progress bar</span>
          <ProgressBar value={0.62} label="62% watched" />
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-5">
          <PosterCard
            href="/dev/ui"
            title="Virtual City"
            genres={[
              { slug: "romance", name: "Romance" },
              { slug: "drama", name: "Drama" },
            ]}
            posterUrl="https://picsum.photos/seed/virtual-city/600/800"
            rank={1}
          />
          <PosterCard
            href="/dev/ui"
            title="Sky of Memories"
            genres={[{ slug: "romance", name: "Romance" }]}
            rank={2}
            vip
          />
          <PosterCard
            href="/dev/ui"
            title="Girl From Another World"
            genres={[
              { slug: "fantasy", name: "Fantasy" },
              { slug: "comedy", name: "Comedy" },
            ]}
            isNew
            original
          />
          <PosterCard
            href="/dev/ui"
            title="Twin Destinies"
            genres={[{ slug: "romance", name: "Romance" }]}
            isNew
            vip
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
          <EpisodeThumb
            href="/dev/ui"
            title="Virtual City"
            meta="EP 3 · The Promise · 12 min left"
            thumbnailUrl="https://picsum.photos/seed/thumb-virtual-city-3/640/360"
            progress={0.62}
          />
          <EpisodeThumb href="/dev/ui" title="Episode 1" meta="21 min" access="free" current />
          <EpisodeThumb href="/dev/ui" title="Episode 8" meta="23 min" access="vip" locked />
        </div>
      </Section>

      <Section title="Demo posters (3:4) and hero (4:5)">
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {demoSeries.map((s) => {
            const extras = demoExtras(s.slug);
            return (
              <div key={s.slug} className="flex flex-col gap-1.5">
                <PosterArt
                  src={s.poster_url}
                  title={s.title}
                  sizes="(min-width: 640px) 200px, 33vw"
                  className="rounded-[10px]"
                >
                  {extras.badge ? (
                    <Badge kind={extras.badge} className="absolute top-1.5 left-1.5" />
                  ) : null}
                </PosterArt>
                <span className="text-xs text-muted">
                  ♥ {extras.likes.toLocaleString("en-US")} · {extras.reviews.length} reviews
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {demoSeries.map((s) => (
            <PosterArt
              key={s.slug}
              src={s.banner_url}
              title={s.title}
              ratio="hero"
              sizes="300px"
              className="w-[300px] shrink-0 rounded-card"
            />
          ))}
        </div>
      </Section>

      <Section title="Loading">
        <Skeleton className="h-10 w-64" />
        <PosterGridSkeleton count={4} />
      </Section>

      <Section title="Icons">
        <div className="flex flex-wrap gap-4 text-fg-soft">
          {Object.entries(Icons).map(([name, Icon]) => (
            <span
              key={name}
              title={name}
              className="flex size-11 items-center justify-center rounded-input border border-line"
            >
              <Icon />
            </span>
          ))}
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-[22px] font-extrabold">{title}</h2>
      {children}
    </section>
  );
}
