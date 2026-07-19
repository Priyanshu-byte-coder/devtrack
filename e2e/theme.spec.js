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
