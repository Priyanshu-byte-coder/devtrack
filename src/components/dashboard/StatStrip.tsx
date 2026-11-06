"use client";

import { useEffect, useState } from "react";
import {
  CalendarCheck,
  Flame,
  GitCommitHorizontal,
  GitMerge,
} from "lucide-react";
import { useAccount } from "@/components/AccountContext";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";

type WeeklySummary = {
  commits: { current: number; previous: number };
  prs: { thisWeek: { merged: number }; lastWeek: { merged: number } };
  activeDays: { thisWeek: number; lastWeek: number };
  streak: number;
};

function isWeeklySummary(value: unknown): value is WeeklySummary {
  const v = value as WeeklySummary | null;
  return (
    !!v &&
    typeof v.streak === "number" &&
    typeof v.commits?.current === "number" &&
    typeof v.prs?.thisWeek?.merged === "number" &&
    typeof v.prs?.lastWeek?.merged === "number" &&
    typeof v.activeDays?.thisWeek === "number"
  );
}

function Delta({ now, before }: { now: number; before: number }) {
  if (now === before)
    return <span className="text-[var(--muted-foreground)]">= last week</span>;
  const up = now > before;
  return (
    <span
      className={up ? "text-emerald-500" : "text-[var(--muted-foreground)]"}
    >
      <span aria-hidden="true">{up ? "▲" : "▼"}</span>
      <span className="sr-only">{up ? "up" : "down"}</span>{" "}
      {Math.abs(now - before)} vs last week
    </span>
  );
}

/** Seven pixel segments, one per day of the week. */
function WeekMeter({ days }: { days: number }) {
  return (
    <span className="mt-2 flex gap-1" aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => (
        <span
          key={i}
          className={`h-2 flex-1 ${i < days ? "bg-emerald-500" : "bg-[var(--control)]"}`}
        />
      ))}
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
      .then((json: unknown) => {
        if (cancelled) return;
        if (isWeeklySummary(json)) setData(json);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [selectedAccount]);

  const tiles = [
    {
      label: "Streak",
      icon: Flame,
      color: "#fb923c",
      value: data?.streak,
      unit: "D",
      glow: Boolean(data && data.streak > 0),
      note: data
        ? data.streak > 0
          ? "keep it going"
          : "commit today to start one"
        : null,
    },
    {
      label: "Commits",
      icon: GitCommitHorizontal,
      color: "#6ba8ff",
      value: data?.commits.current,
      note: data ? (
        <Delta now={data.commits.current} before={data.commits.previous} />
      ) : null,
    },
    {
      label: "PRs merged",
      icon: GitMerge,
      color: "#c77dff",
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
      color: "#34d399",
      value: data?.activeDays.thisWeek,
      unit: "/7",
      meter: data?.activeDays.thisWeek,
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
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div
            key={tile.label}
            className="px-frame relative overflow-hidden bg-[var(--card)] p-4"
          >
            {/* Colour key along the top edge. */}
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1"
              style={{ background: tile.color }}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                {tile.label}
                <span className="sr-only"> this week</span>
              </span>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center ${
                  tile.glow ? "animate-pulse" : ""
                }`}
                style={{
                  background: `color-mix(in srgb, ${tile.color} 16%, transparent)`,
                  color: tile.color,
                }}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            {failed && !data ? (
              <p
                className="mt-2 font-pixel text-3xl text-[var(--muted-foreground)]"
                title="Unavailable right now"
              >
                —
              </p>
            ) : tile.value === null || tile.value === undefined ? (
              <div className="mt-3 h-8 w-16 animate-pulse bg-[var(--card-muted)]" />
            ) : (
              <p className="mt-2 font-pixel text-3xl tabular-nums leading-none text-[var(--card-foreground)]">
                <AnimatedNumber value={tile.value} />
                {tile.unit && (
                  <span className="ml-0.5 text-base text-[var(--muted-foreground)]">
                    {tile.unit}
                  </span>
                )}
              </p>
            )}
            {tile.meter !== undefined && <WeekMeter days={tile.meter} />}
            <p className="mt-2 truncate text-xs">{tile.note}</p>
          </div>
        );
      })}
    </section>
  );
}
