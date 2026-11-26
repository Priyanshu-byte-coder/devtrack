import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";

const authSecret =
  process.env.NEXTAUTH_SECRET ||
  "test-nextauth-secret-for-playwright-tests";
  
test.beforeEach(async ({ page }) => {
  const sessionToken = await encode({
    secret: authSecret,
    token: {
      name: "Playwright User",
      email: "playwright@example.com",
      sub: "12345",
      githubLogin: "playwright-user",
      githubId: "12345",
      accessToken: "test-token",
    },
    maxAge: 60 * 60,
  });

  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: sessionToken,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
      expires: Math.floor(Date.now() / 1000) + 60 * 60,
    },
  ]);

  await page.route("**/api/auth/session**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: { name: "Playwright User", email: "playwright@example.com" },
        githubLogin: "playwright-user",
        githubId: "12345",
        expires: "2099-01-01T00:00:00.000Z",
      }),
    });
  });

  let mockSettings = {
    id: "1",
    github_login: "playwright-user",
    bio: "",
    timezone: "UTC",
    is_public: false,
    leaderboard_opt_in: false,
    has_wakatime_key: false,
  };

  await page.route("**/api/user/settings**", async (route) => {
    if (route.request().method() === "PATCH") {
      const data = JSON.parse(route.request().postData() || "{}");
      mockSettings = { ...mockSettings, ...data };
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(mockSettings),
      });
      return;
    }
    
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(mockSettings),
    });
  });

  await page.route("**/api/user/github-accounts", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ accounts: [] }),
    });
  });

  await page.route("**/api/milestones**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ milestones: [] }),
    });
  });

  await page.route("**/api/daily-note**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ todayNote: "", yesterdayNote: "" }),
    });
  });

  await page.route("**/api/accounts**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ accounts: [] }),
    });
  });

  await page.route("**/api/user/orgs**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ accounts: [], config: {} }),
    });
  });
});

test("settings page saves and reflects changes", async ({ page }) => {
  await page.goto("/dashboard/settings");

  // Wait for settings to load
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();

  // The public profile toggle is a sr-only checkbox driven by React's onChange.
  // Clicking the hidden input directly won't fire the synthetic event.
  // Instead click the visible toggle track (the div sibling of the sr-only input)
  // which is inside the label wrapping the "Toggle Public Profile" checkbox.
  const toggleLabel = page.locator("label").filter({
    has: page.locator("input[aria-label='Toggle Public Profile']"),
  });
  const toggleTrack = toggleLabel.locator("div").first();

  const publicProfileCheckbox = page.locator("input[aria-label='Toggle Public Profile']");

  // Initially false based on our mock
  await expect(publicProfileCheckbox).not.toBeChecked();

  // Click the visible toggle track — this fires the React onChange
  await toggleTrack.click();

  // It should now be checked (our mock returns the patched value)
  await expect(publicProfileCheckbox).toBeChecked();
});

test("saving settings: bio, timezone, visibility persists across reload", async ({
  page,
}) => {
  await page.goto("/dashboard/settings");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true })
  ).toBeVisible({ timeout: 30_000 });

  // 1. Change profile bio
  const bioInput = page.locator("#profile-bio");
  await bioInput.scrollIntoViewIfNeeded();
  await bioInput.fill(
    "Software Engineer passionate about open source and distributed systems."
  );

  const saveBioButton = page.getByRole("button", { name: "Save Bio" });
  await saveBioButton.click();
  await expect(page.getByText("Bio saved successfully!")).toBeVisible({
    timeout: 10_000,
  });

  // 2. Change timezone
  const timezoneSelect = page.locator("#timezone-select");
  await timezoneSelect.scrollIntoViewIfNeeded();
  await timezoneSelect.selectOption("Asia/Kolkata");

  const saveDiscordButton = page.getByRole("button", {
    name: /save discord|save settings/i,
  });
  await saveDiscordButton.click();
  await expect(
    page.getByText(/discord settings saved successfully|discord webhook removed/i)
  ).toBeVisible({ timeout: 10_000 });

  // 3. Change profile visibility
  const toggleLabel = page.locator("label").filter({
    has: page.locator("input[aria-label='Toggle Public Profile']"),
  });
  const toggleTrack = toggleLabel.locator("div").first();
  const publicProfileCheckbox = page.locator(
    "input[aria-label='Toggle Public Profile']"
  );

  await expect(publicProfileCheckbox).not.toBeChecked();
  await toggleTrack.click();
  await expect(publicProfileCheckbox).toBeChecked();

  // 4. Reload page and verify persistence
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true })
  ).toBeVisible({ timeout: 30_000 });

  // Verify bio persisted
  await expect(page.locator("#profile-bio")).toHaveValue(
    "Software Engineer passionate about open source and distributed systems."
  );

  // Verify timezone persisted
  await expect(page.locator("#timezone-select")).toHaveValue("Asia/Kolkata");

  // Verify profile visibility persisted
  await expect(
    page.locator("input[aria-label='Toggle Public Profile']")
  ).toBeChecked();
});

test("saving settings: handles failure path when save request fails", async ({
  page,
}) => {
  // Override PATCH to return an error response
  await page.route("**/api/user/settings**", async (route) => {
    if (route.request().method() === "PATCH") {
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Failed to update settings" }),
      });
    }
    return route.fallback();
  });

  await page.goto("/dashboard/settings");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true })
  ).toBeVisible({ timeout: 30_000 });

  // Attempt to save bio with failing backend
  const bioInput = page.locator("#profile-bio");
  await bioInput.scrollIntoViewIfNeeded();
  await bioInput.fill("Temporary bio text that will fail to save");

  const saveBioButton = page.getByRole("button", { name: "Save Bio" });
  await saveBioButton.click();

  // Expect error feedback
  await expect(
    page.getByText(/failed to update bio|failed to update settings/i)
  ).toBeVisible({ timeout: 10_000 });

  // Ensure false success is NOT displayed
  await expect(page.getByText("Bio saved successfully!")).not.toBeVisible();

  // Reload and verify the bio change was not persisted
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true })
  ).toBeVisible({ timeout: 30_000 });

  await expect(page.locator("#profile-bio")).not.toHaveValue(
    "Temporary bio text that will fail to save"
  );
});
