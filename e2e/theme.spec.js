import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { installDashboardApiMocks } from "./helpers/dashboard-mocks.js";

const authSecret =
  process.env.NEXTAUTH_SECRET ||
  "test-nextauth-secret-for-playwright-tests";

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
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ notifications: [], unreadCount: 0 }),
    });
  });

  await page.route("**/api/goals**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ goals: [] }),
    });
  });

  await installDashboardApiMocks(page);
});

test("theme selector switches between themes on the dashboard", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true })
  ).toBeVisible({ timeout: 30_000 });

  const themeSelect = page.getByRole("combobox", {
    name: "Select dashboard theme",
  });
  await expect(themeSelect).toBeVisible({ timeout: 10_000 });

  const initialValue = await themeSelect.inputValue();
  const nextTheme =
    initialValue === "classic-dark" ? "modern-light-blue" : "classic-dark";
  await themeSelect.selectOption(nextTheme);

  await expect(themeSelect).toHaveValue(nextTheme);
  const stored = await page.evaluate(() => localStorage.getItem("theme"));
  expect(stored).toBe(nextTheme);

  // Reload the page and verify theme persists
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(themeSelect).toHaveValue(nextTheme);
});

/**
 * Issue #964: Public profile page should have a theme toggle.
 * The toggle must work without login and persist to localStorage.
 * We navigate to the profile-not-found page because no real user exists
 * in the test DB — but the layout (ThemeProvider + ThemeToggle) still renders.
 */
test("public profile page theme selector works without authentication", async ({
  page,
}) => {
  // Clear cookies so visitor is unauthenticated
  await page.context().clearCookies();

  // OVERRIDE: Mock the session endpoint to return an unauthenticated state
  // This prevents the authenticated mock from beforeEach from leaking into this test.
  await page.route("**/api/auth/session**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({}), // NextAuth interprets an empty object (or null) as unauthenticated
    });
  });

  // Navigate to any public profile URL — will show "Profile Not Found"
  // but the full layout (including ThemeToggle) still renders
  await page.goto("/u/no-such-user-for-e2e-test", { waitUntil: "load" });

  // Confirm we're on the public profile route (no auth redirect)
  await expect(page).toHaveURL(/\/u\//);

  // AppNavbar uses the compact theme menu on public routes
  const themeToggle = page.getByRole("banner").getByRole("button", { name: "Choose theme" });
  await expect(themeToggle).toBeVisible({ timeout: 10000 });

  const initialTheme = await page.evaluate(() => localStorage.getItem("theme") ?? "classic-dark");
  const nextTheme = initialTheme === "classic-dark" ? "modern-light-blue" : "classic-dark";
  const nextThemeLabel = nextTheme === "classic-dark" ? "Classic Dark" : "Modern Light Blue";

  await themeToggle.click({ force: true });
  await expect(page.getByRole("menu", { name: "Theme options" })).toBeVisible();
  await page.getByRole("menuitemradio", { name: new RegExp(nextThemeLabel, "i") }).click();

  // Theme preference must be persisted to localStorage
  const stored = await page.evaluate(() => localStorage.getItem("theme"));
  expect(stored).toBe(nextTheme);

  // Reload the page and verify theme persists on the profile page
  await page.reload({ waitUntil: "load" });
  await expect(page.getByRole("banner").getByRole("button", { name: "Choose theme" })).toBeVisible();
  const storedAfterReload = await page.evaluate(() => localStorage.getItem("theme"));
  expect(storedAfterReload).toBe(nextTheme);
});

/**
 * Issue #3807: the theme can be switched from the sidebar, the top navbar and
 * the Settings page, and all three must stay in sync, also after a reload.
 * The sidebar and the Settings select live on /dashboard/settings; the top
 * navbar menu only renders outside the signed-in shell (it returns null under
 * /dashboard), so it is driven on a public profile page.
 */
