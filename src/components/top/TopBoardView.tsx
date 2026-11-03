import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { stagger } from "@/lib/motion";
import type { TopDeveloper } from "@/lib/top-developers";
import { JsonLd, SITE_URL, breadcrumbJsonLd } from "@/lib/seo/json-ld";

const fmt = new Intl.NumberFormat("en-US");

interface TopBoardViewProps {
  /** Short name for the breadcrumb, e.g. "Rust" or "India". */
  crumb: string;
  /** Page path, e.g. "/top/rust". */
  path: string;
  /** Visible h1 and the ItemList name. */
  title: string;
  intro: ReactNode;
  developers: TopDeveloper[];
  others: { heading: string; links: Array<{ href: string; label: string }> };
  footer?: ReactNode;
}

/** A "top developers" list: language and country pages share it. */
export default function TopBoardView({
  crumb,
  path,
  title,
  intro,
  developers,
  others,
  footer,
}: TopBoardViewProps) {
  return (
    <div className="pb-10">
      {developers.length > 0 && (
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `${title} on GitHub`,
              itemListElement: developers.map((d, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: `${SITE_URL}/u/${d.login.toLowerCase()}`,
                name: d.name ?? d.login,
              })),
            },
            breadcrumbJsonLd([
              { name: "DevTrack", path: "/" },
              { name: "Top developers", path: "/top" },
              { name: crumb, path },
            ]),
          ]}
        />
      )}

      <nav
        aria-label="Breadcrumb"
        className="font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
      >
        <Link href="/top" className="hover:text-[var(--accent)]">
          Top developers
        </Link>{" "}
        / <span className="text-[var(--accent)]">{crumb}</span>
      </nav>
      <h1 className="mt-2 font-pixel text-[clamp(1.8rem,4.5vw,3rem)] uppercase leading-none text-[var(--foreground)]">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
        {intro}
      </p>

      <ol className="px-frame mt-8 divide-y-2 divide-dashed divide-[var(--border)] bg-[var(--card)]">
        {developers.map((dev, i) => (
          <Reveal
            as="li"
            key={dev.login}
            y={8}
            amount={0}
            delay={i < 12 ? i * stagger.tight : 0}
            className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--control)]"
          >
            <span className="w-8 shrink-0 font-pixel text-sm tabular-nums text-[var(--muted-foreground)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element -- GitHub avatar, sized by the URL */}
            <img
              src={`https://avatars.githubusercontent.com/${encodeURIComponent(dev.login)}?s=72`}
              alt=""
              width={36}
              height={36}
              loading="lazy"
              className="h-9 w-9 shrink-0 bg-[var(--control)]"
            />
            <div className="min-w-0 flex-1">
              {/* The whole row opens the profile, via the overlay. */}
              <Link
                href={`/u/${dev.login.toLowerCase()}`}
                className="truncate font-mono text-sm font-semibold text-[var(--card-foreground)] after:absolute after:inset-0 hover:text-[var(--accent)] focus-visible:text-[var(--accent)] focus-visible:underline focus-visible:outline-none"
              >
                @{dev.login}
              </Link>
              <p className="truncate text-xs text-[var(--muted-foreground)]">
                {[dev.name, dev.location].filter(Boolean).join(" · ") ||
                  dev.bio ||
                  " "}
              </p>
            </div>
            <div className="hidden shrink-0 text-right sm:block">
              <div className="font-pixel text-sm tabular-nums text-[var(--card-foreground)]">
                {fmt.format(dev.followers)}
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">
                followers
              </div>
            </div>
            <Link
              href={`/compare?vs=${encodeURIComponent(dev.login.toLowerCase())}`}
              // Keep crawlers on profiles: every duel is two GitHub fetches.
              rel="nofollow"
              className="relative z-10 shrink-0 border-2 border-[var(--border)] px-2 py-1 font-pixel text-[10px] uppercase text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              aria-label={`Duel @${dev.login}`}
            >
              Duel
            </Link>
          </Reveal>
        ))}
      </ol>

      <section aria-labelledby="more-heading" className="mt-12">
        <h2
          id="more-heading"
          className="font-pixel text-sm uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
        >
          {others.heading}
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {others.links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block border-2 border-[var(--border)] px-3 py-1.5 text-sm text-[var(--card-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        {footer && (
          <p className="mt-8 text-sm text-[var(--muted-foreground)]">
            {footer}
          </p>
        )}
      </section>
    </div>
  );
}
