import type { Metadata } from "next";
import Link from "next/link";
import { Coffee, Heart } from "lucide-react";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { fetchRepoStats } from "@/lib/repo-stats";
import { getPublicSupporters } from "@/lib/supporters";
import { SPONSOR_LINKS } from "@/lib/sponsor-links";

export const metadata: Metadata = {
  title: "Sponsor",
  description:
    "DevTrack is free and open source. Sponsor it on GitHub, buy the team a chai, or put your developer tool in front of developers who ship.",
  alternates: { canonical: "/sponsor" },
};

// Supporters and repo stats are cached upstream; rebuild hourly.
export const revalidate = 3600;

const PERKS = [
  {
    title: "Sponsor badge",
    body: "A sponsor badge on your public profile and next to your name on the leaderboard.",
  },
  {
    title: "Supporters wall",
    body: "Your avatar on this page, linked to your profile (public profiles only).",
  },
  {
    title: "Keep it free",
    body: "Pays for hosting, GitHub API quota and new game modes, so DevTrack stays free.",
  },
];

export default async function SponsorPage() {
  const [stats, supporters] = await Promise.all([
    fetchRepoStats(),
    getPublicSupporters(),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 text-[var(--foreground)] sm:px-6 lg:px-8">
      <p className="font-pixel text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
        Insert coin
      </p>
      <h1 className="mt-2 font-pixel text-[clamp(2rem,5vw,3.25rem)] uppercase leading-none">
        Keep the arcade running
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted-foreground)]">
        DevTrack is free, MIT licensed and built in public. Sponsorships pay for
        hosting and GitHub API quota, and fund new features.
      </p>

      <div className="-m-1 mt-8 flex flex-wrap gap-2">
        <a
          href={SPONSOR_LINKS.github}
          target="_blank"
          rel="noopener noreferrer"
          className="px-btn"
        >
          <Heart className="h-4 w-4" aria-hidden="true" />
          Sponsor on GitHub
        </a>
        <a
          href={SPONSOR_LINKS.chai}
          target="_blank"
          rel="noopener noreferrer"
          className="px-btn px-btn-ghost"
        >
          <Coffee className="h-4 w-4" aria-hidden="true" />
          Buy us a chai
        </a>
      </div>

      <section aria-labelledby="perks-heading" className="mt-14">
        <h2
          id="perks-heading"
          className="font-pixel text-xl uppercase text-[var(--foreground)]"
        >
          What sponsors get
        </h2>
        <RevealGroup
          as="ul"
          className="mt-5 grid gap-4 md:grid-cols-3"
          stagger={0.08}
        >
          {PERKS.map((perk) => (
            <RevealItem
              as="li"
              key={perk.title}
              className="px-frame bg-[var(--card)] p-5"
            >
              <h3 className="font-pixel text-sm uppercase text-[var(--accent)]">
                {perk.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                {perk.body}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <section
        aria-labelledby="company-heading"
        className="px-frame px-frame-accent mt-14 bg-[var(--card)] p-6"
      >
        <h2
          id="company-heading"
          className="font-pixel text-xl uppercase text-[var(--card-foreground)]"
        >
          For companies
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
          One sponsor slot sits on the leaderboard, the page developers come
          back to. It&apos;s clearly labelled, with no tracking scripts and no
          pop-ups. A sponsorship can also include a logo in the GitHub README.
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "GitHub stars", value: stats.stars },
            { label: "Contributors", value: stats.contributorCount },
            { label: "PRs merged", value: stats.mergedPRs },
            { label: "Good first issues", value: stats.goodFirstIssues },
          ].map((s) => (
            <div key={s.label} className="bg-[var(--background)] p-4">
              <dt className="font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                {s.label}
              </dt>
              <dd className="mt-1 font-pixel text-2xl tabular-nums">
                <AnimatedNumber value={s.value} />
              </dd>
            </div>
          ))}
        </dl>
        <div className="-m-1 mt-6">
          <Link href="/contact" className="px-btn">
            Talk to us
          </Link>
        </div>
      </section>

      <section aria-labelledby="supporters-heading" className="mt-14">
        <h2
          id="supporters-heading"
          className="font-pixel text-xl uppercase text-[var(--foreground)]"
        >
          Supporters
        </h2>
        {supporters.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            No public supporters yet. Be player one.
          </p>
        ) : (
          <ul className="mt-5 flex flex-wrap gap-2">
            {supporters.map((login) => (
              <li key={login}>
                <Link
                  href={`/u/${login.toLowerCase()}`}
                  title={`@${login}`}
                  className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- GitHub avatar, sized by the URL */}
                  <img
                    src={`https://avatars.githubusercontent.com/${encodeURIComponent(login)}?s=96`}
                    alt={`@${login}`}
                    width={48}
                    height={48}
                    loading="lazy"
                    className="px-frame h-12 w-12 bg-[var(--control)]"
                    style={{ ["--px-c" as string]: "#f2c14e" }}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
