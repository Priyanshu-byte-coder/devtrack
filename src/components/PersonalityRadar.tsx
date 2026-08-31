"use client";

import { memo } from "react";
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
function toRadarData(report: PersonalityReport): RadarDatum[] {
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
        { metric: "Night Owl", value: nightOwlIntensity },
        { metric: "Sprint Energy", value: sprintIntensity },
        { metric: "Collaboration", value: collaborationIntensity },
        { metric: "Perfectionism", value: report.perfectionismScore },
        { metric: "Consistency", value: report.commitPattern === "Marathoner" ? 80 : 45 },
    ];
}

function PersonalityRadar({ report }: Props) {
    const data = toRadarData(report);
    const color = "var(--accent)";

    return (
        <ResponsiveContainer width="100%" height={260}>
            <RadarChart
                data={data}
                margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
                aria-label="Developer personality radar chart"
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
                    name="Score"
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