"use client";
import SectionHeader from "./SectionHeader";
import { useCallback, useEffect, useState, useRef } from "react";
import { useAccount } from "@/components/AccountContext";
import { useDashboardWidgetA11y } from "@/components/dashboard/DashboardWidgetA11yContext";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useCountUp } from "@/hooks/useCountUp";
import StreakMilestoneBanner from "@/components/StreakMilestoneBanner";
import { useHeatmapTheme } from "@/hooks/useHeatmapTheme";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { Flame, Trophy, Calendar, Zap, Copy, CheckCircle, Medal, Star, Sparkles } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

const DATA_WINDOW_DAYS = 90;
const dataWindowLabel = `Last ${DATA_WINDOW_DAYS} days`;


const STREAK_MILESTONES = [7, 30, 50, 100, 200, 365];

interface StreakData {
  current: number;
  longest: number;
  lastCommitDate: string | null;
  totalActiveDays: number;
  freezeDates: string[];
}

interface ContributionData {
  days: number;
  total: number;
  data: Record<string, number>;
}

interface FreezeData {
  hasFreeze: boolean;
  freezeDate?: string | null;
}

export function useStreakTracker() {
  const { selectedAccount } = useAccount();
  const [data, setData] = useState<StreakData | null>(null);
  const [contributionData, setContributionData] = useState<ContributionData | null>(null);
  const [freezeDates, setFreezeDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedMilestones, setDismissedMilestones] = useState<number[]>([]);
  const [lastCelebratedMilestone, setLastCelebratedMilestone] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [freeze, setFreeze] = useState<FreezeData | null>(null);
  const [freezeLoading, setFreezeLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showFreezeConfirm, setShowFreezeConfirm] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const animatedCurrent = useCountUp(data?.current ?? 0);
  const animatedLongest = useCountUp(data?.longest ?? 0);
  const animatedActiveDays = useCountUp(data?.totalActiveDays ?? 0);

  const handleDownload = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      setIsDownloading(true);
      const dataUrl = await toPng(containerRef.current, {
        cacheBust: true,
        style: { margin: "0" },
      });
      const link = document.createElement("a");
      link.download = "devtrack-streak.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to generate image", err);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  const fetchStreak = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const streakUrl =
        selectedAccount !== null
          ? `/api/metrics/streak?accountId=${encodeURIComponent(selectedAccount)}`
          : "/api/metrics/streak";
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const contributionUrl =
        selectedAccount !== null
          ? `/api/metrics/contributions?days=365&accountId=${encodeURIComponent(selectedAccount)}&timezone=${encodeURIComponent(timezone)}`
          : `/api/metrics/contributions?days=365&timezone=${encodeURIComponent(timezone)}`;
      const [streakRes, contributionRes] = await Promise.all([
        fetch(streakUrl),
        fetch(contributionUrl),
      ]);

      if (!streakRes.ok || !contributionRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const streakData = (await streakRes.json()) as StreakData;
      const contribData = (await contributionRes.json()) as ContributionData;

      setData(streakData);
      setContributionData(contribData);
      setFreezeDates(streakData.freezeDates || []);
    } catch (err) {
      console.error("Failed to fetch streak data:", err);
      setError("We couldn't load your streak data right now. Please try again in a moment.");
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
      setMinutesAgo(0);
    }
  }, [selectedAccount]);

  const fetchFreeze = useCallback(() => {
    setFreezeLoading(true);
    fetch("/api/streak/freeze")
      .then((r) => r.json())
      .then((d: FreezeData) => setFreeze(d))
      .catch((err) => {
        console.error("Failed to fetch freeze data:", err);
        setFreeze(null);
      })
      .finally(() => setFreezeLoading(false));
  }, []);

  useEffect(() => {
    fetchStreak();
    fetchFreeze();
  }, [fetchStreak, fetchFreeze]);

  useEffect(() => {
    const handleSync = () => {
      fetchStreak();
    };
    window.addEventListener("devtrack:sync", handleSync);
    return () => window.removeEventListener("devtrack:sync", handleSync);
  }, [fetchStreak]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage) return;
    const stored = window.localStorage.getItem(
      "devtrack:dismissed-milestones"
    );

    const storedLastCelebrated = window.localStorage.getItem(
      "devtrack:last-celebrated-milestone"
    );

    if (stored) {
      try {
        setDismissedMilestones(JSON.parse(stored));
      } catch (e) {
        // ignore invalid localStorage data
      }
    }

    if (storedLastCelebrated) {
      setLastCelebratedMilestone(
        Number(storedLastCelebrated)
      );
    }
  }, []);

  useEffect(() => {
    if (!lastUpdated) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
      setMinutesAgo(diff);
    }, 60000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  async function handleApplyFreeze() {
    setFreezeLoading(true);
    try {
      const res = await fetch("/api/streak/freeze", { method: "POST" });
      if (!res.ok) throw new Error("Failed to apply freeze");

      const streakUrl =
        selectedAccount !== null
          ? `/api/metrics/streak?accountId=${encodeURIComponent(selectedAccount)}`
          : "/api/metrics/streak";
      const [streakRes, freezeRes] = await Promise.all([
        fetch(streakUrl),
        fetch("/api/streak/freeze"),
      ]);
      const [streakData, freezeData] = await Promise.all([
        streakRes.json() as Promise<StreakData>,
        freezeRes.json() as Promise<FreezeData>,
      ]);
      setData(streakData);
      setFreeze(freezeData);
      toast.success("Streak freeze activated for today!");
    } catch (err) {
      console.error("Failed to apply streak freeze:", err);
      toast.error("Failed to activate streak freeze.");
      fetchFreeze();
    } finally {
      setFreezeLoading(false);
    }
  }

  async function handleCancelFreeze() {
    if (!confirmCancel) {
      setConfirmCancel(true);
      return;
    }

    setCancelling(true);
    try {
      const res = await fetch("/api/streak/freeze", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to cancel freeze");

      setConfirmCancel(false);

      const streakUrl =
        selectedAccount !== null
          ? `/api/metrics/streak?accountId=${encodeURIComponent(selectedAccount)}`
          : "/api/metrics/streak";
      const [streakRes, freezeRes] = await Promise.all([
        fetch(streakUrl),
        fetch("/api/streak/freeze"),
      ]);
      const [streakData, freezeData] = await Promise.all([
        streakRes.json() as Promise<StreakData>,
        freezeRes.json() as Promise<FreezeData>,
      ]);
      setData(streakData);
      setFreeze(freezeData);
    } catch (err) {
      console.error("Failed to cancel streak freeze:", err);
      toast.error("Failed to cancel streak freeze.");
      fetchFreeze();
    } finally {
      setCancelling(false);
    }
  }

  const currentMilestone =
    [...STREAK_MILESTONES]
      .reverse()
      .find(
        (m) =>
          data?.current &&
          data.current >= m &&
          m > lastCelebratedMilestone
      );
  const shouldShowBanner =
    currentMilestone &&
    !dismissedMilestones.includes(currentMilestone);

  const handleDismissBanner = () => {
    if (!currentMilestone) return;

    const updated = [
      ...dismissedMilestones,
      currentMilestone,
    ];

    setDismissedMilestones(updated);

    setLastCelebratedMilestone(currentMilestone);

    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(
        "devtrack:last-celebrated-milestone",
        String(currentMilestone)
      );

      window.localStorage.setItem(
        "devtrack:dismissed-milestones",
        JSON.stringify(updated)
      );
    }
  };

  const handleCopy = async () => {
    if (!data) return;

    const textToCopy = [
      "🔥 DevTrack Stats",
      `Current streak: ${data.current} days`,
      `Longest streak: ${data.longest} days`,
      `Active days: ${data.totalActiveDays}`,
    ].join("\n");

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("Clipboard is not supported in this browser.");
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);

      setCopied(true);

      toast.success("Streak stats copied to clipboard!");

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy streak stats:", err);
      toast.error("Failed to copy streak stats.");
    }
  };

  // -------------------------------------------------------------------------
  // Realtime: re-fetch when streak_freezes rows change in Supabase.
  // Falls back to 60-second polling if the WebSocket cannot connect.
  // NOTE: enable Realtime for the `streak_freezes` table in the Supabase
  // dashboard and ensure the anon role has a SELECT policy (or use a
  // user-scoped filter once a Supabase JWT is available in the session).
  // -------------------------------------------------------------------------
  const handleRealtimeFreeze = useCallback(() => {
    fetchFreeze();
    fetchStreak();
  }, [fetchFreeze, fetchStreak]);

  const { isLive: isStreakLive } = useRealtimeSync(
    "streak_freezes",
    ["INSERT", "DELETE"],
    handleRealtimeFreeze,
  );

  return {
    selectedAccount,
    isStreakLive,
    data,
    setData,
    contributionData,
    setContributionData,
    freezeDates,
    setFreezeDates,
    loading,
    setLoading,
    dismissedMilestones,
    setDismissedMilestones,
    lastCelebratedMilestone,
    setLastCelebratedMilestone,
    lastUpdated,
    minutesAgo,
    copied,
    setCopied,
    error,
    setError,
    calendarMonth,
    setCalendarMonth,
    freeze,
    setFreeze,
    freezeLoading,
    setFreezeLoading,
    cancelling,
    setCancelling,
    confirmCancel,
    setConfirmCancel,
    showFreezeConfirm,
    setShowFreezeConfirm,
    isDownloading,
    setIsDownloading,
    containerRef,
    animatedCurrent,
    animatedLongest,
    animatedActiveDays,
    handleDownload,
    fetchStreak,
    fetchFreeze,
    handleApplyFreeze,
    handleCancelFreeze,
    currentMilestone,
    shouldShowBanner,
    handleDismissBanner,
    handleCopy,
  };
}

