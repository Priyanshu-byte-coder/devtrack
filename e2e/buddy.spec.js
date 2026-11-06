import { expect, test } from "@playwright/test";

// Automated browsers don't get Bit unless they opt in.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem("devtrack:buddy-force", "1")
  );
});

test("Bit gives a tip about the page when clicked", async ({ page }) => {
  await page.goto("/compare");
  await page.getByRole("button", { name: /Bit, the DevTrack guide/ }).click();
  const box = page.getByRole("dialog", { name: /Bit says, Duel arena/ });
  await expect(box).toBeVisible();
  await expect(box).toContainText("Two devs enter");
});

test("Bit can be hidden and brought back", async ({ page }) => {
  await page.goto("/compare");
  await page.getByRole("button", { name: /Bit, the DevTrack guide/ }).click();
  await page.getByRole("button", { name: "Hide Bit" }).click();
  await expect(
    page.getByRole("button", { name: /Bit, the DevTrack guide/ })
  ).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "Bring back Bit" }).click();
  await expect(
    page.getByRole("button", { name: /Bit, the DevTrack guide/ })
  ).toBeVisible();
});

test("Bit stays out of automated browsers by default", async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/compare");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Bit, the DevTrack guide/ })
  ).toHaveCount(0);
  await page.close();
});
