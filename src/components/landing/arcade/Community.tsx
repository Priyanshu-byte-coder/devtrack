import { Github } from "lucide-react";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { TIER_THRESHOLDS, XP_PER } from "@/lib/gamification/scoring";
import DevLookup from "./DevLookup";
import SectionHeading from "./SectionHeading";
import { REPO_URL, SIGN_IN_HREF, type RepoStats } from "./types";

export function CoOp({ stats }: { stats: RepoStats }) {
  const counters = [
    { label: "Commits", value: stats.totalCommits },
    { label: "PRs merged", value: stats.mergedPRs },
    { label: "Contributors", value: stats.contributorCount },
    { label: "GitHub stars", value: stats.stars },
  ];
  const goodFirstIssues = `${REPO_URL}/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22`;

  return (
    <section
      aria-labelledby="coop-heading"
      className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8"
    >
      <SectionHeading
        id="coop-heading"
        eyebrow="Co-op mode"
        title="Built in public. Ship with us."
      >
        DevTrack is MIT licensed, self-hostable, and built by the developers who
        use it. New to open source? There&apos;s a good first issue waiting, and
        a maintainer who reviews every PR.
      </SectionHeading>

      <RevealGroup
        as="ul"
        aria-label="DevTrack on GitHub"
        className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4"
        stagger={0.08}
      >
        {counters.map((c) => (
          <RevealItem
            as="li"
            key={c.label}
            className="px-frame bg-[var(--card)] p-5"
          >
            <span className="block font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              {c.label}
            </span>
            <span className="mt-2 block font-pixel text-3xl tabular-nums text-[var(--card-foreground)]">
              <AnimatedNumber value={c.value} />
            </span>
          </RevealItem>
        ))}
      </RevealGroup>

      {stats.contributors.length > 0 && (
        <ul aria-label="Contributors" className="mt-10 flex flex-wrap gap-1">
          {stats.contributors.map((c) => (
            <li key={c.login}>
              <a
                href={c.html_url}
                target="_blank"
                rel="noopener noreferrer"
                title={c.login}
                className="block outline-offset-2 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- deliberately pixelated, not optimised */}
                <img
                  src={`${c.avatar_url}${c.avatar_url.includes("?") ? "&" : "?"}s=20`}
                  alt={c.login}
                  width={36}
                  height={36}
                  loading="lazy"
                  className="h-9 w-9 bg-[var(--control)] [image-rendering:pixelated]"
                />
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="-m-1 mt-10 flex flex-wrap gap-2">
        <a
          href={goodFirstIssues}
          target="_blank"
          rel="noopener noreferrer"
          className="px-btn"
        >
          {stats.goodFirstIssues > 0
            ? `${stats.goodFirstIssues} good first ${stats.goodFirstIssues === 1 ? "issue" : "issues"}`
            : "Good first issues"}
        </a>
        <a
          href={`${REPO_URL}/blob/main/CONTRIBUTING.md`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-btn px-btn-ghost"
        >
          <Github className="h-4 w-4" aria-hidden="true" />
          Contributing guide
        </a>
      </div>
    </section>
  );
}

/** Questions people (and answer engines) ask. Also emitted as FAQPage JSON-LD. */
export const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "What is DevTrack?",
    a: "DevTrack is a free, open-source dashboard that turns your GitHub activity into stats, a coding streak, XP and a rank on a global developer leaderboard. You sign in with GitHub and everything is built from your real commits, pull requests and reviews.",
  },
  {
    q: "How is the DevTrack score calculated?",
    a: "Your score runs from 0 to 1000 and blends four signals: consistency (active days and your current streak, 30%), impact (pull requests, with reviews counting half, 30%), volume (commits, 25%) and breadth (repositories you contributed to, 15%). Each signal mixes log-scaled progress toward a fixed target with your percentile among everyone on the board.",
  },
  {
    q: "What are the DevTrack tiers?",
    a: `There are six tiers: Bronze (0+), Silver (${TIER_THRESHOLDS.silver}+), Gold (${TIER_THRESHOLDS.gold}+), Platinum (${TIER_THRESHOLDS.platinum}+), Diamond (${TIER_THRESHOLDS.diamond}+) and Legend (${TIER_THRESHOLDS.legend}+). Separately, XP from your lifetime totals sets your level: ${XP_PER.commit} XP per commit, ${XP_PER.pr} per pull request and ${XP_PER.review} per review.`,
  },
  {
    q: "Can I see someone's GitHub stats without them signing up?",
    a: "Yes. Every GitHub user has a page at devtrack.live/u/username built from their public activity, including where they would rank if they joined. If it's your page, you can claim it to join the leaderboard.",
  },
  {
    q: "How do I add a DevTrack badge to my GitHub README?",
    a: "Sign in, make your profile public and join the leaderboard, then copy the Markdown for the rank, streak or commits badge from your profile page into your README. The badges update automatically.",
  },
  {
    q: "How often do rankings update?",
    a: "Leaderboard snapshots are taken every day, which is when rank changes and tiers are recorded. Monthly boards are seasons: each one starts fresh on the first of the month.",
  },
  {
    q: "What access does DevTrack need to my GitHub account?",
    a: "Signing in uses GitHub OAuth so your private activity can count toward your own stats. Your public profile only shows the widgets you choose, you can make it private at any time, and you can revoke access from your GitHub settings.",
  },
  {
    q: "Is DevTrack free?",
    a: "Yes. DevTrack is free and MIT licensed, and you can self-host it.",
  },
];

export function Faq() {
  return (
    <section
      aria-labelledby="faq-heading"
      className="border-y-4 border-[var(--border)] bg-[var(--card)]"
    >
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          id="faq-heading"
          eyebrow="FAQ"
          title="Questions"
          center
        />
        <div className="mt-10 space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group border-2 border-[var(--border)] bg-[var(--background)] open:border-[var(--accent)]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 font-semibold text-[var(--card-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] [&::-webkit-details-marker]:hidden">
                <h3 className="text-base">{item.q}</h3>
                <span
                  aria-hidden="true"
                  className="font-pixel text-lg text-[var(--accent)] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="px-4 pb-4 text-sm leading-6 text-[var(--muted-foreground)]">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function Continue() {
  return (
    <section aria-labelledby="continue-heading" className="px-grid-bg">
      <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <p
          aria-hidden="true"
          className="px-blink font-pixel text-6xl text-[var(--accent)] sm:text-7xl"
        >
          9
        </p>
        <h2
          id="continue-heading"
          className="mt-4 font-pixel text-[clamp(2rem,5vw,3.4rem)] uppercase leading-none text-[var(--foreground)]"
        >
          Continue?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[var(--muted-foreground)]">
          Your history is already on GitHub. Sign in and see your rank, your
          tier and your streak in under a minute.
        </p>
        <div className="-m-1 mt-8 flex flex-wrap justify-center gap-2">
          <a href={SIGN_IN_HREF} className="px-btn">
            <Github className="h-4 w-4" aria-hidden="true" />
            Sign in with GitHub
          </a>
        </div>
        <DevLookup className="mx-auto mt-10 max-w-md text-left" />
      </div>
    </section>
  );
}
