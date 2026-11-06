"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  ExternalLink,
  GitMerge,
  GitPullRequest,
  RefreshCw,
} from "lucide-react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useAccount } from "@/components/AccountContext";
import { SkeletonBlock } from "./WidgetSkeleton";
import { safeExternalHref } from "@/lib/safe-url";
import {
  arcadeTabClass,
  arcadeTabGroupClass,
  hudLabelClass,
} from "@/components/ui/arcade";
import type { PullRequestRange, PullRequestSummary } from "@/lib/pull-requests";

const OPENED = "#6ba8ff";
const MERGED = "#34d399";
const CLOSED = "#94a3b8";
const STALE = "#fb923c";
const REVIEW_COLORS = {
  approved: "#34d399",
  changesRequested: "#fb923c",
  commented: "#c77dff",
};

/** Hours as the shortest readable duration: "<1h", "5h", "2.5d". */
export function formatDuration(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return "—";
  if (hours < 1) return "<1h";
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
}

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function weekLabel(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function Panel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 bg-[var(--control)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className={hudLabelClass}>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function StatTile({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color: string;
}) {
  return (
    <div
      className="stat-cell min-w-0 p-3 sm:p-4"
      style={{ "--stat-c": color } as CSSProperties}
      title={hint}
    >
      <div className={hudLabelClass}>{label}</div>
      <div className="stat-value mt-2 truncate text-lg sm:text-xl">{value}</div>
      {hint && (
        <div className="mt-1 truncate text-[11px] text-[var(--muted-foreground)]">
          {hint}
        </div>
      )}
    </div>
  );
}

function WeeklyChart({ weeks }: { weeks: PullRequestSummary["weeks"] }) {
  const peak = Math.max(1, ...weeks.flatMap((w) => [w.opened, w.merged]));
  return (
    <div>
      <div
        className="flex h-32 items-end gap-1.5 border-b-2 border-[var(--border)] sm:gap-3"
        role="img"
        aria-label={`PRs opened and merged per week: ${weeks
          .map(
            (w) =>
              `${weekLabel(w.weekStart)} ${w.opened} opened, ${w.merged} merged`
          )
          .join("; ")}`}
      >
        {weeks.map((w) => (
          <div
            key={w.weekStart}
            className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5 sm:gap-1"
            title={`Week of ${weekLabel(w.weekStart)}: ${w.opened} opened, ${w.merged} merged`}
          >
            {[
              [w.opened, OPENED],
              [w.merged, MERGED],
            ].map(([count, color], i) => (
              <div
                key={i}
                className="w-full max-w-4 transition-[height] duration-500"
                style={{
                  height: `${Math.max(Number(count) > 0 ? 6 : 2, (Number(count) / peak) * 100)}%`,
                  background:
                    Number(count) > 0
                      ? String(color)
                      : "color-mix(in srgb, var(--border) 70%, transparent)",
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 sm:gap-3">
        {weeks.map((w, i) => (
          <div
            key={w.weekStart}
            className="min-w-0 flex-1 truncate text-center text-[10px] text-[var(--muted-foreground)]"
          >
            {/* Every label on short ranges; every other one on 90 days. */}
            {weeks.length <= 6 || i % 2 === 0 ? weekLabel(w.weekStart) : ""}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-[var(--muted-foreground)]">
        {[
          ["Opened", OPENED],
          ["Merged", MERGED],
        ].map(([label, color]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
      {children}
    </p>
  );
}

export default function PRMetrics() {
  const { selectedAccount } = useAccount();
  const [summary, setSummary] = useState<PullRequestSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = usePersistentState<PullRequestRange>(
    "devtrack:pr-metrics:range",
    "30d"
  );
  const [staleDays, setStaleDays] = usePersistentState(
    "devtrack:pr-metrics:staleThreshold",
    14
  );

  const load = useCallback(
    (refresh = false) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ range });
      if (selectedAccount !== null) params.set("accountId", selectedAccount);
      fetch(`/api/metrics/prs?${params}`, {
        headers: refresh ? { "x-devtrack-cache-bypass": "1" } : undefined,
      })
        .then(async (r) => {
          if (r.status === 429)
            throw new Error(
              "GitHub is rate limiting your account right now. Try again in a few minutes."
            );
          if (!r.ok) throw new Error("We couldn't load your pull requests.");
          return r.json();
        })
        .then((data: { summary?: PullRequestSummary }) => {
          if (!data.summary)
            throw new Error("We couldn't load your pull requests.");
          setSummary(data.summary);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    },
    [range, selectedAccount]
  );

  useEffect(() => load(), [load]);

  const s = summary;
  const reviewTotal = s
    ? s.reviews.approved + s.reviews.changesRequested + s.reviews.commented
    : 0;
  const repoPeak = s ? Math.max(1, ...s.repos.map((r) => r.opened)) : 1;

  return (
    <div className="px-frame space-y-5 bg-[var(--card)] p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]">
            Your pull requests
          </h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            PRs you opened in the last {range.replace("d", " days")}, plus
            everything still open.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={arcadeTabGroupClass}
            role="group"
            aria-label="Time range"
          >
            {(["7d", "30d", "90d"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                aria-pressed={range === option}
                className={arcadeTabClass(range === option)}
              >
                {option}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            aria-label="Refresh pull requests"
            className="p-2 text-[var(--muted-foreground)] hover:bg-[var(--control)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {loading && !s ? (
        <div role="status" aria-busy="true" className="space-y-4">
          <span className="sr-only">Loading pull requests</span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonBlock key={i} className="h-[92px]" />
            ))}
          </div>
          <SkeletonBlock className="h-48" />
          <div className="grid gap-4 lg:grid-cols-2">
            <SkeletonBlock className="h-56" />
            <SkeletonBlock className="h-56" />
          </div>
        </div>
      ) : error && !s ? (
        <div className="border-2 border-red-500/40 p-4 text-sm">
          <p className="text-[var(--card-foreground)]">{error}</p>
          <button type="button" onClick={() => load()} className="px-btn mt-3">
            Try again
          </button>
        </div>
      ) : s ? (
        <div
          className={`space-y-4 ${loading ? "opacity-60" : ""}`}
          aria-busy={loading}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatTile
              label="Opened"
              value={String(s.opened)}
              color={OPENED}
              hint={s.sampled ? "Latest 100 in range" : undefined}
            />
            <StatTile
              label="Merged"
              value={String(s.merged)}
              color={MERGED}
              hint={s.closed ? `${s.closed} closed unmerged` : undefined}
            />
            <StatTile
              label="Merge rate"
              value={
                s.mergeRate === null ? "—" : `${Math.round(s.mergeRate * 100)}%`
              }
              color="#c77dff"
              hint="Of PRs merged or closed"
            />
            <StatTile
              label="Time to merge"
              value={formatDuration(s.medianHoursToMerge)}
              color="#22d3ee"
              hint="Median"
            />
            <StatTile
              label="First review"
              value={formatDuration(s.medianHoursToFirstReview)}
              color="#f2c14e"
              hint="Median, by others"
            />
            <StatTile
              label="Lines"
              value={`+${s.additions.toLocaleString()}`}
              color={STALE}
              hint={`−${s.deletions.toLocaleString()} removed`}
            />
          </div>

          <Panel title="Weekly activity">
            {s.opened === 0 ? (
              <Empty>No pull requests in this range yet.</Empty>
            ) : (
              <WeeklyChart weeks={s.weeks} />
            )}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title={`Open now · ${s.openNow}${s.draftsNow ? ` (${s.draftsNow} draft)` : ""}`}
              aside={
                <label className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                  Stale after
                  <select
                    value={staleDays}
                    onChange={(e) => setStaleDays(Number(e.target.value))}
                    className="border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-[11px] text-[var(--foreground)]"
                  >
                    {[7, 14, 30].map((d) => (
                      <option key={d} value={d}>
                        {d} days
                      </option>
                    ))}
                  </select>
                </label>
              }
            >
              {s.openList.length === 0 ? (
                <Empty>Nothing open. Clean slate.</Empty>
              ) : (
                <ul className="space-y-1.5">
                  {s.openList.map((p) => {
                    const stale = p.ageDays >= staleDays;
                    return (
                      <li key={p.url}>
                        <a
                          href={safeExternalHref(p.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-3 bg-[var(--card)] px-3 py-2 hover:outline hover:outline-2 hover:outline-[var(--border)]"
                        >
                          <GitPullRequest
                            className="h-4 w-4 shrink-0"
                            style={{ color: p.isDraft ? CLOSED : OPENED }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-[var(--card-foreground)] group-hover:text-[var(--accent)]">
                              {p.title}
                            </span>
                            <span className="block truncate text-[11px] text-[var(--muted-foreground)]">
                              {p.repo} #{p.number}
                              {p.isDraft
                                ? " · draft"
                                : p.reviewed
                                  ? " · reviewed"
                                  : " · awaiting review"}
                            </span>
                          </span>
                          <span
                            className="shrink-0 font-pixel text-[10px] uppercase"
                            style={{
                              color: stale ? STALE : "var(--muted-foreground)",
                            }}
                            title={
                              stale
                                ? `Open longer than ${staleDays} days`
                                : undefined
                            }
                          >
                            {p.ageDays}d{stale ? " ⚠" : ""}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel title="Recently merged">
              {s.recentMerged.length === 0 ? (
                <Empty>No merges in this range yet.</Empty>
              ) : (
                <ul className="space-y-1.5">
                  {s.recentMerged.map((p) => (
                    <li key={p.url}>
                      <a
                        href={safeExternalHref(p.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 bg-[var(--card)] px-3 py-2 hover:outline hover:outline-2 hover:outline-[var(--border)]"
                      >
                        <GitMerge
                          className="h-4 w-4 shrink-0"
                          style={{ color: MERGED }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-[var(--card-foreground)] group-hover:text-[var(--accent)]">
                            {p.title}
                          </span>
                          <span className="block truncate text-[11px] text-[var(--muted-foreground)]">
                            {p.repo} #{p.number} · {timeAgo(p.mergedAt)}
                          </span>
                        </span>
                        <span
                          className="shrink-0 font-pixel text-[10px] uppercase text-[var(--muted-foreground)]"
                          title="Time from opening to merge"
                        >
                          {formatDuration(p.hoursToMerge)}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Where you ship">
              {s.repos.length === 0 ? (
                <Empty>No repositories in this range.</Empty>
              ) : (
                <ul className="space-y-3">
                  {s.repos.map((r) => (
                    <li key={r.repo}>
                      <div className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="truncate text-[var(--card-foreground)]">
                          {r.repo}
                        </span>
                        <span className="shrink-0 text-[var(--muted-foreground)]">
                          {r.merged}/{r.opened} merged
                        </span>
                      </div>
                      <div className="mt-1 h-2.5 bg-[var(--card)]">
                        <div
                          className="relative h-full"
                          style={{
                            width: `${(r.opened / repoPeak) * 100}%`,
                            background: OPENED,
                          }}
                        >
                          <div
                            className="absolute inset-y-0 left-0"
                            style={{
                              width: `${(r.merged / r.opened) * 100}%`,
                              background: MERGED,
                            }}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title={`Reviews you gave · last ${range.replace("d", " days")}`}
            >
              {s.reviews.total === 0 ? (
                <Empty>
                  No reviews yet. Reviewing PRs boosts your DevTrack score.
                </Empty>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="stat-value text-3xl">
                        {s.reviews.total}
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        reviews submitted
                      </div>
                    </div>
                  </div>
                  {reviewTotal > 0 && (
                    <div>
                      <div className="flex h-3 overflow-hidden bg-[var(--card)]">
                        {(
                          ["approved", "changesRequested", "commented"] as const
                        ).map((k) =>
                          s.reviews[k] > 0 ? (
                            <div
                              key={k}
                              style={{
                                width: `${(s.reviews[k] / reviewTotal) * 100}%`,
                                background: REVIEW_COLORS[k],
                              }}
                            />
                          ) : null
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
                        {(
                          [
                            ["approved", "Approved"],
                            ["changesRequested", "Changes requested"],
                            ["commented", "Commented"],
                          ] as const
                        ).map(([k, label]) => (
                          <span
                            key={k}
                            className="inline-flex items-center gap-1.5"
                          >
                            <span
                              className="h-2.5 w-2.5"
                              style={{ background: REVIEW_COLORS[k] }}
                            />
                            {label} {s.reviews[k]}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {s.reviews.topRepos.length > 0 && (
                    <ul className="space-y-1 text-xs">
                      {s.reviews.topRepos.map((r) => (
                        <li key={r.repo} className="flex justify-between gap-3">
                          <a
                            href={safeExternalHref(
                              `https://github.com/${r.repo}`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-w-0 items-center gap-1 truncate text-[var(--card-foreground)] hover:text-[var(--accent)]"
                          >
                            <span className="truncate">{r.repo}</span>
                            <ExternalLink
                              className="h-3 w-3 shrink-0 opacity-60"
                              aria-hidden="true"
                            />
                          </a>
                          <span className="shrink-0 text-[var(--muted-foreground)]">
                            {r.count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Panel>
          </div>
        </div>
      ) : null}
    </div>
  );
}
