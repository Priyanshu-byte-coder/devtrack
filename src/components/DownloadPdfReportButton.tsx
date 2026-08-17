"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { downloadDashboardPdf, DashboardReportData, DashboardReportMonthlyCommit, DashboardReportStreak } from "@/lib/pdf-generator";

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const parsed = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(parsed.getTime())) return monthKey;
  return parsed.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function buildMonthlySummaries(data: Record<string, number>): DashboardReportMonthlyCommit[] {
  const monthly = new Map<string, { commits: number; activeDays: Set<string>; bestDay: { date: string; commits: number } | null }>();
  for (const [date, commits] of Object.entries(data)) {
    const monthKey = date.slice(0, 7);
    const current = monthly.get(monthKey) ?? { commits: 0, activeDays: new Set<string>(), bestDay: null };
    current.commits += commits;
    if (commits > 0) {
      current.activeDays.add(date);
    }
    if (!current.bestDay || commits > current.bestDay.commits) {
      current.bestDay = { date, commits };
    }
    monthly.set(monthKey, current);
  }

  return Array.from(monthly.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 3)
    .map(([monthKey, value]) => ({
      month: formatMonthLabel(monthKey),
      commits: value.commits,
      activeDays: value.activeDays.size,
      bestDay: value.bestDay ? value.bestDay.date : null,
    }));
}

function formatHoursFromSeconds(seconds?: number): number | undefined {
  if (typeof seconds !== "number") return undefined;
  return Number((seconds / 3600).toFixed(1));
}

function formatCommitRows(data: Record<string, number>): Array<{ date: string; commits: number }> {
  return Object.entries(data)
    .map(([date, commits]) => ({ date, commits }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchDashboardReportData(session: ReturnType<typeof useSession>['data']): Promise<DashboardReportData> {
  const fetchOptions: RequestInit = {
    cache: "no-store",
  };

  const [weeklyRes, contributionsRes, languagesRes, reposRes, wakatimeRes, goalsRes, achievementsRes] = await Promise.all([
    fetch("/api/metrics/weekly-summary", fetchOptions),
    fetch("/api/metrics/contributions?days=90", fetchOptions),
    fetch("/api/metrics/languages?days=90", fetchOptions),
    fetch("/api/metrics/repos?days=90", fetchOptions),
    fetch("/api/wakatime", fetchOptions),
    fetch("/api/goals", fetchOptions),
    fetch("/api/metrics/achievements", fetchOptions),
  ]);

  const weeklyData = weeklyRes.ok ? await weeklyRes.json() : null;
  const contributionsData = contributionsRes.ok ? await contributionsRes.json() : null;
  const languagesData = languagesRes.ok ? await languagesRes.json() : null;
  const reposData = reposRes.ok ? await reposRes.json() : null;
  const wakatimeData = wakatimeRes.ok ? await wakatimeRes.json() : null;
  const goalsData = goalsRes.ok ? await goalsRes.json() : null;
  const achievementsData = achievementsRes.ok ? await achievementsRes.json() : null;

  const contributionData = contributionsData?.data ? contributionsData.data as Record<string, number> : {};
  const monthlyCommits = buildMonthlySummaries(contributionData);
  const streak: DashboardReportStreak = {
    current: weeklyData?.streak ?? undefined,
    longest: undefined,
    totalActiveDays: weeklyData?.activeDays?.thisWeek ?? undefined,
    lastCommitDate: null,
  };

  const reportData: DashboardReportData = {
    userProfile: {
      name: session?.user?.name ?? undefined,
      githubLogin: session?.githubLogin ?? undefined,
      avatarUrl: session?.user?.image ?? null,
    },
    weeklySummary: {
      commitsThisWeek: weeklyData?.commits?.current,
      commitsLastWeek: weeklyData?.commits?.previous,
      delta: weeklyData?.commits?.delta,
      activeDaysThisWeek: weeklyData?.activeDays?.thisWeek,
      activeDaysLastWeek: weeklyData?.activeDays?.lastWeek,
      topRepo: weeklyData?.topRepo ?? null,
      mostActiveDay: weeklyData?.mostActiveDay ?? null,
      streak: weeklyData?.streak,
    },
    streak,
    wakatime: {
      hasData: wakatimeData?.hasData === true,
      todaysHours: formatHoursFromSeconds(wakatimeData?.todaysSeconds),
      weeklyHours: formatHoursFromSeconds(wakatimeData?.totalSeconds7Days),
      topLanguage: wakatimeData?.topLanguage ?? null,
      topProject: wakatimeData?.topProject ?? null,
    },
    languages: Array.isArray(languagesData?.languages)
      ? languagesData.languages.slice(0, 6).map((item: any) => ({
          name: item.name ?? "Unknown",
          percentage: Number(item.percentage ?? 0),
        }))
      : [],
    topRepos: Array.isArray(reposData?.repos)
      ? reposData.repos.slice(0, 8).map((repo: any) => ({
          name: repo.name ?? "Unknown",
          commits: Number(repo.commits ?? 0),
          description: repo.description ?? null,
          url: repo.url ?? undefined,
        }))
      : [],
    goals: Array.isArray(goalsData?.goals)
      ? goalsData.goals.slice(0, 8).map((goal: any) => ({
          title: goal.title ?? "Untitled goal",
          current: Number(goal.current ?? 0),
          target: Number(goal.target ?? 0),
        }))
      : [],
    achievements: Array.isArray(achievementsData?.achievements)
      ? achievementsData.achievements.slice(0, 10).map((achievement: any) => ({
          title: achievement.title ?? "Achievement",
          description: achievement.description ?? null,
          url: achievement.url ?? undefined,
        }))
      : [],
    monthlyCommits,
  };

  return reportData;
}

export default function DownloadPdfReportButton() {
  const { data: session } = useSession();
  const [isDownloading, setIsDownloading] = useState(false);

  const githubLogin = useMemo(() => (session as any)?.githubLogin as string | undefined, [session]);
  const hasSession = useMemo(() => !!githubLogin || !!session?.user?.name, [githubLogin, session]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      if (!session) {
        toast.error("Please sign in to download your PDF report.");
        return;
      }
      const reportData = await fetchDashboardReportData(session);
      await downloadDashboardPdf(reportData);
      toast.success("PDF report downloaded.");
    } catch (error) {
      console.error("Failed to generate dashboard PDF", error);
      toast.error("Unable to generate the PDF report. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isDownloading || !hasSession}
      className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] transition-all hover:opacity-90 disabled:opacity-50"
    >
      {isDownloading ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
        </svg>
      )}
      {isDownloading ? "Generating PDF..." : "Download PDF Report"}
    </button>
  );
}
