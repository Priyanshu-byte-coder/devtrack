import type { Metadata } from "next";
import Link from "next/link";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { CountryFlag, LanguageIcon } from "@/components/pixel/TopIcons";
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
              className="group px-frame flex flex-col items-center gap-2 bg-[var(--card)] px-3 py-3 text-center sm:flex-row sm:gap-3 sm:px-4 sm:text-left transition-colors hover:bg-[var(--control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <span className="flex h-10 w-11 shrink-0 items-center justify-center">
                <LanguageIcon
                  slug={language.slug}
                  className="transition-transform duration-150 motion-safe:group-hover:-translate-y-1"
                />
              </span>
              <span className="w-full min-w-0 flex-1 truncate font-pixel text-sm uppercase text-[var(--card-foreground)]">
                {language.name}
              </span>
              <span
                aria-hidden="true"
                className="hidden text-[var(--accent)] sm:inline"
              >
                →
              </span>
            </Link>
          </RevealItem>
        ))}
      </RevealGroup>

      <h2 className="mt-12 font-pixel text-sm uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
        By country
      </h2>
      <RevealGroup
        as="ul"
        className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        stagger={0.03}
      >
        {TOP_COUNTRIES.map((country) => (
          <RevealItem as="li" key={country.slug} className="min-w-0">
            <Link
              href={`/top/country/${country.slug}`}
              className="group px-frame flex flex-col items-center gap-2 bg-[var(--card)] px-3 py-3 text-center sm:flex-row sm:gap-3 sm:px-4 sm:text-left transition-colors hover:bg-[var(--control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <CountryFlag
                slug={country.slug}
                className="shrink-0 transition-transform duration-150 motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:-rotate-3"
              />
              <span className="w-full min-w-0 flex-1 truncate text-sm font-semibold text-[var(--card-foreground)]">
                {country.name.replace(/^the /, "")}
              </span>
              <span
                aria-hidden="true"
                className="hidden text-[var(--accent)] sm:inline"
              >
                →
              </span>
            </Link>
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  );
}
