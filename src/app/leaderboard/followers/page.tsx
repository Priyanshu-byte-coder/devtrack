"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "@/components/Link";
import {
  Users,
  Flame,
  GitCommit,
  GitPullRequest,
  ArrowLeft,
  Trophy,
  Loader2,
  Search,
} from "lucide-react";
import type {
  FollowerRankedItem,
  FollowerSortField,
  FollowersLeaderboardResult,
} from "@/lib/followers-leaderboard";

export default function FollowersLeaderboardPage() {
  const [username, setUsername] = useState("octocat");
  const [activeUsername, setActiveUsername] = useState("octocat");
  const [sortBy, setSortBy] = useState<FollowerSortField>("streak");
  const [data, setData] = useState<FollowersLeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const loadFollowers = async (userToFetch: string, sort: FollowerSortField) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/leaderboard/followers?username=${encodeURIComponent(userToFetch)}&sortBy=${sort}`
      );
      if (!res.ok) {
        if (res.status === 404) {
          setError("User not found on GitHub");
        } else {
          setError("Failed to load followers leaderboard");
        }
        setData(null);
      } else {
        const json = await res.json();
        setData(json);
      }
    } catch {
      setError("An unexpected error occurred");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowers(activeUsername, sortBy);
  }, [activeUsername, sortBy]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      startTransition(() => {
        setActiveUsername(username.trim());
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Back */}
        <div className="flex items-center justify-between">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Global Leaderboard
          </Link>
          <span className="text-xs text-slate-500 font-mono">DevTrack Social</span>
        </div>

        {/* Header Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-400" />
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Followers Leaderboard
                </h1>
              </div>
              <p className="text-sm text-slate-400">
                Compare streaks, commit volumes, and merged PRs across GitHub followers.
              </p>
            </div>

            {/* Username Search Form */}
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="GitHub username"
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-44 sm:w-52"
                />
              </div>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-3.5 py-2 rounded-xl text-sm transition-colors"
              >
                Inspect
              </button>
            </form>
          </div>

          {/* Sort By Controls */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2">
              Sort by:
            </span>
            <button
              onClick={() => setSortBy("streak")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortBy === "streak"
                  ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                  : "bg-slate-800/60 text-slate-400 hover:text-white"
              }`}
            >
              <Flame className="w-3.5 h-3.5" /> Streak
            </button>
            <button
              onClick={() => setSortBy("commits")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortBy === "commits"
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                  : "bg-slate-800/60 text-slate-400 hover:text-white"
              }`}
            >
              <GitCommit className="w-3.5 h-3.5" /> Commits
            </button>
            <button
              onClick={() => setSortBy("prs")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortBy === "prs"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                  : "bg-slate-800/60 text-slate-400 hover:text-white"
              }`}
            >
              <GitPullRequest className="w-3.5 h-3.5" /> PRs
            </button>
          </div>
        </div>

        {/* Content Table / State */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-sm text-slate-400">Loading followers rankings...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center space-y-2">
              <p className="text-sm font-medium text-rose-400">{error}</p>
              <p className="text-xs text-slate-500">
                Check the username and try again. Capped at top 20 followers to protect rate limits.
              </p>
            </div>
          ) : data && data.followers.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Users className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-semibold text-slate-300">No followers found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                @{activeUsername} does not have any public followers on GitHub yet.
              </p>
            </div>
          ) : data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th scope="col" className="px-6 py-3.5 w-16">
                      Rank
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Developer
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-right">
                      Streak
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-right">
                      Commits (Month)
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-right">
                      Merged PRs
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.followers.map((follower: FollowerRankedItem) => (
                    <tr
                      key={follower.login}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono font-bold">
                        <span
                          className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs ${
                            follower.rank === 1
                              ? "bg-amber-400/20 text-amber-400 border border-amber-400/30"
                              : follower.rank === 2
                              ? "bg-slate-300/20 text-slate-300 border border-slate-300/30"
                              : follower.rank === 3
                              ? "bg-amber-700/20 text-amber-600 border border-amber-700/30"
                              : "text-slate-500"
                          }`}
                        >
                          {follower.rank}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Image
                            src={follower.avatar_url}
                            alt={follower.login}
                            width={32}
                            height={32}
                            className="rounded-full bg-slate-800"
                            unoptimized
                          />
                          <Link
                            href={`/u/${follower.login}`}
                            className="font-medium text-slate-200 hover:text-indigo-400 transition-colors"
                          >
                            {follower.login}
                          </Link>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
                          <Flame className="w-3.5 h-3.5" />
                          {follower.currentStreak}d
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-300 font-mono">
                        {follower.commitsThisMonth}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-400 font-mono">
                        {follower.prsMerged}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
