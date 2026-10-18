"use client";

import { Button } from "@/components/ui/button";
import {
  segmentedGroupClass,
  segmentedItemClass,
} from "@/components/ui/segmented";
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
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="leaderboard-language">
        Language
      </label>
      <select
        id="leaderboard-language"
        value={language}
        onChange={(event) => updateFilters({ lang: event.target.value })}
        className="h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 text-sm text-[var(--card-foreground)] outline-none transition-colors hover:bg-[var(--control)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <option value="">All languages</option>
        {languages.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      <div role="group" aria-label="Time range" className={segmentedGroupClass}>
        {periods.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={item.value === period}
            onClick={() => updateFilters({ period: item.value })}
            className={segmentedItemClass(item.value === period)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {hasFilters && (
        <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
          Clear
        </Button>
      )}
    </div>
  );
}
