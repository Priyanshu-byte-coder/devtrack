"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@/components/AccountContext";
import { AlertTriangle, X } from "lucide-react";

interface StreakAtRiskBannerProps {
  lastCommitDate?: string | null;
  currentStreak?: number;
  hasStreakFreeze?: boolean;
}

export default function StreakAtRiskBanner({
  lastCommitDate: propsLastCommitDate,
  currentStreak: propsCurrentStreak,
  hasStreakFreeze,
}: StreakAtRiskBannerProps) {
  const { selectedAccount } = useAccount();
  const [dismissed, setDismissed] = useState(false);
  const [lastCommitDate, setLastCommitDate] = useState(propsLastCommitDate);
  const [currentStreak, setCurrentStreak] = useState(propsCurrentStreak);
  const [hasStreakFreezeState, setHasStreakFreezeState] = useState(hasStreakFreeze);
  const [isAtRisk, setIsAtRisk] = useState(false);

  useEffect(() => {
    // If props weren't passed (e.g. from a Server Component), fetch them
    if (propsLastCommitDate === undefined || propsCurrentStreak === undefined) {
      const url =
        selectedAccount !== null
          ? `/api/metrics/streak?accountId=${encodeURIComponent(selectedAccount)}`
          : "/api/metrics/streak";
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          setLastCommitDate(data.lastCommitDate);
          setCurrentStreak(data.current);
        })
        .catch(() => {});
    } else {
      setLastCommitDate(propsLastCommitDate);
      setCurrentStreak(propsCurrentStreak);
    }
  }, [propsLastCommitDate, propsCurrentStreak, selectedAccount]);

  useEffect(() => {
    if (hasStreakFreeze === undefined) {
      fetch("/api/streak/freeze")
        .then((r) => r.json())
        .then((data) => {
          setHasStreakFreezeState(data.hasFreeze);
        })
        .catch(() => {});
    } else {
      setHasStreakFreezeState(hasStreakFreeze);
    }
  }, [hasStreakFreeze]);

  useEffect(() => {
    if (
      dismissed ||
      hasStreakFreezeState ||
      currentStreak === undefined ||
      currentStreak <= 0 ||
      !lastCommitDate
    ) {
      setIsAtRisk(false);
      return;
    }

    const now = new Date();
    // 1. Check if current time is past 20:00 (8pm)
    if (now.getHours() < 20) {
      setIsAtRisk(false);
      return;
    }

    // 2. Check if lastCommitDate is NOT today
    // Convert to local YYYY-MM-DD for comparison
    const todayStr = now.toLocaleDateString("en-CA"); // "YYYY-MM-DD" in local time
    // lastCommitDate comes as "YYYY-MM-DD" from API
    if (lastCommitDate === todayStr) {
      setIsAtRisk(false);
      return;
    }

    setIsAtRisk(true);
  }, [lastCommitDate, currentStreak, hasStreakFreezeState, dismissed]);

  // Guard: hide banner when streak freeze is confirmed active (true) or
  // still loading (undefined). Only render when we know for sure the user
  // has no freeze (hasStreakFreezeState === false) and the streak is at risk.
  if (!isAtRisk || dismissed || hasStreakFreezeState !== false) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-4 text-[var(--warning)] shadow-sm transition-all animate-in fade-in slide-in-from-top-4"
    >
      <div className="flex items-start sm:items-center gap-3">
        <AlertTriangle size={20} className="flex-shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">
            No commit yet today — your streak is at risk!
          </p>
          <p className="text-sm opacity-90">
            You have a {currentStreak} day streak. Don&apos;t break it!
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 self-end sm:self-auto">
        <a
          href="#streaks"
          className="inline-flex items-center justify-center rounded-lg bg-[var(--warning)]/20 px-3.5 py-1.5 text-xs font-semibold hover:bg-[var(--warning)]/30 transition-all active:scale-[0.98]"
        >
          View Streak Freeze
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-lg p-1.5 opacity-70 hover:bg-[var(--warning)]/20 hover:opacity-100 transition-all"
          aria-label="Dismiss banner"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
