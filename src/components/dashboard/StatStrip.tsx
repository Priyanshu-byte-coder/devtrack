"use client";

import { useEffect, useState } from "react";
import {
  CalendarCheck,
  Flame,
  GitCommitHorizontal,
  GitMerge,
} from "lucide-react";
import { useAccount } from "@/components/AccountContext";

type WeeklySummary = {
  commits: { current: number; previous: number };
  prs: { thisWeek: { merged: number }; lastWeek: { merged: number } };
  activeDays: { thisWeek: number; lastWeek: number };
  streak: number;
};

function Delta({ now, before }: { now: number; before: number }) {
  if (now === before)
    return (
      <span className="text-[var(--muted-foreground)]">same as last week</span>
    );
  const up = now > before;
  return (
    <span
      className={up ? "text-emerald-500" : "text-[var(--muted-foreground)]"}
    >
      {up ? "+" : "−"}
      {Math.abs(now - before)} vs last week
    </span>
  );
}

/** This week at a glance: four numbers, one request. */
export default function StatStrip() {
  const { selectedAccount } = useAccount();
  const [data, setData] = useState<WeeklySummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const query = selectedAccount
      ? `?accountId=${encodeURIComponent(selectedAccount)}`
      : "";
    setFailed(false);
    fetch(`/api/metrics/weekly-summary${query}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((json: WeeklySummary) => !cancelled && setData(json))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [selectedAccount]);

  const tiles = [
    {
      label: "Current streak",
      icon: Flame,
      value: data
        ? `${data.streak} ${data.streak === 1 ? "day" : "days"}`
        : null,
      note: data
        ? data.streak > 0
          ? "keep it going"
          : "commit today to start one"
        : null,
    },
    {
      label: "Commits this week",
      icon: GitCommitHorizontal,
      value: data?.commits.current,
      note: data ? (
        <Delta now={data.commits.current} before={data.commits.previous} />
      ) : null,
    },
    {
      label: "PRs merged this week",
      icon: GitMerge,
      value: data?.prs.thisWeek.merged,
      note: data ? (
        <Delta
          now={data.prs.thisWeek.merged}
          before={data.prs.lastWeek.merged}
        />
      ) : null,
    },
    {
      label: "Active days",
      icon: CalendarCheck,
      value: data ? `${data.activeDays.thisWeek}/7` : null,
      note: data ? (
        <Delta
          now={data.activeDays.thisWeek}
          before={data.activeDays.lastWeek}
        />
      ) : null,
    },
  ];

  return (
    <section
      aria-label="This week"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      {tiles.map(({ label, icon: Icon, value, note }) => (
        <div
          key={label}
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)]">
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </div>
          {failed && !data ? (
            <p
              className="mt-1.5 text-2xl font-semibold text-[var(--muted-foreground)]"
              title="Unavailable right now"
            >
              —
            </p>
          ) : value === null || value === undefined ? (
            <div className="mt-2 h-7 w-16 rounded bg-[var(--card-muted)] animate-pulse" />
          ) : (
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--card-foreground)]">
              {value}
            </p>
          )}
          <p className="mt-0.5 truncate text-xs">{note}</p>
        </div>
      ))}
    </section>
  );
}
