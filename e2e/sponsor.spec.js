import { expect, test } from "@playwright/test";

test("sponsor page links to GitHub Sponsors and lists public supporters", async ({
  page,
}) => {
  await page.goto("/sponsor");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Keep the arcade running"
  );
  await expect(
    page.getByRole("link", { name: "Sponsor on GitHub" })
  ).toHaveAttribute("href", "https://github.com/sponsors/Priyanshu-byte-coder");
  await expect(
    page.getByRole("link", { name: "@playwright-user" })
  ).toHaveAttribute("href", "/u/playwright-user");
});

test("the leaderboard's open sponsor slot points to the sponsor page", async ({
  page,
}) => {
  await page.goto("/leaderboard");
  const slot = page.getByRole("complementary", { name: "Sponsor slot" });
  await expect(
    slot.getByRole("link", { name: "Sponsor DevTrack" })
  ).toHaveAttribute("href", "/sponsor");
});
