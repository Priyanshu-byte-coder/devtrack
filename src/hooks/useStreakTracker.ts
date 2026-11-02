"use client";
import SectionHeader from "@/components/SectionHeader";
import { useCallback, useEffect, useState, useRef } from "react";
import { useAccount } from "@/components/AccountContext";
import { useDashboardWidgetA11y } from "@/components/dashboard/DashboardWidgetA11yContext";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useCountUp } from "@/hooks/useCountUp";
import StreakMilestoneBanner from "@/components/StreakMilestoneBanner";
import { useHeatmapTheme } from "@/hooks/useHeatmapTheme";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import {
  Flame,
  Trophy,
  Calendar,
  Zap,
  Copy,
  CheckCircle,
  Medal,
  Star,
  Sparkles,
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import { SkeletonBlock } from "@/components/WidgetSkeleton";

const DATA_WINDOW_DAYS = 90;
const dataWindowLabel = `Last ${DATA_WINDOW_DAYS} days`;

const STREAK_MILESTONES = [7, 30, 50, 100, 200, 365];

interface StreakData {
  complete?: boolean;
  partialReason?: string;
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
  const [contributionData, setContributionData] =
    useState<ContributionData | null>(null);
  const [freezeDates, setFreezeDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedMilestones, setDismissedMilestones] = useState<number[]>([]);
  const [lastCelebratedMilestone, setLastCelebratedMilestone] =
    useState<number>(0);
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
      setError(
        "We couldn't load your streak data right now. Please try again in a moment."
      );
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
    const stored = window.localStorage.getItem("devtrack:dismissed-milestones");

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
      setLastCelebratedMilestone(Number(storedLastCelebrated));
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

  const currentMilestone = [...STREAK_MILESTONES]
    .reverse()
    .find(
      (m) => data?.current && data.current >= m && m > lastCelebratedMilestone
    );
  const shouldShowBanner =
    data?.complete !== false &&
    currentMilestone &&
    !dismissedMilestones.includes(currentMilestone);

  const handleDismissBanner = () => {
    if (!currentMilestone) return;

    const updated = [...dismissedMilestones, currentMilestone];

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
    handleRealtimeFreeze
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
