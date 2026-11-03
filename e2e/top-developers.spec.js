import { expect, test } from "@playwright/test";

test("the top developers hub links every language", async ({ page }) => {
  await page.goto("/top");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Top developers"
  );
  await expect(page.getByRole("link", { name: /Rust/ })).toHaveAttribute(
    "href",
    "/top/rust"
  );
});

test("a language page ranks developers and links to their profiles", async ({
  page,
}) => {
  await page.goto("/top/rust");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Top Rust developers"
  );
  await expect(
    page.getByRole("link", { name: "@playwright-user", exact: true })
  ).toHaveAttribute("href", "/u/playwright-user");
  await expect(
    page.getByRole("link", { name: "Duel @playwright-user" })
  ).toHaveAttribute("href", "/compare?vs=playwright-user");
});

test("unknown languages are not found", async ({ page }) => {
  const res = await page.goto("/top/not-a-language");
  expect(res?.status()).toBe(404);
});
