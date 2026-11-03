import Link from "next/link";
import type { ReactNode } from "react";
import { TIER_THRESHOLDS, XP_PER } from "@/lib/gamification/scoring";

/**
 * Guides: short, practical answers to things developers search for. Each one
 * also feeds FAQPage structured data, which answer engines quote directly.
 */
export interface Guide {
  slug: string;
  title: string;
  /** Meta description and the card blurb. */
  description: string;
  published: string;
  updated: string;
  body: () => ReactNode;
  faq: Array<{ q: string; a: string }>;
}

const SITE = "https://devtrack.live";

function Code({ children }: { children: string }) {
  return (
    <pre className="px-frame my-4 overflow-x-auto bg-[var(--card)] p-4 font-mono text-xs leading-6 text-[var(--card-foreground)]">
      <code>{children}</code>
    </pre>
  );
}

function A({ href, children }: { href: string; children: ReactNode }) {
  return href.startsWith("/") ? (
    <Link
      href={href}
      className="text-[var(--accent)] underline-offset-2 hover:underline"
    >
      {children}
    </Link>
  ) : (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--accent)] underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

export const GUIDES: Guide[] = [
  {
    slug: "github-stats-readme",
    title: "How to add GitHub stats to your profile README",
    description:
      "Add live, auto-updating badges for your rank, coding streak and monthly commits to your GitHub profile README. Copy-paste Markdown included.",
    published: "2026-11-03",
    updated: "2026-11-03",
    body: () => (
      <>
        <p>
          Your GitHub profile README is the repository named after your username
          (for example <code>octocat/octocat</code>). Whatever is in its{" "}
          <code>README.md</code> shows at the top of your profile, which makes
          it the best place for stats that update themselves.
        </p>
        <h2>1. Create your profile README</h2>
        <p>
          On GitHub, create a new public repository with exactly your username
          as its name and tick &quot;Add a README file&quot;. GitHub will tell
          you it&apos;s a special repository when the name matches.
        </p>
        <h2>2. Put your stats on DevTrack</h2>
        <p>
          The badges below are rendered from your real GitHub activity.{" "}
          <A href="/claim">Sign in with GitHub</A> and your profile, streak and
          rank are built for you. The rank badge needs you on the public
          leaderboard, which you can turn on in Settings.
        </p>
        <h2>3. Paste the badges</h2>
        <p>
          Replace <code>YOUR_LOGIN</code> with your GitHub username:
        </p>
        <Code>{`[![DevTrack rank](${SITE}/api/badge/rank?user=YOUR_LOGIN)](${SITE}/u/YOUR_LOGIN)
[![Coding streak](${SITE}/api/badge/streak-shield?user=YOUR_LOGIN)](${SITE}/u/YOUR_LOGIN)
[![Commits this month](${SITE}/api/badge/commits?user=YOUR_LOGIN)](${SITE}/u/YOUR_LOGIN)`}</Code>
        <p>
          The rank badge also takes <code>&amp;board=month</code> or{" "}
          <code>&amp;board=week</code> to show this month&apos;s or this
          week&apos;s board instead of all time.
        </p>
        <h2>4. Commit, and you&apos;re done</h2>
        <p>
          The badges are SVG images served with short caches, so they refresh on
          their own. GitHub proxies README images through its camo cache, so a
          change can take a little while to appear.
        </p>
        <h2>Tips</h2>
        <ul>
          <li>
            Keep it to two or three badges; a wall of badges reads as noise.
          </li>
          <li>
            Link each badge to your DevTrack profile so visitors can see the
            full card.
          </li>
          <li>
            Want to see where you&apos;d rank first? Try any username in the{" "}
            <A href="/">score attack</A> on the home page.
          </li>
        </ul>
      </>
    ),
    faq: [
      {
        q: "How do I show GitHub stats in my README?",
        a: "Create a public repository named after your GitHub username, add a README.md, and paste image badges that link to a stats service. DevTrack's rank, streak and monthly commit badges update automatically from your GitHub activity.",
      },
      {
        q: "Do README stat badges update automatically?",
        a: "Yes. They are images rendered on request from your current GitHub data. GitHub caches README images briefly, so changes can take a little while to show.",
      },
    ],
  },
  {
    slug: "github-streak",
    title: "GitHub streaks: how they work and how to keep one going",
    description:
      "GitHub stopped showing contribution streaks on profiles in 2016. Here is how streaks are counted today, what counts as a contribution, and how to protect yours.",
    published: "2026-11-03",
    updated: "2026-11-03",
    body: () => (
      <>
        <p>
          GitHub used to show your current and longest contribution streak under
          the contribution graph. It removed both in 2016, so if you want a
          streak counter today you need a tool that reads your contribution
          calendar and counts consecutive days for you.
        </p>
        <h2>What counts as a contribution</h2>
        <p>
          GitHub&apos;s contribution graph counts commits to a repository&apos;s
          default branch (or <code>gh-pages</code>), opening issues and pull
          requests, and submitting pull request reviews. Commits only count if
          the email on the commit is linked to your GitHub account. Private
          activity counts too if you turn on &quot;Private contributions&quot;
          in your profile settings.
        </p>
        <h2>How DevTrack counts your streak</h2>
        <ul>
          <li>Any day with at least one contribution is an active day.</li>
          <li>
            Days are counted in <strong>your</strong> time zone (set it in
            Settings), so a late-night commit lands on the right day.
          </li>
          <li>
            Your streak stays alive until the end of the next day: if you coded
            yesterday but not yet today, you still have today to keep it.
          </li>
          <li>
            A <strong>streak freeze</strong> covers a rest day so the streak
            doesn&apos;t reset. You can use one from the Activity page.
          </li>
        </ul>
        <h2>How to keep a streak without burning out</h2>
        <ul>
          <li>
            Make the daily minimum small: one meaningful commit, review or
            issue.
          </li>
          <li>
            Keep a scratch or notes repository for days with no project work.
          </li>
          <li>
            Plan rest days and spend a freeze on them instead of grinding.
          </li>
          <li>
            Set a weekly goal on top, so the streak isn&apos;t the only target.
          </li>
        </ul>
        <p>
          You can see your current and longest streak on your{" "}
          <A href="/claim">DevTrack profile</A>, add a{" "}
          <A href="/guides/github-stats-readme">streak badge to your README</A>,
          and compare it with others on the{" "}
          <A href="/leaderboard">leaderboard</A>.
        </p>
      </>
    ),
    faq: [
      {
        q: "Does GitHub still show contribution streaks?",
        a: "No. GitHub removed the current and longest streak counters from profiles in 2016. Third-party tools such as DevTrack calculate streaks from your contribution calendar.",
      },
      {
        q: "Why didn't my commit count toward my GitHub streak?",
        a: "Commits only count if they are on the default branch (or gh-pages) and the commit email is linked to your GitHub account. Private contributions only show if you enable them in your profile settings.",
      },
      {
        q: "What is a streak freeze?",
        a: "On DevTrack, a streak freeze covers a day without contributions so your streak does not reset. It is meant for planned rest days.",
      },
    ],
  },
  {
    slug: "compare-github-profiles",
    title: "How to compare two GitHub profiles side by side",
    description:
      "Compare any two GitHub users on streaks, contributions, commits, pull requests and code reviews, round by round, and share the result as a card.",
    published: "2026-11-03",
    updated: "2026-11-03",
    body: () => (
      <>
        <p>
          GitHub profiles are hard to compare by eye: the contribution graph
          shows activity, but not streaks, review work or how two people stack
          up. A side-by-side comparison puts the same numbers next to each
          other.
        </p>
        <h2>Start a duel</h2>
        <p>
          Open <A href="/compare">DevTrack Compare</A>, enter two GitHub
          usernames and press fight. You don&apos;t need an account, and it
          works for any public GitHub user. Every pair gets its own link, like{" "}
          <code>/compare/alice-vs-bob</code>, so you can share it.
        </p>
        <h2>What gets compared</h2>
        <ul>
          <li>DevTrack score (0 to 1000)</li>
          <li>Current streak and best streak in the last year</li>
          <li>Active days and contributions in the last year</li>
          <li>All-time commits</li>
          <li>Pull requests and code reviews</li>
        </ul>
        <p>
          Each stat is a round. Whoever wins more rounds wins the duel; win them
          all and it&apos;s a flawless victory.
        </p>
        <h2>Fair comparisons</h2>
        <ul>
          <li>
            Only public activity is visible, unless someone shares private
            contributions on GitHub.
          </li>
          <li>
            Volume isn&apos;t quality. Reviews and merged PRs often say more
            than commit counts.
          </li>
          <li>
            For a wider view, see the{" "}
            <A href="/leaderboard">global leaderboard</A> or the{" "}
            <A href="/top">top developers by language and country</A>.
          </li>
        </ul>
      </>
    ),
    faq: [
      {
        q: "How can I compare two GitHub accounts?",
        a: "Use a comparison tool such as DevTrack Compare: enter two usernames and it shows streaks, contributions, commits, pull requests and reviews side by side, with a shareable link for the pair.",
      },
      {
        q: "Do I need to sign in to compare GitHub profiles on DevTrack?",
        a: "No. Comparisons work for any public GitHub user without an account.",
      },
    ],
  },
  {
    slug: "devtrack-score",
    title: "How the DevTrack score, tiers and levels work",
    description:
      "What goes into the DevTrack score from 0 to 1000, how the six tiers from Bronze to Legend are set, and how XP and levels are earned.",
    published: "2026-11-03",
    updated: "2026-11-03",
    body: () => (
      <>
        <p>
          Every DevTrack profile has a score from 0 to 1000, a tier and a level.
          The score ranks the leaderboard; the level grows with your lifetime
          work and never goes down.
        </p>
        <h2>The score</h2>
        <p>The score blends four signals from your GitHub activity:</p>
        <ul>
          <li>
            <strong>Consistency (30%)</strong>: active days and your current
            streak.
          </li>
          <li>
            <strong>Impact (30%)</strong>: pull requests, with reviews counting
            half.
          </li>
          <li>
            <strong>Volume (25%)</strong>: commits.
          </li>
          <li>
            <strong>Breadth (15%)</strong>: how many repositories you
            contributed to.
          </li>
        </ul>
        <p>
          Each signal mixes log-scaled progress toward a fixed target with your
          percentile among everyone on the board, so a few huge numbers
          can&apos;t dominate and steady work is rewarded.
        </p>
        <h2>Tiers</h2>
        <p>
          Bronze (0+), Silver ({TIER_THRESHOLDS.silver}+), Gold (
          {TIER_THRESHOLDS.gold}+), Platinum ({TIER_THRESHOLDS.platinum}+),
          Diamond ({TIER_THRESHOLDS.diamond}+) and Legend (
          {TIER_THRESHOLDS.legend}+).
        </p>
        <h2>XP and levels</h2>
        <p>
          XP comes from your lifetime totals: {XP_PER.commit} XP per commit,{" "}
          {XP_PER.pr} per pull request and {XP_PER.review} per review. Levels
          get further apart as you climb.
        </p>
        <h2>Seasons</h2>
        <p>
          Alongside the all-time board there are monthly and weekly boards, so
          newcomers can top a season without years of history. See them on the{" "}
          <A href="/leaderboard">leaderboard</A>.
        </p>
      </>
    ),
    faq: [
      {
        q: "How is the DevTrack score calculated?",
        a: "It runs from 0 to 1000 and blends consistency (30%), impact from pull requests and reviews (30%), commit volume (25%) and breadth across repositories (15%), each mixing log-scaled progress with your percentile on the board.",
      },
      {
        q: "What are the DevTrack tiers?",
        a: `Bronze (0+), Silver (${TIER_THRESHOLDS.silver}+), Gold (${TIER_THRESHOLDS.gold}+), Platinum (${TIER_THRESHOLDS.platinum}+), Diamond (${TIER_THRESHOLDS.diamond}+) and Legend (${TIER_THRESHOLDS.legend}+).`,
      },
    ],
  },
];

export function findGuide(slug: string) {
  return GUIDES.find((g) => g.slug === slug);
}
