"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAccount } from "@/components/AccountContext";
import { Trophy, Zap, Flame, Calendar, Star } from "lucide-react";
import WidgetSkeleton, { SkeletonBlock } from "./WidgetSkeleton";

interface StreakData {
  current: number;
  longest: number;
  lastCommitDate: string | null;
  totalActiveDays: number;
}
interface ContributionData {
  days: number;
  total: number;
  data: Record<string, number>;
}
interface Repo {
  name: string;
  commits: number;
  url: string;
}
function getBestDay(data: Record<string, number>): { count: number; dateLabel: string | null } {
  let maxCount = 0;
  let bestDateStr: string | null = null;
  for (const [dateStr, count] of Object.entries(data)) {
    if (count > maxCount) {
      maxCount = count;
      bestDateStr = dateStr;
    }
  }
  let dateLabel: string | null = null;
  if (bestDateStr) {
    const parts = bestDateStr.split("-").map(Number);
    if (parts.length === 3) {
      const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      dateLabel = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
    } else {
      dateLabel = bestDateStr;
    }
  }
  return { count: maxCount, dateLabel };
}
function getBestWeek(data: Record<string, number>): { count: number; weekLabel: string | null } {
  const weeks: Record<string, number> = {};
  for (const [dateStr, count] of Object.entries(data)) {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3) {
      const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      const day = d.getUTCDay(); // 0 is Sunday, 1 is Monday
      const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday week start
      const weekStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
      const weekStr = weekStart.toISOString().slice(0, 10);
      weeks[weekStr] = (weeks[weekStr] ?? 0) + count;
    }
  }
  let maxCount = 0;
  let bestWeekStr: string | null = null;
  for (const [weekStr, count] of Object.entries(weeks)) {
    if (count > maxCount) {
      maxCount = count;
      bestWeekStr = weekStr;
    }
  }
  let weekLabel: string | null = null;
  if (bestWeekStr) {
    const parts = bestWeekStr.split("-").map(Number);
    if (parts.length === 3) {
      const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      weekLabel = `Week of ${d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })}`;
    } else {
      weekLabel = bestWeekStr;
    }
  }
  return { count: maxCount, weekLabel };
}
function getBestMonth(data: Record<string, number>): { count: number; monthLabel: string | null } {
  const months: Record<string, number> = {};
  for (const [dateStr, count] of Object.entries(data)) {
    const monthKey = dateStr.slice(0, 7); // YYYY-MM
    months[monthKey] = (months[monthKey] ?? 0) + count;
  }
  let maxCount = 0;
  let bestMonthKey: string | null = null;
  for (const [mKey, count] of Object.entries(months)) {
    if (count > maxCount) {
      maxCount = count;
      bestMonthKey = mKey;
    }
  }
  let monthLabel: string | null = null;
  if (bestMonthKey) {
    const parts = bestMonthKey.split("-").map(Number);
    if (parts.length === 2) {
      const d = new Date(Date.UTC(parts[0], parts[1] - 1, 1));
      monthLabel = d.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    } else {
      monthLabel = bestMonthKey;
    }
  }
  return { count: maxCount, monthLabel };
}
function getBusiestRepo(repos: Repo[]): { count: number; repoLabel: string | null; repoUrl: string | null } {
  if (!repos || repos.length === 0) {
    return { count: 0, repoLabel: null, repoUrl: null };
  }
  const best = repos[0];
  if (!best) {
    return { count: 0, repoLabel: null, repoUrl: null };
  }
  const shortName = best.name.split("/")[1] ?? best.name;
  return { count: best.commits, repoLabel: shortName, repoUrl: best.url ?? null };
}
export default function PersonalRecords() {
  const { selectedAccount } = useAccount();
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [contributions, setContributions] = useState<ContributionData | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const paramStreak =
        selectedAccount !== null
          ? `?accountId=${encodeURIComponent(selectedAccount)}`
          : "";
      const paramContrib =
        selectedAccount !== null
          ? `&accountId=${encodeURIComponent(selectedAccount)}`
          : "";
      const [streakRes, contribRes, reposRes] = await Promise.all([
        fetch(`/api/metrics/streak${paramStreak}`),
        fetch(`/api/metrics/contributions?days=365${paramContrib}`),
        fetch(`/api/metrics/repos?days=365${paramContrib}`),
      ]);
      if (!streakRes.ok || !contribRes.ok || !reposRes.ok) {
        throw new Error("Failed to fetch personal records data");
      }
      const streakData = (await streakRes.json()) as StreakData;
      const contribData = (await contribRes.json()) as ContributionData;
      const reposData = (await reposRes.json()) as { repos: Repo[] };
      setStreak(streakData);
      setContributions(contribData);
      setRepos(reposData.repos ?? []);
    } catch (e) {
      setError("We couldn't load your personal records right now. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [selectedAccount]);
  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    if (loading || error || !streak || !contributions) return;

    const currentRecords = {
      longest_streak: streak.longest ?? 0,
      best_day: getBestDay(contributions.data ?? {}).count,
      best_week: getBestWeek(contributions.data ?? {}).count,
      best_month: getBestMonth(contributions.data ?? {}).count,
      busiest_repo: getBusiestRepo(repos).count,
    };

    let triggerConfetti = false;
    const storagePrefix = `devtrack_records_${selectedAccount ?? "default"}_`;

    for (const [key, currentValue] of Object.entries(currentRecords)) {
      const storageKey = `${storagePrefix}${key}`;
      const prevValueStr = sessionStorage.getItem(storageKey);

      if (prevValueStr === null) {
        sessionStorage.setItem(storageKey, String(currentValue));
      } else {
        const prevValue = Number(prevValueStr);
        if (currentValue > prevValue) {
          triggerConfetti = true;
          sessionStorage.setItem(storageKey, String(currentValue));
        } else if (currentValue < prevValue) {
          sessionStorage.setItem(storageKey, String(currentValue));
        }
      }
    }

    if (triggerConfetti) {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!prefersReducedMotion) {
        import("canvas-confetti").then((module) => {
          const confetti = module.default;
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        });
      }
    }
  }, [loading, error, streak, contributions, repos, selectedAccount]);
  const bestDay = getBestDay(contributions?.data ?? {});
  const bestWeek = getBestWeek(contributions?.data ?? {});
  const bestMonth = getBestMonth(contributions?.data ?? {});
  const busiestRepo = getBusiestRepo(repos);
  const records = [
    {
      label: "Longest Streak",
      value: streak?.longest ?? 0,
      unit: "days",
      subtext: "All time",
      icon: Trophy,
      isRepo: false,
      repoUrl: null,
    },
    {
      label: "Best Day",
      value: bestDay.count,
      unit: "commits",
      subtext: bestDay.dateLabel ?? "—",
      icon: Zap,
      isRepo: false,
      repoUrl: null,
    },
    {
      label: "Best Week",
      value: bestWeek.count,
      unit: "commits",
      subtext: bestWeek.weekLabel ?? "—",
      icon: Flame,
      isRepo: false,
      repoUrl: null,
    },
    {
      label: "Most Active Month",
      value: bestMonth.count,
      unit: "commits",
      subtext: bestMonth.monthLabel ?? "—",
      icon: Calendar,
      isRepo: false,
      repoUrl: null,
    },
    {
      label: "Busiest Repo",
      value: busiestRepo.count,
      unit: "commits",
      subtext: busiestRepo.repoLabel ?? "—",
      icon: Star,
      isRepo: true,
      repoUrl: busiestRepo.repoUrl ?? null,
    },
  ];
  if (loading) {
    return (
      <WidgetSkeleton title="Personal Records" className="transition-all duration-300">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-stretch">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonBlock key={i} className="h-32 p-4" />
          ))}
        </div>
      </WidgetSkeleton>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">
        Personal Records
      </h2>
      {error ? (
        <div className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)]">
          <p>{error}</p>
          <button
            type="button"
            onClick={fetchRecords}
            className="mt-3 rounded-md border border-[var(--destructive)]/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-stretch stagger-children">
          {records.map((rec) => (
            <div
              key={rec.label}
              className="h-full rounded-lg bg-[var(--control)] p-4 text-center flex flex-col justify-between border border-transparent stat-cell animate-fade-in-up hover:border-[var(--accent)]/30"
            >
              <div>
                <div className="text-xl mb-2 flex justify-center">
                  <rec.icon size={28} className="text-[var(--accent)]" aria-hidden="true" />
                </div>
                <div className="text-3xl font-extrabold text-[var(--accent)] tracking-tight mb-1">
                  {rec.value}
                  <span className="ml-1 text-xs font-normal text-[var(--muted-foreground)] tracking-normal">
                    {rec.unit}
                  </span>
                </div>
                <div className="text-xs font-medium text-[var(--card-foreground)] opacity-90">
                  {rec.label}
                </div>
              </div>
              <div
                className={`mt-3 pt-2.5 border-t border-[var(--border)] text-xs truncate w-full block ${rec.isRepo
                    ? "font-medium text-[var(--card-foreground)]"
                    : "text-[var(--muted-foreground)]"
                  }`}
                title={rec.subtext}
              >
                {rec.isRepo && rec.repoUrl ? (
                  <a
                    href={rec.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-[var(--accent)] transition-colors"
                    title="Open in GitHub"
                    aria-label={`Open ${rec.subtext} on GitHub`}
                  >
                    {rec.subtext}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                ) : (
                  rec.subtext
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
