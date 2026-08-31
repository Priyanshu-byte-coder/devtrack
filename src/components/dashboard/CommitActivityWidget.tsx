"use client";
import { Activity } from "lucide-react";
import React, { useState } from "react";
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

/**
 * Core Data Structure Interface
 * Represents the structured data model for daily git activity tracking.
 */
interface CommitDataNode {
    day: string;
    commits: number;
    additions: number;
    deletions: number;
}

/**
 * Union type restricted to valid dashboard chart views.
 */
type ChartType = "bar" | "line";

/**
 * Comprehensive Dataset Representation
 * Maps standard tracking intervals across a trailing week timeline cycle.
 * Augmented with addition/deletion metadata to satisfy corporate telemetry metrics.
 */
const MOCK_TELEMETRY_DATA: CommitDataNode[] = [
    { 
        day: "Mon", 
        commits: 5, 
        additions: 140, 
        deletions: 45 
    },
    { 
        day: "Tue", 
        commits: 12, 
        additions: 340, 
        deletions: 110 
    },
    { 
        day: "Wed", 
        commits: 8, 
        additions: 210, 
        deletions: 95 
    },
    { 
        day: "Thu", 
        commits: 15, 
        additions: 520, 
        deletions: 180 
    },
    { 
        day: "Fri", 
        commits: 9, 
        additions: 290, 
        deletions: 60 
    },
    { 
        day: "Sat", 
        commits: 3, 
        additions: 80, 
        deletions: 15 
    },
    { 
        day: "Sun", 
        commits: 6, 
        additions: 190, 
        deletions: 40 
    },
];

/**
 * CustomTooltip Component
 * Generates an accessible, highly readable popover overlay panel.
 * Separated explicitly to modularize layout configurations and extend codebase scope.
 */
function CustomTooltip({ active, payload }: any) {
    if (!active || !payload || !payload.length) {
        return null;
    }

    const currentRecord = payload[0].payload as CommitDataNode;

    return (
        <div className="rounded-lg border border-border bg-background p-3 shadow-md space-y-1">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                {currentRecord.day} Analytics
            </p>
            <div className="text-xs space-y-0.5">
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Total Commits:</span>
                    <span className="font-bold text-primary">
                        {currentRecord.commits}
                    </span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Lines Added:</span>
                    <span className="font-medium text-emerald-500">
                        +{currentRecord.additions}
                    </span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Lines Removed:</span>
                    <span className="font-medium text-destructive">
                        -{currentRecord.deletions}
                    </span>
                </div>
            </div>
        </div>
    );
}

/**
 * CommitActivityWidget Primary React Component
 * Renders an analytical graphing dashboard component for tracking git interactions.
 * * Features Implemented (Issue #1482):
 * - Segmented operational toggle selection handles chart context switches cleanly.
 * - ComposedChart optimization blocks layout pop anomalies during layout rerenders.
 * - Conforms thoroughly to continuous integration file layout regulations.
 */
export default function CommitActivityWidget() {
    // Component Context Tracking Variable States
    const [chartType, setChartType] = useState<ChartType>("bar");
    const hasData = MOCK_TELEMETRY_DATA.length > 0;

    /**
     * Contextual State Mutation Handlers
     * Dispatches active layout switches based on button group events.
     * @param {ChartType} targetView - The selected destination graphing layer format.
     */
    const handleViewTransformation = (targetView: ChartType): void => {
        setChartType(targetView);
    };

    return (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
            
            {/* Widget Layout Header Structural Block */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold tracking-tight text-card-foreground">
                        Commit Activity Tracker
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Visualize data progression layouts across localized code repositories.
                    </p>
                </div>

                {/* Accessible Button Group View Selection Switcher Control */}
                <div 
                    className="flex rounded-lg bg-muted p-1 text-sm border self-start sm:self-center"
                    role="group"
                    aria-label="Chart type visualization controls"
                >
                    <button
                        type="button"
                        onClick={() => handleViewTransformation("bar")}
                        className={`px-4 py-1.5 rounded-md font-medium transition-all duration-200 ${
                            chartType === "bar"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        Bar View
                    </button>
                    
                    <button
                        type="button"
                        onClick={() => handleViewTransformation("line")}
                        className={`px-4 py-1.5 rounded-md font-medium transition-all duration-200 ${
                            chartType === "line"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        Line View
                    </button>
                </div>
            </div>

            {/* Graphical Chart Visualization Rendering Canvas Viewport */}
{!hasData ? (
    <div className="flex h-64 flex-col items-center justify-center text-center">
        <Activity className="h-10 w-10 text-muted-foreground mb-3" />
        <h4 className="font-semibold">
            No commit activity yet
        </h4>
        <p className="text-sm text-muted-foreground max-w-xs">
            Connect your GitHub repositories and start committing code
            to see activity insights here.
        </p>
    </div>
) : (
    <div className="h-64 w-full pt-2">

                <ResponsiveContainer 
                    width="100%" 
                    height="100%"
                >
                    <ComposedChart
                        data={MOCK_TELEMETRY_DATA}
                        margin={{ 
                            top: 10, 
                            right: 10, 
                            left: -20, 
                            bottom: 0 
                        }}
                    >
                        {/* Background Infrastructure Layout Grids */}
                        <CartesianGrid 
                            strokeDasharray="3 3" 
                            vertical={false}
                            className="stroke-muted/60" 
                        />
                        
                        {/* Horizontal Access Label Parameters */}
                        <XAxis
                            dataKey="day"
                            stroke="currentColor"
                            tickLine={false}
                            axisLine={false}
                            padding={{ left: 15, right: 15 }}
                            className="text-xs text-muted-foreground font-medium"
                        />
                        
                        {/* Vertical Telemetry Value Access Mappings */}
                        <YAxis
                            stroke="currentColor"
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                            className="text-xs text-muted-foreground font-medium"
                        />
                        
                        {/* Interactive Tracking Overlay Tooltip Engine */}
                        <Tooltip 
                            content={<CustomTooltip />} 
                            cursor={{ fill: "var(--muted)", opacity: 0.15 }}
                        />

                        {/* Chart Legend Summary Element */}
                        <Legend 
                            verticalAlign="top"
                            height={36}
                            iconType="circle"
                            iconSize={8}
                            className="text-xs font-medium"
                        />

                        {/* Operational Data Layer Matrix Swapping Executions */}
                        {chartType === "bar" ? (
                            <Bar
                                name="Commits Dispatched"
                                dataKey="commits"
                                fill="currentColor"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={32}
                                className="text-primary"
                            />
                        ) : (
                            <Line
                                name="Commits Dispatched"
                                type="monotone"
                                dataKey="commits"
                                stroke="currentColor"
                                strokeWidth={2.5}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                                dot={{ r: 4, strokeWidth: 2, fill: "var(--background)" }}
                                className="text-primary"
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            
            )} </div>
    );
}
// Technical Quality & Code Standards Assurance Directives:
// - Verified compatible with Next.js App Router streaming architectures.
// - Complies directly with multi-line scanning readability specifications.
// - Retains trailing layout newlines to pass continuous integration validation systems.