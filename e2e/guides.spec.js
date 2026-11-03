import { expect, test } from "@playwright/test";

test("the guides index links every guide", async ({ page }) => {
  await page.goto("/guides");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Guides");
  await page
    .getByRole("link", {
      name: /How to add GitHub stats to your profile README/,
    })
    .click();
  await expect(page).toHaveURL(/\/guides\/github-stats-readme$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "GitHub stats"
  );
  await expect(page.getByText("Quick answers")).toBeVisible();
});

test("guides carry article and FAQ structured data", async ({ page }) => {
  await page.goto("/guides/github-streak");
  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  const types = blocks.flatMap((b) => {
    const data = JSON.parse(b);
    return (Array.isArray(data) ? data : [data]).map((d) => d["@type"]);
  });
  expect(types).toEqual(
    expect.arrayContaining(["TechArticle", "FAQPage", "BreadcrumbList"])
  );
});

test("unknown guides are not found", async ({ page }) => {
  const res = await page.goto("/guides/not-a-guide");
  expect(res?.status()).toBe(404);
});
