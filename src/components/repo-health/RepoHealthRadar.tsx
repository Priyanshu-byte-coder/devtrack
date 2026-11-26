"use client";

import { memo, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import type { RadarDatum } from "@/lib/repo-health-insights";

interface Props {
  data: RadarDatum[];
  grade: "green" | "yellow" | "red";
}

const GRADE_COLOR: Record<string, string> = {
  green: "var(--accent)",
  yellow: "#ca8a04",
  red: "var(--destructive)",
};

const METRIC_KEY_MAP: Record<
  string,
  "commits" | "prRate" | "prSpeed" | "issues" | "activity"
> = {
  Commits: "commits",
  "PR Rate": "prRate",
  "PR Speed": "prSpeed",
  Issues: "issues",
  Activity: "activity",
};

/**
 * Radar chart visualising the five health sub-scores, each normalised to
 * 0-100 so the axes are visually balanced regardless of their differing
 * maximum weights (25 / 25 / 20 / 15 / 15 pts).
 */
function RepoHealthRadar({ data, grade }: Props) {
  const t = useTranslations("repoHealth");
  const color = GRADE_COLOR[grade] ?? GRADE_COLOR.red;

  const localizedData = useMemo(() => {
    return data.map((d) => {
      const metricKey = METRIC_KEY_MAP[d.metric];
      return {
        ...d,
        metric: metricKey ? t(`radar.metrics.${metricKey}`) : d.metric,
      };
    });
  }, [data, t]);

  return (
    <ResponsiveContainer width="100%" height={230}>
      <RadarChart
        data={localizedData}
        margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
        aria-label={t("radar.ariaLabel")}
      >
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis
          dataKey="metric"
          tick={{
            fontSize: 12,
            fill: "var(--muted-foreground)",
          }}
        />
        <Radar
          name={t("radar.scoreLabel")}
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.18}
          strokeWidth={2}
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export default memo(RepoHealthRadar);
