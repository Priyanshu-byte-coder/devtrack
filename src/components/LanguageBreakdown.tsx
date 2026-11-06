"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useAccount } from "@/components/AccountContext";
import { useDashboardWidgetA11y } from "@/components/dashboard/DashboardWidgetA11yContext";
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

export default function LanguageBreakdown() {
  const { selectedAccount } = useAccount();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setSummary, setIsUpdating } =
    useDashboardWidgetA11y("language-breakdown");

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
      `Top language: ${top.name}, ${top.percentage}%. ${languages.length} language${languages.length === 1 ? "" : "s"} tracked.`
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
    <div className="px-frame bg-[var(--card)] p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]">
          Language Breakdown
        </h2>
        {!loading && languages.length > 0 && (
          <span className="font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            {languages.length} language{languages.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="space-y-3"
        >
          <span className="sr-only">Loading language breakdown</span>
          <SkeletonBlock className="h-6" />
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
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-[var(--destructive)]">
          {error}
        </p>
      ) : languages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 text-4xl">🧩</div>

          <h3 className="text-sm font-semibold text-[var(--card-foreground)]">
            No language data available
          </h3>

          <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">
            Start committing code to repositories and we&apos;ll analyze the
            language distribution across your projects.
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
        <div className="space-y-5">
          {/* Loadout bar: every language's share, side by side. */}
          <div
            className="relative flex h-6 w-full overflow-hidden bg-[var(--control)]"
            role="img"
            aria-label={chartData
              .map((lang) => `${lang.name} ${lang.percentage}%`)
              .join(", ")}
          >
            {chartData.map((lang, index) => (
              <span
                key={lang.name}
                className="lang-seg h-full"
                title={`${lang.name} ${lang.percentage}%`}
                style={
                  {
                    width: `${lang.percentage}%`,
                    backgroundColor: getColor(lang.name),
                    animationDelay: `${index * 90}ms`,
                  } as CSSProperties
                }
              />
            ))}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_10px,var(--card)_10px_12px)]"
            />
          </div>

          {/* One row per language, scaled to the top one. */}
          <ul className="space-y-2.5">
            {chartData.map((lang, index) => (
              <li
                key={lang.name}
                className="grid grid-cols-[minmax(0,7rem)_1fr_3.5rem] items-center gap-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0"
                    style={{ backgroundColor: getColor(lang.name) }}
                  />
                  <span className="truncate text-[var(--card-foreground)]">
                    {lang.name}
                  </span>
                </span>
                <span aria-hidden="true" className="h-2 bg-[var(--control)]">
                  <span
                    className="lang-seg block h-full"
                    style={{
                      width: `${Math.max(2, (lang.percentage / (chartData[0]?.percentage || 1)) * 100)}%`,
                      backgroundColor: getColor(lang.name),
                      animationDelay: `${index * 90}ms`,
                    }}
                  />
                </span>
                <span className="text-right font-pixel text-xs tabular-nums text-[var(--muted-foreground)]">
                  {lang.percentage}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
