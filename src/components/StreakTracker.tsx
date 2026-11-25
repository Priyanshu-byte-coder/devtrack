"use client";
import { useStreakTracker } from "@/hooks/useStreakTracker";
import SectionHeader from "./SectionHeader";
import { useCallback, useEffect, useState, useRef } from "react";
import { useAccount } from "@/components/AccountContext";
import { useDashboardWidgetA11y } from "@/components/dashboard/DashboardWidgetA11yContext";
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
  CheckCircle,
  Medal,
  Star,
  Sparkles,
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import { CopyFeedback } from "@/components/ui/copy-feedback";
import { SkeletonBlock } from "./WidgetSkeleton";
import { useLocale, useTranslations } from "next-intl";

const DATA_WINDOW_DAYS = 90;

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

export { useStreakTracker } from "@/hooks/useStreakTracker";

export default function StreakTracker() {
  const t = useTranslations("dashboard");
  const locale = useLocale();

  const {
    selectedAccount,
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

  const { setSummary, setIsUpdating } =
    useDashboardWidgetA11y("streak-tracker");

  useEffect(() => {
    setIsUpdating(loading);
  }, [loading, setIsUpdating]);

  useEffect(() => {
    if (!data) {
      setSummary(null);
      return;
    }
    const currentFormatted = new Intl.NumberFormat(locale).format(data.current);
    const longestFormatted = new Intl.NumberFormat(locale).format(data.longest);
    setSummary(
      `Current streak: ${currentFormatted} days. Longest streak: ${longestFormatted} days.`
    );
  }, [data, locale, setSummary]);

  if (loading) {
    return (
      <div className="bg-[var(--card)] p-6">
        {data?.complete === false && (
          <p
            role="status"
            className="mb-3 text-xs text-[var(--muted-foreground)]"
          >
            {t("streakTracker.partialHistoryNotice", {
              reason:
                data.partialReason ??
                t("streakTracker.partialHistoryDefaultReason"),
            })}
          </p>
        )}
        <div role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">{t("streakTracker.loadingStreak")}</span>
          <SkeletonBlock className="h-8 w-36 mb-4" />
          <div
            aria-hidden="true"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {[1, 2, 3, 4].map((i) => (
              <SkeletonBlock key={i} className="h-[86.5px] rounded-lg" />
            ))}
          </div>
          <SkeletonBlock className="mt-3 h-[38px]" />
          <SkeletonBlock className="mt-2 h-4" />
          <SkeletonBlock className="mt-4 h-[50px]" />
          <SkeletonBlock className="mt-6 h-[531px]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-frame bg-[var(--card)] p-6">
        <SectionHeader title={t("streakTracker.title")} />
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-[var(--destructive)]">
          <p>{error}</p>
          <button
            type="button"
            onClick={fetchStreak}
            className="mt-3 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-destructive/10"
          >
            {t("streakTracker.tryAgain")}
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
      <div className="px-frame bg-[var(--card)] p-6 min-h-[420px]">
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="mb-4 text-4xl">📉</div>

          <SectionHeader title={t("streakTracker.noContributionDataTitle")} />

          <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">
            {t("streakTracker.noContributionDataDesc")}
          </p>

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90"
          >
            {t("streakTracker.openGithub")}
          </a>
        </div>
      </div>
    );
  }
  const MILESTONES = [
    { days: 30, label: t("streakTracker.milestone30"), icon: Medal },
    { days: 14, label: t("streakTracker.milestone14"), icon: Star },
    { days: 7, label: t("streakTracker.milestone7"), icon: Flame },
    { days: 3, label: t("streakTracker.milestone3"), icon: Sparkles },
  ];

  const badge = MILESTONES.find((m) => (data?.current ?? 0) >= m.days);
  const nextMilestone = [...MILESTONES]
    .reverse()
    .find((m) => (data?.current ?? 0) < m.days);
  const activeDayData = calculateActiveDayInsights(
    contributionData?.data,
    locale
  );
  const monthlyTrend = calculateMonthlyTrend(contributionData, locale, t);

  const formattedDataWindowDays = new Intl.NumberFormat(locale).format(
    DATA_WINDOW_DAYS
  );
  const dataWindowLabel = t("streakTracker.dataWindowLabel", {
    days: formattedDataWindowDays,
  });

  const remainingDaysToNext = nextMilestone
    ? nextMilestone.days - (data?.current ?? 0)
    : 0;
  const remainingDaysFormatted = new Intl.NumberFormat(locale).format(
    remainingDaysToNext
  );
  const targetDaysFormatted = nextMilestone
    ? new Intl.NumberFormat(locale).format(nextMilestone.days)
    : "";

  const stats = data
    ? [
        {
          label: t("streakTracker.currentStreak"),
          value: new Intl.NumberFormat(locale).format(animatedCurrent),
          unit: t("streakTracker.daysUnit"),
          highlight: data.current > 0,
          icon: Flame,
          tooltip: t("streakTracker.currentStreakTooltip"),
        },
        {
          label: t("streakTracker.longestStreak"),
          value: new Intl.NumberFormat(locale).format(animatedLongest),
          unit: t("streakTracker.daysUnit"),
          highlight: false,
          icon: Trophy,
          tooltip: t("streakTracker.longestStreakTooltip"),
        },
        {
          label: t("streakTracker.activeDaysWindow", {
            days: formattedDataWindowDays,
          }),
          value: new Intl.NumberFormat(locale).format(animatedActiveDays),
          unit: t("streakTracker.daysUnit"),
          highlight: false,
          icon: Calendar,
          tooltip: t("streakTracker.activeDaysTooltip", {
            window: dataWindowLabel.toLowerCase(),
          }),
        },
        {
          label: t("streakTracker.lastCommit"),
          value: data.lastCommitDate
            ? new Intl.DateTimeFormat(locale, {
                month: "short",
                day: "numeric",
              }).format(new Date(data.lastCommitDate))
            : "—",
          unit: "",
          highlight: false,
          icon: Zap,
          tooltip: t("streakTracker.lastCommitTooltip"),
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
              aria-label={t("streakTracker.copyStatsAriaLabel")}
            >
              <CopyFeedback
                copied={copied}
                iconClassName="h-4 w-4"
                className="text-xs font-medium"
              />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--control)] disabled:opacity-70"
              aria-label={t("streakTracker.downloadStatsAriaLabel")}
            >
              {isDownloading ? (
                <span className="w-4 h-4 rounded-full border-2 border-[var(--border)] border-t-[var(--foreground)] animate-spin" />
              ) : (
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
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              )}
              <span>{t("streakTracker.saveImageButton")}</span>
            </button>
          </div>
        )}
        <div
          ref={containerRef}
          data-testid="streak-widget"
          className="px-frame bg-[var(--card)] p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SectionHeader title={t("streakTracker.title")} />
            </div>
            {data && <div className="h-8 w-24" />}
          </div>
          <div className="grid grid-cols-2 gap-2 xs:gap-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className={`rounded-lg p-3 text-center ${
                  stat.highlight
                    ? "border border-accent/40 bg-[var(--accent-soft)]"
                    : "bg-[var(--control)]"
                }`}
                aria-label={stat.tooltip}
              >
                <div className="flex justify-center mb-1">
                  <stat.icon
                    size={20}
                    className="text-[var(--accent)]"
                    aria-hidden="true"
                  />
                </div>
                <div
                  className={`text-lg font-bold leading-tight tabular-nums ${
                    stat.highlight
                      ? "text-[var(--accent)]"
                      : "text-[var(--accent)]"
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
                  <span className="break-words">{stat.label}</span>

                  <button
                    type="button"
                    aria-label={t("streakTracker.moreInfoAbout", {
                      label: stat.label,
                    })}
                    title={stat.tooltip}
                    className="text-[var(--muted-foreground)] hover:text-[var(--accent)] shrink-0"
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
                {t("streakTracker.thisMonthActiveDays", {
                  count: new Intl.NumberFormat(locale).format(
                    monthlyTrend.thisMonth
                  ),
                })}
              </span>
              <span className={monthlyTrend.colorClass}>
                ({monthlyTrend.text})
              </span>
            </div>
          )}
          {badge && (
            <div className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2">
              <badge.icon
                size={18}
                className="text-[var(--accent)] shrink-0"
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-[var(--accent)] break-words text-center">
                {t("streakTracker.milestoneBadgeReached", {
                  label: badge.label,
                })}
                {nextMilestone &&
                  t("streakTracker.milestoneRemaining", {
                    count: remainingDaysFormatted,
                    unit:
                      remainingDaysToNext === 1
                        ? t("streakTracker.dayUnit")
                        : t("streakTracker.daysUnit"),
                    target: targetDaysFormatted,
                  })}
              </span>
            </div>
          )}

          {activeDayData.isValid && activeDayData.peakDay && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-medium text-[var(--muted-foreground)]">
                    {t("streakTracker.mostActiveDay")}
                  </div>
                  <div className="text-sm font-semibold text-[var(--card-foreground)] mt-0.5">
                    {activeDayData.peakDay.label}{" "}
                    <span className="text-xs font-normal text-[var(--muted-foreground)]">
                      (
                      {t("streakTracker.avgCommitsPerDay", {
                        count: new Intl.NumberFormat(locale, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        }).format(activeDayData.peakDay.avgCommits),
                      })}
                      )
                    </span>
                  </div>
                </div>

                <div className="flex items-end gap-1.5 h-10 pt-2">
                  {activeDayData.insights.map((item) => {
                    const maxAvg = activeDayData.peakDay?.avgCommits ?? 1;
                    const heightPercent =
                      maxAvg > 0
                        ? Math.max(
                            15,
                            Math.round((item.avgCommits / maxAvg) * 100)
                          )
                        : 15;
                    const isPeak = item.label === activeDayData.peakDay?.label;

                    const avgCommitsFormatted = new Intl.NumberFormat(locale, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }).format(item.avgCommits);

                    return (
                      <div
                        key={item.label}
                        className="flex flex-col items-center gap-1 group relative cursor-default"
                        title={`${item.label}: ${t("streakTracker.avgCommitsPerDay", { count: avgCommitsFormatted })}`}
                      >
                        <div className="w-5 bg-[var(--card-muted)] rounded-sm flex items-end h-8 overflow-hidden">
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-sm transition-[height,width] duration-300 ${
                              isPeak
                                ? "bg-[var(--accent)]"
                                : "bg-accent/40 hover:bg-accent/60"
                            }`}
                          />
                        </div>
                        <span
                          className={`text-[10px] leading-none ${isPeak ? "font-bold text-[var(--card-foreground)]" : "text-[var(--muted-foreground)]"}`}
                        >
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
                ? t("streakTracker.updatedJustNow")
                : t("streakTracker.updatedMinAgo", {
                    minutes: new Intl.NumberFormat(locale).format(minutesAgo),
                  })}
            </p>
          )}

          {freeze && freeze.hasFreeze && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-accent/30 bg-[var(--accent-soft)] px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle
                  size={18}
                  className="text-[var(--accent)]"
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-[var(--accent)]">
                  {t("streakTracker.freezeActiveToday")}
                </span>
              </div>
              {confirmCancel ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {t("streakTracker.removeFreezeQuestion")}
                  </span>
                  <button
                    type="button"
                    onClick={handleCancelFreeze}
                    disabled={cancelling || freezeLoading}
                    className="rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-[var(--destructive)] transition hover:bg-destructive/20 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {cancelling
                      ? t("streakTracker.removingFreeze")
                      : t("streakTracker.yesRemove")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    disabled={cancelling || freezeLoading}
                    className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--control)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("streakTracker.keepFreeze")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelFreeze}
                  disabled={cancelling || freezeLoading}
                  className="rounded-md border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--control)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("streakTracker.cancelFreeze")}
                </button>
              )}
            </div>
          )}

          {freeze && !freeze.hasFreeze && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--control)] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {t("streakTracker.streakFreezeTitle")}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {t("streakTracker.freezesAvailable", { count: 1 })}
                </span>
                <div className="group relative cursor-help">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--card-muted)] text-[10px] font-bold text-[var(--muted-foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors"
                    role="img"
                    aria-label={t("streakTracker.streakFreezeHelpTooltip")}
                  >
                    ?
                  </span>
                  <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 w-64 rounded-lg bg-[var(--foreground)] px-3 py-2 text-xs font-medium leading-relaxed text-[var(--background)] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-20 shadow-lg text-center">
                    {t("streakTracker.streakFreezeHelpTooltip")}
                    <div className="absolute top-full left-1/2 h-1 w-1 -translate-x-1/2 border-4 border-t-[var(--foreground)] border-transparent" />
                  </div>
                </div>
              </div>
              <button
                type="button"
                data-testid="streak-freeze-button"
                onClick={() => setShowFreezeConfirm(true)}
                disabled={freezeLoading || freeze?.hasFreeze}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  freezeLoading || freeze?.hasFreeze
                    ? "cursor-not-allowed opacity-50 bg-[var(--accent)]"
                    : "bg-[var(--accent)] hover:opacity-90"
                } text-[var(--accent-foreground)]`}
              >
                {freezeLoading
                  ? t("streakTracker.freezing")
                  : t("streakTracker.freezeStreakButton")}
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
                locale={locale}
                t={t}
              />
            </>
          ) : null}
        </div>
      </div>
      <ConfirmModal
        isOpen={showFreezeConfirm}
        title={t("streakTracker.freezeModalTitle")}
        message={t("streakTracker.freezeModalMessage")}
        confirmLabel={t("streakTracker.freezeModalConfirm")}
        cancelLabel={t("streakTracker.freezeModalCancel")}
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
  locale?: string;
  t?: (key: string, values?: Record<string, string | number>) => string;
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function StreakCalendar({
  contributions,
  freezeDates,
  currentMonth,
  onMonthChange,
  locale = "en-US",
  t,
}: StreakCalendarProps) {
  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const { getCalendarStyle, themeConfig } = useHeatmapTheme();
  const monthName = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(firstDay);

  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    // 2026-01-04 was a Sunday
    const d = new Date(2026, 0, 4 + i);
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
  });

  const calendarDays: Array<{ date: Date | null; dayOfMonth: number | null }> =
    [];

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

  const prevMonthText = t ? t("streakTracker.prevMonth") : "← Prev";
  const nextMonthText = t ? t("streakTracker.nextMonth") : "Next →";
  const prevMonthAriaLabel = t
    ? t("streakTracker.prevMonthAriaLabel")
    : "Previous month";
  const nextMonthAriaLabel = t
    ? t("streakTracker.nextMonthAriaLabel")
    : "Next month";

  return (
    <div className="mt-6 pt-6 border-t border-[var(--border)]">
      {/* Calendar Header */}
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]">
          {monthName}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handlePrevMonth}
            className="rounded-md px-2 py-1 hover:bg-[var(--control)] transition-colors text-sm font-medium"
            aria-label={prevMonthAriaLabel}
          >
            {prevMonthText}
          </button>
          <button
            onClick={handleNextMonth}
            className="rounded-md px-2 py-1 hover:bg-[var(--control)] transition-colors text-sm font-medium"
            aria-label={nextMonthAriaLabel}
          >
            {nextMonthText}
          </button>
        </div>
      </div>

      {/* Day labels */}
      <div className="mb-3 grid grid-cols-7 gap-1">
        {dayLabels.map((label, i) => (
          <div
            key={i}
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

          const statusFrozen = t ? t("streakTracker.statusFrozen") : "Frozen";
          const statusCommitted = t
            ? t("streakTracker.statusCommitted")
            : "Committed";
          const statusMissed = t ? t("streakTracker.statusMissed") : "Missed";

          if (!isFuture) {
            if (isFrozen) {
              bgColor = "bg-accent/20";
              borderColor = "border border-accent/40";
              statusText = statusFrozen;
            } else if (commitCount > 0) {
              bgColor = "bg-[var(--accent)]";
              borderColor = "border border-[var(--accent)]";
              statusText = statusCommitted;
            } else {
              bgColor = "bg-muted-foreground/20";
              borderColor = "border border-muted-foreground/30";
              statusText = statusMissed;
            }
          }

          const cellStyle = isFuture
            ? {
                backgroundColor: "transparent",
                borderColor: themeConfig.border,
              }
            : isFrozen
              ? undefined
              : getCalendarStyle(commitCount);

          const formattedDay = !isFuture
            ? new Intl.DateTimeFormat(locale, {
                weekday: "short",
                month: "short",
                day: "numeric",
              }).format(dayData.date)
            : "";

          const formattedCommitCount = new Intl.NumberFormat(locale).format(
            commitCount
          );

          const tooltipText = !isFuture
            ? `${formattedDay}: ${statusText}${!isFrozen && commitCount > 0 ? ` (${formattedCommitCount})` : ""}`
            : "";

          const formattedDayOfMonth =
            dayData.dayOfMonth !== null
              ? new Intl.NumberFormat(locale).format(dayData.dayOfMonth)
              : null;

          return (
            <div
              key={dateStr}
              className={`group relative aspect-square rounded-lg ${bgColor} ${borderColor} transition-[transform,box-shadow] hover:scale-110 hover:shadow-lg cursor-default ${
                isToday ? "ring-2 ring-offset-1 ring-[var(--accent)]" : ""
              }`}
              style={cellStyle}
              title={tooltipText}
            >
              {!isFuture && (
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[var(--accent-foreground)] opacity-0 group-hover:opacity-100 transition-opacity">
                  {formattedDayOfMonth}
                </span>
              )}
              {!isFuture && tooltipText && (
                <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--foreground)] px-3 py-2 text-xs font-medium text-[var(--background)] hidden pointer-events-none group-hover:block group-focus-within:block z-10 shadow-lg">
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
          <span className="text-[var(--card-foreground)] font-medium">
            {t ? t("streakTracker.legendCommitted") : "Committed"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-md border border-accent/40 bg-accent/20" />
          <span className="text-[var(--card-foreground)] font-medium">
            {t ? t("streakTracker.legendFrozen") : "Frozen"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-md border border-muted-foreground/30 bg-muted-foreground/20" />
          <span className="text-[var(--card-foreground)] font-medium">
            {t ? t("streakTracker.legendMissed") : "Missed"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-md border-2 border-[var(--border)]" />
          <span className="text-[var(--card-foreground)] font-medium">
            {t ? t("streakTracker.legendFuture") : "Future"}
          </span>
        </div>
      </div>
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        {t
          ? t("streakTracker.calendarFootnote")
          : "Frozen days are set via the streak freeze feature above."}
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

export function calculateActiveDayInsights(
  data: Record<string, number> | undefined | null,
  locale = "en-US"
): {
  insights: WeekdayInsight[];
  peakDay: WeekdayInsight | null;
  isValid: boolean;
} {
  if (!data || Object.keys(data).length < 14) {
    return { insights: [], peakDay: null, isValid: false };
  }

  const dayNames = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2026, 0, 4 + i); // Sunday
    return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(d);
  });
  const shortNames = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2026, 0, 4 + i);
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
  });

  const totals = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];

  for (const [dateStr, commitCount] of Object.entries(data)) {
    const parts = dateStr.split("-").map(Number);
    if (
      parts.length === 3 &&
      !isNaN(parts[0]) &&
      !isNaN(parts[1]) &&
      !isNaN(parts[2])
    ) {
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

export function calculateMonthlyTrend(
  contrib: ContributionData | undefined | null,
  locale = "en-US",
  t?: (key: string, values?: Record<string, string | number>) => string
): MonthlyTrendResult {
  if (!contrib || !contrib.data) {
    return {
      isValid: false,
      thisMonth: 0,
      lastMonth: 0,
      text: "",
      colorClass: "",
    };
  }

  if (contrib.days < 30) {
    return {
      isValid: false,
      thisMonth: 0,
      lastMonth: 0,
      text: "",
      colorClass: "",
    };
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
      if (
        parts.length === 3 &&
        !isNaN(parts[0]) &&
        !isNaN(parts[1]) &&
        !isNaN(parts[2])
      ) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        if (!isNaN(d.getTime())) {
          if (
            d.getFullYear() === currentYear &&
            d.getMonth() === currentMonth
          ) {
            thisMonth++;
          } else if (
            d.getFullYear() === prevYear &&
            d.getMonth() === prevMonth
          ) {
            lastMonth++;
          }
        }
      }
    }
  }

  let text = "";
  let colorClass = "";

  if (lastMonth === 0) {
    text = t ? t("streakTracker.firstMonthTracked") : "First month tracked!";
    colorClass = "text-[var(--accent)] font-medium";
  } else {
    const deltaCalc = ((thisMonth - lastMonth) / lastMonth) * 100;
    const formatted = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(Math.abs(deltaCalc));

    if (deltaCalc > 0) {
      text = t
        ? t("streakTracker.trendUpVsLastMonth", { percent: formatted })
        : `↑${formatted}% vs last month`;
      colorClass = "text-[var(--success)] font-medium";
    } else if (deltaCalc < 0) {
      text = t
        ? t("streakTracker.trendDownVsLastMonth", { percent: formatted })
        : `↓${formatted}% vs last month`;
      colorClass = "text-[var(--destructive)] font-medium";
    } else {
      text = t ? t("streakTracker.trendSameVsLastMonth") : `=0% vs last month`;
      colorClass = "text-[var(--muted-foreground)] font-medium";
    }
  }

  return { isValid: true, thisMonth, lastMonth, text, colorClass };
}
