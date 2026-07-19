"use client";

import { memo } from "react";
import type { HealthInsight } from "@/lib/repo-health-insights";

interface Props {
  insights: HealthInsight[];
}

const SEVERITY_STYLES: Record<
  HealthInsight["severity"],
  { border: string; bg: string; text: string; icon: string }
> = {
  warning: {
    border: "border-[var(--destructive)]/30",
    bg: "bg-[var(--destructive)]/8",
    text: "text-[var(--destructive)]",
    icon: "⚠",
  },
  info: {
    border: "border-[var(--accent)]/30",
    bg: "bg-[var(--accent)]/8",
    text: "text-[var(--accent)]",
    icon: "ℹ",
  },
  success: {
    border: "border-[var(--success,#16a34a)]/30",
    bg: "bg-[var(--success,#16a34a)]/8",
    text: "text-[var(--success,#16a34a)]",
    icon: "✓",
  },
};

/**
 * Rule-based recommendations panel.
 *
 * Each `HealthInsight` is rendered as a bordered card colour-coded by
 * severity.  The insights themselves are produced by `generateInsights()` in
 * `@/lib/repo-health-insights` and are fully data-driven.
 */
function RepoHealthInsights({ insights }: Props) {
  if (insights.length === 0) {
    return (
      <section aria-label="Recommendations">
        <h3 className="mb-3 text-sm font-semibold text-[var(--card-foreground)]">
          Recommendations
        </h3>
        <p className="text-sm text-[var(--muted-foreground)]">
          No recommendations at this time — all metrics look good.
        </p>
      </section>
    );
  }

  const warnings = insights.filter((i) => i.severity === "warning");
  const infos = insights.filter((i) => i.severity === "info");
  const successes = insights.filter((i) => i.severity === "success");
  const ordered = [...warnings, ...infos, ...successes];

  return (
    <section aria-label="Recommendations">
      <h3 className="mb-3 text-sm font-semibold text-[var(--card-foreground)]">
        Recommendations
        {warnings.length > 0 && (
          <span className="ml-2 inline-flex items-center rounded-full bg-[var(--destructive)]/15 px-1.5 py-0.5 text-xs font-medium text-[var(--destructive)]">
            {warnings.length} action{warnings.length !== 1 ? "s" : ""}
          </span>
        )}
      </h3>

      <ul className="space-y-2" role="list">
        {ordered.map((insight) => {
          const styles = SEVERITY_STYLES[insight.severity];
          return (
            <li
              key={insight.id}
              className={`rounded-lg border px-3 py-2.5 ${styles.border} ${styles.bg}`}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`mt-px shrink-0 text-sm leading-none ${styles.text}`}
                  aria-hidden="true"
                >
                  {styles.icon}
                </span>
                <div>
                  <p className={`text-xs font-semibold ${styles.text}`}>
                    {insight.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    {insight.description}
                  </p>
                  <span className="mt-1 inline-block text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]/70">
                    {insight.metric}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default memo(RepoHealthInsights);
