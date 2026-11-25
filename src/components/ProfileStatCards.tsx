"use client";

import React, { useEffect, useState } from "react";
import { Calendar, BookOpen, Star, GitFork, Users } from "lucide-react";

export interface ProfileStats {
  memberSince: string;
  publicRepos: number;
  totalStars: number;
  totalForks: number;
  followers: number;
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return num.toLocaleString();
}

export function formatMemberSince(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function ProfileStatCards({ initialStats }: { initialStats?: ProfileStats }) {
  const [stats, setStats] = useState<ProfileStats | null>(initialStats ?? null);
  const [loading, setLoading] = useState(!initialStats);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialStats) return;
    let cancelled = false;

    async function fetchStats() {
      try {
        setLoading(true);
        const res = await fetch("/api/metrics/profile-stats");
        if (!res.ok) throw new Error("Failed to load profile stats");
        const data = await res.json();
        if (!cancelled) {
          setStats(data);
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [initialStats]);

  const items = [
    {
      label: "Member Since",
      value: stats ? formatMemberSince(stats.memberSince) : "—",
      icon: Calendar,
      color: "#60a5fa",
    },
    {
      label: "Public Repos",
      value: stats ? formatNumber(stats.publicRepos) : "—",
      icon: BookOpen,
      color: "#34d399",
    },
    {
      label: "Total Stars",
      value: stats ? formatNumber(stats.totalStars) : "—",
      icon: Star,
      color: "#fbbf24",
    },
    {
      label: "Total Forks",
      value: stats ? formatNumber(stats.totalForks) : "—",
      icon: GitFork,
      color: "#a78bfa",
    },
    {
      label: "Followers",
      value: stats ? formatNumber(stats.followers) : "—",
      icon: Users,
      color: "#f472b6",
    },
  ];

  if (error && !stats) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Profile summary statistics"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 mb-4"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="flex flex-col justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm transition-colors hover:border-[var(--accent)]"
          >
            <div className="flex items-center justify-between gap-1 text-[var(--muted-foreground)]">
              <span className="truncate text-xs font-medium">{item.label}</span>
              <Icon
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: item.color }}
                aria-hidden="true"
              />
            </div>
            <div className="mt-2">
              {loading ? (
                <div
                  data-testid="stat-skeleton"
                  className="h-6 w-16 animate-pulse rounded bg-[var(--card-muted)]"
                />
              ) : (
                <span className="text-lg font-bold text-[var(--card-foreground)]">
                  {item.value}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
