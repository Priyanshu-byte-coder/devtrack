"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@/components/AccountContext";
import { useDashboardWidgetA11y } from "@/components/dashboard/DashboardWidgetA11yContext";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { SkeletonBlock } from "./WidgetSkeleton";

interface Language {
  name: string;
  bytes: number;
  percentage: number;
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f7df1e",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  CSS: "#563d7c",
  HTML: "#e34c26",
  Ruby: "#701516",
  Shell: "#89e051",
  Swift: "#F05138",
  Kotlin: "#7F52FF",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  PHP: "#4F5D95",
  Dart: "#00B4AB",
  Scala: "#c22d40",
  Vue: "#41b883",
  Other: "#6b7280",
};

const FALLBACK_COLOR = "#6b7280";

function getColor(name: string): string {
  return LANG_COLORS[name] ?? FALLBACK_COLOR;
}

function LanguageTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  if (!entry) return null;
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--tooltip)] px-3 py-2 text-sm text-[var(--tooltip-foreground)] shadow-lg">
      <div className="font-medium">{entry.name}</div>
      <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">
        {entry.value}%
      </div>
    </div>
  );
}

export default function LanguageBreakdown() {
  const { selectedAccount } = useAccount();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setSummary, setIsUpdating } = useDashboardWidgetA11y("language-breakdown");

  useEffect(() => {
    setIsUpdating(loading);
  }, [loading, setIsUpdating]);

  useEffect(() => {
    if (languages.length === 0) {
      setSummary(null);
      return;
    }
    const top = languages[0];
    setSummary(
      `Top language: ${top.name}, ${top.percentage}%. ${languages.length} language${languages.length === 1 ? "" : "s"} tracked.`,
    );
  }, [languages, setSummary]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const url =
      selectedAccount !== null
        ? `/api/metrics/languages?accountId=${encodeURIComponent(selectedAccount)}`
        : "/api/metrics/languages";
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("API error");
        return r.json();
      })
      .then((d: { languages: Language[] }) => setLanguages(d.languages ?? []))
      .catch(() => {
        setError("Failed to load language statistics. Please try again later.");
      })
      .finally(() => setLoading(false));
  }, [selectedAccount]);

  const MAX_DISPLAY = 6;

  // Step 1: merge languages whose share is < 1% into an "Others" bucket.
  // Step 2: cap named languages at MAX_DISPLAY; anything beyond that rank
  // also collapses into "Others". This prevents the legend from growing
  // unboundedly and overflowing the card when a user has 10+ languages.
  const { named, othersBytes, othersPercentage } = languages.reduce<{
    named: Language[];
    othersBytes: number;
    othersPercentage: number;
  }>(
    (acc, lang, idx) => {
      if (lang.percentage < 1 || idx >= MAX_DISPLAY) {
        acc.othersBytes += lang.bytes;
        acc.othersPercentage += lang.percentage;
      } else {
        acc.named.push(lang);
      }
      return acc;
    },
    { named: [], othersBytes: 0, othersPercentage: 0 }
  );

  // Absorb any rounding remainder so the donut stays visually complete.
  const namedTotal = named.reduce((s, l) => s + l.percentage, 0);
  const remainder = 100 - namedTotal - othersPercentage;
  const finalOthersPct =
    Math.round((othersPercentage + Math.max(remainder, 0)) * 10) / 10;

  const chartData: Language[] = [...named];
  if (finalOthersPct > 0 || othersBytes > 0) {
    chartData.push({
      name: "Others",
      bytes: othersBytes,
      percentage: finalOthersPct,
    });
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <h2 className="text-lg font-semibold text-[var(--card-foreground)] mb-4">
        Language Breakdown
      </h2>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="space-y-3"
        >
          <span className="sr-only">Loading language breakdown</span>
          <SkeletonBlock className="mx-auto h-[180px] w-[180px] rounded-full" />
          <div
            aria-hidden="true"
            className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3"
          >
            {[1, 2, 3, 4].map((i) => (
              <SkeletonBlock key={i} className="h-5 rounded" />
            ))}
          </div>
        </div>
      ) : error ? (
        <p className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)]">
          {error}
        </p>
      ) : languages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 text-4xl">🧩</div>

          <h3 className="text-sm font-semibold text-[var(--card-foreground)]">
            No language data available
          </h3>

          <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">
            Start committing code to repositories and we&apos;ll analyze the language distribution across your projects.
          </p>

          <a
            href="https://github.com/new"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--control)]"
          >
            Create Repository
          </a>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
          {/* Donut chart */}
          <div
            className="relative shrink-0"
            role="img"
            aria-label="Donut chart showing language distribution"
          >
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="percentage"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                  strokeWidth={0}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={getColor(entry.name)}
                      opacity={0.9}
                    />
                  ))}
                </Pie>
                <Tooltip content={<LanguageTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Centre label — shows the true total, not the capped display count */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs font-medium text-[var(--muted-foreground)]">
                Languages
              </span>
              <span className="text-lg font-bold text-[var(--card-foreground)]">
                {languages.length}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex w-full flex-col gap-2 sm:flex-1">
            {chartData.map((lang) => (
              <div
                key={lang.name}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor: getColor(lang.name),
                    minWidth: "12px",
                    minHeight: "12px",
                  }}
                  role="img"
                  aria-label={lang.name}
                />
                <span className="min-w-0 flex-1 truncate text-[var(--card-foreground)]">
                  {lang.name}
                </span>
                <span className="shrink-0 tabular-nums text-[var(--muted-foreground)]">
                  {lang.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}