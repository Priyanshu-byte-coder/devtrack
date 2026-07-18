"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

interface PRData {
  open: number;
  merged: number;
  avgReviewHours: number;
  mergeRate: string;
}

interface DayData {
  day: string;
  commits: number;
}

interface Goal {
  id: string;
  title: string;
  target: number;
  current: number;
}

interface MonthlySummary {
  month: string;
  totalCommits: number;
  activeDays: number;
  bestDay: string;
}

interface GoalStatusSummary {
  completed: number;
  inProgress: number;
  notStarted: number;
}

function formatDateLabel(dateInput: string): string {
  const parsed = new Date(`${dateInput}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return dateInput;
  }

  return parsed.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatGeneratedTimestamp(date = new Date()): string {
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatProgressValue(progress: number): string {
  return `${progress.toFixed(1)}%`;
}

function getGoalProgress(goal: Goal): number {
  if (goal.target <= 0) {
    return 0;
  }

  return Math.min((goal.current / goal.target) * 100, 100);
}

function getGoalStatus(goal: Goal): string {
  const progress = getGoalProgress(goal);

  if (progress >= 100) {
    return "Completed";
  }

  if (goal.current > 0) {
    return "In Progress";
  }

  return "Not Started";
}

function getTotalCommits(commitActivity: DayData[]): number {
  return commitActivity.reduce((total, day) => total + day.commits, 0);
}

function getActiveDays(commitActivity: DayData[]): number {
  return commitActivity.filter((day) => day.commits > 0).length;
}

function getBestCommitDay(commitActivity: DayData[]): DayData | null {
  if (commitActivity.length === 0) {
    return null;
  }

  return commitActivity.reduce((best, current) => {
    if (current.commits > best.commits) {
      return current;
    }

    if (current.commits === best.commits && current.day < best.day) {
      return current;
    }

    return best;
  }, commitActivity[0]);
}

function getHighestCommitsInOneDay(commitActivity: DayData[]): number {
  return getBestCommitDay(commitActivity)?.commits ?? 0;
}

function getAverageGoalProgress(goals: Goal[]): number {
  if (goals.length === 0) {
    return 0;
  }

  const totalProgress = goals.reduce((total, goal) => total + getGoalProgress(goal), 0);

  return totalProgress / goals.length;
}

function getGoalStatusSummary(goals: Goal[]): GoalStatusSummary {
  return goals.reduce(
    (summary, goal) => {
      const status = getGoalStatus(goal);

      if (status === "Completed") {
        summary.completed += 1;
      } else if (status === "In Progress") {
        summary.inProgress += 1;
      } else {
        summary.notStarted += 1;
      }

      return summary;
    },
    { completed: 0, inProgress: 0, notStarted: 0 }
  );
}

function getMonthlySummary(commitActivity: DayData[]): MonthlySummary[] {
  const months = new Map<
    string,
    {
      totalCommits: number;
      activeDays: number;
      bestDay: DayData | null;
    }
  >();

  commitActivity.forEach((day) => {
    const monthKey = day.day.slice(0, 7);
    const existing = months.get(monthKey) ?? {
      totalCommits: 0,
      activeDays: 0,
      bestDay: null,
    };

    existing.totalCommits += day.commits;

    if (day.commits > 0) {
      existing.activeDays += 1;
    }

    if (!existing.bestDay || day.commits > existing.bestDay.commits) {
      existing.bestDay = day;
    }

    months.set(monthKey, existing);
  });

  return Array.from(months.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, value]) => {
      const monthDate = new Date(`${monthKey}-01T00:00:00`);

      return {
        month: monthDate.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
        totalCommits: value.totalCommits,
        activeDays: value.activeDays,
        bestDay: value.bestDay ? formatDateLabel(value.bestDay.day) : "-",
      };
    });
}

function getExportInsights(goals: Goal[], commitActivity: DayData[]): string[] {
  const insights: string[] = [];
  const totalCommits = getTotalCommits(commitActivity);
  const activeDays = getActiveDays(commitActivity);
  const bestDay = getBestCommitDay(commitActivity);
  const goalSummary = getGoalStatusSummary(goals);

  if (bestDay) {
    insights.push(
      `Most productive day: ${formatDateLabel(bestDay.day)} with ${bestDay.commits} commits.`
    );
  }

  if (activeDays > 0) {
    insights.push(`You were active on ${activeDays} different days in this report.`);
  } else {
    insights.push("No active commit days were captured in this report.");
  }

  if (goals.length > 0) {
    if (
      goalSummary.notStarted >= goalSummary.inProgress &&
      goalSummary.notStarted >= goalSummary.completed
    ) {
      insights.push(`${goalSummary.notStarted} goals are currently not started.`);
    } else if (goalSummary.inProgress >= goalSummary.completed) {
      insights.push(`${goalSummary.inProgress} goals are currently in progress.`);
    } else {
      insights.push(`${goalSummary.completed} goals are already completed.`);
    }
  } else {
    insights.push("No goals were included in this export.");
  }

  if (totalCommits > 0 && insights.length < 3) {
    insights.push(`Total commit volume in this report: ${totalCommits} commits.`);
  }

  return insights.slice(0, 3);
}

function escapeCsvCell(value: string | number): string {
  const text = String(value);

  if (/[,"\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function appendCsvRow(cells: Array<string | number>): string {
  return `${cells.map(escapeCsvCell).join(",")}\n`;
}

function addFooter(doc: jsPDF, generatedAt: string) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Generated by DevTrack", 14, pageHeight - 10);
    doc.text(`Exported ${generatedAt}`, pageWidth / 2, pageHeight - 10, {
      align: "center",
    });
    doc.text(`Page ${page}`, pageWidth - 14, pageHeight - 10, { align: "right" });
  }
}

export default function ExportButton() {
  const { data: session } = useSession();
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingJSON, setIsExportingJSON] = useState(false);

  const reportName = useMemo(
    () => session?.githubLogin ?? session?.user?.name ?? "",
    [session]
  );

  const fetchData = async () => {
    const fetchOptions: RequestInit = {
      cache: "no-store",
    };

    const [prRes, goalsRes, contribRes, dbExportRes] = await Promise.all([
      fetch(`/api/metrics/prs`, fetchOptions),
      fetch(`/api/goals`, fetchOptions),
      fetch(`/api/metrics/contributions?days=365`, fetchOptions),
      fetch(`/api/user/data-export`, fetchOptions),
    ]);

    const prData: PRData | null = prRes.ok ? await prRes.json() : null;
    const goalsData = goalsRes.ok ? await goalsRes.json() : { goals: [] };
    const contribDataRaw = contribRes.ok ? await contribRes.json() : { data: {} };
    const dbExportData = dbExportRes.ok ? await dbExportRes.json() : null;

    const contribData: DayData[] = Object.entries(contribDataRaw.data ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, commits]) => ({ day, commits: commits as number }));

    return {
      prData,
      contribData,
      goalsData: goalsData?.goals as Goal[],
      dbExportData
    };
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportCSV = async () => {
    setIsExportingCSV(true);
    try {
      const { prData, goalsData, contribData } = await fetchData();
      const generatedAt = formatGeneratedTimestamp();
      const totalCommits = getTotalCommits(contribData);
      const activeDays = getActiveDays(contribData);
      const bestDay = getBestCommitDay(contribData);
      const highestCommits = getHighestCommitsInOneDay(contribData);
      const averageGoalProgress = getAverageGoalProgress(goalsData);
      const monthlySummary = getMonthlySummary(contribData);
      const insights = getExportInsights(goalsData, contribData);
      const goalStatusSummary = getGoalStatusSummary(goalsData);

      let csv = "Report Summary\n";
      csv += appendCsvRow(["Generated on", generatedAt]);
      if (reportName) {
        csv += appendCsvRow(["GitHub user", `@${reportName}`]);
      }
      csv += appendCsvRow(["Total commits", totalCommits]);
      csv += appendCsvRow(["Active coding days", activeDays]);
      csv += appendCsvRow(["Best commit day", bestDay ? formatDateLabel(bestDay.day) : "-"]);
      csv += appendCsvRow(["Highest commits in one day", highestCommits]);
      csv += appendCsvRow(["Total goals", goalsData.length]);
      csv += appendCsvRow(["Average goal progress", `${averageGoalProgress.toFixed(1)}%`]);

      csv += "\nPR Metrics\n";
      csv += appendCsvRow(["Open", "Merged", "Avg Review Hours", "Merge Rate"]);
      if (prData) {
        csv += appendCsvRow([
          prData.open,
          prData.merged,
          prData.avgReviewHours,
          prData.mergeRate,
        ]);
      }

      csv += "\nInsights\n";
      csv += appendCsvRow(["Insight"]);
      insights.forEach((insight) => {
        csv += appendCsvRow([insight]);
      });

      if (goalsData.length > 0) {
        csv += "\nGoals Tracker\n";
        csv += appendCsvRow(["Goal Title", "Current", "Target", "Progress (%)", "Status"]);
        goalsData.forEach((goal) => {
          csv += appendCsvRow([
            goal.title,
            goal.current,
            goal.target,
            formatProgressValue(getGoalProgress(goal)),
            getGoalStatus(goal),
          ]);
        });
      }

      if (contribData.length > 0) {
        csv += "\nCommit Activity\n";
        csv += appendCsvRow(["Date", "Commits"]);
        contribData.forEach((day) => {
          csv += appendCsvRow([formatDateLabel(day.day), day.commits]);
        });
      }

      if (monthlySummary.length > 0) {
        csv += "\nMonthly Summary\n";
        csv += appendCsvRow(["Month", "Total Commits", "Active Days", "Best Day"]);
        monthlySummary.forEach((entry) => {
          csv += appendCsvRow([
            entry.month,
            entry.totalCommits,
            entry.activeDays,
            entry.bestDay,
          ]);
        });
      }

      csv += "\nGoal Status Overview\n";
      csv += appendCsvRow(["Completed", "In Progress", "Not Started"]);
      csv += appendCsvRow([
        goalStatusSummary.completed,
        goalStatusSummary.inProgress,
        goalStatusSummary.notStarted,
      ]);

      downloadFile(csv, "dashboard-metrics.csv", "text/csv");
      toast.success("CSV exported successfully.");
    } catch (error) {
      console.error("CSV export failed:", error);

      toast.error(
        "Failed to export CSV. Please try again."
      );
    } finally {
      setIsExportingCSV(false);
    }
  };

  const exportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const { prData, goalsData, contribData } = await fetchData();
      const doc = new jsPDF();
      const generatedAt = formatGeneratedTimestamp();
      const totalCommits = getTotalCommits(contribData);
      const activeDays = getActiveDays(contribData);
      const bestDay = getBestCommitDay(contribData);
      const highestCommits = getHighestCommitsInOneDay(contribData);
      const averageGoalProgress = getAverageGoalProgress(goalsData);
      const monthlySummary = getMonthlySummary(contribData);
      const insights = getExportInsights(goalsData, contribData);
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 14;
      const contentWidth = pageWidth - marginX * 2;
      const cardGap = 4;
      const cardWidth = (contentWidth - cardGap * 2) / 3;
      const cardHeight = 26;

      const drawSectionTitle = (title: string, y: number) => {
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.text(title, marginX, y);
      };

      const drawSummaryCard = (
        x: number,
        y: number,
        label: string,
        value: string,
        accent: [number, number, number]
      ) => {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, "FD");
        doc.setFillColor(accent[0], accent[1], accent[2]);
        doc.roundedRect(x, y, 2.5, cardHeight, 3, 3, "F");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");
        doc.text(label, x + 6, y + 9);
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.text(value, x + 6, y + 18);
      };

      const drawInsightBox = (startY: number) => {
        const boxHeight = 22 + insights.length * 8;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(marginX, startY, contentWidth, boxHeight, 4, 4, "FD");
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "bold");
        doc.text("Quick Insights", marginX + 6, startY + 8);
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "normal");
        insights.forEach((insight, index) => {
          doc.text(`• ${insight}`, marginX + 8, startY + 16 + index * 8, {
            maxWidth: contentWidth - 14,
          });
        });
      };

      const drawMetricTable = (
        title: string,
        startY: number,
        head: string[][],
        body: Array<Array<string | number>>,
        columnStyles: Record<string, { halign?: "left" | "center" | "right"; cellWidth?: number }> = {}
      ) => {
        drawSectionTitle(title, startY);
        autoTable(doc, {
          startY: startY + 4,
          head,
          body,
          margin: { left: marginX, right: marginX, bottom: 20 },
          theme: "grid",
          styles: {
            fontSize: 9,
            cellPadding: 3,
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
            textColor: [15, 23, 42],
            overflow: "linebreak",
          },
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "left",
          },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          pageBreak: "auto",
          rowPageBreak: "avoid",
          columnStyles,
        });

        return ((doc as any).lastAutoTable?.finalY ?? startY) + 8;
      };

      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(22);
      doc.text("Developer Metrics Report", marginX, 18);
      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text("Generated from DevTrack", marginX, 25);
      doc.setFontSize(9);
      doc.text(`Generated ${generatedAt}`, marginX, 31);
      if (reportName) {
        doc.text(`GitHub user: @${reportName}`, pageWidth - marginX, 18, {
          align: "right",
        });
      }

      const summaryTop = 38;
      drawSummaryCard(marginX, summaryTop, "Total commits", String(totalCommits), [59, 130, 246]);
      drawSummaryCard(
        marginX + cardWidth + cardGap,
        summaryTop,
        "Active coding days",
        String(activeDays),
        [14, 165, 233]
      );
      drawSummaryCard(
        marginX + (cardWidth + cardGap) * 2,
        summaryTop,
        "Best commit day",
        bestDay ? formatDateLabel(bestDay.day) : "-",
        [16, 185, 129]
      );
      drawSummaryCard(
        marginX,
        summaryTop + cardHeight + 6,
        "Highest commits in one day",
        String(highestCommits),
        [245, 158, 11]
      );
      drawSummaryCard(
        marginX + cardWidth + cardGap,
        summaryTop + cardHeight + 6,
        "Total goals",
        String(goalsData.length),
        [139, 92, 246]
      );
      drawSummaryCard(
        marginX + (cardWidth + cardGap) * 2,
        summaryTop + cardHeight + 6,
        "Average goal progress",
        formatProgressValue(averageGoalProgress),
        [236, 72, 153]
      );

      let currentY = summaryTop + cardHeight * 2 + 18;

      drawInsightBox(currentY);
      currentY += 22 + insights.length * 8 + 10;

      if (prData) {
        currentY = drawMetricTable(
          "PR Metrics",
          currentY,
          [["Open", "Merged", "Avg Review Hours", "Merge Rate"]],
          [[prData.open, prData.merged, `${prData.avgReviewHours}h`, prData.mergeRate]],
          {
            0: { halign: "right" },
            1: { halign: "right" },
            2: { halign: "right" },
            3: { halign: "right" },
          }
        );
      }

      if (goalsData.length > 0) {
        currentY = drawMetricTable(
          "Goals Tracker",
          currentY,
          [["Goal Title", "Current", "Target", "Progress", "Status"]],
          goalsData.map((goal) => [
            goal.title,
            goal.current,
            goal.target,
            formatProgressValue(getGoalProgress(goal)),
            getGoalStatus(goal),
          ]),
          {
            1: { halign: "right", cellWidth: 18 },
            2: { halign: "right", cellWidth: 18 },
            3: { halign: "right", cellWidth: 22 },
            4: { halign: "center", cellWidth: 24 },
          }
        );
      }

      if (monthlySummary.length > 0) {
        currentY = drawMetricTable(
          "Monthly Summary",
          currentY,
          [["Month", "Total Commits", "Active Days", "Best Day"]],
          monthlySummary.map((entry) => [
            entry.month,
            entry.totalCommits,
            entry.activeDays,
            entry.bestDay,
          ]),
          {
            1: { halign: "right" },
            2: { halign: "right" },
          }
        );
      }

      if (contribData.length > 0) {
        drawSectionTitle("Commit Activity", currentY);
        autoTable(doc, {
          startY: currentY + 4,
          head: [["Date", "Commits"]],
          body: contribData.map((day) => [formatDateLabel(day.day), day.commits]),
          margin: { left: marginX, right: marginX, bottom: 20 },
          theme: "grid",
          styles: {
            fontSize: 9,
            cellPadding: 3,
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
            textColor: [15, 23, 42],
          },
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontStyle: "bold",
          },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            1: { halign: "right", cellWidth: 24 },
          },
          pageBreak: "auto",
          rowPageBreak: "avoid",
        });
      }

      addFooter(doc, generatedAt);

      doc.save(`devtrack-export-${reportName || "metrics"}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF exported successfully.");
    } catch (error) {
      console.error("PDF export failed:", error);

      toast.error(
        "Failed to export PDF. Please try again."
      );
    }
    finally {
      setIsExportingPDF(false);
    }
  };

  const exportJSON = async () => {
    setIsExportingJSON(true);
    try {
      const { prData, goalsData, contribData, dbExportData } = await fetchData();
      const generatedAt = formatGeneratedTimestamp();

      const jsonData = {
        generatedAt,
        githubUser: reportName || "unknown",
        summary: {
          totalCommits: getTotalCommits(contribData),
          activeCodingDays: getActiveDays(contribData),
          bestCommitDay: getBestCommitDay(contribData)?.day || null,
          highestCommitsInOneDay: getHighestCommitsInOneDay(contribData),
          totalGoals: goalsData.length,
          averageGoalProgress: getAverageGoalProgress(goalsData),
        },
        prMetrics: prData,
        insights: getExportInsights(goalsData, contribData),
        goals: goalsData,
        monthlySummary: getMonthlySummary(contribData),
        commitActivity: contribData,
        goalStatusOverview: getGoalStatusSummary(goalsData),
        // Include full database dump if Supabase is connected
        databaseRecords: dbExportData?.sections || null,
      };

      downloadFile(
        JSON.stringify(jsonData, null, 2),
        `devtrack-export-${reportName || "metrics"}-${new Date().toISOString().slice(0, 10)}.json`,
        "application/json"
      );
    } finally {
      setIsExportingJSON(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
      <button
        type="button"
        onClick={exportCSV}
        disabled={isExportingCSV}
        aria-label="Export dashboard metrics as CSV"
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--control)] px-4 py-2 text-sm font-medium text-[var(--card-foreground)] transition-all hover:border-[var(--accent)] disabled:opacity-50 sm:w-auto sm:min-w-[140px] hover:opacity-90 active:scale-95"
      >
        {isExportingCSV ? (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4z" />
  </svg>
) : (
  <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)}
{isExportingCSV ? "Exporting..." : "Export CSV"}
      </button>

      <button
        type="button"
        onClick={exportPDF}
        disabled={isExportingPDF}
        aria-label="Export dashboard metrics as PDF"
        className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] transition-all hover:opacity-90 disabled:opacity-50 sm:min-w-[140px] sm:flex-none active:scale-95"
        suppressHydrationWarning
      >
        {isExportingPDF ? (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4z" />
  </svg>
) : (
  <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)}
{isExportingPDF ? "Exporting..." : "Export PDF"}
      </button>

      <button
        type="button"
        onClick={exportJSON}
        disabled={isExportingJSON}
        aria-label="Export dashboard metrics as JSON"
        className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--control)] px-4 py-2 text-sm font-medium text-[var(--card-foreground)] transition-colors hover:border-[var(--accent)] disabled:opacity-50 sm:min-w-[140px] sm:flex-none"
        suppressHydrationWarning
      >
        {isExportingJSON ? (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4z" />
  </svg>
) : (
  <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)}
{isExportingJSON ? "Exporting..." : "Export JSON"}
      </button>
    </div>
  );
}
