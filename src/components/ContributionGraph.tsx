// @ts-nocheck
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAccount } from "@/components/AccountContext";
import CommitSearchPanel from "@/components/CommitSearchPanel";
import type { CommitItem } from "@/lib/github";
import { get, set } from "idb-keyval";
import WidgetSkeleton, { SkeletonBlock } from "./WidgetSkeleton";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,

  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DayData {
  day: string;
  commits: number;
}

interface GraphPoint {
  date: string;
  you: number;
  friend: number;
}

interface ContributionSources {
  github?: Record<string, number>;
  gitlab?: Record<string, number>;
}

interface ContributionResponse {
  data: Record<string, number>;
  commits?: CommitItem[];
  sources?: ContributionSources;
}

type ViewMode = "bar" | "line" | "area";

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const charts: { key: ViewMode; label: string }[] = [
  { key: "bar", label: "Bar" },
  { key: "line", label: "Line" },
  { key: "area", label: "Area" },
];

function normalizeCommitCount(count: unknown): number {
  const numericCount = Number(count ?? 0);

  if (!Number.isFinite(numericCount) || numericCount <= 0) {
    return 0;
  }

  return numericCount;
}

function normalizeContributionData(data: Record<string, number>): DayData[] {
  return Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, commits]) => ({
      day,
      commits: normalizeCommitCount(commits),
    }));
}

function getTotalCommits(data: DayData[]): number {
  return data.reduce((total, day) => total + normalizeCommitCount(day.commits), 0);
}

