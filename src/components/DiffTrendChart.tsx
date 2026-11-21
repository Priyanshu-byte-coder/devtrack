"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DIFF_TREND_WEEKS,
  type DiffTrendResponse,
  type DiffTrendWeek,
  weekEndingLabel,
} from "@/lib/diff-trend";
import { SkeletonBlock } from "./WidgetSkeleton";

const count = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact" });

type ChartWeek = DiffTrendWeek & { label: string };

type State =
  | { status: "loading" }
  | { status: "computing" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DiffTrendResponse };

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartWeek }>;
}) {
  const week = active ? payload?.[0]?.payload : undefined;
  if (!week) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm shadow-lg">
      <p className="font-medium text-[var(--card-foreground)]">
        Week ending {week.label}
      </p>
      <p className="text-[var(--success)]">
        +{count.format(week.additions)} added
      </p>
      <p className="text-[var(--destructive)]">
        −{count.format(week.deletions)} removed
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className="border border-[var(--border)] bg-[var(--control)] p-3">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p
        className={`font-pixel text-sm uppercase tracking-[0.12em] sm:text-xl ${className}`}
      >
        {value}
      </p>
    </div>
  );
}

export default function DiffTrendChart() {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });

    fetch("/api/metrics/diff-trend")
      .then(async (r) => {
        if (r.status === 429)
          throw new Error(
            "GitHub is rate limiting your account right now. Try again in a few minutes."
          );
        const data = (await r.json()) as Partial<DiffTrendResponse> & {
          computing?: boolean;
        };
        if (r.status === 202 && data.computing) {
          setState({ status: "computing" });
          return;
        }
        if (!r.ok || !Array.isArray(data.weeks) || !Array.isArray(data.repos))
          throw new Error();
        setState({ status: "ready", data: data as DiffTrendResponse });
      })
      .catch((e: Error) =>
        setState({
          status: "error",
          message:
            e.message ||
            "We couldn't load your line changes right now. Please try again in a moment.",
        })
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const data = state.status === "ready" ? state.data : null;

  const weeks = useMemo<ChartWeek[]>(
    () =>
      (data?.weeks ?? []).map((week) => ({
        ...week,
        label: weekEndingLabel(week.weekStart),
      })),
    [data]
  );

  const totals = useMemo(
    () =>
      weeks.reduce(
        (sum, week) => ({
          additions: sum.additions + week.additions,
          deletions: sum.deletions + week.deletions,
        }),
        { additions: 0, deletions: 0 }
      ),
    [weeks]
  );
  const net = totals.additions - totals.deletions;
  const repos = data?.repos ?? [];

  return (
    <section className="px-frame bg-[var(--card)] p-5">
      <div className="mb-5">
        <h2 className="font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]">
          Lines Changed
        </h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {repos.length > 0
            ? `Lines you added and removed per week in ${repos.join(", ")}, last ${DIFF_TREND_WEEKS} weeks.`
            : `Lines you added and removed per week in your top repositories, last ${DIFF_TREND_WEEKS} weeks.`}
        </p>
      </div>

      {state.status === "loading" ? (
        <div role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Loading line changes</span>
          <SkeletonBlock className="h-72" />
        </div>
      ) : state.status === "computing" ? (
        <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] px-4 text-center text-sm text-[var(--muted-foreground)]">
          <p role="status">
            Computing stats… GitHub is preparing line counts for your
            repositories. Check again in a minute.
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--card-foreground)] transition-colors hover:bg-[var(--control)]"
          >
            Check again
          </button>
        </div>
      ) : state.status === "error" ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-[var(--destructive)]">
          <p>{state.message}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-destructive/10"
          >
            Try again
          </button>
        </div>
      ) : totals.additions + totals.deletions === 0 ? (
        <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-[var(--border)] px-4 text-center text-sm text-[var(--muted-foreground)]">
          No line changes in the last {DIFF_TREND_WEEKS} weeks.
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
            <Stat
              label="Added"
              value={`+${compact.format(totals.additions)}`}
              className="text-[var(--success)]"
            />
            <Stat
              label="Removed"
              value={`−${compact.format(totals.deletions)}`}
              className="text-[var(--destructive)]"
            />
            <Stat
              label="Net"
              value={`${net < 0 ? "−" : "+"}${compact.format(Math.abs(net))}`}
              className="text-[var(--card-foreground)]"
            />
          </div>

          <div
            className="h-64 w-full"
            role="img"
            aria-label={`Lines added and removed per week: ${count.format(totals.additions)} added and ${count.format(totals.deletions)} removed over the last ${DIFF_TREND_WEEKS} weeks.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeks}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  stroke="var(--muted-foreground)"
                  tick={{ fontSize: 12 }}
                  minTickGap={12}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  allowDecimals={false}
                  tickFormatter={(value: number) => compact.format(value)}
                  width={48}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "var(--control)" }}
                />
                <Bar
                  dataKey="additions"
                  name="Added"
                  stackId="lines"
                  fill="var(--success)"
                />
                <Bar
                  dataKey="deletions"
                  name="Removed"
                  stackId="lines"
                  fill="var(--destructive)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
