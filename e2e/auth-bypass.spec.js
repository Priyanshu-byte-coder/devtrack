import { expect, test } from "@playwright/test";

/**
 * Regression tests for the Playwright auth bypass vulnerability.
 *
 * Root cause: dashboard/page.tsx previously checked for a user-settable
 * browser cookie ("playwright-dashboard-auth") combined with the
 * PLAYWRIGHT_AUTH_BYPASS env var. Because the cookie was not HttpOnly
 * and was never server-set, any visitor could inject it from DevTools
 * and gain access to the dashboard without signing in.
 *
 * These tests verify that no cookie value — including the one the old
 * bypass relied on — can substitute for a real NextAuth session.
 */

test("unauthenticated request to /dashboard redirects to landing page", async ({
  page,
}) => {
  await page.goto("/dashboard", { waitUntil: "load" });
  await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
  await expect(
    page.getByRole("link", { name: "Sign in with GitHub" }).first()
  ).toBeVisible({ timeout: 5_000 });
});

test("dashboard heading is not visible without a valid session", async ({
  page,
}) => {
  await page.goto("/dashboard", { waitUntil: "load" });
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true })
  ).not.toBeVisible({ timeout: 5_000 });
});

test("setting playwright-dashboard-auth=1 cookie does not bypass authentication", async ({
  page,
}) => {
  // Simulate the exact attack: set the cookie the old bypass checked for.
  await page.context().addCookies([
    {
      name: "playwright-dashboard-auth",
      value: "1",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
      secure: false,
    },
  ]);

  await page.goto("/dashboard", { waitUntil: "load" });

  // The cookie alone must never grant dashboard access.
  await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true })
  ).not.toBeVisible({ timeout: 5_000 });
});

test("multiple attacker-controlled cookies combined do not bypass authentication", async ({
  page,
}) => {
  // Attempt to set every cookie variation an attacker might try.
  await page.context().addCookies([
    {
      name: "playwright-dashboard-auth",
      value: "1",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
      secure: false,
    },
    {
      name: "__Secure-next-auth.session-token",
      value: "forged-token",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
      secure: true,
    },
  ]);

  await page.goto("/dashboard", { waitUntil: "load" });

  // A forged session token must not be accepted.
  await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
});
