import { expect, test } from "@playwright/test";

test("[Landing E2E] page renders GitHub sign-in entrypoint", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in with GitHub" }).first()
  ).toHaveAttribute(
    "href",
    /\/api\/auth\/signin\/github\?callbackUrl=\/dashboard/
  );
  await expect(
    page.getByRole("link", { name: /star on github/i }).first()
  ).toHaveAttribute("href", "https://github.com/Priyanshu-byte-coder/devtrack");
});

test("[Landing E2E] dashboard stays protected for unauthenticated users", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("link", { name: "Sign in with GitHub" }).first()
  ).toBeVisible();
});

test("[Landing E2E] landing has dashboard link", async ({ page }) => {
  await page.goto("/");
  const dashboardLink = page.getByRole("link", {
    name: "Dashboard",
    exact: true,
  });
  const dashboardButton = page.getByRole("button", {
    name: "Dashboard",
    exact: true,
  });
  await expect(dashboardLink.or(dashboardButton).first()).toBeVisible();
});

test("[Landing E2E] hi-score table links to the top players", async ({
  page,
}) => {
  await page.goto("/");
  const table = page
    .getByRole("heading", { name: "Hi-scores" })
    .locator("..")
    .locator("..");
  await expect(
    table.getByRole("link", { name: /playwright-user/ })
  ).toHaveAttribute("href", "/u/playwright-user");
  await expect(
    table.getByRole("link", { name: "Full board →" })
  ).toHaveAttribute("href", "/leaderboard");
});

test("[Landing E2E] looking up a developer opens their profile", async ({
  page,
}) => {
  await page.goto("/");
  const lookup = page.getByRole("search").first();
  await lookup.getByLabel("Look up any developer").fill("@Playwright-Guest");
  await lookup.getByRole("button", { name: "Go" }).click();
  await expect(page).toHaveURL(/\/u\/playwright-guest$/);
});

test("[Landing E2E] lookup rejects invalid usernames", async ({ page }) => {
  await page.goto("/");
  const lookup = page.getByRole("search").first();
  await lookup.getByLabel("Look up any developer").fill("not a user!");
  await lookup.getByRole("button", { name: "Go" }).click();
  await expect(lookup.getByRole("alert")).toHaveText(/valid GitHub username/);
  await expect(page).toHaveURL(/\/$/);
});

test("[Landing E2E] features and FAQ sections are present", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page
      .locator("#features")
      .getByRole("heading", { name: /everything in one dashboard/i })
  ).toBeVisible();
  const faq = page.getByRole("heading", {
    name: "How is the DevTrack score calculated?",
  });
  await faq.click();
  await expect(page.getByText(/blends four signals/)).toBeVisible();
});

test("[Landing E2E] landing shows footer", async ({ page }) => {
  await page.goto("/");
  // Check that the global footer is rendered (e.g. looking for the copyright text)
  await expect(
    page.getByText(/DevTrack. Built for open-source contributors/i)
  ).toBeVisible();
});
