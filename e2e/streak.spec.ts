import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { mockMetricResponse } from "./helpers/dashboard-mocks";

const authSecret =
  process.env.NEXTAUTH_SECRET || "test-nextauth-secret-for-playwright-tests";

test.describe("[Streak E2E]", () => {
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
    });

    // Mock the streak endpoint with longest: 21 — the value under test
    await page.route("**/api/metrics/streak**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          current: 5,
          longest: 21,
          lastCommitDate: "2026-05-18",
          totalActiveDays: 30,
          freezeDates: [],
        }),
      });
    });

    // Mock contributions with enough data points to pass StreakTracker's
    // Object.keys(contributionData.data).length === 0 guard.
    // StreakTracker requests days=365, so provide a realistic spread.
    await page.route("**/api/metrics/contributions**", async (route) => {
      // Build 20 days of contribution data so the guard is satisfied
      const data: Record<string, number> = {};
      for (let i = 0; i < 20; i++) {
        const d = new Date("2026-05-18");
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        data[key] = i % 3 === 0 ? 0 : i % 2 + 1;
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          days: 365,
          total: 40,
          data,
          commits: [],
          timeBlocks: { morning: 5, afternoon: 10, evening: 8, night: 2 },
        }),
      });
    });

    // Freeze endpoint — required by StreakTracker's fetchFreeze()
    await page.route("**/api/streak/freeze**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ hasFreeze: false, freezeDate: null }),
      });
    });

    // Stub all other metric/infra routes so the dashboard loads fully
    const stubRoutes = [
      "**/api/metrics/prs**",
      "**/api/metrics/pr-breakdown**",
      "**/api/metrics/issues**",
      "**/api/metrics/repos**",
      "**/api/metrics/languages**",
      "**/api/metrics/pinned-repos**",
      "**/api/metrics/weekly-summary**",
      "**/api/metrics/compare**",
      "**/api/metrics/repo-health**",
      "**/api/metrics/ci**",
      "**/api/metrics/activity**",
      "**/api/metrics/commit-time**",
      "**/api/metrics/personal-records**",
      "**/api/metrics/discussions**",
      "**/api/metrics/pr-review-trend**",
      "**/api/metrics/inactive-repos**",
      "**/api/metrics/coding-time**",
      "**/api/metrics/coding-activity-insights**",
      "**/api/metrics/productive-hours**",
      "**/api/metrics/repo-explorer**",
      "**/api/user/pinned-repos/details**",
      "**/api/user/github-accounts**",
      "**/api/user/settings**",
      "**/api/local-coding/stats**",
      "**/api/wakatime**",
      "**/api/notifications**",
      "**/api/goals/sync**",
      "**/api/goals**",
      "**/api/ai-insights**",
      "**/api/metrics/achievement-progress**",
      "**/api/milestones**",
      "**/api/daily-note**",
      "**/api/accounts**",
      "**/api/user/orgs**",
    ];

    for (const pattern of stubRoutes) {
      await page.route(pattern, async (route) => {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(mockMetricResponse(route.request().url())),
        });
      });
    }

    await page.route("**/api/user/dashboard-layout**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.route("**/api/stream**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "data: {}\n\n",
      });
    });
  });

  test("streak widget shows the mocked longest streak value", async ({
    page,
  }) => {
    // Force prefers-reduced-motion so useCountUp sets the final value
    // immediately (skips the 650ms rAF animation) in headless Chromium.
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto("/dashboard", { waitUntil: "load" });

    // Wait for the dashboard heading — confirms the server-rendered page loaded
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true })
    ).toBeVisible({ timeout: 30_000 });

    // Wait for the "Commit Streaks" heading to exist in the DOM first.
    // It is absent during the loading skeleton phase, so we must wait for
    // it before attempting to build a scoped locator from it.
    const streakHeading = page.getByRole("heading", { name: "Commit Streaks" }).first();
    await expect(streakHeading).toBeVisible({ timeout: 15_000 });

    // Now scope to the nearest rounded-xl ancestor — the containerRef div
    // that wraps both the heading and the stats grid.
    const section = streakHeading.locator(
      'xpath=ancestor::div[contains(@class,"rounded-xl")][1]'
    );

    // The "Longest Streak" stat card contains the number as a raw text node
    // inside a div whose full text content is "21 days" (number + unit span).
    // getByText("21", { exact: true }) never matches because no single element
    // has textContent of exactly "21" — the nearest element reads "21 days".
    // Use the stat card's aria-label to scope to the correct card, then assert
    // the card itself contains the text "21".
    const longestStreakCard = section.locator(
      'div[aria-label="Your longest streak ever"]'
    );
    await expect(longestStreakCard).toBeVisible({ timeout: 5_000 });
    await expect(longestStreakCard).toContainText("21");
  });
});
