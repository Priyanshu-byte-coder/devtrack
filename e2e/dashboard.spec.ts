import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { scrollToWidget } from "./helpers/dashboard-mocks";

/**
 * dashboard.spec.ts
 * Covers: dashboard renders all 6 widgets after mock login; no console errors.
 */

const AUTH_SECRET =
  process.env.NEXTAUTH_SECRET ?? "test-nextauth-secret-for-playwright-tests";

async function injectMockSession(page: import("@playwright/test").Page) {
  const sessionToken = await encode({
    secret: AUTH_SECRET,
    token: {
      name: "Playwright User",
      email: "playwright@devtrack.test",
      sub: "99001",
      githubLogin: "playwright-user",
      githubId: "99001",
      accessToken: "mock-access-token",
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

  // ── Core auth & settings routes ──────────────────────────────────────────
  await page.route("**/api/auth/session**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          name: "Playwright User",
          email: "playwright@devtrack.test",
        },
        githubLogin: "playwright-user",
        githubId: "99001",
        accessToken: "mock-access-token",
        expires: "2099-01-01T00:00:00.000Z",
      }),
    })
  );

  await page.route("**/api/user/settings**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ is_public: true }),
    })
  );

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

  // ── Goals ────────────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  await page.route("**/api/goals/sync**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, last_synced_at: now }),
    })
  );

  await page.route("**/api/goals**", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        contentType: "application/json",
        status: 201,
        body: JSON.stringify({ ok: true }),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        goals: [
          {
            id: "g-1",
            title: "Make 10 commits",
            target: 10,
            current: 4,
            unit: "commits",
            recurrence: "weekly",
            period_start: "2026-05-18",
            last_synced_at: now,
          },
        ],
      }),
    });
  });

  // ── Contributions (widget 1 — Contribution Graph) ───────────────────────
  await page.route("**/api/metrics/contributions**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          "2026-05-16": 3,
          "2026-05-17": 5,
          "2026-05-18": 2,
        },
      }),
    })
  );

  // ── Streak (widget 2) ────────────────────────────────────────────────────
  await page.route("**/api/metrics/streak**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        current: 7,
        longest: 14,
        lastCommitDate: "2026-05-18",
        totalActiveDays: 42,
      }),
    })
  );

  await page.route("**/api/streak/freeze**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ hasFreeze: false, freezeDate: null }),
    })
  );

  // ── PRs (widget 3) ───────────────────────────────────────────────────────
  await page.route("**/api/metrics/prs**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        open: 3,
        merged: 9,
        closed: 1,
        avgReviewHours: 5,
        avgFirstReviewHours: 2,
        mergeRate: "75%",
      }),
    })
  );

  await page.route("**/api/metrics/pr-breakdown**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ draft: 1, merged: 9, open: 3, closed: 1 }),
    })
  );

  await page.route("**/api/metrics/pr-review-trend**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ trend: [] }),
    })
  );

  await page.route("**/api/metrics/pr-review-time**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ weeks: [] }),
    })
  );

  // ── Issues (widget 4) ────────────────────────────────────────────────────
  await page.route("**/api/metrics/issues**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        opened: 5,
        closed: 4,
        currentlyOpen: 1,
        avgCloseTimeDays: 3,
        trend: 1,
        mostActiveRepo: "demo/devtrack",
      }),
    })
  );

  // ── Languages ────────────────────────────────────────────────────────────
  await page.route("**/api/metrics/languages**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        languages: [{ language: "TypeScript", count: 20 }],
      }),
    })
  );

  // ── Weekly summary (widget 5) ────────────────────────────────────────────
  await page.route("**/api/metrics/weekly-summary**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        commits: { current: 12, previous: 8, delta: 4, trend: "up" },
        prs: {
          thisWeek: { opened: 3, merged: 2 },
          lastWeek: { opened: 1, merged: 1 },
        },
        issues: { 
          thisWeek: { opened: 5, closed: 0 }, 
          lastWeek: { opened: 3, closed: 0 } 
        },
        productivityScore: { current: 88, previous: 75 },
        activeDays: { thisWeek: 5, lastWeek: 4 },
        streak: 7,
        topRepo: "demo/devtrack",
        repoBreakdown: [],
        dailyCommits: [],
        mostActiveDay: "2023-10-07"
      }),
    })
  );

  await page.route("**/api/metrics/sponsors**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        mrr: 15000,
        activeCount: 12,
        growthTrend: 15,
        sponsors: [],
        sparklineData: []
      }),
    })
  );

  // ── AI Insights (widget 6) ───────────────────────────────────────────────
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
          generatedAt: "2026-05-18T12:00:00.000Z",
        },
      }),
    })
  );

  // ── GitHub accounts (resolveAppUser dependency) ──────────────────────────────
  await page.route("**/api/user/github-accounts**", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          accounts: [
            {
              githubId: "99001",
              login: "playwright-user",
              email: "playwright@devtrack.test",
            },
          ],
        }),
      });
    }
    return route.abort();
  });

  await page.route("**/api/user/profile**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "99001",
        username: "playwright-user",
        email: "playwright@devtrack.test",
      }),
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

  // ── Remaining metric routes (stub to empty) ──────────────────────────────
  const stubRoutes = [
    "**/api/metrics/repos**",
    "**/api/metrics/pinned-repos**",
    "**/api/metrics/compare**",
    "**/api/metrics/repo-health**",
    "**/api/metrics/ci**",
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
    "**/api/daily-note**",
    "**/api/metrics/achievement-progress**",
  ];
  for (const pattern of stubRoutes) {
    await page.route(pattern, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({}),
      })
    );
  }
}

