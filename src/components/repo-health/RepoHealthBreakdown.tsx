"use client";

import { memo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { BreakdownRow } from "@/lib/repo-health-insights";

interface Props {
  rows: BreakdownRow[];
}

function ScoreBar({ pct }: { pct: number }) {
  const color =
    pct >= 70
      ? "bg-[var(--accent)]"
      : pct >= 40
        ? "bg-[#ca8a04]"
        : "bg-[var(--destructive)]";

  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * Tabular breakdown of the five health-score dimensions.
 *
 * Each row shows:
 *   – Metric label
 *   – Raw signal value (formatted)
 *   – Earned / max score
 *   – Progress bar proportional to earned / max
 *   – Weight contribution to the 100-point total
 *   – Tooltip with target description
 */
function RepoHealthBreakdown({ rows }: Props) {
  const t = useTranslations("repoHealth");
  const locale = useLocale();
  const numberFormatter = new Intl.NumberFormat(locale);

  const getLocalizedRawValue = (row: BreakdownRow): string => {
    if (!row.key || row.rawSignal === undefined) return row.rawValue;
    switch (row.key) {
      case "commitFrequency": {
        const count = row.rawSignal;
        const formatted = numberFormatter.format(count);
        return t(
          count === 1
            ? "breakdown.metrics.commitFrequency.rawSingular"
            : "breakdown.metrics.commitFrequency.rawPlural",
          { count: formatted }
        );
      }
      case "prMergeRate": {
        const pctVal = Math.round(row.rawSignal * 100);
        return `${numberFormatter.format(pctVal)}%`;
      }
      case "prTurnaround": {
        const hours = row.rawSignal;
        if (hours === 0) {
          return t("breakdown.metrics.prTurnaround.noPrs");
        }
        return t("breakdown.metrics.prTurnaround.hoursAvg", {
          hours: numberFormatter.format(Math.round(hours)),
        });
      }
      case "openIssues": {
        const count = row.rawSignal;
        const formatted = numberFormatter.format(count);
        return t(
          count === 1
            ? "breakdown.metrics.openIssues.rawSingular"
            : "breakdown.metrics.openIssues.rawPlural",
          { count: formatted }
        );
      }
      case "recentActivity": {
        const days = row.rawSignal;
        if (days >= 9999) {
          return t("breakdown.metrics.recentActivity.unknown");
        }
        if (days === 0) {
          return t("breakdown.metrics.recentActivity.today");
        }
        return t("breakdown.metrics.recentActivity.daysAgo", {
          days: numberFormatter.format(days),
        });
      }
      default:
        return row.rawValue;
    }
  };

  return (
    <section aria-label={t("breakdown.sectionAria")}>
      <h3 className="mb-3 text-sm font-semibold text-[var(--card-foreground)]">
        {t("breakdown.heading")}
      </h3>

      <div className="space-y-4">
        {rows.map((row) => {
          const pct = Math.round((row.earned / row.maxScore) * 100);
          const localizedLabel = row.key
            ? t(`breakdown.metrics.${row.key}.label`)
            : row.label;
          const localizedTip = row.key
            ? t(`breakdown.metrics.${row.key}.tip`)
            : row.tip;
          const localizedRawValue = getLocalizedRawValue(row);
          const formattedEarned = numberFormatter.format(row.earned);
          const formattedMaxScore = numberFormatter.format(row.maxScore);
          const formattedWeightPct = numberFormatter.format(row.weightPct);

          return (
            <div key={row.key ?? row.label}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                {/* Metric name + tooltip */}
                <span
                  className="font-medium text-[var(--card-foreground)] cursor-help"
                  title={localizedTip}
                >
                  {localizedLabel}
                </span>

                <span className="shrink-0 flex items-center gap-2 tabular-nums text-[var(--muted-foreground)]">
                  {/* Raw signal value */}
                  <span
                    className="rounded bg-[var(--control)] px-1.5 py-0.5 font-mono"
                    aria-label={t("breakdown.measuredValueAria", {
                      value: localizedRawValue,
                    })}
                  >
                    {localizedRawValue}
                  </span>

                  {/* Earned / max */}
                  <span
                    aria-label={t("breakdown.pointsAria", {
                      earned: formattedEarned,
                      max: formattedMaxScore,
                    })}
                  >
                    <span className="font-semibold text-[var(--card-foreground)]">
                      {formattedEarned}
                    </span>
                    <span>/{formattedMaxScore}</span>
                    <span className="ml-1 text-muted-foreground/70">
                      ({formattedWeightPct}%)
                    </span>
                  </span>
                </span>
              </div>

              <ScoreBar pct={pct} />
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
        {t("breakdown.footer")}
      </p>
    </section>
  );
}

export default memo(RepoHealthBreakdown);
