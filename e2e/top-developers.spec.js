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

test("a country page ranks developers by location", async ({ page }) => {
  await page.goto("/top/country/india");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Top developers in India"
  );
  await expect(
    page.getByRole("link", { name: "@playwright-user", exact: true })
  ).toHaveAttribute("href", "/u/playwright-user");
  await expect(page.getByRole("link", { name: "Germany" })).toHaveAttribute(
    "href",
    "/top/country/germany"
  );
});

test("the hub links countries too, and unknown countries are not found", async ({
  page,
}) => {
  await page.goto("/top");
  await expect(page.getByRole("link", { name: "India" })).toHaveAttribute(
    "href",
    "/top/country/india"
  );
  const res = await page.goto("/top/country/atlantis");
  expect(res?.status()).toBe(404);
});
