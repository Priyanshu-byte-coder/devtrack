import Link from "next/link";
import { Github } from "lucide-react";
import PixelSprite from "@/components/buddy/PixelSprite";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import PixelArt, { type PixelIconName } from "@/components/pixel/PixelArt";
import { TIER_THRESHOLDS, XP_PER } from "@/lib/gamification/scoring";
import DevLookup from "./DevLookup";
import SectionHeading from "./SectionHeading";
import { REPO_URL, SIGN_IN_HREF, type RepoStats } from "./types";

export function CoOp({ stats }: { stats: RepoStats }) {
  const counters: Array<{
    label: string;
    value: number;
    icon: PixelIconName;
    /** A literal class so Tailwind sees it. */
    accent: string;
  }> = [
    {
      label: "Commits",
      value: stats.totalCommits,
      icon: "coin",
      accent: "[--hud-c:#facc15]",
    },
    {
      label: "PRs merged",
      value: stats.mergedPRs,
      icon: "gem",
      accent: "[--hud-c:#34d399]",
    },
    {
      label: "Contributors",
      value: stats.contributorCount,
      icon: "heart",
      accent: "[--hud-c:#f43f5e]",
    },
    {
      label: "GitHub stars",
      value: stats.stars,
      icon: "star",
      accent: "[--hud-c:#eab308]",
    },
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
        {counters.map((c, index) => (
          <RevealItem
            as="li"
            key={c.label}
            className={`hud-counter px-frame relative overflow-hidden bg-[var(--card)] p-5 ${c.accent}`}
          >
            {/* Colour key along the top, like the dashboard HUD. */}
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1 bg-[var(--hud-c)]"
            />
            <span className="flex items-center gap-3">
              <span
                className={`hud-counter__icon hud-icon-${c.icon} shrink-0`}
                style={{ animationDelay: `${index * 180}ms` }}
              >
                <PixelArt icon={c.icon} scale={4} />
              </span>
              <span className="min-w-0 font-pixel text-3xl tabular-nums text-[var(--card-foreground)] sm:text-4xl">
                <span
                  aria-hidden="true"
                  className="mr-1 text-base text-[var(--muted-foreground)]"
                >
                  ×
                </span>
                <AnimatedNumber value={c.value} />
              </span>
            </span>
            <span className="mt-3 block font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              {c.label}
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
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:px-8">
        {/* "How to play" card: Bit, plus a way into the longer guides. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <SectionHeading id="faq-heading" eyebrow="How to play" title="FAQ" />
          <div className="px-frame mt-8 bg-[var(--background)] p-5">
            <div className="flex items-end gap-3">
              <span className="buddy-bob block shrink-0">
                <PixelSprite frame="talk" scale={3} />
              </span>
              <p className="relative border-2 border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs leading-5 text-[var(--card-foreground)]">
                Stuck on a level? Most answers are here. The rest are in the
                strategy guides.
              </p>
            </div>
            <ul className="mt-5 space-y-1.5 text-sm">
              {[
                ["/guides/devtrack-score", "How the score works"],
                ["/guides/github-stats-readme", "README badges"],
                ["/guides/github-streak", "GitHub streaks"],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="group flex items-center gap-2 text-[var(--accent)] hover:underline"
                  >
                    <span
                      aria-hidden="true"
                      className="font-pixel text-[10px] transition-transform group-hover:translate-x-0.5"
                    >
                      ▶
                    </span>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/guides"
              className="mt-4 inline-block font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] hover:text-[var(--accent)]"
            >
              All guides →
            </Link>
          </div>
        </aside>

        <ol className="min-w-0 space-y-3">
          {FAQ.map((item, index) => (
            <li key={item.q}>
              <details className="faq-item group border-2 border-[var(--border)] bg-[var(--background)] open:border-[var(--accent)]">
                <summary className="flex cursor-pointer list-none items-center gap-4 p-4 text-[var(--card-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden="true"
                    className="w-8 shrink-0 font-pixel text-xs text-[var(--muted-foreground)] group-open:text-[var(--accent)]"
                  >
                    Q{String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="min-w-0 flex-1 text-base font-semibold">
                    {item.q}
                  </h3>
                  <span
                    aria-hidden="true"
                    className="shrink-0 font-pixel text-xs text-[var(--accent)] transition-transform duration-150 group-open:rotate-90"
                  >
                    ▶
                  </span>
                </summary>
                <div className="faq-answer mx-4 mb-4 border-l-4 border-[var(--accent)] bg-[var(--card)] px-4 py-3">
                  <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                    {item.a}
                  </p>
                </div>
              </details>
            </li>
          ))}
        </ol>
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
    <section
      aria-labelledby="continue-heading"
      className="px-grid-bg px-4 py-20 sm:px-6 lg:px-8"
    >
      {/* The cabinet screen stays dark in every theme, like the boot screen. */}
      <div className="continue-screen px-frame relative mx-auto max-w-3xl overflow-hidden px-6 py-14 text-center sm:px-12">
        <div aria-hidden="true" className="px-scanlines absolute inset-0" />

        <div className="relative">
          <h2
            id="continue-heading"
            className="font-pixel text-[clamp(2.2rem,6vw,3.8rem)] uppercase leading-none text-white"
          >
            Continue?
          </h2>
          <p
            aria-hidden="true"
            className="continue-count mt-4 font-pixel text-7xl leading-none text-[#f2c14e] sm:text-8xl"
          />

          <p className="mx-auto mt-6 max-w-md text-base leading-7 text-[#aab6d3]">
            Your history is already on GitHub. Sign in and see your rank, tier
            and streak in under a minute.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:items-stretch">
            <a
              href={SIGN_IN_HREF}
              className="continue-choice group flex min-w-[15rem] items-center justify-center gap-3 border-2 border-[#6ba8ff] bg-[#6ba8ff] px-5 py-3 font-pixel text-sm uppercase tracking-[0.1em] text-[#05070f] hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6ba8ff]/50"
            >
              <span aria-hidden="true" className="px-blink">
                ▶
              </span>
              <span>
                Yes <span className="sr-only">, </span>
                <span className="normal-case tracking-normal">
                  · Sign in with GitHub
                </span>
              </span>
              <Github className="h-4 w-4" aria-hidden="true" />
            </a>
            <a
              href="#continue-lookup"
              className="continue-choice flex min-w-[15rem] items-center justify-center gap-3 border-2 border-[#3a4a70] px-5 py-3 font-pixel text-sm uppercase tracking-[0.1em] text-[#aab6d3] hover:border-white hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
            >
              No{" "}
              <span className="normal-case tracking-normal">
                · Look someone up
              </span>
            </a>
          </div>

          <div
            aria-hidden="true"
            className="mt-10 flex items-center justify-center gap-3 font-pixel text-[10px] uppercase tracking-[0.2em] text-[#8a9bc0]"
          >
            <span className="continue-slot relative inline-flex h-9 w-7 items-start justify-center overflow-hidden">
              <span className="continue-coin">
                <PixelArt icon="coin" scale={2} />
              </span>
            </span>
            Insert coin · free play
          </div>

          <div
            id="continue-lookup"
            className="mx-auto mt-10 max-w-md scroll-mt-28 text-left"
          >
            <DevLookup />
          </div>
        </div>
      </div>
    </section>
  );
}
