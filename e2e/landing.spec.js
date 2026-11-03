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
  const lookup = page
    .getByRole("search")
    .filter({ has: page.getByLabel("Look up any developer") });
  await lookup.getByLabel("Look up any developer").fill("@Playwright-Guest");
  await lookup.getByRole("button", { name: "Go" }).click();
  // The profile route may compile on first visit in dev.
  await expect(page).toHaveURL(/\/u\/playwright-guest$/, { timeout: 15_000 });
});

test("[Landing E2E] lookup rejects invalid usernames", async ({ page }) => {
  await page.goto("/");
  const lookup = page
    .getByRole("search")
    .filter({ has: page.getByLabel("Look up any developer") });
  await lookup.getByLabel("Look up any developer").fill("not a user!");
  await lookup.getByRole("button", { name: "Go" }).click();
  await expect(lookup.getByRole("alert")).toHaveText(/valid GitHub username/);
  await expect(page).toHaveURL(/\/$/);
});

test("[Landing E2E] score attack shows where any developer would rank", async ({
  page,
}) => {
  await page.goto("/");
  const attack = page
    .getByRole("search")
    .filter({ has: page.getByLabel(/Score attack/) });
  await attack.getByLabel(/Score attack/).fill("playwright-guest");
  await attack.getByRole("button", { name: "Play ▶" }).click();
  const card = page.getByRole("region", { name: "@playwright-guest's score" });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card).toContainText("Would rank");
  await expect(card.getByRole("link", { name: /Claim it/ })).toHaveAttribute(
    "href",
    "/claim?login=playwright-guest"
  );
  await card.getByRole("button", { name: /Back to hi-scores/ }).click();
  await expect(page.getByRole("heading", { name: "Hi-scores" })).toBeVisible();
});

test("[Landing E2E] score attack explains unknown players", async ({
  page,
}) => {
  await page.goto("/");
  const attack = page
    .getByRole("search")
    .filter({ has: page.getByLabel(/Score attack/) });
  await attack.getByLabel(/Score attack/).fill("nobody-here-12345");
  await attack.getByRole("button", { name: "Play ▶" }).click();
  await expect(attack.getByRole("alert")).toContainText(
    "No public GitHub user",
    { timeout: 15_000 }
  );
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

test("sign-in explains GitHub sign-in and links the terms", async ({
  page,
}) => {
  await page.goto("/auth/signin");
  await expect(
    page.getByRole("heading", { name: "How sign-in works" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Terms of Service" }).first()
  ).toHaveAttribute("href", "/terms");
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Terms of Service"
  );
});
