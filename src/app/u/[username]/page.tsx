export const dynamic = "force-dynamic";
import ProfileThemeWrapper from "@/components/ProfileThemeWrapper";
import { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";
import BadgeSection from "@/components/BadgeSection";
import GitHubAchievements from "@/components/GitHubAchievements";
import ShareProfileSection from "@/components/ShareProfileSection";
import SponsorBadge from "@/components/SponsorBadge";
import PinnedReposWidget from "@/components/PinnedReposWidget";
import { Moon, Sun } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getUserByGithubId } from "@/lib/supabase";
import type { PublicProfileData } from "@/lib/public-profile-data";
import {
  getProfileForPage,
  getPublicProfileForPage,
} from "@/lib/public-profile-cache";
import { getLeaderboardData } from "@/lib/leaderboard";
import {
  estimateGuestRank,
  isIndexableGuest,
  type GuestProfile,
  type GuestRankEstimate,
} from "@/lib/guest-profile-model";
import GuestProfileView from "@/components/profile/GuestProfileView";
import GitHubBusy from "@/components/GitHubBusy";
import { isGitHubBusyError } from "@/lib/github-busy";
import { getProgressForLogin } from "@/lib/gamification/queries";
import { getRankRow } from "@/lib/gamification/live-rank";
import RankMovementBadge from "@/components/gamification/RankMovementBadge";
import PlayerCard, { type HudStat } from "@/components/profile/PlayerCard";
import { rankMovement } from "@/lib/gamification/ranking";
import { JsonLd, breadcrumbJsonLd, profilePageJsonLd } from "@/lib/seo/json-ld";

// Extend tracking structures to forward gamification flags seamlessly downstream
interface ExtendedPublicProfileData extends PublicProfileData {
  userId: string;
  isNightOwl: boolean;
  isEarlyBird: boolean;
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  );
}

async function loadProfile(
  username: string
): Promise<ExtendedPublicProfileData | null> {
  const base = await getPublicProfileForPage(username);
  if (!base) return null;

  // Compute Night Owl / Early Bird from repos
  let nightOwlCount = 0;
  let earlyBirdCount = 0;

  (base.repos || []).forEach((repo: any) => {
    if (repo.last_commit_date || repo.updatedAt) {
      const commitHour = new Date(
        repo.last_commit_date || repo.updatedAt
      ).getHours();
      if (commitHour >= 0 && commitHour <= 4) nightOwlCount++;
      if (commitHour >= 5 && commitHour <= 8) earlyBirdCount++;
    }
  });

  return {
    ...base,
    userId: "",
    isNightOwl: nightOwlCount >= 1,
    isEarlyBird: earlyBirdCount >= 1,
  };
}

async function getLoggedInGitHubUsername() {
  const session = await getServerSession(authOptions);

  if (typeof session?.githubLogin === "string" && session.githubLogin.trim()) {
    return session.githubLogin;
  }

  if (typeof session?.githubId === "string" && session.githubId.trim()) {
    const user = await getUserByGithubId(session.githubId);
    return user?.github_login ?? null;
  }

  return null;
}

function getProfileUrl(username: string) {
  return `${getBaseUrl()}/u/${username.toLowerCase()}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const canonicalPath = `/u/${username.toLowerCase()}`;

  let lookup: Awaited<ReturnType<typeof getProfileForPage>>;
  try {
    lookup = await getProfileForPage(username);
  } catch {
    // Upstream outage: keep the metadata neutral. A noindex here would drop a
    // real profile from search because GitHub had a bad minute.
    return { title: username };
  }

  if (!lookup) {
    return {
      title: "Profile not found",
      description: "This profile is not available or is private.",
      robots: { index: false, follow: false },
    };
  }

  if (lookup.kind === "guest") return guestMetadata(lookup.profile);

  const displayName = lookup.profile.username;
  // The tab title stays short; link previews get the longer one.
  const title = `${displayName}'s GitHub stats`;
  const shareTitle = `${displayName}'s GitHub stats, streak & rank`;
  const description = `${displayName}'s coding activity on DevTrack: contribution streak, commits, pull requests, top languages and global rank.`;

  // No `images` here on purpose: the segment's opengraph-image.tsx renders the
  // card from live stats. Setting images in config would override it.
  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: shareTitle,
      description,
      url: canonicalPath,
      siteName: "DevTrack",
      type: "profile",
      username: displayName,
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
    },
  };
}
function guestMetadata(guest: GuestProfile): Metadata {
  const canonicalPath = `/u/${guest.login.toLowerCase()}`;
  const title = `${guest.login}'s GitHub stats`;
  const shareTitle = `${guest.login}'s GitHub stats, streak & rank`;
  const description = `${guest.login}'s GitHub activity: ${guest.yearContributions.toLocaleString("en-US")} contributions in the last year, a ${guest.streak.longest}-day best streak, top languages and where they'd rank on DevTrack.`;
  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    // Thin pages stay out of the index but still pass link equity on.
    robots: isIndexableGuest(guest)
      ? undefined
      : { index: false, follow: true },
    openGraph: {
      title: shareTitle,
      description,
      url: canonicalPath,
      siteName: "DevTrack",
      type: "profile",
      username: guest.login,
    },
    twitter: { card: "summary_large_image", title: shareTitle, description },
  };
}

