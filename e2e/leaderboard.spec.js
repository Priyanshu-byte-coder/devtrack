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

// Picking "This week" is remembered for the next visit. Going back to "All
// time" (the default, no URL param) used to restore the saved "This week"
// straight away.
test("switching back to All time sticks", async ({ page }) => {
  await page.goto("/leaderboard");
  const range = page.getByRole("group", { name: "Time range" });

  await range.getByRole("button", { name: "This Week" }).click();
  await expect(page).toHaveURL(/period=week/);

  await range.getByRole("button", { name: "All Time" }).click();
  await expect(page).not.toHaveURL(/period=/);
  // Give the old restore a chance to kick in, then check nothing moved.
  await page.waitForTimeout(1500);
  await expect(page).not.toHaveURL(/period=/);
  await expect(range.getByRole("button", { name: "All Time" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  // And it's remembered on the next visit.
  await page.reload();
  await page.waitForTimeout(1000);
  await expect(page).not.toHaveURL(/period=/);
});

// The Following view lists only you and the people you follow on GitHub
// (two fixture players in test mode), keeping their global ranks.
test("the Following view shows your circle with global ranks", async ({
  page,
  baseURL,
}) => {
  const { encode } = await import("next-auth/jwt");
  const token = await encode({
    secret:
      process.env.NEXTAUTH_SECRET ??
      "test-nextauth-secret-for-playwright-tests",
    token: {
      name: "dev-four",
      sub: "99004",
      githubLogin: "dev-four",
      githubId: "99004",
      accessToken: "mock-access-token",
    },
    maxAge: 3600,
  });
  const { hostname } = new URL(baseURL ?? "http://127.0.0.1:3000");
  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: token,
      domain: hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);

  await page.goto("/leaderboard?view=following");
  await expect(page.getByText("Your circle")).toBeVisible();
  const list = page.getByRole("region", {
    name: "You and the players you follow",
  });
  await expect(list).toContainText("@octocat");
  await expect(list).toContainText("Following");
  await expect(list).toContainText("@dev-four");
  await expect(list).not.toContainText("@playwright-user");
  await expect(page.getByRole("region", { name: "Top three" })).toHaveCount(0);
});
