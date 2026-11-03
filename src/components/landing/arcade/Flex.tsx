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

const POWER_UPS = [
  {
    icon: Activity,
    title: "Activity & streaks",
    body: "Contribution heatmap, streaks with freezes, a consistency score and the hours you code best.",
  },
  {
    icon: GitPullRequest,
    title: "Pull requests",
    body: "Merge rate, review speed, cycle time and what your PRs are made of, week over week.",
  },
  {
    icon: FolderGit2,
    title: "Repositories",
    body: "Where your commits go, your language mix, repo health and the projects that need attention.",
  },
  {
    icon: Target,
    title: "Goals",
    body: "Weekly and monthly targets that update themselves from your GitHub activity.",
  },
  {
    icon: BrainCircuit,
    title: "Code personality",
    body: "Your developer archetype, read from commit times, streaks and PR habits.",
  },
  {
    icon: FileText,
    title: "AI resume",
    body: "An ATS-friendly resume for a target role, built from your merged PRs and real impact.",
  },
  {
    icon: Trophy,
    title: "Leaderboard",
    body: "Global, monthly and weekly boards, with tiers, levels and daily rank changes.",
  },
  {
    icon: Share2,
    title: "Public profile",
    body: "A shareable page with the stats you choose, an arcade share card and README badges.",
  },
  {
    icon: BarChart3,
    title: "Year in Code",
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

        <RevealGroup
          as="ul"
          className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          stagger={0.05}
        >
          {POWER_UPS.map((item) => {
            const body = (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--control)] text-[var(--accent)]">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-[var(--card-foreground)]">
                    {item.title}
                    {item.href && <span aria-hidden="true"> →</span>}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-[var(--muted-foreground)]">
                    {item.body}
                  </span>
                </span>
              </>
            );
            const cls =
              "flex h-full gap-4 border-2 border-dashed border-[var(--border)] bg-[var(--background)] p-5 transition-colors";
            return (
              <RevealItem as="li" key={item.title}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className={`${cls} hover:border-[var(--accent)] focus-visible:border-[var(--accent)] focus-visible:outline-none`}
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
      </div>
    </section>
  );
}
