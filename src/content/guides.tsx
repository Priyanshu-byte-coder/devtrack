import Link from "@/components/Link";
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
    slug: "github-activity-tracker",
    title: "GitHub activity trackers: what they track and which to use",
    description:
      "The main ways to track your GitHub activity, from GitHub's own contribution graph to WakaTime, README stats cards, OSS Insight and DevTrack, and what each one is for.",
    published: "2026-11-05",
    updated: "2026-11-05",
    body: () => (
      <>
        <p>
          A GitHub activity tracker reads what you do on GitHub (commits, pull
          requests, reviews, issues) and turns it into something you can follow
          over time: a streak, a chart, a goal or a rank. GitHub shows some of
          this itself, and a handful of tools fill the gaps. They measure
          different things, so the right one depends on what you want to see.
        </p>
        <h2>What GitHub shows you</h2>
        <ul>
          <li>
            <strong>The contribution graph</strong> on your profile: a year of
            daily activity, coloured by volume.
          </li>
          <li>
            <strong>Achievements</strong>: badges for milestones such as merged
            pull requests and co-authored commits.
          </li>
          <li>
            <strong>Repository Insights</strong>: pulse, contributors and
            traffic for each repository.
          </li>
        </ul>
        <p>
          What&apos;s missing: there&apos;s no streak counter (it was removed in
          2016), no history beyond the graph, no view across all your
          repositories at once, and no way to see how you compare with anyone
          else.
        </p>
        <h2>The main options</h2>
        <ul>
          <li>
            <strong>WakaTime</strong> measures time spent coding through editor
            plugins. It tracks your editor rather than GitHub, so it answers
            &quot;how long did I code?&quot;, not &quot;what did I ship?&quot;.
            Many developers use it alongside a GitHub tracker.
          </li>
          <li>
            <strong>README stats cards</strong>, such as the open-source
            github-readme-stats project, render images of your stars, commits
            and top languages for your profile README. They&apos;re a snapshot:
            no history, goals or ranking.
          </li>
          <li>
            <strong>OSS Insight</strong> analyses GitHub event data to explore
            repositories, developers and trends. It&apos;s strongest for
            researching projects and the open-source ecosystem.
          </li>
          <li>
            <strong>DevTrack</strong> is a free, open-source dashboard for your
            own activity: contribution heatmap, streaks with freezes, pull
            request and review analytics, repositories, goals and weekly
            insights. It also turns your activity into a score from 0 to 1000
            and a place on a{" "}
            <A href="/leaderboard">global developer leaderboard</A>, with live
            badges for your README.
          </li>
        </ul>
        <h2>Which one should you use?</h2>
        <ul>
          <li>
            <strong>To keep a coding streak and track progress</strong>: a
            dashboard like DevTrack, which counts streaks in your time zone and
            lets you set goals.
          </li>
          <li>
            <strong>To see where your time goes</strong>: WakaTime.
          </li>
          <li>
            <strong>To decorate your profile README</strong>: stats cards or{" "}
            <A href="/guides/github-stats-readme">DevTrack badges</A>, which
            also show your rank.
          </li>
          <li>
            <strong>To compare yourself with other developers</strong>: the{" "}
            <A href="/leaderboard">DevTrack leaderboard</A>, a{" "}
            <A href="/compare">head-to-head comparison</A>, or the{" "}
            <A href="/top">top developers by language and country</A>.
          </li>
        </ul>
        <p>
          You can try DevTrack without signing up: every GitHub user has a page
          at <code>devtrack.live/u/username</code>. Sign in with GitHub to{" "}
          <A href="/claim">claim yours</A> and add private contributions to your
          stats.
        </p>
      </>
    ),
    faq: [
      {
        q: "How can I track my GitHub activity?",
        a: "GitHub's contribution graph shows a year of daily activity. For streaks, goals, pull request and review analytics, and a ranking against other developers, sign in to a GitHub activity tracker such as DevTrack, which builds everything from your real GitHub data.",
      },
      {
        q: "What is the best GitHub activity tracker?",
        a: "It depends on what you want to measure. WakaTime tracks time spent in your editor, README stats cards show a snapshot on your profile, OSS Insight explores repositories and trends, and DevTrack tracks your streaks, pull requests and reviews and ranks you on a global developer leaderboard.",
      },
      {
        q: "Does GitHub track how long I spend coding?",
        a: "No. GitHub records contributions such as commits, pull requests, reviews and issues, not time. Tools like WakaTime measure coding time through editor plugins.",
      },
    ],
  },
  {
    slug: "github-leaderboard",
    title: "Is there a GitHub leaderboard? How to see where you rank",
    description:
      "GitHub doesn't rank its users. Here's how developer leaderboards work, what they measure, and how to see where you rank worldwide, by language and by country.",
    published: "2026-11-05",
    updated: "2026-11-05",
    body: () => (
      <>
        <p>
          GitHub has no official ranking of its users. The closest it comes is
          the Trending page, which lists developers whose repositories are
          gaining stars right now. That rewards a viral project, not steady
          work, and it resets every day.
        </p>
        <h2>Ways developers get ranked</h2>
        <ul>
          <li>
            <strong>By followers</strong>: easy to measure, but it mostly
            reflects fame. DevTrack&apos;s <A href="/top">top developers</A>{" "}
            pages use it to list the best-known developers for each language and
            country.
          </li>
          <li>
            <strong>By public contributions</strong>: community lists such as
            committers.top rank the most active users in each country by their
            public contribution count.
          </li>
          <li>
            <strong>By a combined score</strong>: the{" "}
            <A href="/leaderboard">DevTrack leaderboard</A> blends consistency,
            impact from pull requests and reviews, commit volume and breadth
            across repositories into one score from 0 to 1000, so one huge month
            or one famous repository can&apos;t dominate.
          </li>
        </ul>
        <h2>How to see your rank</h2>
        <ol>
          <li>
            Look yourself up: every GitHub user has a page at{" "}
            <code>devtrack.live/u/username</code> showing where they would rank.
          </li>
          <li>
            Sign in with GitHub to join the board. New players are listed
            straight away, and private contributions can count toward your
            totals (never your private repository names or code).
          </li>
          <li>
            Filter the board by language, or switch between all-time, monthly
            and weekly seasons, where newcomers can top the board without years
            of history.
          </li>
        </ol>
        <p>
          Your rank changes daily, and you can show it off with a{" "}
          <A href="/guides/github-stats-readme">live rank badge</A> in your
          README. You can hide your profile or leave the board at any time in
          Settings.
        </p>
        <h2>How to climb</h2>
        <ul>
          <li>
            Show up often. Consistency is 30% of the score, so a small
            contribution every day beats a weekend binge.
          </li>
          <li>
            Review pull requests. Reviews count toward impact, and few people do
            enough of them.
          </li>
          <li>
            Contribute beyond your own repositories. Breadth across projects is
            part of the score.
          </li>
        </ul>
        <p>
          The full formula is in{" "}
          <A href="/guides/devtrack-score">how the DevTrack score works</A>.
        </p>
      </>
    ),
    faq: [
      {
        q: "Does GitHub have a leaderboard?",
        a: "No. GitHub doesn't rank its users. Its Trending page lists developers whose repositories are gaining stars, which changes daily. Developer leaderboards such as DevTrack rank developers by their GitHub activity instead.",
      },
      {
        q: "How can I see my GitHub rank?",
        a: "Open devtrack.live/u/your-username to see where you would rank on the DevTrack global leaderboard, then sign in with GitHub to join it. You can filter by language and see weekly and monthly seasons.",
      },
      {
        q: "Who are the top GitHub developers in my country?",
        a: "DevTrack lists the most-followed GitHub developers in 28 countries, including India, the United States, Germany and Brazil, at devtrack.live/top, updated daily.",
      },
    ],
  },
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
  {
    slug: "pull-request-checklist",
    title: "Writing a pull request maintainers want to merge",
    description:
      "How to craft clear, focused pull requests that open-source maintainers want to review and merge, from commit hygiene to handling review feedback.",
    published: "2026-11-25",
    updated: "2026-11-25",
    body: () => (
      <>
        <p>
          Open-source maintainers spend hundreds of hours reviewing code outside
          their day jobs. A pull request that is easy to review, thoroughly
          tested, and respectful of their time is far more likely to be merged
          promptly. Conversely, a massive pull request with no description,
          failing tests, and unrelated edits often stalls for weeks.
        </p>
        <p>
          Whether you are submitting your very first open-source fix or building
          up your profile on a{" "}
          <A href="/guides/github-activity-tracker">GitHub activity tracker</A>,
          following this practical checklist ensures your contributions stand out
          for the right reasons.
        </p>

        <h2>1. Keep pull requests small and focused</h2>
        <p>
          The single most effective way to speed up a code review is to limit
          scope. A pull request should do one thing and do it well: fix a
          specific bug, add an isolated component, or document an API.
        </p>
        <ul>
          <li>
            <strong>Avoid cosmetic scope creep:</strong> Do not reformat entire
            unrelated files, alter lint rules, or reorganize folder structures
            unless the issue explicitly calls for it. Large diffs filled with
            whitespace changes obscure the core logic and trigger merge
            conflicts.
          </li>
          <li>
            <strong>Split compound features:</strong> If an implementation
            requires a database migration, an API endpoint, and a complex UI,
            consider opening separate PRs in logical stages. GitHub allows you
            to publish early progress as a{" "}
            <A href="https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests#draft-pull-requests">
              draft pull request
            </A>{" "}
            to signal that work is underway before requesting a final review.
          </li>
        </ul>

        <h2>2. Link the issue and use closing keywords</h2>
        <p>
          Always connect your pull request to an existing issue. This gives
          maintainers immediate context on why the change was proposed and
          ensures GitHub automatically updates the tracking board.
        </p>
        <p>
          Use official{" "}
          <A href="https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue">
            GitHub linking keywords
          </A>{" "}
          in your pull request description:
        </p>
        <Code>{`Closes #123\nFixes #123\nResolves #123`}</Code>
        <p>
          When your pull request is merged into the default branch, GitHub will
          automatically close the linked issue. If your PR only partially
          addresses a broader initiative, mention the issue number without a
          closing keyword (e.g., &quot;Part of #123&quot;) so maintainers retain
          ownership of when to close it.
        </p>

        <h2>3. Write a self-explanatory description</h2>
        <p>
          Never leave the pull request body blank. A helpful description answers
          three core questions in under two minutes:
        </p>
        <ul>
          <li>
            <strong>What changed:</strong> A concise bulleted summary of the code
            modifications.
          </li>
          <li>
            <strong>Why:</strong> The background reasoning or bug reproduction
            details that necessitated the change.
          </li>
          <li>
            <strong>How to verify:</strong> Exact terminal commands, test
            suites, or browser steps maintainers can follow to reproduce the fix
            locally.
          </li>
        </ul>

        <h2>4. Provide visual proof for UI changes</h2>
        <p>
          If your pull request modifies user interfaces, styles, or interactive
          components, always include screenshots or a quick recording.
        </p>
        <p>
          Capture both desktop and mobile viewports (e.g., at 390px width for
          smartphones), and test both dark and light modes if the application
          supports themes. Showing visual proof confirms you actually tested the
          change in a browser rather than assuming the styling rendered
          correctly.
        </p>

        <h2>5. Run tests, types, and lints locally</h2>
        <p>
          Never rely on the continuous integration (CI) pipeline as your personal
          linter. Pushing code that breaks static checks wastes maintainer CI
          runner minutes and clutters the commit history.
        </p>
        <p>
          Before committing, run the project&apos;s local validation commands:
        </p>
        <Code>{`# Verify static typing\nnpx tsc --noEmit\n\n# Run code style and lint checks\nnpm run lint\n\n# Execute affected test suites\nnpm test`}</Code>
        <p>
          If the repository includes unit or integration tests, add test
          coverage for your new code paths. Demonstrating that your change has
          automated regression tests gives maintainers the confidence to hit
          merge immediately.
        </p>

        <h2>6. Respect project guidelines and commit hygiene</h2>
        <p>
          Every open-source project has its own conventions defined in{" "}
          <code>CONTRIBUTING.md</code>. Read it carefully before opening your
          pull request.
        </p>
        <ul>
          <li>
            <strong>Commit messages:</strong> Follow the repository&apos;s style,
            such as Conventional Commits (e.g., <code>feat(auth): ...</code> or{" "}
            <code>fix(api): ...</code>).
          </li>
          <li>
            <strong>Sign-off trailers:</strong> Many repositories require a
            Developer Certificate of Origin (DCO). Ensure your commits include a{" "}
            <A href="https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/managing-the-commit-signoff-policy-for-your-repository">
              DCO sign-off trailer
            </A>{" "}
            using <code>git commit -s</code>.
          </li>
        </ul>

        <h2>7. Respond graciously to review feedback</h2>
        <p>
          Code review is a collaborative discussion, not a personal critique.
          When a maintainer requests adjustments:
        </p>
        <ul>
          <li>
            <strong>Acknowledge and clarify:</strong> If a suggestion is unclear,
            politely ask for guidance rather than guessing.
          </li>
          <li>
            <strong>Keep branches synced:</strong> If upstream changes while your
            PR is under review, use{" "}
            <A href="https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/keeping-your-pull-request-in-sync-with-the-base-branch">
              GitHub&apos;s branch update mechanism
            </A>{" "}
            or rebase against upstream <code>main</code> to ensure a clean merge.
          </li>
          <li>
            <strong>Notify when ready:</strong> After pushing requested changes,
            leave a brief comment summarizing what was updated so the reviewer
            knows it is ready for another look.
          </li>
        </ul>

        <h2>How pull request quality powers your DevTrack score</h2>
        <p>
          In DevTrack, pull request activity is a primary signal of real-world
          impact. The{" "}
          <A href="/guides/devtrack-score">DevTrack score</A> allocates 30% of its
          weight to Impact—measuring merged pull requests and constructive code
          reviews across repositories. By focusing on concise, well-documented
          contributions that maintainers merge quickly, you maximize your
          productivity velocity, level up faster, and climb the public
          leaderboard.
        </p>
      </>
    ),
    faq: [
      {
        q: "How small should an open-source pull request be?",
        a: "Ideally under 200 to 400 lines of code focused on a single issue. Smaller PRs are reviewed and merged substantially faster than multi-file refactors.",
      },
      {
        q: "Which keywords automatically close an issue on GitHub?",
        a: "GitHub supports 'Closes #123', 'Fixes #123', and 'Resolves #123' (and their past-tense variants). When merged into default branch, GitHub automatically marks the issue closed.",
      },
      {
        q: "What should I do if a maintainer requests changes?",
        a: "Review the comments carefully, implement the requested adjustments, run local tests to verify nothing broke, push the commit to your branch, and reply politely to confirm the updates are ready.",
      },
      {
        q: "How does merged PR activity impact my DevTrack score?",
        a: "Merged pull requests contribute to the Impact dimension, which represents 30% of your overall DevTrack score, as well as providing 50 XP per pull request toward your lifetime level.",
      },
    ],
  },
  {
    slug: "first-open-source-issue",
    title: "How to pick your first open-source issue",
    description:
      "A practical guide to finding beginner-friendly issues on GitHub, evaluating scope, reading contributing guides, and making your first open-source contribution.",
    published: "2026-11-25",
    updated: "2026-11-25",
    body: () => (
      <>
        <p>
          Taking the leap from writing code in your own private projects to
          contributing to an open-source codebase can feel intimidating. Many
          aspiring contributors open a large repository, feel overwhelmed by the
          sheer volume of directories, open issues, and pull requests, and close
          the browser tab before typing a single command.
        </p>
        <p>
          The secret to getting started in open source is not knowing every line of
          the codebase; it is picking the right first issue. When you select an
          issue that is clearly scoped, actively maintained, and appropriate for
          your current skill level, your first contribution becomes an enjoyable,
          confidence-building milestone. This guide covers how to find
          approachable issues, evaluate scope, claim them courteously, and navigate
          roadblocks.
        </p>

        <h2>Where to look: Labels that signal beginner friendliness</h2>
        <p>
          Open-source maintainers deliberately flag tasks suitable for newcomers
          using standard labels. When searching repositories on{" "}
          <A href="https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/filtering-and-searching-issues-and-pull-requests">
            GitHub&apos;s issue search
          </A>
          , prioritize these established tags:
        </p>
        <ul>
          <li>
            <strong><code>good first issue</code>:</strong> The official GitHub
            standard label for introductory tasks. Maintainers reserve these for
            self-contained bugs, documentation additions, minor UI polish, or
            straightforward unit test gaps that do not require deep architectural
            context.
          </li>
          <li>
            <strong><code>help wanted</code>:</strong> Indicates that maintainers
            actively desire external community contributions because the core team
            is focused on higher-priority roadmap epics.
          </li>
          <li>
            <strong><code>documentation</code> or <code>docs</code>:</strong> Fixing
            outdated README steps, correcting broken code snippets, or clarifying API
            parameter tables is one of the highest-value ways to learn a project
            while delivering immediate value.
          </li>
          <li>
            <strong><code>type: testing</code> or <code>tests</code>:</strong> Adding
            missing unit tests or edge-case assertions allows you to explore the
            codebase safely with instant local feedback.
          </li>
        </ul>

        <h2>Reading the project&apos;s CONTRIBUTING guide first</h2>
        <p>
          Before commenting on an issue or forking a repository, always look for
          a <code>CONTRIBUTING.md</code> file in the repository root or <code>.github/</code> directory.
          As documented in{" "}
          <A href="https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors">
            GitHub&apos;s guidelines for repository contributors
          </A>
          , this file contains the project&apos;s non-negotiable rules of engagement:
        </p>
        <ol>
          <li>
            <strong>Environment Setup:</strong> Required Node, Python, or Go
            versions, package manager preferences (e.g. <code>pnpm</code> vs{" "}
            <code>npm</code>), and commands to run local development servers.
          </li>
          <li>
            <strong>Branching and Commit Conventions:</strong> Whether the project
            mandates Conventional Commits (e.g. <code>feat:</code>, <code>fix:</code>),
            Developer Certificate of Origin (DCO) sign-off lines, or specific branch
            naming formats.
          </li>
          <li>
            <strong>Testing and Linting Standards:</strong> The exact verification
            commands (e.g. <code>npm run lint</code>, <code>pytest</code>,{" "}
            <code>mix test</code>) that must pass before a pull request can be
            merged.
          </li>
        </ol>

        <h2>Sizing an issue: Green flags vs. red flags</h2>
        <p>
          Not all issues labeled &quot;beginner&quot; are actually easy. Learn to evaluate
          an issue&apos;s true difficulty before investing hours of work:
        </p>
        <ul>
          <li>
            <strong>Green Flag — Clear Acceptance Criteria:</strong> The issue
            description clearly identifies the affected files, expected behavior,
            and acceptance criteria, or includes reproduction steps and screenshots.
          </li>
          <li>
            <strong>Green Flag — Active Maintainer Engagement:</strong> Maintainers
            have commented recently, merged other community PRs within the past
            two weeks, and responded promptly to contributor inquiries.
          </li>
          <li>
            <strong>Red Flag — Vague Architecture Refactors:</strong> Issues
            titled <em>&quot;Refactor auth module&quot;</em> or <em>&quot;Improve performance&quot;</em>{" "}
            are rarely suitable for first-time contributors; they often spark
            prolonged architectural debates and stall in review.
          </li>
          <li>
            <strong>Red Flag — Dormant Repositories:</strong> If the last commit
            was nine months ago and unanswered PRs are piling up, your contribution
            may sit unreviewed indefinitely regardless of quality.
          </li>
        </ul>

        <h2>How to claim an issue politely</h2>
        <p>
          Avoid leaving generic comments like <em>&quot;Assign to me&quot;</em> or{" "}
          <em>&quot;I want to work on this&quot;</em> without context. Maintainers receive dozens
          of automated or abandoned claims every week. Instead, post a brief,
          informed comment explaining your approach:
        </p>
        <pre className="overflow-x-auto rounded border border-base-300 bg-base-200 p-3 text-xs">
          <code>
{`Hi @maintainer! I'd love to work on this issue.

My proposed plan:
1. Locate the hardcoded color palette in src/components/...
2. Replace static classes with semantic theme variables.
3. Add a unit test verifying dark/light adaptability.

Could you please assign this issue to me?`}
          </code>
        </pre>
        <p>
          This demonstrates that you read the issue description, understand the
          task, and have a credible plan to deliver results.
        </p>

        <h2>What to do when you get stuck</h2>
        <p>
          Every developer gets stuck when working in an unfamiliar codebase. When
          you hit an obstacle, follow this troubleshooting hierarchy:
        </p>
        <ul>
          <li>
            <strong>Inspect existing tests:</strong> Test files are living
            documentation. Searching for how existing functions are called and
            mocked in <code>test/</code> usually answers 90% of architectural questions.
          </li>
          <li>
            <strong>Search closed PRs:</strong> Use GitHub search to look at recently
            merged pull requests touching the same directory. See how other
            contributors structured their solutions and solved similar problems.
          </li>
          <li>
            <strong>Ask targeted questions on the issue:</strong> If an internal API
            is ambiguous, leave a concise comment outlining what you tried, what you
            observed, and your specific question. Maintainers are eager to help
            contributors who demonstrate clear troubleshooting effort.
          </li>
        </ul>
        <p>
          Once your changes are coded and verified locally, follow our{" "}
          <A href="/guides/pull-request-checklist">pull request checklist guide</A>{" "}
          to prepare a clean, maintainer-ready PR, and learn about{" "}
          <A href="/guides/devtrack-score">how the DevTrack score works</A>{" "}
          to track your ongoing impact.
        </p>

        <h2>How early contributions build your DevTrack score</h2>
        <p>
          Picking and solving well-scoped open-source issues is the fastest way to
          establish your public presence on the{" "}
          <A href="/guides/devtrack-score">DevTrack global leaderboard</A>:
        </p>
        <ul>
          <li>
            <strong>Breadth across repositories:</strong> Contributing to diverse
            projects boosts your DevTrack breadth score, proving that your skills
            transfer across different tech stacks and team workflows.
          </li>
          <li>
            <strong>Milestones and XP:</strong> Each merged pull request awards
            experience points toward leveling up your player card and unlocking
            community achievement badges.
          </li>
          <li>
            <strong>Consistency over volume:</strong> Resolving one or two small
            issues every week builds a reliable streak and sustainable momentum.
          </li>
        </ul>
      </>
    ),
    faq: [
      {
        q: "What does the 'good first issue' label mean on GitHub?",
        a: "The 'good first issue' label identifies introductory tasks curated by maintainers for first-time contributors. These are typically self-contained, clearly scoped bugs, documentation improvements, or small feature enhancements.",
      },
      {
        q: "Should I start working on an issue before it is assigned to me?",
        a: "It is best practice to leave a comment with your proposed approach and wait for maintainer confirmation. This prevents duplicated effort if another contributor is already working on the issue.",
      },
      {
        q: "What should I do if a repository has no CONTRIBUTING.md file?",
        a: "Inspect the README, check package.json or Makefile scripts, and examine recent merged pull requests to mirror the established testing, linting, and branch conventions.",
      },
      {
        q: "How do merged issues and PRs affect my DevTrack score?",
        a: "Merged PRs directly increase the Impact dimension (30% of your score), expand repository breadth, and award experience points (XP) to climb the global leaderboard.",
      },
    ],
  },

  {
    slug: "code-review-for-beginners",
    title: "Reviewing other people's pull requests (and why it grows your profile)",
    description: "Learn to review pull requests with clear, kind feedback, understand GitHub contribution credit, and track review impact in DevTrack.",
    published: "2026-11-29",
    updated: "2026-11-29",
    body: () => (
      <>
        <p>
          Open source is not only about writing code. Projects also need people
          who read proposed changes carefully, try them out, ask useful questions,
          and help authors make their work safer and easier to maintain. You do
          not need to be a senior developer to start reviewing. A focused review
          of a small change can help its author and teach you how a real codebase
          works.
        </p>
        <p>
          A review is not a contest to find the most comments. Your goal is to
          understand what the pull request (PR) is trying to do, identify issues
          that matter, and explain them in a way the author can act on. This guide
          covers a repeatable review process, respectful feedback, GitHub
          contribution credit, and the way DevTrack records review activity.
        </p>

        <h2>1. Understand the change before judging it</h2>
        <p>
          Start with the PR description and the issue or discussion it references.
          Write down the intended behavior in one sentence. Then read the diff
          from top to bottom. Look at nearby code when a function, component, or
          data model is unfamiliar; the diff alone may not show the conventions
          the project already follows.
        </p>
        <ul>
          <li><strong>Check the scope:</strong> Does the change solve the stated
            problem? Are unrelated refactors or generated files included?</li>
          <li><strong>Trace the behavior:</strong> Follow inputs through the
            changed code. Check empty values, unexpected types, boundary values,
            permissions, and failure paths where relevant.</li>
          <li><strong>Look at tests:</strong> Are important success and failure
            cases covered? Do the tests assert the outcome rather than merely
            repeating the implementation?</li>
          <li><strong>Consider compatibility:</strong> Could the change break an
            existing caller, API response, saved record, keyboard flow, or
            supported platform?</li>
          <li><strong>Check maintainability:</strong> Are names understandable?
            Is the code consistent with nearby patterns? Is user-facing behavior
            or configuration documented when needed?</li>
        </ul>
        <p>
          Do not assume every preference is a defect. A different naming choice
          or formatting style may be harmless if it follows the repository's
          conventions. Prioritize correctness, security, data loss, accessibility,
          and regressions over personal style.
        </p>

        <h2>2. Run the change when you can</h2>
        <p>
          Read the project's contribution instructions before running commands.
          If setup is practical, install the documented dependencies, run the
          relevant tests, and try the behavior described by the author. Report
          what you actually ran, including the command and whether it passed.
          If you cannot run the project, say so; a careful static review is still
          useful, but it is not the same as runtime verification.
        </p>
        <p>
          Treat automated checks as evidence, not a substitute for reading the
          code. A green test suite cannot prove that every edge case is covered.
          A failing check may also be unrelated to the PR, so compare the failure
          with the base branch or ask the author for context before calling it a
          regression.
        </p>

        <h2>3. Write comments an author can use</h2>
        <p>
          A useful review comment identifies a specific location, explains the
          consequence, and suggests a direction. For example, instead of saying
          <em> "This is wrong"</em>, explain: <em>"If this value is empty, the
          request still reaches the database. Could we validate it before this
          call? That would keep invalid records from being created."</em>
        </p>
        <ul>
          <li><strong>Be specific:</strong> Point to the affected line and describe
            a reproducible scenario.</li>
          <li><strong>Explain impact:</strong> Say what could break and who or
            what is affected.</li>
          <li><strong>Ask, do not belittle:</strong> "Could we handle the timeout
            here?" invites discussion; "You forgot error handling" attacks the
            author.</li>
          <li><strong>Separate blockers from suggestions:</strong> Mark a
            correctness or security issue clearly. Label optional polish as
            non-blocking or a nit.</li>
          <li><strong>Acknowledge good work:</strong> Mention a clear test,
            thoughtful edge-case fix, or helpful explanation when you see one.</li>
        </ul>
        <p>
          When a small replacement is obvious, GitHub supports suggested changes
          in review comments. See
          <A href="https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/incorporating-feedback-in-your-pull-request">GitHub's guide to incorporating feedback and suggested changes</A>.
          Suggestions should remain easy to understand and should not hide a
          larger design decision inside a one-click edit.
        </p>

        <h2>4. Choose the right review submission</h2>
        <p>
          GitHub's pull request review flow offers three submission types:
          Comment, Approve, and Request changes. Read
          <A href="https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews">GitHub's documentation about pull request reviews</A>
          for how these work. Use a comment when you have observations or
          questions but no approval decision. Approve only when you have reviewed
          the change and are comfortable with it. Request changes when you have
          identified a concrete issue that should be fixed before merge.
        </p>
        <p>
          Repository permissions and branch protection determine whose approval
          can satisfy a merge requirement. If you are a new contributor and do
          not have the authority to approve, you can still leave a constructive
          comment or report your findings to the maintainers. Never use
          "Request changes" just to express a preference.
        </p>

        <h2>5. How reviews appear on your GitHub profile</h2>
        <p>
          GitHub can include pull request reviews in your contribution activity,
          but eligibility has an important condition: the review must be made in
          a standalone repository, not a fork. GitHub's
          <A href="https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference">profile contributions reference</A>
          explains which activities count and the repository requirements.
          Therefore, do not assume that every review on every public repository
          will add a square to your graph. The contribution settings also let
          you control whether eligible private contributions are shown.
        </p>
        <p>
          A submitted review is also visible in the pull request conversation,
          where collaborators can read the comments and review decision. The
          contribution graph is a summary, not a quality score: a thoughtful
          review can be valuable even when it does not qualify for graph credit.
        </p>

        <h2>6. How reviews affect your DevTrack stats</h2>
        <p>
          DevTrack's score v2 gives the Impact signal 30% of the overall score.
          Within that signal, pull requests contribute one unit each and reviews
          contribute half a unit each. This means reviews are recognized, but
          they do not count as much as a pull request in the impact calculation.
          The scoring model also uses period targets and cohort-relative scoring,
          so the exact points shown on a leaderboard depend on the period and
          the other contributors being ranked.
        </p>
        <p>
          DevTrack's lifetime XP system awards 15 XP per review. XP is separate
          from the rolling leaderboard score: it accumulates from lifetime
          activity and contributes to your level. You can read more in the
          <A href="/guides/devtrack-score">guide to the DevTrack score</A>.
          Review activity is one part of a broader profile; it does not guarantee
          a particular rank, badge, or invitation to maintain a project.
        </p>

        <h2>A simple review routine</h2>
        <ol>
          <li>Pick a small, active PR in a project whose purpose you understand.</li>
          <li>Read the issue, description, diff, and relevant surrounding code.</li>
          <li>Check tests and run the documented commands if possible.</li>
          <li>Write only actionable comments, with impact and evidence.</li>
          <li>Submit the appropriate review type and respond kindly if the author
            asks a follow-up question.</li>
        </ol>
        <p>
          If you are preparing your own contribution too, use the
          <A href="/guides/pull-request-checklist">pull request checklist</A>
          to make it easier for someone else to review your work. Good reviewers
          and good PR authors help create the same kind of welcoming project:
          one where feedback is specific, respectful, and focused on improving
          the software together.
        </p>
      </>
    ),
    faq: [
      {
        q: "Do reviews on every public GitHub repository count on my contribution graph?",
        a: "No. GitHub's contribution rules require reviews to be made in a standalone repository, not a fork. Other contribution eligibility rules and your profile settings can also affect what is displayed.",
      },
      {
        q: "Can I review a pull request if I am not a maintainer?",
        a: "You can still read the diff, test the change where practical, and leave useful feedback. Whether your approval can satisfy a merge requirement depends on the repository's permissions and branch protection settings.",
      },
      {
        q: "How much does a review add to DevTrack?",
        a: "A review contributes half a unit to the Impact signal, which is 30% of DevTrack's score, and earns 15 lifetime XP. Leaderboard score is period- and cohort-dependent, while XP accumulates over time.",
      },
      {
        q: "What should I do if I cannot run the project locally?",
        a: "Be transparent. Review the diff, trace relevant code paths, inspect the tests and CI results, and state clearly that you performed a static review rather than runtime testing.",
      },
    ],
  },
,];

export function findGuide(slug: string) {
  return GUIDES.find((g) => g.slug === slug);
}
