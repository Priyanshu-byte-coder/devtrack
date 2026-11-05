"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, HeartPulse, X } from "lucide-react";
import ContributorStats from "./ContributorStats";
import { RepoAnalyticsResponse } from "@/lib/repo-analytics-types";
import { formatDisplayDate } from "@/lib/date-utils";
import { safeExternalHref } from "@/lib/safe-url";
import { hudLabelClass } from "@/components/ui/arcade";
import { SkeletonBlock } from "@/components/WidgetSkeleton";

interface RepoAnalyticsSheetProps {
  repoFullName: string | null;
  open: boolean;
  onClose: () => void;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-[var(--control)] p-4">
      <h4 className={`${hudLabelClass} mb-3`}>{title}</h4>
      {children}
    </section>
  );
}

function CommitTimeline({
  timeline,
}: {
  timeline: RepoAnalyticsResponse["timeline"];
}) {
  const peak = Math.max(1, ...timeline.map((t) => t.events));
  const total = timeline.reduce((sum, t) => sum + t.events, 0);
  if (total === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        No commits in the last 12 weeks.
      </p>
    );
  }
  return (
    <div>
      <div
        className="flex h-28 items-end gap-1 border-b-2 border-[var(--border)]"
        role="img"
        aria-label={`Commits per week: ${timeline
          .map((t) => `week of ${t.date} ${t.events}`)
          .join(", ")}`}
      >
        {timeline.map((t) => (
          <div
            key={t.date}
            className="flex-1 bg-[var(--accent)]"
            title={`Week of ${t.date}: ${t.events} commit${t.events === 1 ? "" : "s"}`}
            style={{
              height: `${t.events > 0 ? Math.max(6, (t.events / peak) * 100) : 2}%`,
              opacity: t.events > 0 ? 1 : 0.25,
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-[var(--muted-foreground)]">
        <span>{timeline[0]?.date}</span>
        <span>{total.toLocaleString()} commits in 12 weeks</span>
        <span>{timeline.at(-1)?.date}</span>
      </div>
    </div>
  );
}

export default function RepoAnalyticsSheet({
  repoFullName,
  open,
  onClose,
}: RepoAnalyticsSheetProps) {
  const [data, setData] = useState<RepoAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !repoFullName) return;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(
      `/api/metrics/repo-analytics?repo=${encodeURIComponent(repoFullName)}`
    )
      .then((res) => {
        if (res.status === 429)
          throw new Error(
            "GitHub is rate limiting your account right now. Try again in a few minutes."
          );
        if (!res.ok)
          throw new Error("Unable to load this repository right now.");
        return res.json();
      })
      .then((json: RepoAnalyticsResponse) => setData(json))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, repoFullName]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!shouldRender && !open) return null;

  const overview = data?.overview;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${repoFullName ?? "Repository"} analytics`}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l-4 border-[var(--border)] bg-[var(--card)] p-4 transition-transform duration-300 ease-out sm:p-6"
        style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={hudLabelClass}>Repo analytics</p>
            <h3 className="mt-1 truncate text-lg font-semibold text-[var(--card-foreground)]">
              {repoFullName ?? "Repository"}
            </h3>
            {overview?.description && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {overview.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 border-2 border-[var(--border)] p-1.5 text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {loading && (
          <div role="status" aria-busy="true" className="space-y-3">
            <span className="sr-only">Loading repository analytics</span>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <SkeletonBlock key={i} className="h-[72px]" />
              ))}
            </div>
            <SkeletonBlock className="h-40" />
            <SkeletonBlock className="h-48" />
          </div>
        )}

        {error && (
          <div className="border-2 border-red-500/40 p-4 text-sm text-[var(--card-foreground)]">
            {error}
          </div>
        )}

        {!loading && data && overview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["Stars", overview.stars, "#f2c14e"],
                  ["Forks", overview.forks, "#6ba8ff"],
                  ["Open issues", overview.openIssues, "#fb923c"],
                  ["PRs", data.prActivity?.total ?? 0, "#34d399"],
                ] as const
              ).map(([label, value, color]) => (
                <div
                  key={label}
                  className="stat-cell p-3"
                  style={{ "--stat-c": color } as CSSProperties}
                >
                  <div className={hudLabelClass}>{label}</div>
                  <div className="stat-value mt-1 text-lg">
                    {Number(value).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
              <span>{overview.license}</span>
              <span>Branch {overview.defaultBranch}</span>
              <span>Created {formatDisplayDate(overview.createdAt)}</span>
              <span>Updated {formatDisplayDate(overview.updatedAt)}</span>
            </div>

            <Panel title="Commits per week">
              {data.statsBuilding ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  GitHub is still computing this repository&apos;s stats. Check
                  back in a minute.
                </p>
              ) : (
                <CommitTimeline timeline={data.timeline} />
              )}
            </Panel>

            <div className="grid gap-4 sm:grid-cols-2">
              <Panel title="Languages">
                {data.languageBreakdown.length === 0 ? (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    No language data.
                  </p>
                ) : (
                  <>
                    <div className="flex h-3 overflow-hidden bg-[var(--card)]">
                      {data.languageBreakdown.map((l) => (
                        <div
                          key={l.name}
                          style={{
                            width: `${l.percentage}%`,
                            background: l.color,
                          }}
                          title={`${l.name} ${l.percentage}%`}
                        />
                      ))}
                    </div>
                    <ul className="mt-3 space-y-1.5 text-xs">
                      {data.languageBreakdown.slice(0, 6).map((l) => (
                        <li
                          key={l.name}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="inline-flex min-w-0 items-center gap-1.5 text-[var(--card-foreground)]">
                            <span
                              className="h-2.5 w-2.5 shrink-0"
                              style={{ background: l.color }}
                            />
                            <span className="truncate">{l.name}</span>
                          </span>
                          <span className="text-[var(--muted-foreground)]">
                            {l.percentage}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Panel>

              <Panel title="Top contributors">
                <ContributorStats
                  contributors={data.contributors.slice(0, 6)}
                />
              </Panel>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/repo-health" className="px-btn">
                <HeartPulse className="h-4 w-4" aria-hidden="true" />
                Full health check
              </Link>
              {repoFullName && (
                <a
                  href={safeExternalHref(`https://github.com/${repoFullName}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 border-2 border-[var(--border)] px-3 py-2 text-sm text-[var(--card-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Open on GitHub
                </a>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
