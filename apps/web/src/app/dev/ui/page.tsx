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
import { PosterCard } from "@/components/ui/PosterCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PosterGridSkeleton, Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "UI kit", robots: { index: false } };

// Trang xem nhanh các thành phần, chỉ có khi `next dev`. Bản build production trả 404.
export default function DevUiPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const colors: Array<[string, string]> = [
    ["canvas", "#0B0709"],
    ["surface", "#150E12"],
    ["surface-2", "#1F1419"],
    ["line", "#36252D"],
    ["fg", "#F7EFF2"],
    ["muted", "#B5A2AA"],
    ["pink", "#FF3D7F"],
    ["orange", "#FF8A3D"],
    ["link", "#FF6FA3"],
    ["vip", "#FFC247"],
    ["success", "#4FD6A0"],
    ["error", "#FF6B6B"],
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1360px] flex-col gap-12 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-extrabold tracking-[0.14em] text-link">
            VDRAMA · UI KIT
          </span>
          <h1 className="text-4xl font-black tracking-[-0.02em] sm:text-[52px]">
            Dark, warm, cinematic
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
          <div className="col-span-3 flex flex-col gap-2 sm:col-span-2">
            <div className="h-16 rounded-card border border-line bg-brand" />
            <span className="text-sm font-semibold">bg-brand</span>
            <span className="font-mono text-xs text-muted">#FF2E7E → #FF7A3D</span>
          </div>
        </div>
      </Section>

      <Section title="Type">
        <div className="flex flex-col gap-4">
          <span className="text-5xl leading-[1.05] font-black tracking-[-0.02em] sm:text-[56px]">
            Virtual City
          </span>
          <span className="text-[28px] font-extrabold">Continue watching</span>
          <span className="text-[22px] font-extrabold">Trending now</span>
          <p className="max-w-prose text-base leading-relaxed text-fg-soft">
            Is love real, or just an algorithm? Short AI dramas you can binge in an evening.
          </p>
          <span className="text-[13px] text-muted">12 episodes · Romance</span>
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
          <Button disabled>Disabled</Button>
          <ButtonLink href="/dev/ui" size="sm">
            Small link
          </ButtonLink>
          <ButtonLink href="/dev/ui" size="sm" variant="secondary">
            Sign in
          </ButtonLink>
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
          <GenreTag>Romance</GenreTag>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Chip href="/dev/ui" active>
            All
          </Chip>
          <Chip href="/dev/ui">Romance</Chip>
          <Chip href="/dev/ui">Fantasy</Chip>
          <Chip href="/dev/ui">Action</Chip>
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-5">
          <PosterCard
            href="/dev/ui"
            title="Virtual City"
            meta="12 episodes · Romance"
            posterUrl="https://picsum.photos/seed/poster-virtual-city/400/600"
            rank={1}
          />
          <PosterCard
            href="/dev/ui"
            title="Sky of Memories"
            meta="24 episodes · Romance"
            rank={2}
            vip
          />
          <PosterCard href="/dev/ui" title="Girl From Another World" meta="12 episodes" isNew />
          <PosterCard
            href="/dev/ui"
            title="Twin Destinies"
            meta="24 episodes · Romance"
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
