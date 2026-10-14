import "server-only";
import { collectGitHubSearch } from "@/lib/github-search";
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
      const search = await collectGitHubSearch<{
        commit: { author: { date: string } };
      }>(
        "commits",
        `author:${login} author-date:>=${since.toISOString().slice(0, 10)}${visibility === "public" ? " is:public" : ""}`,
        token
      );
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
