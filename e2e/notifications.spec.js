import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";

const authSecret =
  process.env.NEXTAUTH_SECRET || "test-nextauth-secret-for-playwright-tests";

/** Returns a properly-shaped mock response for each metric endpoint. */
function mockMetricResponse(url) {
  if (url.includes("/api/metrics/prs"))
    return {
      open: 2,
      merged: 8,
      closed: 1,
      avgReviewHours: 6,
      avgFirstReviewHours: 3,
      mergeRate: "80%",
    };
  if (url.includes("/api/metrics/pr-breakdown"))
    return { draft: 1, merged: 8, open: 2, closed: 1 };
  if (url.includes("/api/metrics/issues"))
    return {
      opened: 4,
      closed: 3,
      currentlyOpen: 1,
      avgCloseTimeDays: 2,
      trend: 1,
      mostActiveRepo: "demo/repo",
    };
  if (
    url.includes("/api/metrics/repos") ||
    url.includes("/api/metrics/pinned-repos")
  )
    return {
      repos: [
        { name: "demo/repo", commits: 12, url: "https://github.com/demo/repo" },
      ],
    };
  if (url.includes("/api/metrics/languages"))
    return { languages: [{ language: "TypeScript", count: 12 }] };
  if (url.includes("/api/metrics/streak"))
    return {
      current: 3,
      longest: 9,
      lastCommitDate: "2026-05-18",
      totalActiveDays: 12,
      freezeDates: [],
    };
  if (url.includes("/api/streak/freeze"))
    return { hasFreeze: false, freezeDate: null };
  if (url.includes("/api/metrics/sponsors"))
    return { mrr: 15000, activeCount: 12, growthTrend: 15, sponsors: [], sparklineData: [] };
  if (url.includes("/api/metrics/weekly-summary"))
    return {
      commits: { current: 10, previous: 7, delta: 3, trend: "up" },
      prs: {
        thisWeek: { opened: 3, merged: 2 },
        lastWeek: { opened: 1, merged: 1 },
      },
      issues: { 
        thisWeek: { opened: 4, closed: 2 }, 
        lastWeek: { opened: 3, closed: 1 } 
      },
      productivityScore: { current: 85, previous: 80 },
      activeDays: { thisWeek: 5, lastWeek: 4 },
      streak: 3,
      topRepo: "demo/repo",
      repoBreakdown: [],
      dailyCommits: [],
      mostActiveDay: "2023-10-07"
    };
  if (url.includes("/api/metrics/compare"))
    return { user: { commits: 10 }, friend: { commits: 8 } };
  if (url.includes("/api/metrics/repo-health")) return { repositories: [] };
  if (url.includes("/api/metrics/ci"))
    return {
      successRate: 95,
      averageDurationMinutes: 3,
      flakiestWorkflow: null,
      totalRuns: 42,
      reposChecked: 5,
    };
  if (url.includes("/api/metrics/activity")) return { data: [] };
  if (url.includes("/api/metrics/commit-time")) return { data: [] };
  if (url.includes("/api/metrics/personal-records")) return { records: [] };
  if (url.includes("/api/metrics/discussions"))
    return { total: 0, answered: 0 };
  if (url.includes("/api/metrics/pr-review-trend")) return { trend: [] };
  if (url.includes("/api/metrics/inactive-repos")) return { repos: [] };
  if (url.includes("/api/metrics/coding-time") || url.includes("/api/wakatime"))
    return {
      hasData: false,
      not_configured: true,
      todaysSeconds: 0,
      totalSeconds7Days: 0,
      chartData: [],
      topLanguage: "",
      topProject: "",
    };
  if (url.includes("/api/metrics/coding-activity-insights"))
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
  if (url.includes("/api/metrics/contributions"))
    return {
      days: 365,
      total: 10,
      data: { "2026-05-16": 3, "2026-05-17": 5, "2026-05-18": 2 },
    };
  if (url.includes("/api/metrics/productive-hours"))
    return { grid: [], peak: null, total: 0, days: 0, timezone: "UTC" };
  if (url.includes("/api/user/pinned-repos/details"))
    return { pinnedRepos: [] };
  if (url.includes("/api/metrics/repo-explorer")) return { repos: [] };
  return {};
}

