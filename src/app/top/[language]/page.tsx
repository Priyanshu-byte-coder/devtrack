import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion/Reveal";
import { stagger } from "@/lib/motion";
import {
  TOP_LANGUAGES,
  findTopLanguage,
  getTopDevelopers,
  type TopDeveloper,
} from "@/lib/top-developers";
import { JsonLd, SITE_URL, breadcrumbJsonLd } from "@/lib/seo/json-ld";

// Rendered on first request and then daily, like the search behind it. Not
// prerendered at build: a GitHub hiccup then would be cached for a day.
// A failed fetch throws instead, and errors are never cached.
export const revalidate = 86400;

const fmt = new Intl.NumberFormat("en-US");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ language: string }>;
}): Promise<Metadata> {
  const { language: slug } = await params;
  const language = findTopLanguage(slug);
  if (!language) return { title: "Top developers" };
  const title = `Top ${language.name} developers on GitHub`;
  const description = `The most-followed ${language.name} developers on GitHub, with their streaks, contributions and DevTrack rank. Updated daily.`;
  return {
    title,
    description,
    alternates: { canonical: `/top/${language.slug}` },
    openGraph: { title, description, url: `/top/${language.slug}` },
  };
}

function itemListJsonLd(languageName: string, developers: TopDeveloper[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Top ${languageName} developers on GitHub`,
    itemListElement: developers.map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/u/${d.login.toLowerCase()}`,
      name: d.name ?? d.login,
    })),
  };
}

export default async function TopLanguagePage({
  params,
}: {
  params: Promise<{ language: string }>;
}) {
  const { language: slug } = await params;
  const language = findTopLanguage(slug);
  if (!language) notFound();

  const developers = await getTopDevelopers(language);

  const others = TOP_LANGUAGES.filter((l) => l.slug !== language.slug);

  return (
    <div className="pb-10">
      {developers.length > 0 && (
        <JsonLd
          data={[
            itemListJsonLd(language.name, developers),
            breadcrumbJsonLd([
              { name: "DevTrack", path: "/" },
              { name: "Top developers", path: "/top" },
              { name: language.name, path: `/top/${language.slug}` },
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
        / <span className="text-[var(--accent)]">{language.name}</span>
      </nav>
      <h1 className="mt-2 font-pixel text-[clamp(1.8rem,4.5vw,3rem)] uppercase leading-none text-[var(--foreground)]">
        Top {language.name} developers
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
        The most-followed GitHub users who write {language.name}, refreshed
        daily. Open anyone to see their streak, contributions and where
        they&apos;d rank on DevTrack, or challenge them to a duel.
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
                  " "}
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
          Other languages
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {others.map((l) => (
            <li key={l.slug}>
              <Link
                href={`/top/${l.slug}`}
                className="block border-2 border-[var(--border)] px-3 py-1.5 text-sm text-[var(--card-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {l.name}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-[var(--muted-foreground)]">
          Writing {language.name} yourself?{" "}
          <Link
            href="/compare"
            className="text-[var(--accent)] hover:underline"
          >
            Start a duel
          </Link>{" "}
          or{" "}
          <Link
            href="/leaderboard"
            className="text-[var(--accent)] hover:underline"
          >
            climb the DevTrack leaderboard
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
