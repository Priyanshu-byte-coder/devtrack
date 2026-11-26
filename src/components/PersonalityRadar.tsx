"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    ResponsiveContainer,
} from "recharts";
import type { PersonalityReport } from "@/lib/personality-analysis";

interface Props {
    report: PersonalityReport;
}

interface RadarDatum {
    metric: string;
    value: number;
}

/**
 * Translates the personality dimensions into five 0-100 axes so they sit
 * on a single radar chart. Categorical dimensions (working style, commit
 * pattern, collaboration style) are mapped to a representative intensity
 * score rather than plotted as raw enums.
 */
function toRadarData(report: PersonalityReport, t: (key: string) => string): RadarDatum[] {
    const nightOwlIntensity =
        report.workingStyle === "Night Owl"
            ? Math.max(report.nightCommitPct, 60)
            : report.workingStyle === "Early Bird"
                ? 100 - Math.max(report.morningCommitPct, 60)
                : 50;

    const sprintIntensity = report.commitPattern === "Sprinter" ? 80 : 35;

    const collaborationIntensity =
        report.collaborationStyle === "Open Source Hero"
            ? 90
            : report.collaborationStyle === "Team Player"
                ? 60
                : 25;

    return [
        { metric: t("radar.metrics.nightOwl"), value: nightOwlIntensity },
        { metric: t("radar.metrics.sprintEnergy"), value: sprintIntensity },
        { metric: t("radar.metrics.collaboration"), value: collaborationIntensity },
        { metric: t("radar.metrics.perfectionism"), value: report.perfectionismScore },
        { metric: t("radar.metrics.consistency"), value: report.commitPattern === "Marathoner" ? 80 : 45 },
    ];
}

function PersonalityRadar({ report }: Props) {
    const t = useTranslations("personality");
    const data = toRadarData(report, t);
    const color = "var(--accent)";

    return (
        <ResponsiveContainer width="100%" height={260}>
            <RadarChart
                data={data}
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
                    fillOpacity={0.2}
                    strokeWidth={2}
                    dot={{ r: 3, fill: color, strokeWidth: 0 }}
                />
            </RadarChart>
        </ResponsiveContainer>
    );
}

export default memo(PersonalityRadar);
