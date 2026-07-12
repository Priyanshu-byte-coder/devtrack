"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { SkeletonBlock } from "./WidgetSkeleton";

const ComparisonChart = dynamic(() => import("./ComparisonChart"), { ssr: false });

interface CompareData {
  username: string;
  streak: number;
  commits30d: number;
  topLanguage: string;
  prs: number;
  weeklyCommits?: Array<{ week: string; commits: number }>;
  fromCache?: boolean;
}

interface SuggestedUser {
  username: string;
  avatarUrl: string;
}

const STORAGE_KEY = "devtrack:compare_username";
const SUGGEST_DEBOUNCE_MS = 300;

function FriendComparison() {
  const [friendUsername, setFriendUsername] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(STORAGE_KEY) ?? "";
  });
  const [selectedUserAvatar, setSelectedUserAvatar] = useState("");
  const [comparingUser, setComparingUser] = useState("");
  const [myData, setMyData] = useState<CompareData | null>(null);
  const [friendData, setFriendData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestQuery, setSuggestQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suppressNextSuggestFetch, setSuppressNextSuggestFetch] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const trimmedFriendUsername = useMemo(
    () => friendUsername.trim(),
    [friendUsername]
  );

  // Fetch my data on mount
  useEffect(() => {
    fetch("/api/metrics/compare?username=me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setMyData(data);
      })
      .catch(() => {});
  }, []);

  // Auto-compare persisted username on mount
  useEffect(() => {
    const persisted = localStorage.getItem(STORAGE_KEY);
    if (persisted) runCompare(persisted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(
      () => setSuggestQuery(friendUsername),
      SUGGEST_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [friendUsername]);

  // suggestions
  useEffect(() => {
    const q = suggestQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (suppressNextSuggestFetch) {
      setSuppressNextSuggestFetch(false);
      return;
    }

    let cancelled = false;
    setSuggestLoading(true);

    fetch(`/api/users/search?q=${encodeURIComponent(q)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const users = Array.isArray(data?.users) ? data.users : [];
        setSuggestions(users);
        setSuggestOpen(users.length > 0);
        setActiveIndex(-1);
      })
      .catch(() => {
        if (cancelled) return;
        setSuggestions([]);
        setSuggestOpen(false);
        setActiveIndex(-1);
      })
      .finally(() => {
        if (cancelled) return;
        setSuggestLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [suggestQuery, suppressNextSuggestFetch]);

  // outside click
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      if (e.target instanceof Node && container.contains(e.target)) return;
      setSuggestOpen(false);
      setActiveIndex(-1);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const chooseSuggestion = (user: SuggestedUser) => {
    setFriendUsername(user.username);
    setSelectedUserAvatar(user.avatarUrl);
    setSuppressNextSuggestFetch(true);
    setSuggestions([]);
    setSuggestOpen(false);
    setActiveIndex(-1);
  };

  async function runCompare(target: string) {
    const trimmed = target.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");
    setFriendData(null);
    setComparingUser(trimmed);

    try {
      const res = await fetch(
        `/api/metrics/compare?username=${encodeURIComponent(trimmed)}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to fetch user");
      } else {
        setFriendData(data);
        localStorage.setItem(STORAGE_KEY, trimmed);
        window.dispatchEvent(
          new CustomEvent("devtrack:compare-user", {
            detail: { username: trimmed },
          })
        );
        window.dispatchEvent(
          new CustomEvent("devtrack:show-commit-activity", {
            detail: { username: trimmed },
          })
        );
      }
    } catch {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  }

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    await runCompare(trimmedFriendUsername);
  };

  const clearComparison = () => {
    setFriendUsername("");
    setSelectedUserAvatar("");
    setComparingUser("");
    setFriendData(null);
    setError("");
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleCommitActivityClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
  };

  const hasNoCompareData =
    friendData !== null &&
    friendData.commits30d === 0 &&
    friendData.streak === 0 &&
    friendData.prs === 0;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-sm">

      {/* HEADER */}
      <div className="mb-6 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
          Friend Comparison
        </h2>

        <p className="text-sm text-[var(--muted-foreground)]">
          See how you stack up against others
        </p>

        <form onSubmit={handleCompare} className="flex gap-2">
          <div ref={containerRef} className="relative flex-1">
            <input
              value={friendUsername}
              onChange={(e) => setFriendUsername(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder="GitHub username..."
            />
          </div>

          <button
            disabled={loading || !trimmedFriendUsername}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm text-[var(--accent-foreground)]"
          >
            Compare
          </button>

          {friendData && (
            <button
              type="button"
              onClick={clearComparison}
              className="w-full sm:w-auto shrink-0 whitespace-nowrap rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* ERROR */}
      {error && (
        <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div
          className="space-y-2 mt-2"
          aria-busy="true"
          aria-label="Loading comparison"
        >
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className="h-12 w-full rounded-lg" />
          ))}
          <SkeletonBlock className="h-48 rounded-xl mt-4" />
        </div>
      )}

      {/* EMPTY STATE (NEW FIX) */}
      {!loading && !friendData && !error && (
        <div className="flex h-32 items-center justify-center border-2 border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--muted-foreground)]">
          Enter a username to start comparing
        </div>
      )}

      {/* NO DATA STATE (NEW FIX) */}
      {hasNoCompareData && !loading && (
        <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--muted-foreground)]">
          <p className="font-medium text-[var(--card-foreground)]">
            No comparison data available
          </p>
          <p className="text-xs mt-1">
            This user has no activity in the selected period
          </p>
        </div>
      )}

      {/* SUCCESS */}
      {friendData && myData && !loading && !hasNoCompareData && (
        <div className="mt-4 space-y-3">
          <ComparisonRow label="Streak" myValue={myData.streak} theirValue={friendData.streak} suffix="d" />
          <ComparisonRow label="Commits" myValue={myData.commits30d} theirValue={friendData.commits30d} />
          <ComparisonRow label="PRs" myValue={myData.prs} theirValue={friendData.prs} />
        </div>
      )}

      {/* CLEAR */}
      {friendData && (
        <button
          onClick={clearComparison}
          className="mt-4 text-sm text-[var(--muted-foreground)] hover:text-red-500"
        >
          Clear Comparison
        </button>
      )}
    </div>
  );
}

function ComparisonRow({
  label,
  myValue,
  theirValue,
  suffix = "",
}: any) {
  return (
    <div className="flex justify-between p-2 bg-[var(--control)] rounded">
      <span>{myValue}{suffix}</span>
      <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
      <span>{theirValue}{suffix}</span>
    </div>
  );
}

export default React.memo(FriendComparison);