import "server-only";
import { dateDiffDays } from "@/lib/date-utils";
import { collectAuthorCommits, collectGitHubSearch } from "@/lib/github-search";
import {
  metricsCacheKey,
  withMetricsCache,
  METRICS_CACHE_TTL_SECONDS,
} from "@/lib/metrics-cache";
export type ActiveDates = Set<string> & {
  complete: boolean;
  partialReason?: string;
};
/** Commit-based streaks use the same 365-day window, timezone and completeness contract everywhere. */
export async function fetchCommitStreakDates(
  login: string,
  token: string | undefined,
  context: { bypass: boolean; userId: string },
  timeZone = "UTC",
  visibility: "all" | "public" = "all"
): Promise<ActiveDates> {
  const key = metricsCacheKey(context.userId, "streak", {
    githubLogin: login,
    timeZone,
    visibility,
  });
  const result = await withMetricsCache(
    {
      bypass: context.bypass,
      key,
      ttlSeconds: METRICS_CACHE_TTL_SECONDS.streak,
    },
    async () => {
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - 365);
      const sinceStr = since.toISOString().slice(0, 10);
      const search =
        visibility === "public"
          ? await collectGitHubSearch<{ commit: { author: { date: string } } }>(
              "commits",
              `author:${login} author-date:>=${sinceStr} is:public`,
              token
            )
          : await collectAuthorCommits(login, sinceStr, token, {
              fresh: context.bypass,
            });
      const dates = new Set<string>();
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      for (const item of search.items)
        dates.add(formatter.format(new Date(item.commit.author.date)));
      return {
        dates: [...dates],
        complete: search.complete,
        partialReason: search.partialReason,
      };
    }
  );
  return Object.assign(new Set(result.dates), {
    complete: result.complete,
    partialReason: result.partialReason,
  });
}

export type StreakCoverage = "exact" | "lower-bound" | "unknown";

/**
 * Whether a current streak worked out from possibly partial dates is exact.
 *
 * Commit search caps at 1,000 results, so very active users rarely get a full
 * year. That doesn't matter for the current streak: search returns newest
 * first, so a partial result still covers every day after the oldest date it
 * reached. The streak is exact as long as the day that broke it falls inside
 * that window; otherwise the true streak is at least what was counted.
 *
 * When GitHub reports the search itself timed out, gaps could be anywhere,
 * so the result can't be trusted at all.
 */
export function currentStreakCoverage(
  dates: ActiveDates,
  current: number,
  today: string
): StreakCoverage {
  if (dates.complete) return "exact";
  if (dates.partialReason?.includes("reported incomplete")) return "unknown";
  if (dates.size === 0) return "unknown";
  const oldest = [...dates].sort()[0];
  // Days strictly after the oldest fetched day are fully covered. The day
  // that ended a streak sits current + 1 days before today at the latest.
  const coveredDays = Math.round(dateDiffDays(oldest, today));
  return current <= coveredDays - 2 ? "exact" : "lower-bound";
}
