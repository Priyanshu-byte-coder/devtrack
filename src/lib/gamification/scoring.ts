/**
 * DevTrack score v2, tiers, and XP/levels.
 *
 * Pure functions: no I/O, so the ranking rules are testable and identical
 * wherever they run (leaderboard build, snapshot cron, badges, share cards).
 *
 * Score (0–1000) blends four signals:
 *   consistency 30%  active days in the period, plus the current streak
 *   impact      30%  pull requests, plus half credit for reviews
 *   volume      25%  commits
 *   breadth     15%  repositories contributed to
 *
 * Each signal is scored two ways and blended:
 *   absolute  log-scaled progress toward a per-period target, so the 50th
 *             commit is worth less than the 5th and commit spam stops paying
 *   relative  percentile within the cohort being ranked
 * Relative weight grows with cohort size (0 for a lone user, up to half at
 * 21+), so a small early leaderboard isn't decided by a coin-flip percentile.
 */

export type ScoringPeriod = "week" | "month" | "all";

export interface ActivityStats {
  /** Days with at least one contribution in the period (last 365 days for "all"). */
  activeDays: number;
  streak: number;
  commits: number;
  prs: number;
  reviews: number;
  /** Repositories the user committed to in the period. */
  repos: number;
}

export const SCORE_WEIGHTS = {
  consistency: 0.3,
  impact: 0.3,
  volume: 0.25,
  breadth: 0.15,
} as const;

type Signal = keyof typeof SCORE_WEIGHTS;

/** Where each signal's absolute half saturates. Beyond this, more adds nothing. */
export const PERIOD_TARGETS: Record<ScoringPeriod, Record<Signal, number>> = {
  week: { consistency: 7, impact: 8, volume: 40, breadth: 5 },
  month: { consistency: 30, impact: 30, volume: 150, breadth: 10 },
  all: { consistency: 365, impact: 300, volume: 2000, breadth: 50 },
};

const MAX_RELATIVE_WEIGHT = 0.5;
const COHORT_FOR_FULL_RELATIVE = 21;

function finite(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function signals(
  stats: ActivityStats,
  period: ScoringPeriod
): Record<Signal, number> {
  const days = PERIOD_TARGETS[period].consistency;
  return {
    consistency:
      0.7 * finite(stats.activeDays) +
      0.3 * Math.min(finite(stats.streak), days),
    impact: finite(stats.prs) + 0.5 * finite(stats.reviews),
    volume: finite(stats.commits),
    breadth: finite(stats.repos),
  };
}

/** Log-scaled progress toward a target, in [0, 1]. */
export function absoluteProgress(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1, Math.log1p(finite(value)) / Math.log1p(target));
}

/** Share of the cohort below `value`, counting ties as half, in [0, 1]. */
export function percentile(value: number, cohort: number[]): number {
  if (cohort.length <= 1) return 0.5;
  let below = 0;
  let equal = 0;
  for (const other of cohort) {
    if (other < value) below++;
    else if (other === value) equal++;
  }
  // Exclude the value itself from its own ties.
  return (below + 0.5 * Math.max(0, equal - 1)) / (cohort.length - 1);
}

export function relativeWeight(cohortSize: number): number {
  if (cohortSize <= 1) return 0;
  return Math.min(
    MAX_RELATIVE_WEIGHT,
    (MAX_RELATIVE_WEIGHT * (cohortSize - 1)) / (COHORT_FOR_FULL_RELATIVE - 1)
  );
}

/**
 * Score every member of a cohort. Returns scores in input order.
 * Scores are only comparable within one period's cohort.
 */
export function scoreCohort(
  cohort: ActivityStats[],
  period: ScoringPeriod
): number[] {
  const targets = PERIOD_TARGETS[period];
  const rw = relativeWeight(cohort.length);
  const perUser = cohort.map((stats) => signals(stats, period));
  const columns = Object.fromEntries(
    (Object.keys(SCORE_WEIGHTS) as Signal[]).map((s) => [
      s,
      perUser.map((u) => u[s]),
    ])
  ) as Record<Signal, number[]>;

  return perUser.map((values) => {
    let total = 0;
    for (const signal of Object.keys(SCORE_WEIGHTS) as Signal[]) {
      const abs = absoluteProgress(values[signal], targets[signal]);
      const rel = percentile(values[signal], columns[signal]);
      total += SCORE_WEIGHTS[signal] * ((1 - rw) * abs + rw * rel);
    }
    return Math.round(1000 * total);
  });
}

// ── Tiers ────────────────────────────────────────────────────────────────

export const TIERS = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
  "legend",
] as const;
export type Tier = (typeof TIERS)[number];

/**
 * Minimum score for each tier. Fixed thresholds rather than percentiles:
 * with only a handful of public profiles, "top 1%" would be nobody. Revisit
 * once the leaderboard has a few hundred people.
 */
export const TIER_THRESHOLDS: Record<Tier, number> = {
  bronze: 0,
  silver: 200,
  gold: 400,
  platinum: 600,
  diamond: 750,
  legend: 900,
};

export function tierForScore(score: number): Tier {
  let tier: Tier = "bronze";
  for (const t of TIERS) if (score >= TIER_THRESHOLDS[t]) tier = t;
  return tier;
}

export function tierRank(tier: Tier): number {
  return TIERS.indexOf(tier);
}

// ── XP and levels ───────────────────────────────────────────────────────

/**
 * XP is personal and only ever goes up: it comes from all-time totals, never
 * from a rolling window. Rank can fall; XP can't. That's what keeps people
 * low on the board motivated.
 */
export const XP_PER = { commit: 10, pr: 40, review: 15 } as const;

export interface LifetimeTotals {
  commits: number;
  prs: number;
  reviews: number;
}

export function xpFromTotals(totals: LifetimeTotals): number {
  return (
    finite(totals.commits) * XP_PER.commit +
    finite(totals.prs) * XP_PER.pr +
    finite(totals.reviews) * XP_PER.review
  );
}

const LEVEL_BASE = 100;
const LEVEL_EXPONENT = 1.5;

/** Total XP needed to reach `level` (level 1 needs 0). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.ceil(LEVEL_BASE * (level - 1) ** LEVEL_EXPONENT);
}

export interface LevelProgress {
  level: number;
  /** XP earned within the current level. */
  current: number;
  /** XP the current level spans. */
  needed: number;
  /** current / needed, in [0, 1). */
  fraction: number;
}

export function levelFromXp(xp: number): LevelProgress {
  const safe = finite(xp);
  let level = Math.floor((safe / LEVEL_BASE) ** (1 / LEVEL_EXPONENT)) + 1;
  // Guard against floating-point drift at exact boundaries.
  while (xpForLevel(level + 1) <= safe) level++;
  while (level > 1 && xpForLevel(level) > safe) level--;
  const floor = xpForLevel(level);
  const needed = xpForLevel(level + 1) - floor;
  const current = safe - floor;
  return {
    level,
    current,
    needed,
    fraction: needed > 0 ? current / needed : 0,
  };
}