async function mockSettingsPageApis(page) {
  await page.route("**/api/user/settings**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "1",
        github_login: "playwright-user",
        is_public: false,
        leaderboard_opt_in: false,
        has_wakatime_key: false,
      }),
    });
  });
  for (const [pattern, body] of [
    ["**/api/user/github-accounts", { accounts: [] }],
    ["**/api/milestones**", { milestones: [] }],
    ["**/api/daily-note**", { todayNote: "", yesterdayNote: "" }],
    ["**/api/accounts**", { accounts: [] }],
    ["**/api/user/orgs**", { accounts: [], config: {} }],
  ]) {
    await page.route(pattern, async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
  }
}

async function openSettings(page) {
  await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true })
  ).toBeVisible({ timeout: 30_000 });
  return {
    sidebar: page.getByRole("combobox", { name: "Select dashboard theme" }),
    settingsCard: page.locator("#theme-select"),
  };
}

test("sidebar and Settings theme selectors stay in sync, also after a reload", async ({
  page,
}) => {
  await mockSettingsPageApis(page);
  const { sidebar, settingsCard } = await openSettings(page);
  await expect(sidebar).toBeVisible();
  await expect(settingsCard).toBeVisible();

  // Sidebar -> Settings card and <html>
  await sidebar.selectOption("nordic-frost");
  await expect(settingsCard).toHaveValue("nordic-frost");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "nordic-frost");

  // Settings card -> sidebar and <html>
  await settingsCard.selectOption("modern-light-blue");
  await expect(sidebar).toHaveValue("modern-light-blue");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "modern-light-blue");
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);

  // Back to a dark theme from the sidebar: both controls and <html> follow
  await sidebar.selectOption("cyberpunk-matrix");
  await expect(settingsCard).toHaveValue("cyberpunk-matrix");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(sidebar).toHaveValue("cyberpunk-matrix");
  await expect(settingsCard).toHaveValue("cyberpunk-matrix");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "cyberpunk-matrix");
});

test("a theme picked in the top navbar shows in the sidebar and Settings, and the other way round", async ({
  page,
}) => {
  await mockSettingsPageApis(page);

  // Top navbar (public profile, signed out) -> Settings page. The navbar menu
  // is only reachable signed out here, so drop the session for this step and
  // restore it before opening Settings.
  const signedInCookies = await page.context().cookies();
  const signedOutSession = (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({}) });
  const signedInSession = (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: { name: "Playwright User", email: "playwright@example.com" },
        githubLogin: "playwright-user",
        githubId: "12345",
        expires: "2099-01-01T00:00:00.000Z",
      }),
    });
  await page.context().clearCookies();
  await page.route("**/api/auth/session**", signedOutSession);
  await page.goto("/u/no-such-user-for-e2e-test", { waitUntil: "load" });
  const navbarToggle = page
    .getByRole("banner")
    .getByRole("button", { name: "Choose theme" });
  await expect(navbarToggle).toBeVisible({ timeout: 10_000 });
  await navbarToggle.click();
  await page
    .getByRole("menuitemradio", { name: /Nordic Frost/i })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "nordic-frost");

  await page.unroute("**/api/auth/session**", signedOutSession);
  await page.context().addCookies(signedInCookies);
  await page.route("**/api/auth/session**", signedInSession);
  const { sidebar, settingsCard } = await openSettings(page);
  await expect(sidebar).toHaveValue("nordic-frost");
  await expect(settingsCard).toHaveValue("nordic-frost");

  // Settings card -> top navbar (checked on the public profile page)
  await settingsCard.selectOption("modern-light-blue");
  await expect(sidebar).toHaveValue("modern-light-blue");

  await page.context().clearCookies();
  await page.unroute("**/api/auth/session**", signedInSession);
  await page.route("**/api/auth/session**", signedOutSession);
  await page.goto("/u/no-such-user-for-e2e-test", { waitUntil: "load" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "modern-light-blue");
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Choose theme" })
    .click();
  await expect(
    page.getByRole("menuitemradio", { name: /Modern Light Blue/i })
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("menuitemradio", { name: /Nordic Frost/i })
  ).toHaveAttribute("aria-checked", "false");
});
