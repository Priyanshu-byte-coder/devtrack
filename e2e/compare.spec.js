import { expect, test } from "@playwright/test";

test("a duel scores two developers round by round", async ({ page }) => {
  await page.goto("/compare/Playwright-User-vs-playwright-guest");

  await expect(page).toHaveURL(
    /\/compare\/playwright-user-vs-playwright-guest$/
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "@playwright-user vs @playwright-guest"
  );
  const result = page.getByRole("region", { name: "Result" });
  await expect(result).toContainText("@playwright-user wins");
  // Members' hidden widgets sit their rounds out.
  await expect(
    page.getByText("Pull requests: @playwright-user Hidden")
  ).toBeAttached();
  await expect(page.getByRole("link", { name: "Post on X" })).toHaveAttribute(
    "href",
    /x\.com\/intent\/tweet/
  );
});

test("a duel with an unknown player is a no contest", async ({ page }) => {
  await page.goto("/compare/playwright-user-vs-nobody-here-123");
  await expect(page.getByRole("heading", { name: "No contest" })).toBeVisible();
});

test("the compare hub starts a duel", async ({ page }) => {
  await page.goto("/compare");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Compare developers"
  );
  const form = page.getByRole("form", { name: "Start a duel" });
  await form.getByLabel("Player 1").fill("@playwright-user");
  await form.getByLabel("Player 2").fill("playwright-guest");
  await form.getByRole("button", { name: "Fight" }).click();
  await expect(page).toHaveURL(
    /\/compare\/playwright-user-vs-playwright-guest$/
  );
});

test("the hub rejects the same player twice", async ({ page }) => {
  await page.goto("/compare");
  const form = page.getByRole("form", { name: "Start a duel" });
  await form.getByLabel("Player 1").fill("octocat");
  await form.getByLabel("Player 2").fill("Octocat");
  await form.getByRole("button", { name: "Fight" }).click();
  await expect(form.getByRole("alert")).toHaveText(/two different developers/);
});
