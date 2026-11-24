import { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "@/components/Link";
import {
  Users,
  GitCommit,
  GitPullRequest,
  Flame,
  Building2,
  ExternalLink,
  Globe,
  Award,
  ArrowLeft,
  Calendar,
} from "lucide-react";
import { fetchOrgAnalytics, OrgAnalyticsData } from "@/lib/org-analytics";

export const dynamic = "force-dynamic";

interface OrgPageProps {
  params: Promise<{ orgName: string }>;
}

export async function generateMetadata({ params }: OrgPageProps): Promise<Metadata> {
  const { orgName } = await params;
  return {
    title: `${orgName} — Team Analytics | DevTrack`,
    description: `Public developer velocity, commit analytics, and team streaks for ${orgName} on DevTrack.`,
  };
}

export default async function OrgAnalyticsPage({ params }: OrgPageProps) {
  const { orgName } = await params;

  let data: OrgAnalyticsData | null = null;
  try {
    data = await fetchOrgAnalytics(orgName);
  } catch {
    // Falls through to notFound / error UI
  }

  if (!data) {
    notFound();
  }

  const { org, members, stats } = data;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Back Link */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to DevTrack
          </Link>
        </div>

        {/* Org Header Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 shadow-xl">
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-800 flex-shrink-0">
            {org.avatar_url ? (
              <Image
                src={org.avatar_url}
                alt={org.name || org.login}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <Building2 className="w-12 h-12 text-slate-500 m-auto mt-7" />
            )}
          </div>

          <div className="flex-1 text-center md:text-left space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-center md:justify-start">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {org.name || org.login}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit mx-auto sm:mx-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Team Analytics
              </span>
            </div>

            {org.description && (
              <p className="text-sm text-slate-400 max-w-2xl">{org.description}</p>
            )}

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                github.com/{org.login}
              </span>
              {org.blog && (
                <a
                  href={org.blog.startsWith("http") ? org.blog : `https://${org.blog}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  {org.blog}
                </a>
              )}
              <a
                href={org.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                View on GitHub <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* 4 KPI Stat Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Commits (30d)</span>
              <GitCommit className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-3xl font-bold text-white tracking-tight">{stats.totalCommits30d}</p>
            <p className="text-xs text-slate-500">Across {stats.totalMembers} public members</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Active Contributors</span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-white tracking-tight">{stats.activeContributors}</p>
            <p className="text-xs text-slate-500">At least 1 commit in 30 days</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Top Streak</span>
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-3xl font-bold text-white tracking-tight">
              {stats.streakLeaderboard[0]?.currentStreak || 0}
              <span className="text-sm font-normal text-slate-400 ml-1">days</span>
            </p>
            <p className="text-xs text-slate-500">
              Held by @{stats.streakLeaderboard[0]?.login || "none"}
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>PR Velocity</span>
              <GitPullRequest className="w-4 h-4 text-sky-400" />
            </div>
            <p className="text-3xl font-bold text-white tracking-tight">{stats.prVelocity.total}</p>
            <p className="text-xs text-slate-500">
              {stats.prVelocity.merged} merged · {stats.prVelocity.open} open
            </p>
          </div>
        </div>

        {/* Streak Leaderboard & Members Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Top 5 Streak Leaderboard */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Award className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">Streak Leaderboard</h2>
            </div>

            {stats.streakLeaderboard.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No streak data available</p>
            ) : (
              <div className="space-y-3">
                {stats.streakLeaderboard.map((leader, rank) => (
                  <div
                    key={leader.login}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          rank === 0
                            ? "bg-amber-400/20 text-amber-400 border border-amber-400/30"
                            : rank === 1
                            ? "bg-slate-300/20 text-slate-300 border border-slate-300/30"
                            : rank === 2
                            ? "bg-amber-700/20 text-amber-600 border border-amber-700/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {rank + 1}
                      </span>
                      <Image
                        src={leader.avatar_url}
                        alt={leader.login}
                        width={28}
                        height={28}
                        className="rounded-full bg-slate-800"
                        unoptimized
                      />
                      <Link
                        href={`/u/${leader.login}`}
                        className="text-sm font-medium text-slate-200 hover:text-indigo-400 transition-colors"
                      >
                        {leader.login}
                      </Link>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                      <Flame className="w-3.5 h-3.5" />
                      <span>{leader.currentStreak}d</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Org Public Members Grid */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-semibold text-white">Public Members</h2>
              </div>
              <span className="text-xs text-slate-400">{members.length} members shown</span>
            </div>

            {members.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Users className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-base font-medium text-slate-300">No public members found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  This organization has no public members visible or membership privacy is set to
                  private.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
                {members.map((member) => (
                  <div
                    key={member.login}
                    className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Image
                        src={member.avatar_url}
                        alt={member.login}
                        width={36}
                        height={36}
                        className="rounded-full bg-slate-800"
                        unoptimized
                      />
                      <div>
                        <Link
                          href={`/u/${member.login}`}
                          className="text-sm font-medium text-slate-200 hover:text-indigo-400 transition-colors block"
                        >
                          {member.login}
                        </Link>
                        <span className="text-xs text-slate-500">
                          {member.commits30d} commits (30d)
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-medium text-slate-400 flex items-center gap-1 justify-end">
                        <Flame className="w-3 h-3 text-amber-500" /> {member.currentStreak}d
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {member.prsMerged} PRs merged
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer info banner */}
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-slate-600" />
          <span>
            Aggregated stats are cached for 1 hour. Rate limit shared safely via token pool.
          </span>
        </div>
      </div>
    </div>
  );
}
