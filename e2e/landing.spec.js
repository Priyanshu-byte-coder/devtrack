import { expect, test } from "@playwright/test";

test("[Landing E2E] page renders GitHub sign-in entrypoint", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in with GitHub" }).first(),
  ).toHaveAttribute("href", /\/api\/auth\/signin\/github\?callbackUrl=\/dashboard/);
  await expect(
    page.getByRole("link", { name: /star on github/i }).first(),
  ).toHaveAttribute("href", "https://github.com/Priyanshu-byte-coder/devtrack");
});

test("[Landing E2E] dashboard stays protected for unauthenticated users", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Sign in with GitHub" }).first()).toBeVisible();
});

test("[Landing E2E] landing has dashboard link", async ({ page }) => {
  await page.goto("/");
  const dashboardLink = page.getByRole("link", { name: "Dashboard", exact: true });
  const dashboardButton = page.getByRole("button", { name: "Dashboard", exact: true });
  await expect(dashboardLink.or(dashboardButton).first()).toBeVisible();
});

test("[Landing E2E] landing introduces DevTrack in an about section", async ({ page }) => {
  await page.goto("/");
  const about = page.locator("#about");
  await about.scrollIntoViewIfNeeded();
  await expect(about.getByRole("heading", { name: /developer progress/i })).toBeVisible();
  await expect(about.getByText("Live GitHub Signals")).toBeVisible();
  await expect(about.getByRole("link", { name: "Explore features" })).toHaveAttribute("href", "#features");
});

test("[Landing E2E] landing shows footer", async ({ page }) => {
  await page.goto("/");
  // Check that the global footer is rendered (e.g. looking for the copyright text)
  await expect(page.getByText(/DevTrack. Built for open-source contributors/i)).toBeVisible();
});
