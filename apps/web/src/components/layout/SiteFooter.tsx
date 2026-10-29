import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { FOOTER_LINKS } from "./nav";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-5 px-4 py-8 sm:px-6">
        <Logo height={32} />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted no-underline hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <span className="text-[13px] text-muted">© 2026 VDrama</span>
      </div>
    </footer>
  );
}
