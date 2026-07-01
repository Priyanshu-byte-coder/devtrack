"use client";

import { Check, ChevronDown, Copy, Download, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "@/components/AccountContext";
import { signOut } from "next-auth/react";

interface WeeklySummaryData {
  commits: {
    current: number;
    previous: number;
    delta: number;
    trend: "up" | "down" | "same";
  };
  prs: {
    thisWeek: { opened: number; merged: number };
    lastWeek: { opened: number; merged: number };
  };
  issues?: {
    thisWeek: { opened: number; closed: number } | number;
    lastWeek: { opened: number; closed: number } | number;
  };
  productivityScore?: {
    current: number;
    previous: number;
  };
  activeDays: { thisWeek: number; lastWeek: number };
  streak: number;
  topRepo: string | null;
}

interface AiSummaryState {
  text: string | null;
  loading: boolean;
  error: string | null;
  rateLimitReset: Date | null;
  copied: boolean;
}

export default function WeeklySummaryCard() {
  const { selectedAccount } = useAccount();
  const [summary, setSummary] = useState<WeeklySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [githubAuthInvalid, setGithubAuthInvalid] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [ai, setAi] = useState<AiSummaryState>({
    text: null,
    loading: false,
    error: null,
    rateLimitReset: null,
    copied: false,
  });

  const maxCommits = summary?.commits
    ? Math.max(summary.commits.current, summary.commits.previous, 1)
    : 1;

  const maxPRs = summary?.prs
    ? Math.max(summary.prs.thisWeek.merged, summary.prs.lastWeek.merged, 1)
    : 1;

  const maxActiveDays = summary?.activeDays
    ? Math.max(summary.activeDays.thisWeek, summary.activeDays.lastWeek, 1)
    : 1;

  const getIssuesCount = (val: { opened: number; closed: number } | number | undefined) => {
    if (typeof val === "number") return val;
    if (val && typeof val === "object") return val.closed;
    return 0;
  };

  const issuesThisWeek = getIssuesCount(summary?.issues?.thisWeek);
  const issuesLastWeek = getIssuesCount(summary?.issues?.lastWeek);

  const maxIssues = summary?.issues
    ? Math.max(issuesThisWeek, issuesLastWeek, 1)
    : 1;

  const fetchSummary = useCallback(() => {
    setLoading(true);
    setError(null);
    setGithubAuthInvalid(false);

    const url =
      selectedAccount !== null
        ? `/api/metrics/weekly-summary?accountId=${encodeURIComponent(selectedAccount)}`
        : "/api/metrics/weekly-summary";

    fetch(url)
      .then(async (r) => {
        const data = await r.json();
        if (data?.error === "token_expired") {
          setGithubAuthInvalid(true);
          return null;
        }
        if (!r.ok) throw new Error("API error");
        return data as WeeklySummaryData;
      })
      .then((data) => {
        if (!data) return;
        setSummary(data);
      })
      .catch(() =>
        setError(
          "We couldn't load your weekly summary right now. Please try again in a moment."
        )
      )
      .finally(() => setLoading(false));
  }, [selectedAccount]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleDownload = () => {
    if (!summary) return;

    const scoreDiff = summary.productivityScore
      ? summary.productivityScore.current - summary.productivityScore.previous
      : 0;
    const scoreSign = scoreDiff >= 0 ? "+" : "";

    const reportText = `
========================================
       WEEKLY PRODUCTIVITY REPORT
========================================

Commits This Week   : ${summary.commits.current}
Commits Last Week   : ${summary.commits.previous}
Change              : ${summary.commits.trend === "up" ? "+" : summary.commits.trend === "down" ? "-" : ""}${Math.abs(summary.commits.delta)}

PRs Opened          : ${summary.prs.thisWeek.opened}
PRs Merged          : ${summary.prs.thisWeek.merged}
${summary.issues ? `\nIssues Resolved     : ${issuesThisWeek}
Issues Last Week    : ${issuesLastWeek}` : ""}

Active Days         : ${summary.activeDays.thisWeek} / 7
Current Streak      : ${summary.streak} days
Top Repository      : ${summary.topRepo ?? "-"}
${summary.productivityScore ? `\nProductivity Score  : ${summary.productivityScore.current} (${scoreSign}${scoreDiff} vs last week)` : ""}
${ai.text ? `\nAI Summary\n----------\n${ai.text}` : ""}

========================================
    `.trim();

    const blob = new Blob([reportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "weekly-summary-report.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateSummary = useCallback(() => {
    if (!summary || ai.loading) return;

    setAi((prev) => ({ ...prev, loading: true, error: null }));

    fetch("/api/ai/weekly-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commits: summary.commits,
        prs: summary.prs,
        streak: summary.streak,
        topRepo: summary.topRepo,
        activeDays: summary.activeDays,
      }),
    })
      .then(async (r) => {
        const body = await r.json();
        if (r.status === 429) {
          const resetDate = body.rateLimitReset
            ? new Date(body.rateLimitReset)
            : null;
          setAi((prev) => ({
            ...prev,
            loading: false,
            error: null,
            rateLimitReset: resetDate,
          }));
          return;
        }
        if (!r.ok) {
          setAi((prev) => ({
            ...prev,
            loading: false,
            error: body.error ?? "Failed to generate summary",
          }));
          return;
        }
        setAi((prev) => ({
          ...prev,
          loading: false,
          error: null,
          rateLimitReset: body.rateLimitReset
            ? new Date(body.rateLimitReset)
            : null,
          text: body.summary ?? null,
        }));
      })
      .catch(() => {
        setAi((prev) => ({
          ...prev,
          loading: false,
          error: "Could not reach the summary service. Please try again.",
        }));
      });
  }, [summary, ai.loading]);

  const handleCopy = useCallback(() => {
    if (!ai.text) return;
    navigator.clipboard.writeText(ai.text).then(() => {
      setAi((prev) => ({ ...prev, copied: true }));
      setTimeout(() => setAi((prev) => ({ ...prev, copied: false })), 2000);
    });
  }, [ai.text]);

  const rateLimitMessage = (() => {
    if (!ai.rateLimitReset) return null;
    const now = Date.now();
    const resetMs = ai.rateLimitReset.getTime() - now;
    if (resetMs <= 0) return null;
    const hours = Math.floor(resetMs / 3_600_000);
    const minutes = Math.floor((resetMs % 3_600_000) / 60_000);
    if (hours > 0) {
      return `Summary already generated today. Next available in ${hours}h ${minutes}m.`;
    }
    return `Summary already generated today. Next available in ${minutes}m.`;
  })();

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
          This Week
        </h2>
        <div className="flex items-center gap-2">
          {summary && !loading && !ai.text && !ai.loading && !rateLimitMessage && (
            <button
              type="button"
              onClick={handleGenerateSummary}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--control)] hover:text-[var(--card-foreground)]"
              aria-label="Generate AI summary"
              title="Generate AI summary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Summarise</span>
            </button>
          )}
          {summary && (
            <button
              type="button"
              onClick={handleDownload}
              className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--card-foreground)]"
              aria-label="Download weekly report"
              title="Download weekly report"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed((value) => !value)}
            className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--card-foreground)]"
            aria-expanded={!isCollapsed}
            aria-label={
              isCollapsed ? "Expand weekly summary" : "Collapse weekly summary"
            }
            suppressHydrationWarning
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isCollapsed &&
        (loading ? (
          <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="mt-4 space-y-3"
          >
            <span className="sr-only">Loading weekly summary</span>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                aria-hidden="true"
                className="h-20 rounded-lg bg-[var(--card-muted)] animate-pulse"
              />
            ))}
          </div>
        ) : githubAuthInvalid ? (
          <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-6 text-center space-y-3">
            <p className="text-sm text-[var(--muted-foreground)]">
              Your GitHub connection is no longer valid. Reconnect your GitHub
              account to continue syncing data.
            </p>
            <button
              type="button"
              onClick={() => {
                void signOut({ redirect: false }).then(() => {
                  window.location.href = "/api/auth/signin/github?callbackUrl=/dashboard";
                });
              }}
              className="inline-flex items-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Reconnect GitHub
            </button>
          </div>
        ) : error ? (
          <div className="mt-4 rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)]">
            {error}
          </div>
        ) : summary &&
          summary.commits &&
          summary.prs &&
          summary.activeDays ? (
          <div className="mt-4 space-y-4">
            {ai.loading && (
              <div
                role="status"
                aria-live="polite"
                aria-busy="true"
                className="flex items-center gap-2 rounded-lg bg-[var(--control)] p-4"
              >
                <Sparkles className="h-4 w-4 animate-pulse text-[var(--muted-foreground)]" />
                <span className="text-sm text-[var(--muted-foreground)]">
                  Generating summary...
                </span>
              </div>
            )}

            {ai.error && !ai.loading && (
              <div className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)]">
                {ai.error}
              </div>
            )}

            {rateLimitMessage && !ai.loading && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--control)] p-4 text-sm text-[var(--muted-foreground)]">
                {rateLimitMessage}
              </div>
            )}

            {ai.text && !ai.loading && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--control)] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Summary
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--border)] hover:text-[var(--card-foreground)]"
                    aria-label="Copy AI summary to clipboard"
                    title="Copy to clipboard"
                  >
                    {ai.copied ? (
                      <>
                        <Check className="h-3 w-3 text-[var(--success)]" />
                        <span className="text-[var(--success)]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-[var(--card-foreground)]">
                  {ai.text}
                </p>
              </div>
            )}

            {/* Commits Comparison */}
            <div className="rounded-lg bg-[var(--control)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">
                  Commits
                </span>
                <span className="text-base font-semibold text-[var(--card-foreground)]">
                  {summary.commits.current}
                  {summary.commits.trend !== "same" && (
                    <span
                      className="ml-2 text-sm font-medium"
                      style={{
                        color:
                          summary.commits.trend === "up"
                            ? "var(--success)"
                            : "var(--destructive)",
                      }}
                    >
                      {summary.commits.trend === "up" ? "+" : "-"}
                      {Math.abs(summary.commits.delta)}
                    </span>
                  )}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-16 text-xs text-[var(--muted-foreground)]">
                    Last week
                  </span>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded bg-[var(--border)]">
                      <div
                        className="h-full bg-[var(--muted-foreground)]"
                        style={{
                          width: `${((summary.commits.previous / maxCommits) * 100).toFixed(0)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 text-xs text-[var(--muted-foreground)]">
                    This week
                  </span>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded bg-[var(--border)]">
                      <div
                        className="h-full bg-[var(--success)]"
                        style={{
                          width: `${((summary.commits.current / maxCommits) * 100).toFixed(0)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PRs Comparison */}
            <div className="rounded-lg bg-[var(--control)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">
                  PRs Merged
                </span>
                <span className="text-base font-semibold text-[var(--card-foreground)]">
                  {summary.prs.thisWeek.merged}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-16 text-xs text-[var(--muted-foreground)]">
                    Last week
                  </span>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded bg-[var(--border)]">
                      <div
                        className="h-full bg-[var(--muted-foreground)]"
                        style={{
                          width: `${((summary.prs.lastWeek.merged / maxPRs) * 100).toFixed(0)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 text-xs text-[var(--muted-foreground)]">
                    This week
                  </span>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded bg-[var(--border)]">
                      <div
                        className="h-full bg-[var(--success)]"
                        style={{
                          width: `${((summary.prs.thisWeek.merged / maxPRs) * 100).toFixed(0)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Issues Resolved */}
            {summary.issues && (
              <div className="rounded-lg bg-[var(--control)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-[var(--muted-foreground)]">
                    Issues Resolved
                  </span>
                  <span className="text-base font-semibold text-[var(--card-foreground)]">
                    {issuesThisWeek}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-xs text-[var(--muted-foreground)]">
                      Last week
                    </span>
                    <div className="flex-1">
                      <div className="h-2 overflow-hidden rounded bg-[var(--border)]">
                        <div
                          className="h-full bg-[var(--muted-foreground)] opacity-50 rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${((issuesLastWeek / maxIssues) * 100).toFixed(0)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-xs text-[var(--muted-foreground)]">
                      This week
                    </span>
                    <div className="flex-1">
                      <div className="h-2 overflow-hidden rounded bg-[var(--border)]">
                        <div
                          className="h-full bg-[var(--success)]"
                          style={{
                            width: `${((issuesThisWeek / maxIssues) * 100).toFixed(0)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            )}

            {/* Active Days Comparison */}
            <div className="rounded-lg bg-[var(--control)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">
                  Active Days
                </span>
                <span className="text-base font-semibold text-[var(--card-foreground)]">
                  {summary.activeDays.thisWeek} / 7
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-16 text-xs text-[var(--muted-foreground)]">
                    Last week
                  </span>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded bg-[var(--border)]">
                      <div
                        className="h-full bg-[var(--muted-foreground)]"
                        style={{
                          width: `${((summary.activeDays.lastWeek / maxActiveDays) * 100).toFixed(0)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 text-xs text-[var(--muted-foreground)]">
                    This week
                  </span>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded bg-[var(--border)]">
                      <div
                        className="h-full bg-[var(--success)]"
                        style={{
                          width: `${((summary.activeDays.thisWeek / maxActiveDays) * 100).toFixed(0)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Productivity Score */}
            {summary.productivityScore && (
              <div className="rounded-lg bg-[var(--control)] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--muted-foreground)]">
                    Productivity Score
                  </span>
                  <span className="text-base font-semibold text-[var(--card-foreground)]">
                    {summary.productivityScore.current}
                    <span
                      className="ml-2 text-sm font-medium"
                      style={{
                        color:
                          summary.productivityScore.current >=
                          summary.productivityScore.previous
                            ? "var(--success)"
                            : "var(--destructive)",
                      }}
                    >
                      {summary.productivityScore.current >=
                      summary.productivityScore.previous
                        ? "+"
                        : ""}
                      {summary.productivityScore.current -
                        summary.productivityScore.previous}{" "}
                      vs last week
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* Streak & Top Repo */}
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-[var(--control)] p-4">
                <span className="text-sm text-[var(--muted-foreground)]">
                  Streak
                </span>
                <span className="text-base font-semibold text-[var(--card-foreground)]">
                  {summary.streak} day streak
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[var(--control)] p-4">
                <span className="text-sm text-[var(--muted-foreground)]">
                  Top repo
                </span>
                <span className="text-base font-semibold text-[var(--card-foreground)]">
                  {summary.topRepo ?? "-"}
                </span>
              </div>
            </div>
          </div>
        ) : null)}
    </div>
  );
}