export default function StreakTracker() {
  const {
    selectedAccount,
    isStreakLive,
    data,
    setData,
    contributionData,
    setContributionData,
    freezeDates,
    setFreezeDates,
    loading,
    dismissedMilestones,
    lastCelebratedMilestone,
    lastUpdated,
    minutesAgo,
    copied,
    setCopied,
    error,
    setError,
    calendarMonth,
    setCalendarMonth,
    freeze,
    setFreeze,
    freezeLoading,
    setFreezeLoading,
    cancelling,
    confirmCancel,
    showFreezeConfirm,
    setShowFreezeConfirm,
    setConfirmCancel,
    isDownloading,
    containerRef,
    animatedCurrent,
    animatedLongest,
    animatedActiveDays,
    handleDownload,
    fetchStreak,
    handleApplyFreeze,
    handleCancelFreeze,
    currentMilestone,
    shouldShowBanner,
    handleDismissBanner,
    handleCopy,
  } = useStreakTracker();

  const { setSummary, setIsUpdating } = useDashboardWidgetA11y("streak-tracker");

  useEffect(() => {
    setIsUpdating(loading);
  }, [loading, setIsUpdating]);

  useEffect(() => {
    if (!data) {
      setSummary(null);
      return;
    }
    setSummary(
      `Current streak: ${data.current} days. Longest streak: ${data.longest} days.`,
    );
  }, [data, setSummary]);

  if (loading) {
    return (
      <div className="bg-[var(--card)] rounded-xl p-6 min-h-[700px]">
        <div role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Loading streak tracker</span>
          <div
            aria-hidden="true"
            className="h-6 w-36 bg-[var(--card-muted)] rounded animate-pulse mb-4"
          />
          <div aria-hidden="true" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-[var(--card-muted)] rounded-lg h-28 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <SectionHeader title="Commit Streaks" />
        <div className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)]">
          <p>{error}</p>
          <button
            type="button"
            onClick={fetchStreak}
            className="mt-3 rounded-md border border-[var(--destructive)]/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (
    !contributionData ||
    !contributionData.data ||
    Object.keys(contributionData.data).length === 0
  ) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm min-h-[420px]">
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="mb-4 text-4xl">📉</div>

          <SectionHeader title="No contribution data found" />



          <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">
            Start committing to build your streak and track your coding activity.
          </p>

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90"
          >
            Open GitHub
          </a>
        </div>
      </div>
    );
  }
  const MILESTONES = [
    { days: 30, label: "30-day streak!", icon: Medal },
    { days: 14, label: "2-week streak!", icon: Star },
    { days: 7, label: "7-day streak!", icon: Flame },
    { days: 3, label: "3-day streak!", icon: Sparkles },
  ];

  const badge = MILESTONES.find((m) => (data?.current ?? 0) >= m.days);
  const activeDayData = calculateActiveDayInsights(contributionData?.data);
  const monthlyTrend = calculateMonthlyTrend(contributionData);

  const stats = data
    ? [
      {
        label: "Current Streak",
        value: animatedCurrent,
        unit: "days",
        highlight: data.current > 0,
        icon: Flame,
        tooltip: "Current consecutive coding days",
      },
      {
        label: "Longest Streak",
        value: animatedLongest,
        unit: "days",
        highlight: false,
        icon: Trophy,
        tooltip: "Your longest streak ever",
      },
      {
        label: `Active Days (${DATA_WINDOW_DAYS}d)`,
        value: animatedActiveDays,
        unit: "days",
        highlight: false,
        icon: Calendar,
        tooltip: `Days you made commits in the ${dataWindowLabel.toLowerCase()}`,
      },
      {
        label: "Last Commit",
        value: data.lastCommitDate
          ? new Date(data.lastCommitDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
          : "—",
        unit: "",
        highlight: false,
        icon: Zap,
        tooltip: "Your most recent commit",
      },
    ]
    : [];





  return (
    <>
      {shouldShowBanner && currentMilestone && (
        <StreakMilestoneBanner
          streak={currentMilestone}
          onDismiss={handleDismissBanner}
        />
      )}
      <div className="relative">
        {data && (
          <div className="absolute top-6 right-6 flex items-center gap-2 z-10">
            <button
              type="button"
              onClick={handleCopy}
              className="cursor-pointer flex h-8 items-center justify-center rounded-md px-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--control)] hover:text-[var(--card-foreground)] transition-colors"
              aria-label="Copy streak stats to clipboard"
            >
              {copied ? (
                <span className="text-xs font-medium text-[var(--success)]">Copied!</span>
              ) : (
                <Copy size={16} className="opacity-80 hover:opacity-100" />
              )}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="cursor-pointer flex h-8 items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-70 transition-colors gap-1.5 shadow-sm"
              aria-label="Download streak stats as image"
            >
              {isDownloading ? (
                <span className="w-4 h-4 rounded-full border-2 border-[var(--accent-foreground)]/30 border-t-[var(--accent-foreground)] animate-spin" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              )}
              <span>SHARE</span>
            </button>
          </div>
        )}
        <div ref={containerRef} data-testid="streak-widget" className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SectionHeader title="Commit Streaks" />
              {isStreakLive && (
                <span
                  title="Live — updates automatically"
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-500"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  Live
                </span>
              )}
            </div>
            {data && <div className="h-8 w-24" />}
          </div>
          <div className="grid grid-cols-2 gap-2 xs:gap-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className={`rounded-lg p-3 text-center ${stat.highlight
                  ? "border border-[var(--accent)]/40 bg-[var(--accent-soft)]"
                  : "bg-[var(--control)]"
                  }`}
                aria-label={stat.tooltip}
              >
                <div className="flex justify-center mb-1">
                  <stat.icon size={20} className="text-[var(--accent)]" aria-hidden="true" />
                </div>
                <div
                  className={`text-lg font-bold leading-tight tabular-nums ${stat.highlight ? "text-[var(--accent)]" : "text-[var(--accent)]"
                    }`}
                >
                  {stat.value}
                  {stat.unit && (
                    <span className="ml-1 text-sm font-normal text-[var(--muted-foreground)]">
                      {stat.unit}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center justify-center gap-1 text-xs text-[var(--muted-foreground)]">
                  <span>{stat.label}</span>

                  <button
                    type="button"
                    aria-label={`More info about ${stat.label}`}
                    title={stat.tooltip}
                    className="text-[var(--muted-foreground)] hover:text-[var(--accent)]"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
          {monthlyTrend.isValid && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-xs shadow-sm">
              <span className="text-[var(--muted-foreground)]">
                This month: <strong className="font-semibold text-[var(--card-foreground)]">{monthlyTrend.thisMonth} active days</strong>
              </span>
              <span className={monthlyTrend.colorClass}>
                ({monthlyTrend.text})
              </span>
            </div>
          )}
          {badge && (
            <div className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2">
              <badge.icon size={18} className="text-[var(--accent)]" aria-hidden="true" />
              <span className="text-sm font-medium text-[var(--accent)]">{badge.label}</span>
            </div>
          )}

          {activeDayData.isValid && activeDayData.peakDay && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-medium text-[var(--muted-foreground)]">Most Active Day</div>
                  <div className="text-sm font-semibold text-[var(--card-foreground)] mt-0.5">
                    {activeDayData.peakDay.label}{" "}
                    <span className="text-xs font-normal text-[var(--muted-foreground)]">
                      (avg {activeDayData.peakDay.avgCommits.toFixed(1)} commits)
                    </span>
                  </div>
                </div>

                <div className="flex items-end gap-1.5 h-10 pt-2">
                  {activeDayData.insights.map((item) => {
                    const maxAvg = activeDayData.peakDay?.avgCommits ?? 1;
                    const heightPercent = maxAvg > 0 ? Math.max(15, Math.round((item.avgCommits / maxAvg) * 100)) : 15;
                    const isPeak = item.label === activeDayData.peakDay?.label;

                    return (
                      <div
                        key={item.label}
                        className="flex flex-col items-center gap-1 group relative cursor-default"
                        title={`${item.label}: avg ${item.avgCommits.toFixed(1)} commits`}
                      >
                        <div className="w-5 bg-[var(--card-muted)] rounded-sm flex items-end h-8 overflow-hidden">
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-sm transition-all duration-300 ${isPeak ? "bg-[var(--accent)]" : "bg-[var(--accent)]/40 hover:bg-[var(--accent)]/60"
                              }`}
                          />
                        </div>
                        <span className={`text-[10px] leading-none ${isPeak ? "font-bold text-[var(--card-foreground)]" : "text-[var(--muted-foreground)]"}`}>
                          {item.shortLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {lastUpdated && (
            <p className="mt-2 text-right text-xs text-[var(--muted-foreground)]">
              {minutesAgo === 0
                ? "Updated just now"
                : `Updated ${minutesAgo} min ago`}
            </p>
          )}

          {freeze && freeze.hasFreeze && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-[var(--accent)]" aria-hidden="true" />
                <span className="text-sm font-medium text-[var(--accent)]">Freeze active today</span>
              </div>
              {confirmCancel ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--muted-foreground)]">Remove freeze?</span>
                  <button
                    type="button"
                    onClick={handleCancelFreeze}
                    disabled={cancelling || freezeLoading}
                    className="rounded-md bg-[var(--destructive)]/10 px-2.5 py-1 text-xs font-medium text-[var(--destructive)] transition hover:bg-[var(--destructive)]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {cancelling ? "Removing..." : "Yes, remove"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    disabled={cancelling || freezeLoading}
                    className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--control)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Keep
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelFreeze}
                  disabled={cancelling || freezeLoading}
                  className="rounded-md border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--control)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel freeze
                </button>
              )}
            </div>
          )}

          {freeze && !freeze.hasFreeze && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--control)] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--foreground)]">Streak Freeze</span>
                <span className="text-xs text-[var(--muted-foreground)]">❄️ 1 available</span>
                <div className="group relative cursor-help">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--card-muted)] text-[10px] font-bold text-[var(--muted-foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors"
                    role="img"
                    aria-label="A streak freeze protects your streak for one missed day. You can only use one freeze at a time."
                  >
                    ?
                  </span>
                  <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 w-64 rounded-lg bg-[var(--foreground)] px-3 py-2 text-xs font-medium leading-relaxed text-[var(--background)] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-20 shadow-lg text-center">
                    A streak freeze protects your streak for one missed day. You can only use one freeze at a time.
                    <div className="absolute top-full left-1/2 h-1 w-1 -translate-x-1/2 border-4 border-t-[var(--foreground)] border-transparent" />
                  </div>
                </div>
              </div>
              <button
                type="button"
                data-testid="streak-freeze-button"
                onClick={() => setShowFreezeConfirm(true)}
                disabled={freezeLoading || freeze?.hasFreeze}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${freezeLoading || freeze?.hasFreeze
                  ? "cursor-not-allowed opacity-50 bg-[var(--accent)]"
                  : "bg-[var(--accent)] hover:opacity-90"
                  } text-[var(--accent-foreground)]`}
              >
                {freezeLoading ? "Freezing..." : "Freeze Streak"}
              </button>
            </div>
          )}

          {/* Streak Calendar Section */}
          {contributionData ? (
            <>
              {/*
            Freeze dates are managed via the streak freeze API (/api/streak/freeze).
            Users can activate a freeze from the freeze button in this component.
            The calendar displays existing freeze dates from the API response.
            Future: add UI to manually mark/unmark past dates as frozen.
          */}
              <StreakCalendar
                contributions={contributionData.data}
                freezeDates={
                  freeze?.freezeDate
                    ? Array.from(new Set([...freezeDates, freeze.freezeDate]))
                    : freezeDates
                }
                currentMonth={calendarMonth}
                onMonthChange={setCalendarMonth}
              />
            </>
          ) : null}
        </div>
      </div>
      <ConfirmModal
      isOpen={showFreezeConfirm}
      title="❄️ Use a Streak Freeze?"
      message={`This will consume 1 of your available freezes. Your streak will be protected for today.`}
      confirmLabel="Yes, Freeze"
      cancelLabel="Cancel"
      onConfirm={() => {
        setShowFreezeConfirm(false);
        handleApplyFreeze();
      }}
      onCancel={() => setShowFreezeConfirm(false)}
      disabled={freezeLoading}
    />
    </>
  );
}

interface StreakCalendarProps {
  contributions: Record<string, number>;
  freezeDates: string[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function StreakCalendar({
  contributions,
  freezeDates,
  currentMonth,
  onMonthChange,
}: StreakCalendarProps) {
  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const { getCalendarStyle, themeConfig } = useHeatmapTheme();
  const monthName = firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const calendarDays: Array<{ date: Date | null; dayOfMonth: number | null }> = [];

  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push({ date: null, dayOfMonth: null });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({ date: new Date(year, month, day), dayOfMonth: day });
  }
  const totalCells = Math.ceil(calendarDays.length / 7) * 7;
  while (calendarDays.length < totalCells) {
    calendarDays.push({ date: null, dayOfMonth: null });
  }

  const handlePrevMonth = () => onMonthChange(new Date(year, month - 1));
  const handleNextMonth = () => onMonthChange(new Date(year, month + 1));
  const freezeSet = new Set(freezeDates);

  return (
    <div className="mt-6 pt-6 border-t border-[var(--border)]">
      {/* Calendar Header */}
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--card-foreground)]">
          {monthName}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handlePrevMonth}
            className="rounded-md px-2 py-1 hover:bg-[var(--control)] transition-colors text-sm font-medium"
            aria-label="Previous month"
          >
            ← Prev
          </button>
          <button
            onClick={handleNextMonth}
            className="rounded-md px-2 py-1 hover:bg-[var(--control)] transition-colors text-sm font-medium"
            aria-label="Next month"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Day labels */}
      <div className="mb-3 grid grid-cols-7 gap-1">
        {dayLabels.map((label) => (
          <div
            key={label}
            className="text-center text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((dayData, idx) => {
          if (!dayData.date) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }

          const dateStr = toLocalDateStr(dayData.date);
          const commitCount = contributions[dateStr] ?? 0;
          const isFuture = dayData.date > today;
          const isToday = dayData.date.toDateString() === today.toDateString();
          const isFrozen = freezeSet.has(dateStr) && commitCount === 0;

          let bgColor = "bg-transparent";
          let borderColor = "border border-[var(--border)]";
          let statusText = "";

          if (!isFuture) {
            if (isFrozen) {
              bgColor = "bg-[var(--accent)]/20";
              borderColor = "border border-[var(--accent)]/40";
              statusText = "Frozen";
            } else if (commitCount > 0) {
              bgColor = "bg-[var(--accent)]";
              borderColor = "border border-[var(--accent)]";
              statusText = "Committed";
            } else {
              bgColor = "bg-[var(--muted-foreground)]/20";
              borderColor = "border border-[var(--muted-foreground)]/30";
              statusText = "Missed";
            }
          }

          const cellStyle = isFuture
            ? { backgroundColor: "transparent", borderColor: themeConfig.border }
            : isFrozen
              ? undefined
              : getCalendarStyle(commitCount);

          const tooltipText = !isFuture
            ? `${dayData.date.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}: ${statusText}${!isFrozen && commitCount > 0 ? ` (${commitCount})` : ""}`
            : "";

          return (
            <div
              key={dateStr}
              className={`group relative aspect-square rounded-lg ${bgColor} ${borderColor} transition-all hover:scale-110 hover:shadow-lg cursor-default ${isToday ? "ring-2 ring-offset-1 ring-[var(--accent)]" : ""
                }`}
              style={cellStyle}
              title={tooltipText}
            >
              {!isFuture && (
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[var(--accent-foreground)] opacity-0 group-hover:opacity-100 transition-opacity">
                  {dayData.dayOfMonth}
                </span>
              )}
              {!isFuture && tooltipText && (
                <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--foreground)] px-3 py-2 text-xs font-medium text-[var(--background)] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10 shadow-lg">
                  {tooltipText}
                  <div className="absolute top-full left-1/2 h-1 w-1 -translate-x-1/2 border-4 border-t-[var(--foreground)] border-transparent" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-6 text-sm">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-md bg-[var(--accent)]" />
          <span className="text-[var(--card-foreground)] font-medium">Committed</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/20" />
          <span className="text-[var(--card-foreground)] font-medium">Frozen</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-md border border-[var(--muted-foreground)]/30 bg-[var(--muted-foreground)]/20" />
          <span className="text-[var(--card-foreground)] font-medium">Missed</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-md border-2 border-[var(--border)]" />
          <span className="text-[var(--card-foreground)] font-medium">Future</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        Frozen days are set via the streak freeze feature above.
      </p>
    </div>
  );
}

interface WeekdayInsight {
  label: string;
  shortLabel: string;
  totalCommits: number;
  countDays: number;
  avgCommits: number;
}

export function calculateActiveDayInsights(data: Record<string, number> | undefined | null): {
  insights: WeekdayInsight[];
  peakDay: WeekdayInsight | null;
  isValid: boolean;
} {
  if (!data || Object.keys(data).length < 14) {
    return { insights: [], peakDay: null, isValid: false };
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const shortNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const totals = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];

  for (const [dateStr, commitCount] of Object.entries(data)) {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      if (!isNaN(d.getTime())) {
        const dayIdx = d.getDay();
        totals[dayIdx] += commitCount;
        counts[dayIdx] += 1;
      }
    }
  }

  const insights: WeekdayInsight[] = [];
  for (let i = 0; i < 7; i++) {
    const totalCommits = totals[i];
    const countDays = counts[i];
    const avgCommits = countDays > 0 ? totalCommits / countDays : 0;
    insights.push({
      label: dayNames[i],
      shortLabel: shortNames[i],
      totalCommits,
      countDays,
      avgCommits,
    });
  }

  let maxAvg = -1;
  for (const item of insights) {
    if (item.avgCommits > maxAvg) {
      maxAvg = item.avgCommits;
    }
  }

  const tiedDays = insights.filter((item) => item.avgCommits === maxAvg);
  tiedDays.sort((a, b) => a.label.localeCompare(b.label));
  const peakDay = tiedDays.length > 0 ? tiedDays[0] : null;

  return { insights, peakDay, isValid: true };
}

interface MonthlyTrendResult {
  isValid: boolean;
  thisMonth: number;
  lastMonth: number;
  text: string;
  colorClass: string;
}

export function calculateMonthlyTrend(contrib: ContributionData | undefined | null): MonthlyTrendResult {
  if (!contrib || !contrib.data) {
    return { isValid: false, thisMonth: 0, lastMonth: 0, text: "", colorClass: "" };
  }

  if (contrib.days < 30) {
    return { isValid: false, thisMonth: 0, lastMonth: 0, text: "", colorClass: "" };
  }

  const data = contrib.data;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const prevDate = new Date(currentYear, currentMonth - 1, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth();

  let thisMonth = 0;
  let lastMonth = 0;

  for (const [dateStr, count] of Object.entries(data)) {
    if (count > 0) {
      const parts = dateStr.split("-").map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        if (!isNaN(d.getTime())) {
          if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
            thisMonth++;
          } else if (d.getFullYear() === prevYear && d.getMonth() === prevMonth) {
            lastMonth++;
          }
        }
      }
    }
  }

  let text = "";
  let colorClass = "";

  if (lastMonth === 0) {
    text = "First month tracked!";
    colorClass = "text-[var(--accent)] font-medium";
  } else {
    const deltaCalc = ((thisMonth - lastMonth) / lastMonth) * 100;
    const formatted = deltaCalc.toFixed(0);

    if (deltaCalc > 0) {
      text = `↑${formatted}% vs last month`;
      colorClass = "text-[var(--success)] font-medium";
    } else if (deltaCalc < 0) {
      text = `↓${Math.abs(deltaCalc).toFixed(0)}% vs last month`;
      colorClass = "text-[var(--destructive)] font-medium";
    } else {
      text = `=0% vs last month`;
      colorClass = "text-[var(--muted-foreground)] font-medium";
    }
  }

  return { isValid: true, thisMonth, lastMonth, text, colorClass };
}