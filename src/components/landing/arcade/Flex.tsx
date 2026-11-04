import SwipeDots from "@/components/ui/SwipeDots";
import {
  Activity,
  BarChart3,
  BrainCircuit,
  FileText,
  FolderGit2,
  GitPullRequest,
  Share2,
  Target,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { renderRankBadge } from "@/lib/gamification/rank-badge";
import {
  renderCommitsBadge,
  renderStreakBadge,
} from "@/lib/gamification/stat-badge";
import SectionHeading from "./SectionHeading";
import { SIGN_IN_HREF } from "./types";

// Sample data, rendered by the same code as the real badges.
const SAMPLE_BADGES = [
  {
    label: "Rank",
    svg: renderRankBadge({
      state: "ranked",
      board: "all",
      rank: 1,
      total: 1000,
      tier: "legend",
      scoreV2: 942,
      level: 54,
      levelProgress: 0.62,
      movement: { kind: "up", places: 2 },
    }),
  },
  {
    label: "Streak",
    svg: renderStreakBadge({
      state: "ok",
      current: 42,
      longest: 90,
      lowerBound: false,
      lastWeek: [true, true, true, false, true, true, true],
    }),
  },
  {
    label: "Commits",
    svg: renderCommitsBadge({
      state: "ok",
      commits: 128,
      month: 10,
      year: 2026,
      monthProgress: 0.6,
    }),
  },
];

// Inline SVGs share one document, so each badge's clip-path id must be unique.
const BADGES = SAMPLE_BADGES.map((badge, i) => ({
  ...badge,
  svg: badge.svg
    .replace('id="panel"', `id="landing-badge-${i}"`)
    .replaceAll("url(#panel)", `url(#landing-badge-${i})`),
}));

const SNIPPET =
  "[![DevTrack rank](https://devtrack.live/api/badge/rank?user=YOU)](https://devtrack.live/u/you)";

export function FlexBadges() {
  return (
    <section
      aria-labelledby="flex-heading"
      className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div className="min-w-0">
          <SectionHeading
            id="flex-heading"
            eyebrow="Bragging rights"
            title="Flex it in your README"
          >
            Animated pixel badges for your rank, streak and monthly commits.
            They update on their own, so your README always shows your current
            score. Each one links back to your profile.
          </SectionHeading>
          <pre className="px-frame mt-8 overflow-x-auto bg-[var(--card)] p-4 font-mono text-xs leading-6 text-[var(--card-foreground)]">
            <code>{SNIPPET}</code>
          </pre>
          <div className="-m-1 mt-6">
            <a href={SIGN_IN_HREF} className="px-btn">
              Get your badges
            </a>
          </div>
        </div>

        <RevealGroup className="min-w-0 space-y-4" stagger={0.12}>
          {BADGES.map((badge) => (
            <RevealItem key={badge.label} className="overflow-x-auto">
              <div
                className="w-max [&_svg]:h-16 [&_svg]:w-auto sm:[&_svg]:h-20"
                // Our own SVG, built from fixed sample data.
                dangerouslySetInnerHTML={{ __html: badge.svg }}
              />
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

// `accent` is a literal class so Tailwind generates it.
const POWER_UPS = [
  {
    icon: Activity,
    title: "Activity & streaks",
    effect: "+ Combo",
    accent: "[--pu-c:#fb923c]",
    body: "Contribution heatmap, streaks with freezes, a consistency score and the hours you code best.",
  },
  {
    icon: GitPullRequest,
    title: "Pull requests",
    effect: "+ Impact",
    accent: "[--pu-c:#c77dff]",
    body: "Merge rate, review speed, cycle time and what your PRs are made of, week over week.",
  },
  {
    icon: FolderGit2,
    title: "Repositories",
    effect: "+ Breadth",
    accent: "[--pu-c:#6ba8ff]",
    body: "Where your commits go, your language mix, repo health and the projects that need attention.",
  },
  {
    icon: Target,
    title: "Goals",
    effect: "+ Focus",
    accent: "[--pu-c:#34d399]",
    body: "Weekly and monthly targets that update themselves from your GitHub activity.",
  },
  {
    icon: BrainCircuit,
    title: "Code personality",
    effect: "+ Insight",
    accent: "[--pu-c:#22d3ee]",
    body: "Your developer archetype, read from commit times, streaks and PR habits.",
  },
  {
    icon: FileText,
    title: "AI resume",
    effect: "+ Hireable",
    accent: "[--pu-c:#f472b6]",
    body: "An ATS-friendly resume for a target role, built from your merged PRs and real impact.",
  },
  {
    icon: Trophy,
    title: "Leaderboard",
    effect: "+ Glory",
    accent: "[--pu-c:#f2c14e]",
    body: "Global, monthly and weekly boards, with tiers, levels and daily rank changes.",
  },
  {
    icon: Share2,
    title: "Public profile",
    effect: "+ Flex",
    accent: "[--pu-c:#a3e635]",
    body: "A shareable page with the stats you choose, an arcade share card and README badges.",
  },
  {
    icon: BarChart3,
    title: "Year in Code",
    effect: "+ Nostalgia",
    accent: "[--pu-c:#f87171]",
    body: "Your year as a set of slides you can share: commits, streaks, languages and peak hours.",
    href: "/wrapped",
  },
];

export function PowerUps() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="scroll-mt-20 border-y-4 border-[var(--border)] bg-[var(--card)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          id="features-heading"
          eyebrow="Power-ups"
          title="Everything in one dashboard"
        >
          Sign in and all of this is built for you from your GitHub activity,
          with no configuration.
        </SectionHeading>

        {/* Item-select HUD bar. */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed border-[var(--border)] pb-3 font-pixel text-[10px] uppercase tracking-[0.16em]">
          <span className="text-[var(--card-foreground)]">
            <span
              aria-hidden="true"
              className="px-blink mr-2 text-[var(--accent)]"
            >
              ▶
            </span>
            Select your power-ups
          </span>
          <span className="text-[var(--muted-foreground)]">
            {POWER_UPS.length}/{POWER_UPS.length} unlocked · free
          </span>
        </div>

        {/* Phones swipe through the power-ups like an item carousel. */}
        <RevealGroup
          as="ul"
          id="power-ups"
          className="swipe-row -mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:py-0 lg:grid-cols-3"
          stagger={0.05}
        >
          {POWER_UPS.map((item, index) => {
            const body = (
              <>
                <span
                  className="pu-box relative flex h-12 w-12 shrink-0 items-center justify-center text-white"
                  style={{ animationDelay: `${(index % 3) * 220}ms` }}
                >
                  <item.icon className="relative h-6 w-6" aria-hidden="true" />
                  <span className="pu-spark" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-[var(--card-foreground)]">
                      {item.title}
                      {item.href && <span aria-hidden="true"> →</span>}
                    </span>
                    <span className="pu-effect font-pixel text-[10px] uppercase tracking-[0.12em]">
                      {item.effect}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-[var(--muted-foreground)]">
                    {item.body}
                  </span>
                </span>
              </>
            );
            const cls = `pu-card ${item.accent} flex h-full gap-4 bg-[var(--background)] p-5`;
            return (
              <RevealItem
                as="li"
                key={item.title}
                className="w-[82%] shrink-0 snap-center sm:w-auto"
              >
                {item.href ? (
                  <Link
                    href={item.href}
                    className={`${cls} focus-visible:outline-none`}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </RevealItem>
            );
          })}
        </RevealGroup>
        <SwipeDots
          targetId="power-ups"
          count={POWER_UPS.length}
          label="Power-ups"
          className="sm:hidden"
        />
      </div>
    </section>
  );
}