test.beforeEach(async ({ page }) => {
  const sessionToken = await encode({
    secret: authSecret,
    token: {
      name: "Playwright User",
      email: "playwright@example.com",
      sub: "12345",
      githubLogin: "playwright-user",
      githubId: "12345",
      accessToken: "test-token",
    },
    maxAge: 60 * 60,
  });

  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: sessionToken,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
      expires: Math.floor(Date.now() / 1000) + 60 * 60,
    },
  ]);

  await page.route("**/api/auth/session**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: { name: "Playwright User", email: "playwright@example.com" },
        githubLogin: "playwright-user",
        githubId: "12345",
        accessToken: "test-token",
        expires: "2099-01-01T00:00:00.000Z",
      }),
    });
  });

  await page.route("**/api/user/settings", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ is_public: true }),
    });
  });

  await page.route("**/api/notifications**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ notifications: [], unreadCount: 0 }) });
  });

  await page.route("**/api/milestones**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ milestones: [] }),
    });
  });

  await page.route("**/api/accounts**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ accounts: [] }),
    });
  });

  await page.route("**/api/user/orgs**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ accounts: [], config: {} }),
    });
  });

  await page.route("**/api/user/github-accounts", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ accounts: [] }),
    });
  });

  await page.route("**/api/goals/sync", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ updated: 1, commitCount: 4 }),
    });
  });

  await page.route("**/api/goals**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        contentType: "application/json",
        status: 201,
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        goals: [
          {
            id: "goal-1",
            title: "Make 10 commits",
            target: 10,
            current: 4,
            unit: "commits",
            recurrence: "weekly",
            period_start: "2026-05-18",
            last_synced_at: new Date().toISOString(),
          },
        ],
      }),
    });
  });

  await page.route("**/api/ai-insights**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          insights: [
            {
              id: "insight-1",
              type: "productivity",
              title: "High Consistency",
              description: "You have coded 5 days this week!",
              severity: "positive",
            },
          ],
          trend: { direction: "up", percentage: 15 },
          aiSummary: "Great job shipping features this week.",
          generatedAt: "2026-05-18T12:00:00.000Z",
        },
      }),
    });
  });

  const metricRoutes = [
    "**/api/metrics/prs**",
    "**/api/metrics/pr-breakdown**",
    "**/api/metrics/issues**",
    "**/api/metrics/repos**",
    "**/api/metrics/languages**",
    "**/api/metrics/streak**",
    "**/api/metrics/pinned-repos**",
    "**/api/metrics/weekly-summary**",
    "**/api/metrics/compare**",
    "**/api/metrics/repo-health**",
    "**/api/metrics/ci**",
    "**/api/streak/freeze**",
    "**/api/metrics/activity**",
    "**/api/metrics/commit-time**",
    "**/api/metrics/personal-records**",
    "**/api/metrics/discussions**",
    "**/api/metrics/pr-review-trend**",
    "**/api/metrics/inactive-repos**",
    "**/api/metrics/contributions**",
    "**/api/metrics/coding-time**",
    "**/api/metrics/coding-activity-insights**",
    "**/api/local-coding/stats**",
    "**/api/wakatime**",
    "**/api/metrics/productive-hours**",
    "**/api/user/pinned-repos/details**",
    "**/api/metrics/repo-explorer**",
    "**/api/metrics/pr-review-time**",
    "**/api/metrics/achievement-progress**",
    "**/api/metrics/sponsors**",
  ];

  for (const pattern of metricRoutes) {
    await page.route(pattern, async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(mockMetricResponse(route.request().url())),
      });
    });
  }

  await page.route("**/api/streak/freeze**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ hasFreeze: false, freezeDate: null }) });
  });

  await page.route("**/api/stream**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: "data: {}\n\n",
    });
  });

  await page.route("**/api/user/dashboard-layout**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ layout: null }) });
    } else {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
  });

  await page.route("**/api/daily-note**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ note: null }) });
  });
});

test("notification bell opens and closes drawer", async ({ page }) => {
  await page.route("**/api/notifications**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        notifications: [
          {
            id: "1",
            type: "info",
            message: "Test notification",
            read: false,
            created_at: new Date().toISOString(),
          },
        ],
        unreadCount: 1,
      }),
    });
  });

  await page.goto("/dashboard", { waitUntil: "load" });

  // Wait for the dashboard to fully render
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 30000 });

  // Find and click the notification bell
  const bellButton = page.getByRole("button", { name: /Notifications/ }).first();
  await expect(bellButton).toBeVisible({ timeout: 10000 });

  await bellButton.click();
  const drawerHeading = page.getByRole("heading", { name: "Notifications" });
  await expect(drawerHeading).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Test notification")).toBeVisible({
    timeout: 5000,
  });

  // Click again to close
  await bellButton.click();
  await expect(drawerHeading).not.toBeVisible({ timeout: 5000 });
});

test("notification search filters and highlights correctly", async ({ page }) => {
  await page.route("**/api/notifications**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        notifications: [
          {
            id: "1",
            type: "info",
            message: "Alpha notification message",
            read: false,
            created_at: new Date().toISOString(),
          },
          {
            id: "2",
            type: "info",
            message: "Beta alert message",
            read: false,
            created_at: new Date().toISOString(),
          },
        ],
        unreadCount: 2,
      }),
    });
  });

  await page.goto("/dashboard", { waitUntil: "load" });

  // Wait for the dashboard to fully render
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 30000 });

  // Open the notifications drawer
  const bellButton = page.getByRole("button", { name: /Notifications/ });
  await bellButton.click();

  // Verify both notifications are visible initially
  await expect(page.getByText("Alpha notification message")).toBeVisible();
  await expect(page.getByText("Beta alert message")).toBeVisible();

  // Verify search input is autodefocussed (focused)
  const searchInput = page.getByPlaceholder("Search notifications...");
  await expect(searchInput).toBeFocused();

  // Type "Alpha" into search
  await searchInput.fill("Alpha");
  // Wait for debounce (150ms)
  await page.waitForTimeout(250);

  // Alpha should be visible with highlighted matching text, Beta should not
  await expect(page.getByText("Alpha notification message")).toBeVisible();
  await expect(page.getByText("Beta alert message")).not.toBeVisible();
  await expect(page.locator("mark").filter({ hasText: "Alpha" })).toBeVisible();

  // Test special character input in search query (should not crash page)
  await searchInput.fill("Alpha (test)");
  await page.waitForTimeout(250);
  await expect(page.getByText("No results for 'Alpha (test)'")).toBeVisible();

  // Test clear search button
  const clearButton = page.getByRole("button", { name: "Clear search" });
  await expect(clearButton).toBeVisible();
  await clearButton.click();

  // Verify search query is cleared and both are visible again
  await expect(searchInput).toHaveValue("");
  await expect(page.getByText("Alpha notification message")).toBeVisible();
  await expect(page.getByText("Beta alert message")).toBeVisible();
});
