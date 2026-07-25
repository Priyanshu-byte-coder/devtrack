import { Metadata } from "next";
import Link from "next/link";
import { Scale, Trophy } from "lucide-react";
import Image from "next/image";
import { normalizeGitHubUsername } from "@/lib/validate-github-username";
import {
  fetchPublicProfile,
  type PublicLanguage,
  type PublicProfileData,
  type TopRepo,
} from "@/lib/public-profile-data";

export const dynamic = "force-dynamic";

type Winner = "left" | "right" | "tie";

async function parseUsers(params: Promise<{ users: string }>): Promise<[string, string] | null> {
  let decoded: string;
  try {
    const { users } = await params;
    decoded = decodeURIComponent(users);
  } catch (e) {
    return null;
  }

  const match = decoded.match(/^(.+)-vs-(.+)$/);
  if (!match) return null;

  const left = normalizeGitHubUsername(match[1]);
  const right = normalizeGitHubUsername(match[2]);

  if (!left || !right || left.toLowerCase() === right.toLowerCase()) {
    return null;
  }

  return [left, right];
}

function compareNumbers(left: number, right: number): Winner {
  if (left === right) return "tie";
  return left > right ? "left" : "right";
}

function topLanguage(languages: PublicLanguage[]): string {
  return languages[0]?.name ?? "No public data";
}

function repoCommitTotal(repos: TopRepo[]): number {
  return repos.reduce((sum, repo) => sum + repo.commits, 0);
}

export async function generateMetadata({
  params,
}: { params: Promise<{ users: string }> }): Promise<Metadata> {
  const parsed = await parseUsers(params);
  if (!parsed) {
    return {
      title: "Compare Public Profiles",
      description: "Compare public DevTrack profile stats.",
    };
  }

  const [left, right] = parsed;
  return {
    title: `${left} vs ${right} - DevTrack Compare`,
    description: `Side-by-side public DevTrack stats comparison for ${left} and ${right}.`,
  };
}

export default async function PublicProfileComparePage({
  params,
}: { params: Promise<{ users: string }> }) {
  const { users } = await params;
  const parsed = await parseUsers(params);

  if (!parsed) {
    return <CompareUnavailable title="Invalid compare URL" />;
  }

  const [leftUsername, rightUsername] = parsed;
  const [leftProfile, rightProfile] = await Promise.all([
    fetchPublicProfile(leftUsername),
    fetchPublicProfile(rightUsername),
  ]);

  if (!leftProfile || !rightProfile) {
    return (
      <CompareUnavailable
        title="Comparison unavailable"
        message="One of these profiles does not exist, is private, or cannot be loaded right now."
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 text-[var(--foreground)] transition-colors md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Public Profile Compare
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)] md:text-4xl">
              @{leftProfile.username} vs @{rightProfile.username}
            </h1>
            <p className="mt-2 text-[var(--muted-foreground)]">
              Shareable comparison built only from publicly visible DevTrack stats.
            </p>
          </div>
          <Link
            href={`/u/${encodeURIComponent(rightProfile.username)}`}
            className="secondary-button inline-flex rounded-lg px-4 py-2 text-sm font-medium"
          >
            View profile
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
          <ProfileHeader profile={leftProfile} />
          <div className="hidden items-center justify-center md:flex">
            <div className="rounded-full border border-[var(--border)] bg-[var(--card)] p-3 text-[var(--muted-foreground)] shadow-[var(--shadow-soft)]">
              <Scale size={22} />
            </div>
          </div>
          <ProfileHeader profile={rightProfile} align="right" />
        </div>

        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-soft)] md:p-6">
          <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm font-medium text-[var(--muted-foreground)]">
            <div>@{leftProfile.username}</div>
            <div className="text-center text-xs uppercase tracking-wide">
              Metric
            </div>
            <div className="text-right">@{rightProfile.username}</div>
          </div>

          <div className="space-y-3">
            <MetricRow
              label="Current streak"
              left={leftProfile.streak.current}
              right={rightProfile.streak.current}
              suffix=" days"
            />
            <MetricRow
              label="Longest streak"
              left={leftProfile.streak.longest}
              right={rightProfile.streak.longest}
              suffix=" days"
            />
            <MetricRow
              label="Commits (30d)"
              left={leftProfile.contributions.total}
              right={rightProfile.contributions.total}
            />
            <MetricRow
              label="Pull requests"
              left={leftProfile.pullRequests}
              right={rightProfile.pullRequests}
            />
            <MetricRow
              label="Top repo commits"
              left={repoCommitTotal(leftProfile.repos)}
              right={repoCommitTotal(rightProfile.repos)}
            />
            <LanguageRow
              left={topLanguage(leftProfile.topLanguages)}
              right={topLanguage(rightProfile.topLanguages)}
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LanguageCard
            username={leftProfile.username}
            languages={leftProfile.topLanguages}
          />
          <LanguageCard
            username={rightProfile.username}
            languages={rightProfile.topLanguages}
          />
          <ReposCard username={leftProfile.username} repos={leftProfile.repos} />
          <ReposCard username={rightProfile.username} repos={rightProfile.repos} />
        </div>
      </div>
    </div>
  );
}