async function guestEstimate(
  guest: GuestProfile
): Promise<GuestRankEstimate | null> {
  try {
    const board = await getLeaderboardData(false, { period: "all" });
    if (!board) return null;
    return estimateGuestRank(guest, Object.values(board.leaders).flat());
  } catch {
    return null;
  }
}

async function GuestProfilePage({ guest }: { guest: GuestProfile }) {
  const canonical = guest.login.toLowerCase();
  const [estimate, viewerLogin] = await Promise.all([
    guestEstimate(guest),
    getLoggedInGitHubUsername(),
  ]);
  const indexable = isIndexableGuest(guest);

  return (
    <ProfileThemeWrapper>
      {indexable && (
        <JsonLd
          data={[
            profilePageJsonLd({
              username: guest.login,
              bio: guest.bio,
              memberSince: null,
              topLanguages: guest.topLanguages,
            }),
            breadcrumbJsonLd([
              { name: "DevTrack", path: "/" },
              { name: "Leaderboard", path: "/leaderboard" },
              { name: guest.login, path: `/u/${canonical}` },
            ]),
          ]}
        />
      )}
      <GuestProfileView
        profile={guest}
        estimate={estimate}
        profileUrl={getProfileUrl(canonical)}
        viewerLogin={
          viewerLogin && viewerLogin.toLowerCase() !== canonical
            ? viewerLogin
            : null
        }
      />
    </ProfileThemeWrapper>
  );
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  let lookup: Awaited<ReturnType<typeof getProfileForPage>>;
  try {
    lookup = await getProfileForPage(username);
  } catch (error) {
    if (!isGitHubBusyError(error)) throw error;
    return (
      <ProfileThemeWrapper>
        <GitHubBusy
          retryHref={`/u/${encodeURIComponent(username)}`}
          what={`@${username}'s profile`}
        />
      </ProfileThemeWrapper>
    );
  }
  if (!lookup) notFound();

  if (lookup.kind === "guest") {
    const canonical = lookup.profile.login.toLowerCase();
    if (username !== canonical) permanentRedirect(`/u/${canonical}`);
    return <GuestProfilePage guest={lookup.profile} />;
  }

  const [profile, loggedInUsername, progress, globalRank] = await Promise.all([
    loadProfile(username),
    getLoggedInGitHubUsername(),
    getProgressForLogin(username),
    getRankRow(username, "all"),
  ]);
  const profileUrl = getProfileUrl(username);

  if (!profile) notFound();

  const canonicalUsername = profile.username.toLowerCase();
  if (username !== canonicalUsername) {
    permanentRedirect(`/u/${canonicalUsername}`);
  }

  const gistsUrl = `https://gist.github.com/${profile.username}`;
  const githubUrl = `https://github.com/${profile.username}`;
  const isOwner =
    loggedInUsername?.toLowerCase() === profile.username.toLowerCase();
  const showCompareButton =
    loggedInUsername !== null &&
    loggedInUsername.toLowerCase() !== profile.username.toLowerCase();
  const compareHref = showCompareButton
    ? `/compare/${encodeURIComponent(loggedInUsername)}-vs-${encodeURIComponent(profile.username)}`
    : null;

  const widgets = profile.publicWidgets ?? ["streak", "contributions"];
  const showStreak = widgets.includes("streak");
  const showContributions = widgets.includes("contributions");
  const showLanguages = widgets.includes("languages");
  const showPRs = widgets.includes("prs");

  const memberSinceFormatted = profile.memberSince
    ? new Date(profile.memberSince).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;

  // Headline stats, in priority order; hidden widgets never make the HUD.
  const hudCandidates: Array<HudStat | false> = [
    globalRank
      ? {
          label: "Global rank",
          value: globalRank.rank,
          prefix: "#",
          sub: (
            <RankMovementBadge
              movement={rankMovement(
                globalRank.rank,
                globalRank.previousRank ?? undefined,
                globalRank.hasPrevious
              )}
            />
          ),
        }
      : { label: "Global rank", value: "—" },
    showStreak && {
      label: "Streak",
      value: profile.streak.current,
      suffix: "D",
    },
    progress !== null && { label: "Level", value: progress.level },
    showContributions && {
      label: "Commits 30d",
      value: profile.contributions.total,
    },
    showPRs && { label: "PRs", value: profile.pullRequests },
    { label: "Gists", value: profile.publicGists },
  ];
  const hud = hudCandidates
    .filter((stat): stat is HudStat => Boolean(stat))
    .slice(0, 3);

  return (
    <ProfileThemeWrapper>
      <JsonLd
        data={[
          profilePageJsonLd({
            username: profile.username,
            bio: profile.bio,
            memberSince: profile.memberSince,
            topLanguages: showLanguages ? (profile.topLanguages ?? []) : [],
          }),
          breadcrumbJsonLd([
            { name: "DevTrack", path: "/" },
            { name: "Leaderboard", path: "/leaderboard" },
            { name: profile.username, path: `/u/${canonicalUsername}` },
          ]),
        ]}
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 text-[var(--foreground)] sm:px-6 lg:px-8">
        <PlayerCard
          login={profile.username}
          eyebrow={isOwner ? "Player 1 · you" : "Player · DevTrack member"}
          subtitle="GitHub activity and coding stats"
          bio={profile.bio}
          tier={progress?.tier ?? globalRank?.tier ?? null}
          xp={progress?.xp ?? null}
          hud={hud}
          meta={
            <>
              {profile.isSponsor && <SponsorBadge />}
              {profile.isNightOwl && (
                <span
                  title="Night Owl Milestone Badge"
                  className="inline-flex items-center gap-1 border border-indigo-500/40 bg-indigo-500/10 px-2 py-0.5 font-bold text-indigo-400"
                >
                  <Moon className="h-3 w-3" aria-hidden="true" />
                  Night Owl
                </span>
              )}
              {profile.isEarlyBird && (
                <span
                  title="Early Bird Milestone Badge"
                  className="inline-flex items-center gap-1 border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-bold text-amber-400"
                >
                  <Sun className="h-3 w-3" aria-hidden="true" />
                  Early Bird
                </span>
              )}
              {memberSinceFormatted && (
                <span>Member since {memberSinceFormatted}</span>
              )}
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 border border-[var(--border)] bg-[var(--control)] px-2.5 py-1 font-medium text-[var(--card-foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                View on GitHub
              </a>
              {profile.publicGists > 0 && (
                <a
                  href={gistsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center border border-[var(--border)] bg-[var(--control)] px-2.5 py-1 font-medium text-[var(--card-foreground)] transition-colors hover:text-[var(--accent)]"
                >
                  {profile.publicGists} Gists
                </a>
              )}
            </>
          }
          actions={
            <>
              {compareHref ? (
                <Link href={compareHref} className="px-btn">
                  Challenge to a duel
                </Link>
              ) : (
                !isOwner && (
                  <Link
                    href={`/compare?vs=${encodeURIComponent(canonicalUsername)}`}
                    className="px-btn"
                  >
                    Duel @{profile.username}
                  </Link>
                )
              )}
              <Link href="/leaderboard" className="px-btn px-btn-ghost">
                Leaderboard
              </Link>
            </>
          }
        />

        {/* Share section */}
        <div className="mb-8">
          <ShareProfileSection
            username={profile.username}
            streak={profile.streak.current}
            profileUrl={profileUrl}
            isOwner={isOwner}
            rank={
              globalRank
                ? {
                    rank: globalRank.rank,
                    total: globalRank.total,
                    tier: globalRank.tier,
                    level: globalRank.level,
                  }
                : null
            }
          />
        </div>

        {/* Row 1: Contribution graph + Streak (gated by public_widgets) */}
        {(showContributions || showStreak) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {showContributions && (
              <div className="lg:col-span-2">
                <PublicContributionGraph data={profile.contributions} />
              </div>
            )}
            {showStreak && (
              <div className={showContributions ? "" : "lg:col-span-3"}>
                <PublicStreakTracker streak={profile.streak} />
              </div>
            )}
          </div>
        )}

        {/* Languages (gated) */}
        {showLanguages && profile.topLanguages.length > 0 && (
          <div className="mt-6">
            <PublicLanguageBreakdown languages={profile.topLanguages} />
          </div>
        )}

        {/* Pull Requests (gated) */}
        {showPRs && (
          <div className="mt-6">
            <PublicPRCount pullRequests={profile.pullRequests} />
          </div>
        )}

        {/* Custom Spotlight Repositories */}
        {profile.spotlightRepos?.length ? (
          <div className="mt-6">
            <PinnedReposWidget
              initialRepos={profile.spotlightRepos}
              isPublic={true}
            />
          </div>
        ) : null}

        {/* Weekly Goal Progress */}
        {profile.weeklyGoalProgress && (
          <div className="mt-6">
            <PublicWeeklyGoalProgress progress={profile.weeklyGoalProgress} />
          </div>
        )}

        {/* Top repos */}
        <div className="mt-6">
          <PublicTopRepos repos={profile.repos} />
        </div>

        {/* GitHub achievements */}
        <div className="mt-6">
          <GitHubAchievements
            achievements={profile.achievements}
            error={profile.achievementsError}
          />
        </div>

        {/* README badges: only useful to the profile owner */}
        {isOwner && (
          <div className="mt-6">
            <BadgeSection username={profile.username} />
          </div>
        )}

        {/* Powered by DevTrack footer badge */}
        <div className="mt-10 flex justify-center">
          <a
            href="https://devtrack.live"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border-2 border-dashed border-[var(--border)] bg-[var(--card)] px-4 py-2 font-pixel text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] hover:border-[var(--accent)]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-3.5 w-3.5 text-[var(--accent)]"
              aria-hidden="true"
            >
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Powered by DevTrack
          </a>
        </div>
      </main>
    </ProfileThemeWrapper>
  );
}

function PublicContributionGraph({
  data: contributionData,
}: {
  data: {
    days: number;
    total: number;
    data: Record<string, number>;
  };
}) {
  // Every day in the window, zeros included, so gaps show as gaps.
  const today = Date.parse(new Date().toISOString().slice(0, 10));
  const days = Array.from({ length: contributionData.days }, (_, i) => {
    const day = new Date(today - (contributionData.days - 1 - i) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return { day, commits: contributionData.data?.[day] ?? 0 };
  });
  const max = Math.max(1, ...days.map((d) => d.commits));
  const active = days.filter((d) => d.commits > 0).length;
  const best = days.reduce((a, b) => (b.commits > a.commits ? b : a), days[0]);
  const label = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  return (
    <div className="px-frame bg-[var(--card)] p-6">
      <h2 className="font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]">
        Commit Activity ({contributionData.days} days)
      </h2>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {[
          { label: "Total commits", value: contributionData.total },
          { label: "Active days", value: active },
          {
            label: "Best day",
            value: best && best.commits > 0 ? best.commits : 0,
          },
        ].map((stat) => (
          <div key={stat.label}>
            <dt className="font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              {stat.label}
            </dt>
            <dd className="font-pixel text-xl tabular-nums text-[var(--card-foreground)]">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {contributionData.total === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">
          No public commits in the last {contributionData.days} days.
        </p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`Commits per day over the last ${contributionData.days} days: ${contributionData.total} in total, best day ${best.commits} on ${label(best.day)}.`}
            className="mt-5 flex h-36 items-end gap-[3px]"
          >
            {days.map((d, i) => {
              const steps =
                d.commits === 0
                  ? 0
                  : Math.max(1, Math.round((d.commits / max) * 12));
              const isBest = d === best && d.commits > 0;
              return (
                <div
                  key={d.day}
                  title={`${label(d.day)}: ${d.commits} commit${d.commits === 1 ? "" : "s"}`}
                  className="flex h-full min-w-0 flex-1 flex-col justify-end"
                >
                  <div
                    className="profile-bar w-full origin-bottom"
                    style={{
                      height: steps === 0 ? "3px" : `${(steps / 12) * 100}%`,
                      background:
                        steps === 0
                          ? "var(--control)"
                          : isBest
                            ? "#f2c14e"
                            : "var(--accent)",
                      opacity: steps === 0 ? 1 : 0.45 + 0.55 * (steps / 12),
                      animationDelay: `${i * 18}ms`,
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between font-pixel text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            <span>{label(days[0].day)}</span>
            <span>
              <span className="text-[#f2c14e]">■</span> best day
            </span>
            <span>Today</span>
          </div>
        </>
      )}
    </div>
  );
}

function PublicStreakTracker({
  streak,
}: {
  streak: import("@/lib/public-profile-data").StreakData;
}) {
  const stats = [
    {
      label: "Current Streak",
      value: streak.current,
      unit: "days",
      highlight: streak.current > 0,
      icon: "🔥",
    },
    {
      label: "Longest Streak",
      value: streak.longest,
      unit: "days",
      highlight: false,
      icon: "🏆",
    },
    {
      label: "Active Days (365d)",
      value: streak.totalActiveDays,
      unit: "days",
      highlight: false,
      icon: "📅",
    },
    {
      label: "Last Commit",
      value: streak.lastCommitDate
        ? new Date(streak.lastCommitDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "—",
      unit: "",
      highlight: false,
      icon: "⚡",
    },
  ];

  return (
    <div className="px-frame bg-[var(--card)] p-6">
      <h2 className="mb-4 font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]">
        Commit Streaks
      </h2>
      {streak.complete === false && (
        <p role="status" className="mb-3 text-sm text-amber-500">
          {streak.partialReason ?? "Streak history is incomplete."}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`border-2 p-3 ${
              stat.highlight
                ? "border-[var(--accent)] bg-accent/10"
                : "border-[var(--border)] bg-[var(--control)]"
            }`}
          >
            <div className="text-xs font-medium text-[var(--muted-foreground)]">
              {stat.icon} {stat.label}
            </div>
            <div className="mt-1 font-pixel text-lg tabular-nums text-[var(--card-foreground)]">
              {stat.value}
            </div>
            {stat.unit && (
              <div className="text-xs text-[var(--muted-foreground)]">
                {stat.unit}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PublicLanguageBreakdown({
  languages,
}: {
  languages: Array<{ name: string; count: number; percentage: number }>;
}) {
  return (
    <div className="px-frame bg-[var(--card)] p-6">
      <h2 className="mb-4 font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]">
        Top Languages
      </h2>
      <div className="space-y-3">
        {languages.map((lang) => (
          <div key={lang.name}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-[var(--card-foreground)]">
                {lang.name}
              </span>
              <span className="text-[var(--muted-foreground)]">
                {lang.percentage}%
              </span>
            </div>
            <div className="h-2 overflow-hidden bg-[var(--control)]">
              <div
                className="h-full bg-[var(--accent)] transition-all duration-500"
                style={{ width: `${lang.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PublicPRCount({ pullRequests }: { pullRequests: number }) {
  return (
    <div className="px-frame bg-[var(--card)] p-6">
      <h2 className="mb-2 font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]">
        Pull Requests
      </h2>
      <div className="flex items-end gap-2">
        <span className="font-pixel text-4xl tabular-nums text-[var(--accent)]">
          {pullRequests.toLocaleString()}
        </span>
        <span className="mb-1 text-sm text-[var(--muted-foreground)]">
          total PRs authored
        </span>
      </div>
    </div>
  );
}

function PublicWeeklyGoalProgress({
  progress,
}: {
  progress: { completed: number; total: number; percentage: number };
}) {
  return (
    <div className="px-frame bg-[var(--card)] p-6">
      <h2 className="mb-4 font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]">
        Weekly Goal Progress
      </h2>
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20">
          <svg className="h-20 w-20 -rotate-90" viewBox="0 0 72 72">
            <circle
              cx="36"
              cy="36"
              r="30"
              fill="none"
              stroke="var(--control)"
              strokeWidth="6"
            />
            <circle
              cx="36"
              cy="36"
              r="30"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="6"
              strokeDasharray={2 * Math.PI * 30}
              strokeDashoffset={
                2 * Math.PI * 30 * (1 - progress.percentage / 100)
              }
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[var(--card-foreground)]">
            {progress.percentage}%
          </span>
        </div>
        <div className="text-sm text-[var(--muted-foreground)]">
          {progress.completed} of {progress.total} weekly goals completed
        </div>
      </div>
    </div>
  );
}

function PublicTopRepos({
  repos,
}: {
  repos: Array<{ name: string; commits: number; url: string }>;
}) {
  const maxCommits = repos[0]?.commits ?? 1;

  return (
    <div className="px-frame bg-[var(--card)] p-6">
      <h2 className="mb-4 font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]">
        Top Repositories
      </h2>

      {repos.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          No repository data available.
        </p>
      ) : (
        <ul className="space-y-3">
          {repos.map((repo, idx) => {
            const barWidth = Math.max(
              Math.round((repo.commits / maxCommits) * 100),
              4
            );
            const shortName = repo.name.split("/")[1] ?? repo.name;
            return (
              <li key={repo.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="max-w-[70%] truncate text-[var(--card-foreground)] transition-colors hover:text-[var(--accent)]"
                    title={repo.name}
                  >
                    <span className="mr-1 text-[var(--muted-foreground)]">
                      #{idx + 1}
                    </span>
                    {shortName}
                  </a>
                  <span className="shrink-0 text-[var(--muted-foreground)]">
                    {repo.commits} commit{repo.commits !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden bg-[var(--control)]">
                  <div
                    className="h-full bg-[var(--accent)] transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
