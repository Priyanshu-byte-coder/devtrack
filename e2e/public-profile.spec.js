import { expect, test } from "@playwright/test";

test("public profile route renders without requiring authentication", async ({ page }) => {
  await page.goto("/u/playwright-user");

  await expect(page).toHaveURL(/\/u\/playwright-user$/);
  await expect(page.getByRole("link", { name: "Sign in with GitHub" })).toHaveCount(0);
});

test("invalid public profile username shows 404 page", async ({ page }) => {
  await page.goto("/u/non-existent-user-12345");
  
  await expect(page.getByRole("heading", { name: "Profile Not Found" })).toBeVisible();
  await expect(page.getByText("This profile is not available or has not been made public.")).toBeVisible();
});
