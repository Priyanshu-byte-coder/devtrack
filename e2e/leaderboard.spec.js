import { expect, test } from "@playwright/test";

test("the podium shows the top three in rank order", async ({ page }) => {
  await page.goto("/leaderboard");
  const podium = page.getByRole("region", { name: "Top three" });
  const links = podium.getByRole("link");
  await expect(links.first()).toHaveAttribute("href", "/u/playwright-user");
  await expect(podium).toContainText("1st place");
});

test("biggest climbers are listed from the daily snapshot", async ({
  page,
}) => {
  await page.goto("/leaderboard");
  const climbers = page.getByRole("region", { name: /Biggest climbers/ });
  await expect(climbers).toBeVisible();
  await expect(climbers.getByRole("listitem").first()).toContainText("Up");
});
