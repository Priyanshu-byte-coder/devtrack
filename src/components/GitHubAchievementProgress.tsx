"use client";

import { useEffect, useState } from "react";
import type { AchievementProgressInfo } from "@/lib/achievement-progress";

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; items: AchievementProgressInfo[] };

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]"
    >
      <div
        className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function AchievementCard({ item }: { item: AchievementProgressInfo }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--control)] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--card-foreground)]">
          {item.title}
        </span>
        {item.dataAvailable && item.nextMilestone && (
          <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
            {item.nextMilestone.tier}
          </span>
        )}
      </div>

      {item.dataAvailable ? (
        <>
          <ProgressBar percent={item.progressPercent ?? 0} />
          <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
            {item.progressDescription ?? ""}
          </p>
        </>
      ) : (
        <p className="text-xs text-[var(--muted-foreground)] italic">
          Progress unavailable
        </p>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="h-20 animate-pulse rounded-lg bg-[var(--card-muted)]"
    />
  );
}

export default function GitHubAchievementProgress() {
  const [state, setState] = useState<FetchState>({ status: "idle" });

  useEffect(() => {
    setState({ status: "loading" });

    fetch("/api/metrics/achievement-progress")
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<AchievementProgressInfo[]>;
      })
      .then((items) => setState({ status: "success", items }))
      .catch((err: unknown) => {
        setState({
          status: "error",
          message:
            err instanceof Error ? err.message : "Failed to load progress",
        });
      });
  }, []);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-[var(--card-foreground)]">
        Achievement Progress
      </h2>
      <p className="mb-4 text-xs text-[var(--muted-foreground)]">
        Estimated progress for locked GitHub achievements
      </p>

      {state.status === "loading" || state.status === "idle" ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="space-y-3"
        >
          <span className="sr-only">Loading achievement progress</span>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : state.status === "error" ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          Achievement progress could not be loaded right now.
        </p>
      ) : state.items.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          All tracked achievements have been unlocked!
        </p>
      ) : (
        <div className="space-y-3">
          {state.items.map((item) => (
            <AchievementCard key={item.slug} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
