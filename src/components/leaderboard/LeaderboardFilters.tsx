"use client";

import { Button } from "@/components/ui/button";
import { arcadeTabClass, arcadeTabGroupClass } from "@/components/ui/arcade";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PUBLIC_CACHE_PARAM } from "@/lib/public-page-cache";

type Period = "week" | "month" | "all";

const STORAGE_KEY = "leaderboard-filters";

/** The page's query, minus the proxy's cache marker (lib/public-page-cache). */
function withoutCacheMarker(current: { toString(): string }) {
  const params = new URLSearchParams(current.toString());
  params.delete(PUBLIC_CACHE_PARAM);
  return params;
}

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

type StoredFilters = { lang?: string; period?: string };

function readStoredFilters(): StoredFilters | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredFilters) : null;
  } catch {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage blocked: nothing to restore.
    }
    return null;
  }
}

export default function LeaderboardFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const language = searchParams.get("lang") ?? "";
  const rawPeriod = searchParams.get("period");
  const period: Period = isPeriod(rawPeriod) ? rawPeriod : "all";

  const hasFilters = searchParams.has("lang") || searchParams.has("period");

  // Bring back the last filters once, when the page opens without any.
  // Only then: "All time" and "All languages" are the defaults, so picking
  // them removes the params, and restoring on every change used to put the
  // saved "This week" straight back.
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (searchParams.has("lang") || searchParams.has("period")) return;

    const stored = readStoredFilters();
    if (!stored) return;

    const nextParams = withoutCacheMarker(searchParams);
    if (stored.lang) nextParams.set("lang", stored.lang);
    const storedPeriod = stored.period ?? null;
    if (isPeriod(storedPeriod) && storedPeriod !== "all") {
      nextParams.set("period", storedPeriod);
    }
    const query = nextParams.toString();
    if (query) router.replace(`${pathname}?${query}`, { scroll: false });
  }, [pathname, router, searchParams]);

  /** Remember the choice, including going back to the defaults. */
  function saveFilters(next: { lang: string; period: Period }) {
    try {
      if (!next.lang && next.period === "all") {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
    } catch {
      // Storage blocked: the URL still holds the filters.
    }
  }

  function updateFilters(next: Partial<{ lang: string; period: Period }>) {
    saveFilters({
      lang: next.lang ?? language,
      period: next.period ?? period,
    });
    const params = withoutCacheMarker(searchParams);

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
    const params = withoutCacheMarker(searchParams);
    params.delete("lang");
    params.delete("period");
    saveFilters({ lang: "", period: "all" });

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
        className="px-frame h-9 bg-[var(--card)] px-2.5 font-mono text-sm text-[var(--card-foreground)] outline-none transition-colors hover:bg-[var(--control)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <option value="">All languages</option>
        {languages.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      <div role="group" aria-label="Time range" className={arcadeTabGroupClass}>
        {periods.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={item.value === period}
            onClick={() => updateFilters({ period: item.value })}
            className={arcadeTabClass(item.value === period)}
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
