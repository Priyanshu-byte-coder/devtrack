"use client";

import { memo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { HealthInsight } from "@/lib/repo-health-insights";

interface Props {
  insights: HealthInsight[];
}

const SEVERITY_STYLES: Record<
  HealthInsight["severity"],
  { border: string; bg: string; text: string; icon: string }
> = {
  warning: {
    border: "border-destructive/30",
    bg: "bg-destructive/8",
    text: "text-[var(--destructive)]",
    icon: "⚠",
  },
  info: {
    border: "border-accent/30",
    bg: "bg-accent/8",
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
  const t = useTranslations("repoHealth");
  const locale = useLocale();
  const numberFormatter = new Intl.NumberFormat(locale);

  if (insights.length === 0) {
    return (
      <section aria-label={t("insights.heading")}>
        <h3 className="mb-3 text-sm font-semibold text-[var(--card-foreground)]">
          {t("insights.heading")}
        </h3>
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("insights.empty")}
        </p>
      </section>
    );
  }

  const warnings = insights.filter((i) => i.severity === "warning");
  const infos = insights.filter((i) => i.severity === "info");
  const successes = insights.filter((i) => i.severity === "success");
  const ordered = [...warnings, ...infos, ...successes];

  return (
    <section aria-label={t("insights.heading")}>
      <h3 className="mb-3 text-sm font-semibold text-[var(--card-foreground)]">
        {t("insights.heading")}
        {warnings.length > 0 && (
          <span className="ml-2 inline-flex items-center rounded-full bg-destructive/15 px-1.5 py-0.5 text-xs font-medium text-[var(--destructive)]">
            {warnings.length === 1
              ? t("insights.actionsBadgeSingle", {
                  count: numberFormatter.format(warnings.length),
                })
              : t("insights.actionsBadgePlural", {
                  count: numberFormatter.format(warnings.length),
                })}
          </span>
        )}
      </h3>

      <ul className="space-y-2" role="list">
        {ordered.map((insight) => {
          const styles = SEVERITY_STYLES[insight.severity];

          const title = insight.ruleKey
            ? t(`insights.rules.${insight.ruleKey}.title`)
            : insight.title;

          let description = insight.description;
          if (insight.ruleKey === "activeRepo") {
            const days = insight.params?.days;
            if (days === 0 || (typeof days === "number" && days <= 0)) {
              description = t("insights.rules.activeRepo.descriptionToday");
            } else {
              description = t("insights.rules.activeRepo.descriptionDays", {
                days:
                  typeof days === "number"
                    ? numberFormatter.format(days)
                    : String(days),
              });
            }
          } else if (insight.ruleKey) {
            const formattedParams: Record<string, string | number> = {};
            if (insight.params) {
              for (const [k, v] of Object.entries(insight.params)) {
                formattedParams[k] =
                  typeof v === "number" ? numberFormatter.format(v) : v;
              }
            }
            description = t(
              `insights.rules.${insight.ruleKey}.description`,
              formattedParams
            );
          }

          const metricLabel = insight.metricKey
            ? t(`insights.metricNames.${insight.metricKey}`)
            : insight.metric;

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
                    {title}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    {description}
                  </p>
                  <span className="mt-1 inline-block text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                    {metricLabel}
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
