import { expect } from "@playwright/test";

/**
 * Shared Playwright route mocks for authenticated dashboard E2E tests.
 * Intercepts browser requests so CI placeholder Supabase env and production
 * middleware rate limits do not break widget rendering.
 */

export const DEFAULT_STREAK = {
  current: 12,
  longest: 21,
  lastCommitDate: "2026-05-18",
  totalActiveDays: 63,
  freezeDates: [],
};

export const DEFAULT_CONTRIBUTIONS = {
  days: 365,
  total: 10,
  data: {
    "2026-05-16": 3,
    "2026-05-17": 5,
    "2026-05-18": 2,
  },
};

export const DEFAULT_FREEZE = {
  hasFreeze: false,
  freezeDate: null,
};

export function mockMetricResponse(url) {
  if (url.includes("/api/metrics/prs")) {
    return {
      open: 3,
      merged: 9,
      closed: 1,
      avgReviewHours: 5,
      avgFirstReviewHours: 2,
      mergeRate: "75%",
    };
  }
  if (url.includes("/api/metrics/pr-breakdown")) {
    return { draft: 1, merged: 9, open: 3, closed: 1 };
  }
  if (url.includes("/api/metrics/issues")) {
    return {
      opened: 5,
      closed: 4,
      currentlyOpen: 1,
      avgCloseTimeDays: 3,
      trend: 1,
      mostActiveRepo: "demo/devtrack",
    };
  }
  if (
    url.includes("/api/metrics/repos") ||
    url.includes("/api/metrics/pinned-repos")
  ) {
    return {
      repos: [
        { name: "demo/repo", commits: 12, url: "https://github.com/demo/repo" },
      ],
    };
  }
  if (url.includes("/api/metrics/languages")) {
    return { languages: [{ language: "TypeScript", count: 20 }] };
  }
  if (url.includes("/api/metrics/streak")) {
    return DEFAULT_STREAK;
  }
  if (url.includes("/api/metrics/weekly-summary")) {
    return {
      commits: { current: 12, previous: 8, delta: 4, trend: "up" },
      prs: {
        thisWeek: { opened: 3, merged: 2 },
        lastWeek: { opened: 1, merged: 1 },
      },
      issues: { thisWeek: 5, lastWeek: 3 },
      productivityScore: { current: 88, previous: 75 },
      activeDays: { thisWeek: 5, lastWeek: 4 },
      streak: 7,
      topRepo: "demo/devtrack",
      repoBreakdown: [
        { repoName: "demo/devtrack", commits: 10 },
        { repoName: "demo/other", commits: 2 }
      ],
      dailyCommits: [
        { date: "2023-10-07", commits: 5 },
        { date: "2023-10-06", commits: 3 },
        { date: "2023-10-05", commits: 4 },
        { date: "2023-10-04", commits: 0 },
        { date: "2023-10-03", commits: 0 },
        { date: "2023-10-02", commits: 0 },
        { date: "2023-10-01", commits: 0 }
      ],
      mostActiveDay: "2023-10-07"
    };
  }
  if (url.includes("/api/metrics/compare")) {
    return { user: { commits: 10 }, friend: { commits: 8 } };
  }
  if (url.includes("/api/metrics/repo-health")) return { repositories: [] };
  if (url.includes("/api/metrics/ci")) {
    return {
      successRate: 95,
      averageDurationMinutes: 3,
      flakiestWorkflow: null,
      totalRuns: 42,
      reposChecked: 5,
    };
  }
  if (url.includes("/api/metrics/activity")) return { data: [] };
  if (url.includes("/api/metrics/commit-time")) return { data: [] };
  if (url.includes("/api/metrics/personal-records")) return { records: [] };
  if (url.includes("/api/metrics/discussions")) {
    return { total: 0, answered: 0 };
  }
  if (url.includes("/api/metrics/pr-review-trend")) return { trend: [] };
  if (url.includes("/api/metrics/pr-review-time")) {
    return { weeks: [] };
  }
  if (url.includes("/api/metrics/inactive-repos")) return { repos: [] };
  if (url.includes("/api/metrics/coding-time") || url.includes("/api/wakatime")) {
    return {
      hasData: false,
      not_configured: true,
      todaysSeconds: 0,
      totalSeconds7Days: 0,
      chartData: [],
      topLanguage: "",
      topProject: "",
    };
  }
  if (url.includes("/api/metrics/coding-activity-insights")) {
    return {
      hourlyCounts: [],
      mostActiveHour: { hour: 0, count: 0, label: "" },
      leastActiveHour: { hour: 0, count: 0, label: "" },
      totalActivities: 0,
      averageDailyCommits: 0,
      consistencyScore: 0,
      productivityLevel: "Low",
      timezone: "UTC",
    };
  }
  if (url.includes("/api/metrics/contributions")) {
    return DEFAULT_CONTRIBUTIONS;
  }
  if (url.includes("/api/metrics/productive-hours")) {
    return { grid: [], peak: null, total: 0, days: 0, timezone: "UTC" };
  }
  if (url.includes("/api/user/pinned-repos/details")) {
    return { pinnedRepos: [] };
  }
  if (url.includes("/api/metrics/repo-explorer")) return { repos: [] };
  if (url.includes("/api/metrics/sponsors")) {
    return {
      mrr: 85,
      activeCount: 3,
      growthTrend: 200,
      sparklineData: [
        { month: "Jan", count: 0 },
        { month: "Feb", count: 0 },
        { month: "Mar", count: 0 },
        { month: "Apr", count: 1 },
        { month: "May", count: 1 },
        { month: "Jun", count: 3 },
      ],
      sponsors: [
        {
          login: "sponsor-1",
          name: "Gold Supporter",
          url: "https://github.com/sponsor-1",
          avatarUrl: null,
          privacyLevel: "PUBLIC",
          tierName: "$50 tier",
          monthlyPriceInCents: 5000,
          createdAt: "2026-05-18T12:00:00.000Z",
        },
      ],
      syncedAt: "2026-06-11T12:00:00.000Z",
    };
  }
  return {};
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{
 *   streak?: Record<string, unknown>;
 *   contributions?: Record<string, unknown>;
 *   freeze?: Record<string, unknown>;
 * }} [options]
 */
