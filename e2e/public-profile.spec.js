import { expect, test } from "@playwright/test";

test("public profile route renders without requiring authentication", async ({
  page,
}) => {
  await page.goto("/u/playwright-user");

  await expect(page).toHaveURL(/\/u\/playwright-user$/);
  await expect(
    page.getByRole("link", { name: "Sign in with GitHub" })
  ).toHaveCount(0);
});

test("invalid public profile username shows 404 page", async ({ page }) => {
  await page.goto("/u/non-existent-user-12345");

  await expect(
    page.getByRole("heading", { name: "Profile Not Found" })
  ).toBeVisible();
  await expect(
    page.getByText("This profile is not available or has not been made public.")
  ).toBeVisible();
});

test("GitHub users who haven't joined get a guest profile with a claim link", async ({
  page,
}) => {
  await page.goto("/u/Playwright-Guest");

  await expect(page).toHaveURL(/\/u\/playwright-guest$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "@playwright-guest"
  );
  await expect(page.getByText("Not on DevTrack yet")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Claim this profile" })
  ).toHaveAttribute("href", "/claim?login=playwright-guest");
  await expect(
    page.getByRole("heading", { name: /would rank #\d+/i })
  ).toBeVisible();
});
