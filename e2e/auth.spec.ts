import { expect, test } from "@playwright/test";

/**
 * auth.spec.ts
 * Covers: landing page loads, "Sign in with GitHub" button present,
 * OAuth redirect fires, and unauthenticated dashboard protection.
 */

test("[Auth E2E] landing page loads with H1 heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(/DevTrack/i);
});

test("[Auth E2E] Sign in with GitHub button is visible on landing", async ({
  page,
}) => {
  await page.goto("/");
  const signInBtn = page
    .getByRole("link", { name: /sign in with github/i })
    .first();
  await expect(signInBtn).toBeVisible();
});

test("[Auth E2E] Sign in with GitHub button points to NextAuth GitHub provider", async ({
  page,
}) => {
  await page.goto("/");
  const signInBtn = page
    .getByRole("link", { name: /sign in with github/i })
    .first();
  await expect(signInBtn).toHaveAttribute(
    "href",
    /\/api\/auth\/signin\/github/
  );
});

test("[Auth E2E] OAuth redirect fires when Sign in link is clicked", async ({
  page,
}) => {
  // Mock the GitHub OAuth endpoint so we don't need real credentials.
  await page.route("**/api/auth/signin/github**", async (route) => {
    await route.fulfill({
      status: 302,
      headers: { Location: "https://github.com/login/oauth/authorize?mock=1" },
    });
  });

  await page.goto("/");
  const signInBtn = page
    .getByRole("link", { name: /sign in with github/i })
    .first();

  const [response] = await Promise.all([
    page.waitForResponse("**/api/auth/signin/github**"),
    signInBtn.click(),
  ]);

  // The mock returns 302 — confirm the redirect was triggered.
  expect([200, 302]).toContain(response.status());
});

test("[Auth E2E] /dashboard redirects unauthenticated users to landing page", async ({
  page,
}) => {
  await page.goto("/dashboard", { waitUntil: "load" });
  await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
});

test("[Auth E2E] landing page shows DevTrack feature section", async ({
  page,
}) => {
  await page.goto("/");
  // Features section or a recognised feature keyword must be present.
  const features = page.locator("#features");
  await expect(features).toBeVisible();
});