export async function installDashboardApiMocks(page, options = {}) {
  const streak = options.streak ?? DEFAULT_STREAK;
  const contributions = options.contributions ?? DEFAULT_CONTRIBUTIONS;
  const freeze = options.freeze ?? DEFAULT_FREEZE;

  await page.route("**/api/notifications**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ notifications: [], unreadCount: 0 }),
    })
  );

  await page.route("**/api/milestones**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ milestones: [] }),
    })
  );

  await page.route("**/api/daily-note**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ todayNote: "", yesterdayNote: "" }),
    })
  );

  await page.route("**/api/accounts**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ accounts: [] }),
    })
  );

  await page.route("**/api/user/orgs**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ accounts: [], config: {} }),
    })
  );

  await page.route("**/api/stream**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: "data: {}\n\n",
    })
  );

  const now = new Date().toISOString();

  await page.route("**/api/goals/sync**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, last_synced_at: now }),
    })
  );

  await page.route("**/api/metrics/contributions**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(contributions),
    })
  );

  await page.route("**/api/metrics/streak**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(streak),
    })
  );

  await page.route("**/api/streak/freeze**", async (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ...freeze, hasFreeze: true, freezeDate: "2026-05-18" }),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(freeze),
    });
  });

  await page.route("**/api/metrics/weekly-summary**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(mockMetricResponse("/api/metrics/weekly-summary")),
    })
  );

  await page.route("**/api/ai-insights**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          insights: [
            {
              id: "i-1",
              type: "productivity",
              title: "High Consistency",
              description: "You coded 5 days in a row!",
              severity: "positive",
            },
          ],
          trend: { direction: "up", percentage: 18 },
          aiSummary: "Great week! Keep shipping.",
          generatedAt: now,
        },
      }),
    })
  );

  await page.route("**/api/user/github-orgs**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ orgs: [], hasReadOrgScope: true }),
    })
  );

  await page.route("**/api/daily-focus**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ goal: "" }),
    })
  );

  await page.route("**/api/user/dashboard-layout**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ layout: null, source: "default" }),
    })
  );

  const stubRoutes = [
    "**/api/metrics/prs**",
    "**/api/metrics/pr-breakdown**",
    "**/api/metrics/pr-review-trend**",
    "**/api/metrics/pr-review-time**",
    "**/api/metrics/issues**",
    "**/api/metrics/languages**",
    "**/api/metrics/repos**",
    "**/api/metrics/pinned-repos**",
    "**/api/metrics/compare**",
    "**/api/metrics/repo-health**",
    "**/api/metrics/ci**",
    "**/api/user/github-accounts**",
    "**/api/integrations/jira**",
    "**/api/metrics/activity**",
    "**/api/metrics/commit-time**",
    "**/api/metrics/personal-records**",
    "**/api/metrics/discussions**",
    "**/api/metrics/inactive-repos**",
    "**/api/local-coding/stats**",
    "**/api/metrics/coding-time**",
    "**/api/metrics/coding-activity-insights**",
    "**/api/wakatime**",
    "**/api/metrics/productive-hours**",
    "**/api/user/pinned-repos/details**",
    "**/api/metrics/repo-explorer**",
    "**/api/metrics/sponsors**",
    "**/api/metrics/achievement-progress**",
  ];

  for (const pattern of stubRoutes) {
    await page.route(pattern, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(mockMetricResponse(route.request().url())),
      })
    );
  }
}

/** Scroll a dashboard widget heading into view before asserting or clicking. */
export async function scrollToWidget(page, headingName) {
  const heading = page.getByRole("heading", { name: headingName }).first();
  await heading.scrollIntoViewIfNeeded();
  await expect(heading).toBeVisible({ timeout: 15_000 });
  return heading;
}

export function streakSection(page) {
  return page
    .getByRole("heading", { name: "Commit Streaks" })
    .first()
    .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
}
