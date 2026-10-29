import Link from "next/link";

export function SectionHeader({ id, title, href }: { id: string; title: string; href?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="text-xl font-extrabold md:text-2xl">
        {title}
      </h2>
      {href ? (
        <Link href={href} className="text-sm font-semibold no-underline">
          See all
        </Link>
      ) : null}
    </div>
  );
}
