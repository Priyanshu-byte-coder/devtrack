"use client";

import { useCallback, useEffect, useState } from "react";

interface DiscussionData {
  discussionsStarted: number;
  commentsGiven: number;
  markedAsAnswer: number;
}

export default function DiscussionsWidget() {
  const [data, setData] = useState<DiscussionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/metrics/discussions")
      .then((r) => {
        if (!r.ok) throw new Error("API error");
        return r.json();
      })
      .then((d: DiscussionData) => setData(d))
      .catch(() =>
        setError("We couldn't load your discussion metrics right now.")
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = data
    ? [
        {
          label: "Discussions Started",
          value: data.discussionsStarted,
          title: "Total discussions you have opened",
        },
        {
          label: "Comments Given",
          value: data.commentsGiven,
          title: "Discussions you have commented on",
        },
        {
          label: "Marked as Answer",
          value: data.markedAsAnswer,
          title: "Your replies marked as the accepted answer",
        },
      ]
    : [];

  const hasNoDiscussionData =
    !!data &&
    data.discussionsStarted === 0 &&
    data.commentsGiven === 0 &&
    data.markedAsAnswer === 0;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">
        Discussion Activity
      </h2>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-lg skeleton-shimmer"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)]">
          <p>{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="mt-3 rounded-md border border-[var(--destructive)]/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
          >
            Try again
          </button>
        </div>
      ) : hasNoDiscussionData ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 text-4xl">💬</div>
      
          <h3 className="text-sm font-semibold text-[var(--card-foreground)]">
            No discussion activity yet
          </h3>
      
          <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">
            Participate in GitHub Discussions to see your activity metrics here.
          </p>
      
          <a
            href="https://github.com/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--control)]"
          >
            Explore Discussions
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg bg-[var(--control)] p-4 text-center stat-cell animate-fade-in-up"
              title={stat.title}
            >
              <div className="text-2xl font-bold text-[var(--accent)]">
                {stat.value}
              </div>
              <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
