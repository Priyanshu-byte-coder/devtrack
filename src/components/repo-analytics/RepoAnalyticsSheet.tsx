"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import Link from "@/components/Link";
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
  const t = useTranslations("repositories");
  const peak = Math.max(1, ...timeline.map((t) => t.events));
  const total = timeline.reduce((sum, t) => sum + t.events, 0);
  if (total === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        {t("analyticsSheet.noCommits")}
      </p>
    );
  }
  return (
    <div>
      <div
        className="flex h-28 items-end gap-1 border-b-2 border-[var(--border)]"
        role="img"
        aria-label={t("analyticsSheet.timelineAria", {
          entries: timeline
            .map((entry) =>
              t("analyticsSheet.timelineEntry", {
                date: entry.date,
                count: entry.events,
              })
            )
            .join(", "),
        })}
      >
        {timeline.map((entry) => (
          <div
            key={entry.date}
            className="flex-1 bg-[var(--accent)]"
            title={t("analyticsSheet.weekTitle", {
              date: entry.date,
              count: entry.events,
            })}
            style={{
              height: `${entry.events > 0 ? Math.max(6, (entry.events / peak) * 100) : 2}%`,
              opacity: entry.events > 0 ? 1 : 0.25,
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-[var(--muted-foreground)]">
        <span>{timeline[0]?.date}</span>
        <span>{t("analyticsSheet.commitsIn12Weeks", { count: total })}</span>
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
  const t = useTranslations("repositories");
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
          throw new Error(t("analyticsSheet.rateLimitError"));
        if (!res.ok) throw new Error(t("analyticsSheet.loadError"));
        return res.json();
      })
      .then((json: RepoAnalyticsResponse) => setData(json))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, repoFullName, t]);

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
        aria-label={t("analyticsSheet.sheetAria", {
          name: repoFullName ?? t("analyticsSheet.repository"),
        })}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l-4 border-[var(--border)] bg-[var(--card)] p-4 transition-transform duration-300 ease-out sm:p-6"
        style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={hudLabelClass}>{t("analyticsSheet.title")}</p>
            <h3 className="mt-1 truncate text-lg font-semibold text-[var(--card-foreground)]">
              {repoFullName ?? t("analyticsSheet.repository")}
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
            aria-label={t("analyticsSheet.close")}
            className="shrink-0 border-2 border-[var(--border)] p-1.5 text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {loading && (
          <div role="status" aria-busy="true" className="space-y-3">
            <span className="sr-only">{t("analyticsSheet.loading")}</span>
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
                  {
                    id: "stars",
                    label: t("analyticsSheet.stars"),
                    value: overview.stars,
                    color: "#f2c14e",
                  },
                  {
                    id: "forks",
                    label: t("analyticsSheet.forks"),
                    value: overview.forks,
                    color: "#6ba8ff",
                  },
                  {
                    id: "openIssues",
                    label: t("analyticsSheet.openIssues"),
                    value: overview.openIssues,
                    color: "#fb923c",
                  },
                  {
                    id: "prs",
                    label: t("analyticsSheet.prs"),
                    value: data.prActivity?.total ?? 0,
                    color: "#34d399",
                  },
                ] as const
              ).map(({ id, label, value, color }) => (
                <div
                  key={id}
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
              <span>
                {t("analyticsSheet.branch", {
                  branch: overview.defaultBranch,
                })}
              </span>
              <span>
                {t("analyticsSheet.created", {
                  date: formatDisplayDate(overview.createdAt),
                })}
              </span>
              <span>
                {t("analyticsSheet.updated", {
                  date: formatDisplayDate(overview.updatedAt),
                })}
              </span>
            </div>

            <Panel title={t("analyticsSheet.commitsPerWeek")}>
              {data.statsBuilding ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  {t("analyticsSheet.statsBuilding")}
                </p>
              ) : (
                <CommitTimeline timeline={data.timeline} />
              )}
            </Panel>

            <div className="grid gap-4 sm:grid-cols-2">
              <Panel title={t("analyticsSheet.languages")}>
                {data.languageBreakdown.length === 0 ? (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {t("analyticsSheet.noLanguageData")}
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

              <Panel title={t("analyticsSheet.topContributors")}>
                <ContributorStats
                  contributors={data.contributors.slice(0, 6)}
                />
              </Panel>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/repo-health" className="px-btn">
                <HeartPulse className="h-4 w-4" aria-hidden="true" />
                {t("analyticsSheet.fullHealthCheck")}
              </Link>
              {repoFullName && (
                <a
                  href={safeExternalHref(`https://github.com/${repoFullName}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 border-2 border-[var(--border)] px-3 py-2 text-sm text-[var(--card-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {t("analyticsSheet.openOnGitHub")}
                </a>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