function mergeContributionData(
  myData: DayData[],
  friendData: DayData[]
): GraphPoint[] {
  const map = new Map<string, GraphPoint>();

  myData.forEach(d => {
    map.set(d.day, {
      date: d.day,
      you: normalizeCommitCount(d.commits),
      friend: 0,
    });
  });

  friendData.forEach(d => {
    if (!map.has(d.day)) {
      map.set(d.day, {
        date: d.day,
        you: 0,
        friend: normalizeCommitCount(d.commits),
      });
    } else {
      map.get(d.day)!.friend = normalizeCommitCount(d.commits);
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

function mergeContributionSources(
  sources: ContributionSources | undefined,
  fallback: Record<string, number>
): Record<string, number> {
  if (!sources) return fallback;

  const github = sources.github ?? fallback;
  const gitlab = sources.gitlab ?? {};
  const merged = { ...github };

  for (const [day, commits] of Object.entries(gitlab)) {
    merged[day] = normalizeCommitCount(merged[day]) + normalizeCommitCount(commits);
  }

  return merged;
}

export default function ContributionGraph() {
  const { selectedAccount } = useAccount();
  const [data, setData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("devtrack:contribution-range");
        if (stored === "7" || stored === "30" || stored === "90" || stored === "365") {
          return Number(stored);
        }
      } catch {}
    }
    return 30;
  });
  const [chartType, setChartType] = useState<ViewMode>("bar");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [usesTouchTooltip, setUsesTouchTooltip] = useState(false);
  const [repo, setRepo] = useState<string>("all");
  const [repoOptions, setRepoOptions] = useState<string[]>([]);

  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const [compareUser, setCompareUser] = useState<string | null>(null);
  const [friendData, setFriendData] = useState<DayData[]>([]);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareRequestId, setCompareRequestId] = useState(0);

  // Custom range state
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showPopover, setShowPopover] = useState(false);
  const [customLabel, setCustomLabel] = useState<string | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fetch my data
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("devtrack:contribution-range");
        if (stored === "7" || stored === "30" || stored === "90" || stored === "365") {
          setDays(Number(stored));
        } else {
          localStorage.setItem("devtrack:contribution-range", "30");
          setDays(30);
        }
      } catch (e) {
        setDays(30);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const media = window.matchMedia("(hover: none), (pointer: coarse)");
    const updateTooltipMode = () => setUsesTouchTooltip(media.matches);

    updateTooltipMode();
    media.addEventListener("change", updateTooltipMode);

    return () => media.removeEventListener("change", updateTooltipMode);
  }, []);

  const handleRangeChange = (newDays: number) => {
    setDays(newDays);
    setCustomLabel(null);
    setCustomFrom("");
    setCustomTo("");
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("devtrack:contribution-range", String(newDays));
      } catch (e) {}
    }
  };

  useEffect(() => {
    let active = true;

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const accountParam =
      selectedAccount !== null
        ? `&accountId=${encodeURIComponent(selectedAccount)}`
        : "";
    const repoParam = repo !== "all" ? `&repo=${repo}` : "";
    const timezoneParam = `&timezone=${encodeURIComponent(timezone)}`;
    const url =
      customLabel && customFrom && customTo
        ? `/api/metrics/contributions?from=${customFrom}&to=${customTo}${accountParam}${repoParam}${timezoneParam}`
        : `/api/metrics/contributions?days=${days}${accountParam}${repoParam}${timezoneParam}`;

    const cacheKey = `contrib-graph-${selectedAccount ?? "default"}-${repo}-${days}-${customFrom ?? "none"}-${customTo ?? "none"}`;
    const CACHE_TTL = 60 * 60 * 1000; // 1 hour

    async function processFetch() {
      // 1. Attempt to load from IndexedDB cache
      let cached: { data: DayData[]; commits: CommitItem[]; timestamp: number } | undefined;
      try {
        cached = await get(cacheKey);
      } catch (err) {
        console.warn("Failed to get cache from IndexedDB:", err);
      }

      if (cached && active) {
        // Hydrate from cache immediately (Local Hydration)
        setData(cached.data);
        setCommits(cached.commits);
        setLoading(false);
        setLastUpdated(new Date(cached.timestamp));
        setMinutesAgo(Math.floor((Date.now() - cached.timestamp) / 60000));
        setError(null);

        // Check if cache has expired (TTL Strategy)
        const isExpired = Date.now() - cached.timestamp > CACHE_TTL;
        if (!isExpired) {
          // If not expired, skip background fetch
          return;
        }
      } else if (active) {
        // No cache: show standard loading
        setLoading(true);
        setError(null);
        setCommits([]);
      }

      // 2. Perform background sync / standard fetch
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error("API error");
        const res: ContributionResponse = await r.json();
        
        if (!active) return;

        const merged = mergeContributionSources(
          res.sources,
          res.data ?? {}
        );
        const sorted = normalizeContributionData(merged);

        setData(sorted);
        setCommits(res.commits ?? []);
        setError(null);
        setLastUpdated(new Date());
        setMinutesAgo(0);

        // Update IndexedDB cache
        try {
          await set(cacheKey, {
            data: sorted,
            commits: res.commits ?? [],
            timestamp: Date.now(),
          });
        } catch (err) {
          console.warn("Failed to write cache to IndexedDB:", err);
        }
      } catch (err) {
        if (!active) return;
        // If we have cached data, suppress fetch error (Offline recovery)
        if (!cached) {
          setError("Failed to load contribution data.");
        }
      } finally {
        if (active && !cached) {
          setLoading(false);
        }
      }
    }

    processFetch();

    return () => {
      active = false;
    };
  }, [days, selectedAccount, customFrom, customTo, customLabel, repo]);

  // Fetch friend data when compare mode is on and compareUser changes
  useEffect(() => {
    fetch("/api/metrics/repos?days=90")
      .then((r) => r.json())
      .then((d: { repos: { name: string }[] }) =>
        setRepoOptions(d.repos.map((r) => r.name))
      )
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (!compareMode || !compareUser) {
      setFriendData([]);
      setCompareError(null);
      return;
    }

    setCompareLoading(true);
    setCompareError(null);

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/metrics/contributions?days=${days}&username=${encodeURIComponent(compareUser)}&timezone=${encodeURIComponent(timezone)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch friend data");
        return r.json();
      })
      .then((res: { data: Record<string, number> }) => {
        const sorted = normalizeContributionData(res.data ?? {});
        setFriendData(sorted);
      })
      .catch(() => {
        setCompareError("Failed to load friend data");
        setFriendData([]);
      })
      .finally(() => {
        setCompareLoading(false);
      });
  }, [compareMode, compareUser, days, compareRequestId]);

  useEffect(() => {
    const onCompareUser = (event: Event) => {
      const customEvent = event as CustomEvent<{ username?: string }>;
      const username = customEvent.detail?.username?.trim();
      if (!username) return;
      setCompareUser(username);
      setCompareMode(true);
      setCompareError(null);
      setCompareRequestId((prev) => prev + 1);
    };

    const onClearCompareUser = () => {
      setCompareMode(false);
      setCompareUser(null);
      setFriendData([]);
      setCompareError(null);
    };

    window.addEventListener("devtrack:compare-user", onCompareUser as EventListener);
    window.addEventListener("devtrack:clear-compare-user", onClearCompareUser);

    return () => {
      window.removeEventListener("devtrack:compare-user", onCompareUser as EventListener);
      window.removeEventListener("devtrack:clear-compare-user", onClearCompareUser);
    };
  }, []);

  useEffect(() => {
    const handleToggleChart = () => {
      setChartType((prev) => {
        if (prev === "bar") return "line";
        if (prev === "line") return "area";
        return "bar";
      });
    };
    window.addEventListener("toggleChart", handleToggleChart);
    return () => window.removeEventListener("toggleChart", handleToggleChart);
  }, []);

  useEffect(() => {
    if (!lastUpdated) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
      setMinutesAgo(diff);
    }, 60000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  useEffect(() => {
    if (!showPopover) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowPopover(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [showPopover]);

  const handleClearCompare = () => {
    window.dispatchEvent(new Event("devtrack:clear-compare-user"));
    setCompareMode(false);
    setCompareUser(null);
    setFriendData([]);
    setCompareError(null);
  };

  const handleCustomApply = () => {
    setCustomError(null);
    const today = new Date().toISOString().slice(0, 10);

    if (!customFrom || !customTo) {
      setCustomError("Please select both dates.");
      return;
    }
    if (customFrom > customTo) {
      setCustomError("Start date must be before end date.");
      return;
    }
    if (customTo > today) {
      setCustomError("End date can't be in the future.");
      return;
    }
    const msPerDay = 1000 * 60 * 60 * 24;
    const diff =
      (new Date(customTo).getTime() - new Date(customFrom).getTime()) / msPerDay;
    if (diff > 365 * 2) {
      setCustomError("Max range is 2 years.");
      return;
    }

    const fmt = (d: string) => {
      const [year, month, day] = d.split("-").map(Number);
      return new Date(year, month - 1, day).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    };
    setCustomLabel(`${fmt(customFrom)} – ${fmt(customTo)}`);
    setShowPopover(false);
  };

  const mergedData =
    compareMode && data.length > 0
      ? mergeContributionData(data, friendData)
      : [];

  const displayData = compareMode ? mergedData : data;
  const hasFriendData = compareMode && friendData.length > 0 && !compareError;
  const tooltipTrigger = usesTouchTooltip ? "click" : "hover";
  const totalCommits = compareMode
    ? getTotalCommits(data)
    : getTotalCommits(displayData as DayData[]);

  if (loading) {
    return (
      <WidgetSkeleton title="Your Commits" className="transition-all duration-300 fade-in-up">
        <div className="flex justify-between items-center mb-4">
          <SkeletonBlock className="h-6 w-32" />
          <SkeletonBlock className="h-8 w-64" />
        </div>
        <SkeletonBlock className="h-[220px] w-full" />
      </WidgetSkeleton>
    );
  }

  return (
    <div
      id="contribution-activity"
      className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 fade-in-up"
    >
      <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h2 className="text-sm md:text-base lg:text-lg font-semibold text-[var(--foreground)]">
            {compareMode && compareUser ? `You vs ${compareUser}` : "Your Commits"}
          </h2>
          {compareMode && compareError && (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">{compareError}</p>
          )}
          {compareMode && compareLoading && (
            <p className="text-xs text-[var(--muted-foreground)] mt-1">Loading friend data...</p>
          )}
          {!compareMode && !loading && !error && (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {totalCommits} commit{totalCommits === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Repo Filter */}
          <select
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            className="bg-slate-700 text-slate-300 text-sm rounded-lg px-2 py-1 border border-slate-600"
          >
            <option value="all">All repos</option>
            {repoOptions.map((r) => (
              <option key={r} value={r}>
                {r.split("/")[1]}
              </option>
            ))}
          </select>

          {/* Range buttons */}
          <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--background)] p-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => handleRangeChange(r.days)}
                aria-label={`Show ${r.days}-day range`}
                aria-pressed={days === r.days && !customLabel}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${days === r.days && !customLabel
                  ? "bg-[var(--accent)] text-[var(--background)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Custom date range */}
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setShowPopover((v) => !v)}
              aria-label={customLabel ? `Custom date range: ${customLabel}` : "Select custom date range"}
              aria-expanded={showPopover}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors border border-[var(--border)] ${customLabel
                ? "bg-[var(--accent)] text-[var(--background)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
            >
              {customLabel ?? "Custom…"}
            </button>

            {showPopover && (
              <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg">
                <p className="text-sm font-medium text-[var(--foreground)] mb-3">
                  Custom range
                </p>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-[var(--muted-foreground)]">
                    Start date
                    <input
                      type="date"
                      value={customFrom}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => {
                        setCustomFrom(e.target.value);
                        if (!customTo) {
                          setCustomTo(new Date().toISOString().slice(0, 10));
                        }
                      }}
                      className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
                    />
                  </label>
                  <label className="text-xs text-[var(--muted-foreground)]">
                    End date
                    <input
                      type="date"
                      value={customTo}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
                    />
                  </label>
                  {customError && (
                    <p className="text-xs text-[var(--destructive)]">{customError}</p>
                  )}
                  {customLabel && (
                    <button
                      onClick={() => {
                        setCustomLabel(null);
                        setCustomFrom("");
                        setCustomTo("");
                        setCustomError(null);
                        setShowPopover(false);
                      }}
                      className="w-full rounded-md border border-[var(--border)] py-1.5 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={handleCustomApply}
                    className="mt-1 w-full rounded-md bg-[var(--accent)] py-1.5 text-sm font-medium text-[var(--background)] hover:opacity-90 transition-opacity active:scale-95"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Chart Toggle Buttons */}
          {displayData.length > 0 && !error && (
            <div
              role="group"
              aria-label="Chart type"
              className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--background)] p-1 text-sm"
            >
              {charts.map((chart) => (
                <button
                  key={chart.key}
                  type="button"
                  onClick={() => setChartType(chart.key)}
                  aria-pressed={chartType === chart.key}
                  className={`relative px-3 py-1 rounded-md transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    chartType === chart.key
                      ? "bg-[var(--accent)] text-[var(--background)] font-semibold"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {chart.label}
                  {chartType === chart.key && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[3px] h-0.5 w-4 rounded-full bg-[var(--background)]"
                    />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Clear compare button */}
          {compareMode && (
            <button
              onClick={handleClearCompare}
              aria-label="Clear comparison mode"
              className="px-3 py-1 rounded-md text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors border border-[var(--border)]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="flex h-[220px] items-center rounded-lg border border-[var(--border)] bg-[var(--background)] px-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            {error} Please try refreshing.
          </p>
        </div>
      ) : displayData.length === 0 ? (
        <p className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--background)] px-4 text-sm text-[var(--muted-foreground)]">
          No commits in the last {days} days.
        </p>
      ) : (
        <div className="h-[220px] w-full overflow-hidden">
<ResponsiveContainer width="100%" height="100%">
  {chartType === "bar" ? (
    <BarChart data={displayData}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
      <XAxis
        dataKey={compareMode ? "date" : "day"}
        hide
      />
      <YAxis stroke="var(--muted-foreground)" allowDecimals={false} />
      <Tooltip
        trigger={tooltipTrigger}
        contentStyle={{
          background: "var(--card)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
        }}
        labelStyle={{
          color: "var(--foreground)",
          fontSize: "12px",
        }}
        cursor={false}
      />
      {hasFriendData && (
        <Legend
          wrapperStyle={{ color: "var(--muted-foreground)", fontSize: "12px" }}
          className="hidden sm:block"
        />
      )}

      {compareMode && hasFriendData ? (
        <>
          <Bar
            dataKey="you"
            fill="var(--accent)"
            radius={[4, 4, 0, 0]}
            name="You"
          />
          <Bar
            dataKey="friend"
            fill="var(--muted-foreground)"
            radius={[4, 4, 0, 0]}
            name={`${compareUser}`}
          />
        </>
      )   : (
                  <Bar
                    dataKey="commits"
                    fill="var(--accent)"
                    radius={[4, 4, 0, 0]}
                  />
                )}
              </BarChart>
            ) : chartType === "line" ? (
              <LineChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey={compareMode ? "date" : "day"}
                  hide
                />
<YAxis stroke="var(--muted-foreground)" allowDecimals={false} />
<Tooltip
  trigger={tooltipTrigger}
  contentStyle={{
    background: "var(--card)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
  }}
  labelStyle={{
    color: "var(--foreground)",
    fontSize: "12px",
  }}
  cursor={false}
/>

{hasFriendData && (
  <Legend
    wrapperStyle={{ color: "var(--muted-foreground)", fontSize: "12px" }}
    className="hidden sm:block"
  />
)}

{compareMode && hasFriendData ? (
  <>
    <Line
      type="monotone"
      dataKey="you"
      stroke="var(--accent)"
      strokeWidth={2}
      dot={false}
      name="You"
    />
    <Line
      type="monotone"
      dataKey="friend"
      stroke="var(--muted-foreground)"
      strokeWidth={2}
      strokeDasharray="4 4"
      dot={false}
      name={`${compareUser}`}
    />
  </>
) : (                  <Line
                    type="monotone"
                    dataKey="commits"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
              </LineChart>
            ) : (
              <AreaChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey={compareMode ? "date" : "day"}
                  hide
                />
<YAxis stroke="var(--muted-foreground)" allowDecimals={false} />
<Tooltip
  contentStyle={{
    background: "var(--card)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
  }}
  labelStyle={{
    color: "var(--foreground)",
    fontSize: "12px",
  }}
  cursor={false}
/>

{hasFriendData && (
  <Legend
    wrapperStyle={{ color: "var(--muted-foreground)", fontSize: "12px" }}
    className="hidden sm:block"
  />
)}

{compareMode && hasFriendData ? (
  <>
    <Area
      type="monotone"
      dataKey="you"
      stroke="var(--accent)"
      fill="var(--accent)"
      fillOpacity={0.3}
      name="You"
    />
    <Area
      type="monotone"
      dataKey="friend"
      stroke="var(--muted-foreground)"
      fill="var(--muted-foreground)"
      fillOpacity={0.3}
      name={`${compareUser}`}
    />
  </>
) : (                  <Area
                    type="monotone"
                    dataKey="commits"
                    stroke="var(--accent)"
                    fill="var(--accent)"
                    fillOpacity={0.3}
                  />
                )}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {lastUpdated && !compareMode && (
        <p className="mt-2 text-right text-xs text-[var(--muted-foreground)]">
          {minutesAgo === 0
            ? "Updated just now"
            : `Updated ${minutesAgo} min ago`}
        </p>
      )}

      {compareMode && compareUser && !compareLoading && !compareError && (
        <p className="mt-2 text-right text-xs text-[var(--muted-foreground)]">
          Comparing with {compareUser}
        </p>
      )}

      {!compareMode && (
        <CommitSearchPanel commits={commits} loading={loading} />
      )}
    </div>
  );
}
