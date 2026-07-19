"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Period = "week" | "month" | "all";

const STORAGE_KEY = "leaderboard-filters";

const languages = [
  { label: "TypeScript", value: "typescript" },
  { label: "JavaScript", value: "javascript" },
  { label: "Python", value: "python" },
  { label: "Go", value: "go" },
  { label: "Rust", value: "rust" },
  { label: "Java", value: "java" },
  { label: "C++", value: "c++" },
  { label: "C", value: "c" },
  { label: "C#", value: "c#" },
  { label: "PHP", value: "php" },
  { label: "Ruby", value: "ruby" },
  { label: "Kotlin", value: "kotlin" },
  { label: "Swift", value: "swift" },
  { label: "Dart", value: "dart" },
  { label: "Shell", value: "shell" },
];

const periods: Array<{ label: string; value: Period }> = [
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "All Time", value: "all" },
];

function isPeriod(value: string | null): value is Period {
  return value === "week" || value === "month" || value === "all";
}

export default function LeaderboardFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const language = searchParams.get("lang") ?? "";
  const rawPeriod = searchParams.get("period");
  const period: Period = isPeriod(rawPeriod) ? rawPeriod : "all";

  const hasFilters = searchParams.has("lang") || searchParams.has("period");

  const currentFilters = useMemo(
    () => ({ lang: language, period }),
    [language, period]
  );

  useEffect(() => {
    const hasUrlFilters =
      searchParams.has("lang") || searchParams.has("period");

    if (!hasUrlFilters) {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return;
      }

      try {
        const parsed = JSON.parse(stored) as {
          lang?: string;
          period?: string;
        };
        const nextParams = new URLSearchParams(searchParams.toString());

        if (parsed.lang) {
          nextParams.set("lang", parsed.lang);
        }

        const storedPeriod = parsed.period ?? null;
        if (isPeriod(storedPeriod) && storedPeriod !== "all") {
          nextParams.set("period", storedPeriod);
        }

        const query = nextParams.toString();
        if (query) {
          router.replace(`${pathname}?${query}`, { scroll: false });
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentFilters));
  }, [currentFilters, pathname, router, searchParams]);

  function updateFilters(next: Partial<{ lang: string; period: Period }>) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.lang !== undefined) {
      if (next.lang) {
        params.set("lang", next.lang);
      } else {
        params.delete("lang");
      }
    }

    if (next.period !== undefined) {
      if (next.period === "all") {
        params.delete("period");
      } else {
        params.set("period", next.period);
      }
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("lang");
    params.delete("period");
    window.localStorage.removeItem(STORAGE_KEY);

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--card)]/90 p-3 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <label className="flex flex-col gap-2 text-sm font-medium text-[var(--card-foreground)] md:min-w-64">
          Language
          <select
            value={language}
            onChange={(event) => updateFilters({ lang: event.target.value })}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--card-foreground)] outline-none transition-colors hover:bg-[var(--control)] focus:border-[var(--accent)]"
          >
            <option value="">All languages</option>
            {languages.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2 text-sm font-medium text-[var(--card-foreground)]">
          Time range
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-[var(--border)] bg-[var(--control)] p-1">
            {periods.map((item) => {
              const active = item.value === period;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => updateFilters({ period: item.value })}
                  className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                    active
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-sm"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--card)] hover:text-[var(--card-foreground)]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={clearFilters}
          disabled={!hasFilters}
          className="secondary-button rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}