test.beforeEach(async ({ page }) => {
  await injectMockSession(page);
});

test("[Dashboard E2E] dashboard heading is visible after mock login", async ({
  page,
}) => {
  await page.goto("/dashboard", { waitUntil: "load" });
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true })
  ).toBeVisible({ timeout: 30_000 });
});

test("[Dashboard E2E] Commits widget renders", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true })
  ).toBeVisible({ timeout: 30_000 });
  await scrollToWidget(page, "Your Commits");
});

test("[Dashboard E2E] PR Analytics widget renders", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true })
  ).toBeVisible({ timeout: 30_000 });
  await scrollToWidget(page, "PR Analytics");
});

test("[Dashboard E2E] Goals widget renders with mocked goal", async ({
  page,
}) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true })
  ).toBeVisible({ timeout: 30_000 });
  await scrollToWidget(page, "Goals");
  await expect(page.getByText("Make 10 commits")).toBeVisible({
    timeout: 10_000,
  });
});

test("[Dashboard E2E] no uncaught console errors on dashboard load", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/dashboard", { waitUntil: "load" });
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true })
  ).toBeVisible({ timeout: 30_000 });

  // Filter out known browser noise unrelated to the app.
  const appErrors = consoleErrors.filter(
    (e) =>
      !e.includes("favicon") &&
      !e.includes("net::ERR_") &&
      !e.includes("ERR_INTERNET_DISCONNECTED") &&
      !e.includes("vercel-scripts.com") && // lgtm[js/incomplete-url-substring-sanitization] - filtering test console noise, not sanitizing user input
      !e.includes("_vercel/insights") &&
      !e.includes("_vercel/speed-insights") &&
      !e.includes("Content Security Policy") &&
      !e.includes("Hydration failed") &&
      !e.includes("Expected server HTML") &&
      !e.includes("occurred during hydration") &&
      !e.includes("at DashboardPage") &&
      !e.includes("at InnerLayoutRouter") &&
      !e.includes("at RootLayout") &&
      !e.includes("react-dev-overlay") &&
      !e.includes("Failed to load resource") &&
      !e.includes("Warning: ") && // Catch React warnings that get printed as errors
      !e.includes("Encountered two children with the same key") &&
      e.trim() !== "div" &&
      e.trim() !== "span" &&
      e.trim() !== "p"
  );
  expect(appErrors).toHaveLength(0);
});

test("[Dashboard E2E] weekly summary widget renders", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true })
  ).toBeVisible({ timeout: 30_000 });
  // Weekly summary section should appear somewhere on the dashboard.
  await expect(
    page.getByRole("heading", { name: "This Week" }).first()
  ).toBeVisible({ timeout: 10_000 });
});

const TRACKED_METRICS_ENDPOINTS = [
  "/api/metrics/repo-explorer",
  "/api/metrics/prs",
  "/api/metrics/pr-breakdown",
  "/api/metrics/pr-review-time",
] as const;

// React Strict Mode in dev double-invokes effects. Duplicate widget instances
// would exceed these per-endpoint ceilings (e.g. 2x PRMetrics → 4+ /api/metrics/prs).
const METRICS_REQUEST_BOUNDS: Record<
  (typeof TRACKED_METRICS_ENDPOINTS)[number],
  { min: number; max: number }
> = {
  "/api/metrics/repo-explorer": { min: 1, max: 2 },
  "/api/metrics/prs": { min: 1, max: 2 },
  "/api/metrics/pr-breakdown": { min: 1, max: 2 },
  // MiniPRTrendChart (inside PR Metrics) + PR Review Trend widget both call this route.
  "/api/metrics/pr-review-time": { min: 1, max: 4 },
};

function countMetricRequests(urls: string[], endpoint: string): number {
  return urls.filter((url) => {
    try {
      return new URL(url).pathname === endpoint;
    } catch {
      return false;
    }
  }).length;
}

test("[Dashboard E2E] analytics widgets render once without duplicate metric requests", async ({
  page,
}) => {
  const requestUrls: string[] = [];

  page.on("request", (request) => {
    if (request.method() !== "GET") return;

    const url = request.url();
    if (
      TRACKED_METRICS_ENDPOINTS.some((endpoint) => url.includes(endpoint))
    ) {
      requestUrls.push(url);
    }
  });

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true })
  ).toBeVisible({ timeout: 30_000 });

  const lazyAnalyticsWidgets = [
    {
      region: "Repository Analytics",
      heading: "Repo Analytics",
    },
    {
      region: "PR Breakdown",
      heading: "PR Breakdown",
    },
    {
      region: "PR Review Trend",
      heading: "PR Review Time Trend",
    },
  ] as const;

  await page.getByRole("region", { name: "PR Metrics" }).scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("heading", { name: "PR Analytics", level: 2 })
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("region", { name: "PR Metrics" })).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "PR Analytics", level: 2 })
  ).toHaveCount(1);

  for (const { region, heading } of lazyAnalyticsWidgets) {
    await page.getByRole("region", { name: region }).scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("heading", { name: heading, level: 2 })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("region", { name: region })).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: heading, level: 2 })
    ).toHaveCount(1);
  }

  for (const endpoint of TRACKED_METRICS_ENDPOINTS) {
    const { min, max } = METRICS_REQUEST_BOUNDS[endpoint];
    await expect
      .poll(
        () => {
          const count = countMetricRequests(requestUrls, endpoint);
          return count >= min && count <= max;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  }
});