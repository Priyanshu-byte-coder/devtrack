import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { installDashboardApiMocks } from "./helpers/dashboard-mocks";

/**
 * New accounts start on the public leaderboard. The dashboard tells them
 * once, with a one-click "Hide me".
 */

const AUTH_SECRET =
  process.env.NEXTAUTH_SECRET ?? "test-nextauth-secret-for-playwright-tests";

async function signInAs(
  page: import("@playwright/test").Page,
  settings: Record<string, unknown>
) {
  const sessionToken = await encode({
    secret: AUTH_SECRET,
    token: {
      name: "Playwright User",
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
  await installDashboardApiMocks(page);
  await page.route("**/api/auth/session**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: { name: "Playwright User" },
        githubLogin: "playwright-user",
        githubId: "99001",
        expires: "2099-01-01T00:00:00.000Z",
      }),
    })
  );
  const patches: unknown[] = [];
  await page.route("**/api/user/settings**", (route) => {
    if (route.request().method() === "PATCH") {
      patches.push(route.request().postDataJSON());
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ...settings, is_public: false }),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ seen_onboarding: true, ...settings }),
    });
  });
  return patches;
}

test("a new player is told they're on the board and can hide", async ({
  page,
}) => {
  const patches = await signInAs(page, {
    is_public: true,
    leaderboard_opt_in: true,
    public_since: new Date().toISOString(),
  });
  await page.goto("/dashboard/activity");

  const banner = page.getByRole("region", {
    name: "You're on the leaderboard",
  });
  await expect(banner).toBeVisible();
  await expect(
    banner.getByRole("link", { name: "See the board" })
  ).toHaveAttribute("href", "/leaderboard");

  await banner.getByRole("button", { name: "Hide me" }).click();
  await expect(banner).toHaveCount(0);
  expect(patches).toEqual([{ is_public: false, leaderboard_opt_in: false }]);
});

test("players who went public long ago don't see it", async ({ page }) => {
  await signInAs(page, {
    is_public: true,
    leaderboard_opt_in: true,
    public_since: "2025-01-01T00:00:00.000Z",
  });
  await page.goto("/dashboard/activity");
  await expect(
    page.getByRole("heading", { level: 1, name: "Activity" })
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "You're on the leaderboard" })
  ).toHaveCount(0);
});
