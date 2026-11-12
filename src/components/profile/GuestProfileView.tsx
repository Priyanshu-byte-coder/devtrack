import Link from "next/link";
import { Star } from "lucide-react";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import PlayerCard, { type HudStat } from "@/components/profile/PlayerCard";
import ShareProfileSection from "@/components/ShareProfileSection";
import { levelFromXp } from "@/lib/gamification/scoring";
import type {
  GuestProfile,
  GuestRankEstimate,
} from "@/lib/guest-profile-model";

const CARD = "px-frame bg-[var(--card)] p-5 sm:p-6";

const fmt = new Intl.NumberFormat("en-US");

interface GuestProfileViewProps {
  profile: GuestProfile;
  estimate: GuestRankEstimate | null;
  profileUrl: string;
  /** Signed-in viewer's login, if any. */
  viewerLogin: string | null;
}

/**
 * Profile for a GitHub user who hasn't joined DevTrack: their public GitHub
 * activity, where they would rank, and an invitation to claim the page.
 */
export default function GuestProfileView({
  profile,
  estimate,
  profileUrl,
  viewerLogin,
}: GuestProfileViewProps) {
  const githubUrl = `https://github.com/${profile.login}`;
  const githubSince = new Date(profile.githubSince).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" }
  );
  const claimHref = `/claim?login=${encodeURIComponent(profile.login.toLowerCase())}`;
  const compareHref = viewerLogin
    ? `/compare/${encodeURIComponent(viewerLogin)}-vs-${encodeURIComponent(profile.login)}`
    : null;

  const stats = [
    { label: "Contributions (1y)", value: profile.yearContributions },
    { label: "Current streak", value: profile.streak.current, unit: "days" },
    {
      label: "Longest streak (1y)",
      value: profile.streak.longest,
      unit: "days",
    },
    { label: "Active days (1y)", value: profile.activeDays },
    { label: "Commits (all time)", value: profile.lifetime.commits },
    { label: "Pull requests", value: profile.lifetime.prs },
    { label: "Code reviews", value: profile.lifetime.reviews },
    { label: "Followers", value: profile.followers },
  ];

  const hud: HudStat[] = [
    estimate
      ? { label: "Est. rank", value: estimate.rank, prefix: "~#" }
      : { label: "Est. rank", value: "—" },
    { label: "Streak", value: profile.streak.current, suffix: "D" },
    {
      label: "Level",
      value: estimate ? levelFromXp(estimate.xp).level : "—",
    },
  ];

  return (
    // data-guest-profile tells the page cache it may keep this for a week.
    <main
      data-guest-profile=""
      className="mx-auto w-full max-w-6xl px-4 py-8 text-[var(--foreground)] sm:px-6 lg:px-8"
    >
      <PlayerCard
        login={profile.login}
        eyebrow="Not on DevTrack yet"
        subtitle={profile.name}
        bio={profile.bio}
        tier={estimate?.tier ?? null}
        xp={estimate?.xp ?? null}
        hud={hud}
        meta={
          <>
            <span>On GitHub since {githubSince}</span>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center border border-[var(--border)] bg-[var(--control)] px-2.5 py-1 font-medium text-[var(--card-foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              View on GitHub
            </a>
          </>
        }
        actions={
          compareHref ? (
            <Link href={compareHref} className="px-btn">
              Challenge to a duel
            </Link>
          ) : (
            <Link
              href={`/compare?vs=${encodeURIComponent(profile.login.toLowerCase())}`}
              rel="nofollow"
              className="px-btn px-btn-ghost"
            >
              Duel @{profile.login}
            </Link>
          )
        }
      />

      {/* Plain statement of what this page is, for visitors and reviewers. */}
      <p className="mb-6 border-l-4 border-[var(--border)] pl-3 text-xs leading-5 text-[var(--muted-foreground)]">
        This page is generated automatically from @{profile.login}&apos;s public
        GitHub activity. It is not run, verified or endorsed by @{profile.login}{" "}
        or by GitHub, and DevTrack never asks for a GitHub password.
      </p>

      {/* Claim: the estimate is the hook */}
      <section
        aria-labelledby="claim-heading"
        className="px-frame px-frame-accent mb-8 bg-[var(--card)] p-5 sm:p-6"
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="font-pixel text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
              Unclaimed profile
            </p>
            <h2
              id="claim-heading"
              className="mt-2 font-pixel text-2xl uppercase leading-tight text-[var(--card-foreground)] sm:text-3xl"
            >
              {estimate ? (
                <>
                  Would rank #{estimate.rank}{" "}
                  <span className="text-[var(--muted-foreground)]">
                    of {fmt.format(estimate.total)} globally
                  </span>
                </>
              ) : (
                "Climb the DevTrack leaderboard"
              )}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">
              If you are @{profile.login}, sign in with GitHub as @
              {profile.login} to claim it: join the leaderboard, keep your
              {estimate ? ` ${fmt.format(estimate.xp)} XP` : " XP"} and tier,
              count private contributions, and get README badges. Only the owner
              of the GitHub account can claim it.
            </p>
          </div>
          <div className="-m-1 flex shrink-0 flex-wrap gap-2 md:flex-col">
            <Link href={claimHref} rel="nofollow" className="px-btn">
              Is this you? Sign in to claim
            </Link>
            <Link href="/leaderboard" className="px-btn px-btn-ghost">
              See the leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section
        aria-label="GitHub stats"
        className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {stats.map((stat) => (
          <div key={stat.label} className="px-frame bg-[var(--card)] p-4">
            <div className="font-pixel text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              {stat.label}
            </div>
            <div className="mt-1 font-pixel text-2xl tabular-nums text-[var(--card-foreground)]">
              <AnimatedNumber value={stat.value} />
              {stat.unit && (
                <span className="ml-1 text-sm font-medium text-[var(--muted-foreground)]">
                  {stat.unit}
                </span>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Contribution calendar */}
      <section className={`${CARD} mb-6`} aria-labelledby="calendar-heading">
        <h2
          id="calendar-heading"
          className="font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]"
        >
          {fmt.format(profile.yearContributions)} contributions in the last year
        </h2>
        <ContributionCalendar days={profile.calendar} />
      </section>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section
          className={`${CARD} lg:col-span-2`}
          aria-labelledby="repos-heading"
        >
          <h2
            id="repos-heading"
            className="mb-4 font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]"
          >
            Top repositories
          </h2>
          {profile.topRepos.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              No public repositories yet.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {profile.topRepos.map((repo) => (
                <li
                  key={repo.name}
                  className="min-w-0 border-2 border-dashed border-[var(--border)] bg-[var(--background)] p-3"
                >
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate font-medium text-[var(--card-foreground)] hover:text-[var(--accent)]"
                  >
                    {repo.name}
                  </a>
                  {repo.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--muted-foreground)]">
                      {repo.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3" aria-hidden="true" />
                      {fmt.format(repo.stars)}
                    </span>
                    {repo.language && <span>{repo.language}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={CARD} aria-labelledby="languages-heading">
          <h2
            id="languages-heading"
            className="mb-4 font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]"
          >
            Top languages
          </h2>
          {profile.topLanguages.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              No language data.
            </p>
          ) : (
            <div className="space-y-3">
              {profile.topLanguages.map((lang) => (
                <div key={lang.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-[var(--card-foreground)]">
                      {lang.name}
                    </span>
                    <span className="text-[var(--muted-foreground)]">
                      {lang.percentage}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden bg-[var(--control)]">
                    <div
                      className="h-full bg-[var(--accent)]"
                      style={{ width: `${lang.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mb-6">
        <ShareProfileSection
          username={profile.login}
          streak={profile.streak.current}
          profileUrl={profileUrl}
          isOwner={false}
          rank={null}
        />
      </div>

      <p className="text-center text-xs text-[var(--muted-foreground)]">
        Built from public GitHub data and refreshed every few hours. Not
        affiliated with @{profile.login}.
      </p>
    </main>
  );
}

const LEVELS = [
  "bg-[var(--control)]",
  "bg-accent/30",
  "bg-accent/55",
  "bg-accent/80",
  "bg-accent",
];

function level(count: number, max: number) {
  if (count <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
}

/** GitHub-style year grid: one column per week, Sunday at the top. */
function ContributionCalendar({ days }: { days: GuestProfile["calendar"] }) {
  if (days.length === 0) {
    return (
      <p className="mt-3 text-sm text-[var(--muted-foreground)]">
        No public contributions.
      </p>
    );
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  const firstWeekday = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();

  return (
    <div className="mt-4 overflow-x-auto pb-1">
      <div
        role="img"
        aria-label={`Daily contributions over the last year, busiest day ${max}`}
        className="grid w-max grid-flow-col grid-rows-7 gap-[3px]"
      >
        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`pad-${i}`} className="h-[11px] w-[11px]" />
        ))}
        {days.map((d) => (
          <span
            key={d.date}
            title={`${d.date}: ${d.count} contribution${d.count === 1 ? "" : "s"}`}
            className={`h-[11px] w-[11px] ${LEVELS[level(d.count, max)]}`}
          />
        ))}
      </div>
    </div>
  );
}
