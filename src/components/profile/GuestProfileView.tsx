import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import TierBadge from "@/components/gamification/TierBadge";
import LevelChip from "@/components/gamification/LevelChip";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import ShareProfileSection from "@/components/ShareProfileSection";
import { levelFromXp } from "@/lib/gamification/scoring";
import type {
  GuestProfile,
  GuestRankEstimate,
} from "@/lib/guest-profile-model";

const CARD =
  "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-soft)] sm:p-6";

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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 text-[var(--foreground)] sm:px-6 lg:px-8">
      {/* Identity */}
      <header className="mb-6 flex flex-wrap items-start gap-5">
        <Image
          src={`https://avatars.githubusercontent.com/${profile.login}`}
          alt={`${profile.login}'s GitHub avatar`}
          width={80}
          height={80}
          className="shrink-0 rounded-full border-2 border-[var(--border)] shadow-md"
          unoptimized
        />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="truncate">@{profile.login}</span>
            <span className="rounded-full border border-dashed border-[var(--border)] px-2.5 py-0.5 text-xs font-medium text-[var(--muted-foreground)]">
              Not on DevTrack yet
            </span>
          </h1>
          {profile.name && (
            <p className="mt-1 text-[var(--muted-foreground)]">
              {profile.name}
            </p>
          )}
          {profile.bio && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--card-foreground)]">
              {profile.bio}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--muted-foreground)]">
            <span>On GitHub since {githubSince}</span>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--control)] px-3 py-1 text-xs font-medium text-[var(--card-foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              View on GitHub
            </a>
            {compareHref && (
              <Link
                href={compareHref}
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                Compare with me
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Claim: the estimate is the hook */}
      <section
        aria-labelledby="claim-heading"
        className="mb-6 overflow-hidden rounded-2xl border-2 border-[var(--accent)] bg-[var(--card)] p-5 sm:p-6"
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Unclaimed profile
            </p>
            <h2
              id="claim-heading"
              className="mt-2 font-display text-2xl font-bold text-[var(--card-foreground)] sm:text-3xl"
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
            {estimate && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <TierBadge tier={estimate.tier} score={estimate.scoreV2} />
                <LevelChip level={levelFromXp(estimate.xp).level} />
                <span className="text-sm text-[var(--muted-foreground)]">
                  {fmt.format(estimate.xp)} XP waiting
                </span>
              </div>
            )}
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">
              Is this you? Claim it to join the leaderboard, keep your XP and
              tier, count private contributions, and get README badges.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
            <Link href={claimHref} className={buttonVariants({ size: "lg" })}>
              Claim this profile
            </Link>
            <Link
              href="/leaderboard"
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
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
          <div
            key={stat.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <div className="text-xs font-medium text-[var(--muted-foreground)]">
              {stat.label}
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-[var(--card-foreground)]">
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
          className="text-lg font-semibold text-[var(--card-foreground)]"
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
            className="mb-4 text-lg font-semibold text-[var(--card-foreground)]"
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
                  className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--control)] p-3"
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
            className="mb-4 text-lg font-semibold text-[var(--card-foreground)]"
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
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--control)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
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
    </div>
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
            className={`h-[11px] w-[11px] rounded-[2px] ${LEVELS[level(d.count, max)]}`}
          />
        ))}
      </div>
    </div>
  );
}
