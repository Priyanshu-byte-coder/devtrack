import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";

const authSecret =
  process.env.NEXTAUTH_SECRET || "test-nextauth-secret-for-playwright-tests";

async function setTheme(page, theme) {
  await page.addInitScript((themeName) => {
    window.localStorage.setItem("theme", themeName);
    document.documentElement.dataset.theme = themeName;

    if (themeName.includes("dark")) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, theme);

  await page.emulateMedia({
    colorScheme: theme.includes("dark") ? "dark" : "light",
  });
}

async function stabilize(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(500);
}

const VIEWPORT_SCREENSHOT_CLIP = { x: 0, y: 0, width: 1280, height: 900 };

async function expectViewportScreenshot(page, name) {
  await expect(page).toHaveScreenshot(name, {
    clip: VIEWPORT_SCREENSHOT_CLIP,
  });
}

async function mockAuthenticatedSession(page) {
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
}

async function mockDashboardApis(page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/auth/session") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            name: "Playwright User",
            email: "playwright@example.com",
          },
          githubLogin: "playwright-user",
          githubId: "12345",
          accessToken: "test-token",
          expires: "2099-01-01T00:00:00.000Z",
        }),
      });
    }

    if (path === "/api/stream") {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "data: {}\n\n",
      });
    }

    if (path === "/api/user/settings") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ is_public: true }),
      });
    }

    if (path.includes("/api/public/")) {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          name: "Playwright User",
          githubLogin: "playwright-user",
          bio: "Test user for visual regression",
          profileImage: null,
          is_public: true,
        }),
      });
    }

    if (path === "/api/notifications") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ notifications: [], unreadCount: 0 }),
      });
    }

    if (path === "/api/milestones") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ milestones: [] }),
      });
    }

    if (path === "/api/daily-note") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ todayNote: "", yesterdayNote: "" }),
      });
    }

    if (path === "/api/accounts") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ accounts: [] }),
      });
    }

    if (path === "/api/user/orgs") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ accounts: [], config: {} }),
      });
    }

    if (path === "/api/ai-insights") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            insights: [
              {
                id: "insight-1",
                type: "productivity",
                title: "High Consistency",
                description: "You maintained a strong contribution rhythm.",
                severity: "positive",
              },
            ],
            trend: { direction: "up", percentage: 15 },
            aiSummary: "Great consistency across commits and pull requests.",
            generatedAt: "2026-06-01T10:00:00.000Z",
          },
        }),
      });
    }

    if (path === "/api/goals/sync") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          last_synced_at: "2026-06-01T10:00:00.000Z",
        }),
      });
    }

    if (path === "/api/goals") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          goals: [
            {
              id: "goal-1",
              title: "Ship 3 pull requests",
              target: 3,
              current: 2,
              unit: "prs",
              recurrence: "weekly",
              period_start: "2026-06-01",
              last_synced_at: "2026-06-01T10:00:00.000Z",
            },
          ],
        }),
      });
    }

    if (path === "/api/user/dashboard-layout") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ layout: null }),
      });
    }

    if (path === "/api/metrics/contributions") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            "2026-05-25": 3,
            "2026-05-26": 5,
            "2026-05-27": 2,
            "2026-05-28": 4,
            "2026-05-29": 6,
            "2026-05-30": 1,
            "2026-05-31": 7,
          },
        }),
      });
    }

    if (path.startsWith("/api/metrics/")) {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(mockMetricResponse(path)),
      });
    }

    if (path === "/api/streak/freeze") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ freezes: [] }),
      });
    }

    if (path === "/api/user/github-accounts") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ accounts: [] }),
      });
    }

    if (path === "/api/integrations/jira") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(null),
      });
    }

    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
}

