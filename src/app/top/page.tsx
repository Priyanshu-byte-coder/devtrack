import type { Metadata } from "next";
import Link from "next/link";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { TOP_COUNTRIES, TOP_LANGUAGES } from "@/lib/top-developers";

export const metadata: Metadata = {
  title: "Top GitHub developers",
  description:
    "The most-followed GitHub developers for JavaScript, TypeScript, Python, Go, Rust and more, and in India, the US, Germany, Brazil and beyond, with their streaks, contributions and DevTrack rank.",
  alternates: { canonical: "/top" },
  openGraph: {
    title: "Top developers on GitHub · DevTrack",
    description: "The most-followed GitHub developers, language by language.",
    url: "/top",
  },
};

export default function TopDevelopersHub() {
  return (
    <div className="pb-10">
      <p className="font-pixel text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
        Hall of fame
      </p>
      <h1 className="mt-2 font-pixel text-[clamp(2rem,5vw,3.25rem)] uppercase leading-none text-[var(--foreground)]">
        Top developers
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
        The most-followed developers on GitHub, by language and by country. Each
        list updates daily; open anyone to see their stats and where they&apos;d
        rank on DevTrack.
      </p>

      <h2 className="mt-10 font-pixel text-sm uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
        By language
      </h2>

      <RevealGroup
        as="ul"
        className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        stagger={0.03}
      >
        {TOP_LANGUAGES.map((language) => (
          <RevealItem as="li" key={language.slug} className="min-w-0">
            <Link
              href={`/top/${language.slug}`}
              className="px-frame flex items-center justify-between gap-2 bg-[var(--card)] px-4 py-4 transition-colors hover:bg-[var(--control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <span className="truncate font-pixel text-sm uppercase text-[var(--card-foreground)]">
                {language.name}
              </span>
              <span aria-hidden="true" className="text-[var(--accent)]">
                →
              </span>
            </Link>
          </RevealItem>
        ))}
      </RevealGroup>

      <h2 className="mt-12 font-pixel text-sm uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
        By country
      </h2>
      <ul className="mt-4 flex flex-wrap gap-2">
        {TOP_COUNTRIES.map((country) => (
          <li key={country.slug}>
            <Link
              href={`/top/country/${country.slug}`}
              className="block border-2 border-[var(--border)] px-3 py-1.5 text-sm text-[var(--card-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {country.name.replace(/^the /, "")}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