function CompareUnavailable({
  title,
  message = "Use /compare/user1-vs-user2 with two public DevTrack profiles.",
}: {
  title: string;
  message?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4 text-[var(--foreground)]">
      <div className="surface-card max-w-md rounded-2xl p-8 text-center">
        <h1 className="mb-2 text-3xl font-bold">{title}</h1>
        <p className="mb-6 text-sm text-[var(--muted-foreground)]">{message}</p>
        <Link href="/" className="primary-button inline-block rounded-lg px-6 py-2">
          Back to Home
        </Link>
      </div>
    </div>
  );
}

function ProfileHeader({
  profile,
  align = "left",
}: {
  profile: PublicProfileData;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-soft)] ${
        align === "right" ? "md:text-right" : ""
      }`}
    >
      <div
        className={`flex items-center gap-4 ${
          align === "right" ? "md:flex-row-reverse" : ""
        }`}
      >
        <Image
          src={`https://avatars.githubusercontent.com/${profile.username}`}
          alt={`${profile.username} avatar`}
          width={56}
          height={56}
          unoptimized
          className="h-14 w-14 rounded-full border border-[var(--border)]"
        />
        <div className="min-w-0">
          <Link
            href={`/u/${encodeURIComponent(profile.username)}`}
            className="truncate text-xl font-bold text-[var(--card-foreground)] hover:text-[var(--accent)]"
          >
            @{profile.username}
          </Link>
          <p className="text-sm text-[var(--muted-foreground)]">
            {profile.streak.current} day streak - {profile.contributions.total} commits
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  left,
  right,
  suffix = "",
}: {
  label: string;
  left: number;
  right: number;
  suffix?: string;
}) {
  const winner = compareNumbers(left, right);

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg bg-[var(--control)] p-3">
      <Value
        value={`${left}${suffix}`}
        state={winner === "tie" ? "tie" : winner === "left" ? "win" : "neutral"}
      />
      <div className="text-center text-xs font-medium text-[var(--muted-foreground)]">
        {label}
      </div>
      <Value
        value={`${right}${suffix}`}
        state={winner === "tie" ? "tie" : winner === "right" ? "win" : "neutral"}
        align="right"
      />
    </div>
  );
}

function LanguageRow({ left, right }: { left: string; right: string }) {
  const tied = left === right;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg bg-[var(--control)] p-3">
      <Value value={left} state={tied ? "tie" : "neutral"} />
      <div className="text-center text-xs font-medium text-[var(--muted-foreground)]">
        Top language
      </div>
      <Value value={right} state={tied ? "tie" : "neutral"} align="right" />
    </div>
  );
}

function Value({
  value,
  state,
  align = "left",
}: {
  value: string;
  state: "win" | "tie" | "neutral";
  align?: "left" | "right";
}) {
  const className =
    state === "win"
      ? "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]"
      : state === "tie"
        ? "border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)]"
        : "border-transparent text-[var(--foreground)]";

  return (
    <div className={`min-w-0 ${align === "right" ? "text-right" : ""}`}>
      <span
        className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-sm font-bold ${className}`}
      >
        {state === "win" && <Trophy size={14} aria-hidden="true" />}
        <span className="truncate">{value}</span>
        {state === "tie" && <span className="text-xs font-medium">Tie</span>}
      </span>
    </div>
  );
}

function LanguageCard({
  username,
  languages,
}: {
  username: string;
  languages: PublicLanguage[];
}) {
  const total = languages.reduce((sum, language) => sum + language.count, 0);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-soft)]">
      <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">
        @{username} Top Languages
      </h2>
      {languages.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          No public language data available.
        </p>
      ) : (
        <ul className="space-y-3">
          {languages.map((language) => (
            <li key={language.name}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-[var(--card-foreground)]">
                  {language.name}
                </span>
                <span className="text-[var(--muted-foreground)]">
                  {language.count} repo{language.count !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--control)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{
                    width: `${Math.max((language.count / total) * 100, 4)}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReposCard({ username, repos }: { username: string; repos: TopRepo[] }) {
  const maxCommits = repos[0]?.commits ?? 1;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-soft)]">
      <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">
        @{username} Top Repositories
      </h2>
      {repos.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          No public repository data available.
        </p>
      ) : (
        <ul className="space-y-3">
          {repos.map((repo, index) => {
            const shortName = repo.name.split("/")[1] ?? repo.name;
            const width = Math.max(Math.round((repo.commits / maxCommits) * 100), 4);

            return (
              <li key={repo.name}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 truncate font-medium text-[var(--card-foreground)] hover:text-[var(--accent)]"
                    title={repo.name}
                  >
                    <span className="mr-1 text-[var(--muted-foreground)]">
                      #{index + 1}
                    </span>
                    {shortName}
                  </a>
                  <span className="shrink-0 text-[var(--muted-foreground)]">
                    {repo.commits} commit{repo.commits !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--control)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${width}%` }}
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