function mockMetricResponse(path) {
  if (path.includes("/prs")) {
    return {
      open: 2,
      merged: 8,
      closed: 1,
      avgReviewHours: 6,
      avgFirstReviewHours: 3,
      mergeRate: "80%",
    };
  }

  if (path.includes("/pr-breakdown")) {
    return { draft: 1, merged: 8, open: 2, closed: 1 };
  }

  if (path.includes("/issues")) {
    return {
      opened: 4,
      closed: 3,
      currentlyOpen: 1,
      avgCloseTimeDays: 2,
      trend: 1,
      mostActiveRepo: "playwright/demo",
    };
  }

  if (path.includes("/repos") || path.includes("/pinned-repos")) {
    return {
      repos: [
        {
          name: "playwright/demo",
          commits: 12,
          url: "https://github.com/playwright/demo",
        },
      ],
      pinnedRepos: [],
    };
  }

  if (path.includes("/languages")) {
    return {
      languages: [
        { language: "TypeScript", count: 12 },
        { language: "JavaScript", count: 5 },
      ],
    };
  }

  if (path.includes("/streak")) {
    return {
      current: 8,
      longest: 21,
      lastCommitDate: "2026-06-01",
      totalActiveDays: 18,
    };
  }

  if (path.includes("/weekly-summary")) {
    return {
      commits: { current: 14, previous: 9, delta: 5, trend: "up" },
      prs: {
        thisWeek: { opened: 3, merged: 2 },
        lastWeek: { opened: 1, merged: 1 },
      },
      issues: { thisWeek: 4, lastWeek: 3 },
      productivityScore: { current: 86, previous: 78 },
      activeDays: { thisWeek: 5, lastWeek: 4 },
      streak: 8,
      topRepo: "playwright/demo",
    };
  }

  if (path.includes("/compare")) {
    return { user: { commits: 14 }, friend: { commits: 8 } };
  }

  if (path.includes("/ci")) {
    return {
      successRate: 95,
      averageDurationMinutes: 3,
      flakiestWorkflow: null,
      totalRuns: 42,
      reposChecked: 5,
    };
  }

  if (path.includes("/coding-time") || path.includes("/wakatime")) {
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

  if (path.includes("/coding-activity-insights")) {
    return {
      hourlyCounts: [],
      mostActiveHour: { hour: 10, count: 4, label: "10 AM" },
      leastActiveHour: { hour: 2, count: 0, label: "2 AM" },
      totalActivities: 24,
      averageDailyCommits: 3,
      consistencyScore: 82,
      productivityLevel: "High",
      timezone: "UTC",
    };
  }

  if (path.includes("/productive-hours")) {
    return { grid: [], peak: null, total: 0, days: 0, timezone: "UTC" };
  }

  if (path.includes("/repo-explorer")) {
    return { repos: [] };
  }

  if (path.includes("/sponsors")) {
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

test.describe("visual regression screenshots", () => {
  test("landing page full page screenshot in dark mode", async ({ page }) => {
    await setTheme(page, "classic-dark");
    await page.goto("/", { waitUntil: "load" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await stabilize(page);

    await expect(page).toHaveScreenshot("landing-page-dark.png", {
      clip: { x: 0, y: 0, width: 1280, height: 4400 },
    });
  });

  test("sign-in page screenshot", async ({ page }) => {
    await setTheme(page, "classic-dark");
    await page.goto("/auth/signin", { waitUntil: "load" });
    await expect(
      page.getByRole("button", { name: "Sign in with GitHub" })
    ).toBeVisible();
    await stabilize(page);

    await expectViewportScreenshot(page, "sign-in-page.png");
  });

  test("dashboard header screenshots in dark and light mode", async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockDashboardApis(page);
    await page.addInitScript(() => {
      const fixedTime = new Date(2026, 4, 18, 19, 0, 0).valueOf();
      const RealDate = Date;
      
    class MockDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) {
          super(fixedTime);
          return;
        }
        super(...args);
      } 
      
      static now() {
      return fixedTime;
      }
    }
    
    globalThis.Date = MockDate;
  });
  
    await setTheme(page, "classic-dark");
    await page.goto("/dashboard", { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await stabilize(page);

    await expect(page).toHaveScreenshot("dashboard-header-dark.png", {
      clip: { x: 0, y: 0, width: 1280, height: 420 },
    });

    await page.evaluate(() => {
      window.localStorage.setItem("theme", "modern-light-blue");
      document.documentElement.dataset.theme = "modern-light-blue";
      document.documentElement.classList.remove("dark");
    });
    await page.emulateMedia({ colorScheme: "light" });
    // Re-apply mocks before reload
    await page.reload({ waitUntil: "load" }); 
    await mockDashboardApis(page);
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await stabilize(page);

    await expect(page).toHaveScreenshot("dashboard-header-light.png", {
      clip: { x: 0, y: 0, width: 1280, height: 420 },
    });
  });

  test("public profile screenshot with deterministic mock data", async ({
    page,
  }) => {
    await mockDashboardApis(page);
    await setTheme(page, "classic-dark");
    await page.goto("/u/playwright-user", { waitUntil: "load" });
    await expect(
      page.getByRole("heading", { name: "@playwright-user", exact: false })
    ).toBeVisible({ timeout: 30_000 });
    await stabilize(page);

    await expectViewportScreenshot(page, "public-profile-mock-data.png");
  });

    test("404 page screenshot", async ({ page }) => {
    await setTheme(page, "classic-dark");

    const response = await page.goto("/visual-regression-missing-page", {
      waitUntil: "load",
    });

    expect(response?.status()).toBe(404);
    await expect(page.locator("body")).toContainText(
      /404|not found|could not be found/i
    );

    await stabilize(page);

    await expectViewportScreenshot(page, "not-found-page.png");
  });
});