"use client";

import Link from "@/components/Link";
import { useEffect, useState } from "react";
import { useAccount } from "@/components/AccountContext";
import { AlertTriangle, X } from "lucide-react";

interface StreakAtRiskBannerProps {
  lastCommitDate?: string | null;
  currentStreak?: number;
  hasStreakFreeze?: boolean;
}

const DISMISSAL_KEY = "streak-banner-dismissed-date";

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function StreakAtRiskBanner({
  lastCommitDate: propsLastCommitDate,
  currentStreak: propsCurrentStreak,
  hasStreakFreeze,
}: StreakAtRiskBannerProps) {
  const { selectedAccount } = useAccount();

  const [dismissed, setDismissed] = useState(false);
  const [dismissalChecked, setDismissalChecked] = useState(false);
  const [lastCommitDate, setLastCommitDate] = useState(propsLastCommitDate);
  const [currentStreak, setCurrentStreak] = useState(propsCurrentStreak);
  const [hasStreakFreezeState, setHasStreakFreezeState] =
    useState(hasStreakFreeze);
  const [isAtRisk, setIsAtRisk] = useState(false);

  // Check whether the banner was dismissed today.
  useEffect(() => {
    try {
      const dismissedDate = window.localStorage.getItem(DISMISSAL_KEY);
      setDismissed(dismissedDate === getTodayDate());
    } catch {
      setDismissed(false);
    } finally {
      setDismissalChecked(true);
    }
  }, []);

  // Fetch streak data when props aren't provided.
  useEffect(() => {
    if (propsLastCommitDate === undefined || propsCurrentStreak === undefined) {
      const url =
        selectedAccount !== null
          ? `/api/metrics/streak?accountId=${encodeURIComponent(selectedAccount)}`
          : "/api/metrics/streak";

      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error("Failed to fetch streak");
          return r.json();
        })
        .then((data) => {
          setLastCommitDate(data.lastCommitDate ?? null);
          setCurrentStreak(data.current);
        })
        .catch(() => {});
    } else {
      setLastCommitDate(propsLastCommitDate);
      setCurrentStreak(propsCurrentStreak);
    }
  }, [propsLastCommitDate, propsCurrentStreak, selectedAccount]);

  // Check streak freeze status.
  useEffect(() => {
    if (hasStreakFreeze === undefined) {
      fetch("/api/streak/freeze")
        .then((r) => {
          if (!r.ok) throw new Error("Failed to fetch streak freeze");
          return r.json();
        })
        .then((data) => {
          setHasStreakFreezeState(data.hasFreeze);
        })
        .catch(() => {});
    } else {
      setHasStreakFreezeState(hasStreakFreeze);
    }
  }, [hasStreakFreeze]);

  // Determine whether the streak is at risk.
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

    // Only show the banner after 8 PM.
    if (now.getHours() < 20) {
      setIsAtRisk(false);
      return;
    }

    // Check whether the last commit was today.
    if (lastCommitDate === getTodayDate()) {
      setIsAtRisk(false);
      return;
    }

    setIsAtRisk(true);
  }, [lastCommitDate, currentStreak, hasStreakFreezeState, dismissed]);

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISSAL_KEY, getTodayDate());
    } catch {
      // Keep the banner dismissible when browser storage is unavailable.
    }

    setDismissed(true);
  };

  if (!dismissalChecked) return null;

  // Hide while loading freeze status or when the streak is not at risk.
  if (!isAtRisk || dismissed || hasStreakFreezeState !== false) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-warning/40 bg-[color-mix(in_srgb,var(--warning)_12%,var(--card))] p-4 text-[var(--warning)] shadow-lg animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-start sm:items-center gap-3">
        <AlertTriangle
          size={20}
          className="flex-shrink-0 mt-0.5 sm:mt-0"
          aria-hidden="true"
        />
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
        <Link
          href="/dashboard/activity#streaks"
          className="inline-flex items-center justify-center rounded-lg bg-warning/20 px-3.5 py-1.5 text-xs font-semibold hover:bg-warning/30 transition-[background-color,transform] active:scale-[0.98]"
        >
          View streak
        </Link>

        <button
          onClick={handleDismiss}
          className="rounded-lg p-1.5 opacity-70 hover:bg-warning/20 hover:opacity-100 transition-[background-color,opacity]"
          aria-label="Dismiss banner"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
