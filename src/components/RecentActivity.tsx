"use client";

import { type ReactNode, useCallback, useEffect, useState, useRef } from "react";
import { useAccount } from "@/components/AccountContext";

type ActivityType =
  | "push"
  | "pull_request"
  | "issue"
  | "release"
  | "discussion"
  | "other";

interface ActivityItem {
  id: string;
  type: ActivityType;
  createdAt: string;
  title: string;
  subtitle: string;
  repo: string;
  url: string;
}

function getTypeBadge(type: ActivityType): string {
  if (type === "push") return "Push";
  if (type === "pull_request") return "PR";
  if (type === "issue") return "Issue";
  if (type === "release") return "Release";
  if (type === "discussion") return "Discussion";
  return "Event";
}

function getTypeIcon(type: ActivityType): ReactNode {
  if (type === "push") {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
        <path
          d="M5 2v8M5 10l-2-2M5 10l2-2M11 14V6M11 6l-2 2M11 6l2 2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (type === "pull_request") {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
        <path
          d="M4 3a1.5 1.5 0 1 1-3 0a1.5 1.5 0 0 1 3 0ZM4 13a1.5 1.5 0 1 1-3 0a1.5 1.5 0 0 1 3 0ZM10 3a1.5 1.5 0 1 1 3 0a1.5 1.5 0 0 1-3 0Z"
          fill="currentColor"
        />
        <path
          d="M2.5 4.5v7M4 3h4.5a2.5 2.5 0 0 1 2.5 2.5v0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (type === "issue") {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8" cy="5" r="1" fill="currentColor" />
        <path d="M8 7.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "release") {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
        <path
          d="M8 2l1.6 3.2L13 6l-2.5 2.4L11 12l-3-1.6L5 12l.5-3.6L3 6l3.4-.8L8 2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (type === "discussion") {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
        <path
          d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v6A1.5 1.5 0 0 1 12.5 11H9l-3 2.5V11H3.5A1.5 1.5 0 0 1 2 9.5v-6Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return null;
}

function formatEventTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function RecentActivity() {
  const { selectedAccount } = useAccount();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchActivity = useCallback((isLoadMore = false) => {
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setLoading(true);
      offsetRef.current = 0;
    }
    setError(null);

    const limit = 10;
    const previousOffset = offsetRef.current;
    const currentOffset = isLoadMore ? previousOffset + limit : 0;
    
    // Advance synchronously to prevent race conditions from concurrent calls
    offsetRef.current = currentOffset;

    let queryParams = `?limit=${limit}&offset=${currentOffset}`;
    if (selectedAccount !== null) {
      queryParams += `&accountId=${encodeURIComponent(selectedAccount)}`;
    }

    fetch(`/api/metrics/activity${queryParams}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("API error");
        }
        return res.json();
      })
      .then((payload: { items?: ActivityItem[] }) => {
        const fetchedItems = payload.items ?? [];
        if (isLoadMore) {
          setItems((prev) => [...prev, ...fetchedItems]);
        } else {
          setItems(fetchedItems);
        }
        setHasMore(fetchedItems.length === limit);
      })
      .catch(() => {
        // Roll back the offset on failure
        offsetRef.current = previousOffset;
        setError(
          "We couldn't load your recent activity right now. Please try again in a moment."
        );
      })
      .finally(() => {
        setLoading(false);
        setIsLoadingMore(false);
      });
  }, [selectedAccount]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
            Recent Activity
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Your latest GitHub events
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchActivity(false)}
          disabled={loading || isLoadingMore}
          aria-label="Refresh recent activity"
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--control)] disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-90 active:scale-95"
        >
          {loading ? (
            <svg aria-hidden="true" className="animate-spin h-3 w-3 text-[var(--muted-foreground)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          ) : null}
          <span>Refresh</span>
        </button>
      </div>

      {loading && !isLoadingMore ? ( 
        <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-16 rounded-lg skeleton-shimmer"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)]">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => fetchActivity(false)}
            className="mt-3 rounded-md border border-[var(--destructive)]/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
          >
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
  <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card-muted)] p-6 text-center">
    <div className="mb-3 text-3xl">📈</div>

    <h3 className="text-sm font-semibold text-[var(--card-foreground)]">
      No Recent Activity
    </h3>

    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
      We haven&apos;t found any recent GitHub activity for this account yet.
      Push commits, open pull requests, or contribute to repositories to
      see activity appear here.
    </p>

    <button
      type="button"
      onClick={() => fetchActivity(false)}
      className="mt-4 rounded-md border border-[var(--border)] px-4 py-2 text-xs font-medium hover:bg-[var(--control)]"
    >
      Refresh Activity
    </button>
  </div>
) 
       : ( 
        <div className="max-h-[320px] overflow-y-auto pr-1 flex flex-col space-y-3">
          <ul className="space-y-3 border-l border-[var(--border)] pl-4">
            {items.map((item) => (
              <li key={item.id} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-[21px] top-6 h-2.5 w-2.5 rounded-full border border-[var(--border)] bg-[var(--card)]"
                />
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-[var(--border)] bg-[var(--control)] p-4 transition-colors hover:border-[var(--accent)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-xs font-medium text-[var(--muted-foreground)]">
                      {getTypeIcon(item.type)}
                      {getTypeBadge(item.type)}
                    </span>
                    <span
                      className="shrink-0 text-xs text-[var(--muted-foreground)]"
                      title={new Date(item.createdAt).toLocaleString()}
                    >
                      {formatEventTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-[var(--card-foreground)]">
                    {item.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">
                    {item.subtitle}
                  </p>
                </a>
              </li>
            ))}
          </ul>
          
          {hasMore && (
            <div className="pt-2 text-center pb-2">
              <button
                type="button"
                onClick={() => fetchActivity(true)}
                disabled={isLoadingMore || loading}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-4 py-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--control)] disabled:cursor-not-allowed disabled:opacity-60 bg-[var(--card)] shadow-sm"
              >
                {isLoadingMore ? (
                  <svg className="animate-spin h-3.5 w-3.5 text-[var(--muted-foreground)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : null}
                {isLoadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      )
} </div>
  );
}
