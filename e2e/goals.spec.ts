import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";
import {
  installDashboardApiMocks,
  scrollToWidget,
} from "./helpers/dashboard-mocks";

/**
 * goals.spec.ts
 * Covers: create goal → appears in list; delete goal → removed from list.
 */

const AUTH_SECRET =
  process.env.NEXTAUTH_SECRET ?? "test-nextauth-secret-for-playwright-tests";

/** Minimal shared mock setup — only the routes goals tests need. */
async function setupGoalsMocks(page: import("@playwright/test").Page) {
  const sessionToken = await encode({
    secret: AUTH_SECRET,
    token: {
      name: "Playwright User",
      email: "playwright@devtrack.test",
      sub: "99001",
      githubLogin: "playwright-user",
      githubId: "99001",
      accessToken: "mock-access-token",
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

  await page.route("**/api/auth/session**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: { name: "Playwright User", email: "playwright@devtrack.test" },
        githubLogin: "playwright-user",
        githubId: "99001",
        expires: "2099-01-01T00:00:00.000Z",
      }),
    })
  );

  await page.route("**/api/user/settings**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ is_public: true }),
    })
  );

  await page.route("**/api/notifications**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ notifications: [], unreadCount: 0 }),
    })
  );

  await page.route("**/api/milestones**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ milestones: [] }),
    })
  );

  await page.route("**/api/daily-note**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ todayNote: "", yesterdayNote: "" }),
    })
  );

  await page.route("**/api/accounts**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ accounts: [] }),
    })
  );

  await page.route("**/api/user/orgs**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ accounts: [], config: {} }),
    })
  );

  await page.route("**/api/stream**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: "data: {}\n\n",
    })
  );

  await page.route("**/api/goals/sync**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        last_synced_at: new Date().toISOString(),
      }),
    })
  );

  await installDashboardApiMocks(page);
}

async function openGoalsWidget(page: import("@playwright/test").Page) {
  await page.goto("/dashboard/goals", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Goals" })
  ).toBeVisible({ timeout: 30_000 });
  await scrollToWidget(page, "Goals");
}

test("[Goals E2E] goals widget renders on dashboard", async ({ page }) => {
  page.on("console", (msg) => console.log("BROWSER CONSOLE:", msg.text()));
  await setupGoalsMocks(page);

  await page.route(/\/api\/goals(\?|$)/, (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ goals: [] }),
    });
  });

  await openGoalsWidget(page);
});

test("[Goals E2E] creating a goal sends POST /api/goals with correct payload", async ({
  page,
}) => {
  await setupGoalsMocks(page);

  const goalPosts: unknown[] = [];

  // Use regex so only /api/goals is matched — NOT /api/goals/sync or /api/goals/:id.
  await page.route(/\/api\/goals(\?|$)/, async (route) => {
    if (route.request().method() === "POST") {
      goalPosts.push(route.request().postDataJSON());
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ goals: [] }),
    });
  });

  await openGoalsWidget(page);

  // Scroll the goal form into view and wait for it to be interactive.
  const titleInput = page.getByLabel("Goal title");
  await titleInput.scrollIntoViewIfNeeded();
  await titleInput.waitFor({ state: "visible", timeout: 10_000 });

  await titleInput.fill("Ship one PR");
  await page.getByLabel("Target").fill("1");
  await page.getByLabel("Unit", { exact: true }).selectOption("prs");
  await page.getByRole("button", { name: "Create goal" }).click();

  await expect
    .poll(() => goalPosts.filter(Boolean), { timeout: 10_000 })
    .toHaveLength(1);
  expect(goalPosts.find(Boolean)).toMatchObject({
    title: "Ship one PR",
    target: 1,
    unit: "prs",
  });
});

test("[Goals E2E] newly created goal appears in the goals list", async ({
  page,
}) => {
  await setupGoalsMocks(page);

  let goalsStore = [
    {
      id: "g-existing",
      title: "Existing Goal",
      target: 5,
      current: 2,
      unit: "commits",
      recurrence: "weekly",
      period_start: "2026-05-18",
      last_synced_at: new Date().toISOString(),
    },
  ];

  // Use regex so only /api/goals is matched — NOT /api/goals/sync or /api/goals/:id.
  await page.route(/\/api\/goals(\?|$)/, async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as Record<
        string,
        unknown
      > | null;
      // Guard: /api/goals/sync POSTs (if leaked) have null body — skip them.
      if (!body) {
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
      }
      goalsStore.push({
        id: `g-new-${Date.now()}`,
        title: body.title as string,
        target: Number(body.target),
        current: 0,
        unit: body.unit as string,
        recurrence: (body.recurrence as string) ?? "none",
        period_start: "2026-05-18",
        last_synced_at: new Date().toISOString(),
      });
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ goals: goalsStore }),
    });
  });

  await openGoalsWidget(page);

  await expect(page.getByText("Existing Goal")).toBeVisible({
    timeout: 10_000,
  });

  // Scroll goal form into view and wait for it to be interactive.
  const titleInput = page.getByLabel("Goal title");
  await titleInput.scrollIntoViewIfNeeded();
  await titleInput.waitFor({ state: "visible", timeout: 10_000 });

  // Create a new goal.
  await titleInput.fill("Ship five PRs");
  await page.getByLabel("Target").fill("5");
  await page.getByLabel("Unit", { exact: true }).selectOption("prs");
  await page.getByRole("button", { name: "Create goal" }).click();

  // The new goal should appear without a page reload.
  await expect(page.getByText("Ship five PRs")).toBeVisible({
    timeout: 10_000,
  });
});

test("[Goals E2E] deleting a goal removes it from the list", async ({
  page,
}) => {
  await setupGoalsMocks(page);

  let goalsStore = [
    {
      id: "g-deleteme",
      title: "Goal to Delete",
      target: 3,
      current: 1,
      unit: "commits",
      recurrence: "weekly",
      period_start: "2026-05-18",
      last_synced_at: new Date().toISOString(),
    },
  ];

  await page.route(/\/api\/goals(\?|$)/, async (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ goals: goalsStore }),
    });
  });

  // DELETE /api/goals/:id
  await page.route("**/api/goals/**", async (route) => {
    if (route.request().method() === "DELETE") {
      const url = route.request().url();
      const id = url.split("/api/goals/")[1]?.split("?")[0];
      goalsStore = goalsStore.filter((g) => g.id !== id);
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }
    // PATCH (goal sharing toggle) — fulfill with a minimal goal object
    if (route.request().method() === "PATCH") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ goal: goalsStore[0] ?? {} }),
      });
    }
    return route.fallback();
  });

  await openGoalsWidget(page);
  await expect(page.getByText("Goal to Delete")).toBeVisible({
    timeout: 10_000,
  });

  // Click the delete button (trash icon) next to this goal.
  const goalRow = page
    .locator("li")
    .filter({ hasText: "Goal to Delete" })
    .first();
  await goalRow.getByRole("button", { name: /delete goal/i }).click();

  // A confirmation modal appears — click "Permanently Delete" to confirm.
  await page.getByRole("button", { name: /permanently delete/i }).click();

  // Goal should be gone.
  await expect(
    page.getByText("Goal to Delete", { exact: true })
  ).not.toBeVisible({ timeout: 10_000 });
});

test("[Goals E2E] full lifecycle: create goal, mark progress, delete via confirmation modal, and verify empty state", async ({
  page,
}) => {
  await setupGoalsMocks(page);

  interface MockGoal {
    id: string;
    title: string;
    target: number;
    current: number;
    unit: string;
    recurrence: string;
    category?: string | null;
    period_start: string;
    last_synced_at: string;
  }

  let goalsStore: MockGoal[] = [];

  // Route /api/goals (GET list, POST create)
  await page.route(/\/api\/goals(\?|$)/, async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as Record<string, unknown> | null;
      if (!body) {
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
      }
      const newGoal: MockGoal = {
        id: `g-test-${Date.now()}`,
        title: body.title as string,
        target: Number(body.target),
        current: 0,
        unit: body.unit as string,
        recurrence: (body.recurrence as string) ?? "none",
        category: (body.category as string) ?? null,
        period_start: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      };
      goalsStore.push(newGoal);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, goal: newGoal }),
      });
    }

    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ goals: goalsStore }),
    });
  });

  // Route /api/goals/:id (PATCH progress/target, DELETE goal)
  await page.route("**/api/goals/**", async (route) => {
    const url = route.request().url();
    const id = url.split("/api/goals/")[1]?.split("?")[0];

    if (route.request().method() === "DELETE") {
      goalsStore = goalsStore.filter((g) => g.id !== id);
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }

    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as Record<string, unknown> | null;
      const goalIndex = goalsStore.findIndex((g) => g.id === id);
      if (goalIndex !== -1 && body) {
        if (typeof body.current === "number") {
          goalsStore[goalIndex].current = body.current;
        }
        if (typeof body.target === "number") {
          goalsStore[goalIndex].target = body.target;
        }
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ ok: true, goal: goalsStore[goalIndex] }),
        });
      }
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }

    return route.fallback();
  });

  // Navigate to Goals dashboard
  await openGoalsWidget(page);

  // 1. Verify initial empty state
  const emptyState = page.getByText(/no goals yet/i);
  await expect(emptyState).toBeVisible({ timeout: 10_000 });

  // 2. Create a manual goal (unit: "hours" renders manual progress increment +1 button)
  const titleInput = page.getByLabel("Goal title");
  await titleInput.scrollIntoViewIfNeeded();
  await titleInput.waitFor({ state: "visible", timeout: 10_000 });

  await titleInput.fill("Study Distributed Systems");
  await page.getByLabel("Target").fill("5");
  await page.getByLabel("Unit", { exact: true }).selectOption("hours");
  await page.getByRole("button", { name: "Create goal" }).click();

  // Verify the created goal appears in the list
  const createdGoalTitle = page.getByText("Study Distributed Systems");
  await expect(createdGoalTitle).toBeVisible({ timeout: 10_000 });
  await expect(emptyState).not.toBeVisible();

  // Initial progress should be 0/5 hours
  const progressText = page.getByText("0/5 hours");
  await expect(progressText).toBeVisible({ timeout: 10_000 });

  /**
   * Note on Issue #3804 Step 2 ("Edit its target"):
   * GoalTracker component (src/components/GoalTracker.tsx) only provides target input
   * during goal creation. There is no edit-target UI control, modal, or inline edit
   * exposed in the frontend, although PATCH /api/goals/:id supports updating target.
   * Per Section 4.4 ("No artificial implementation"), we do not fabricate UI actions
   * or call PATCH via page.evaluate().
   */

  // 3. Mark progress: click the "+1" button for manual unit goal
  const incrementButton = page.getByRole("button", {
    name: /increment "study distributed systems" progress by 1/i,
  });
  await expect(incrementButton).toBeVisible();
  await incrementButton.click();

  // Verify progress updates to 1/5 hours
  await expect(page.getByText("1/5 hours")).toBeVisible({ timeout: 10_000 });

  // Increment once more to verify further progress tracking
  await incrementButton.click();
  await expect(page.getByText("2/5 hours")).toBeVisible({ timeout: 10_000 });

  // 4. Delete goal using confirmation modal
  const deleteButton = page.getByRole("button", {
    name: /delete goal: study distributed systems/i,
  });
  await expect(deleteButton).toBeVisible();
  await deleteButton.click();

  // Verify confirmation modal opens
  const confirmModalHeading = page.getByRole("heading", {
    name: "Delete Tracking Goal",
  });
  await expect(confirmModalHeading).toBeVisible({ timeout: 5_000 });

  // Click "Permanently Delete" in the modal
  const confirmDeleteButton = page.getByRole("button", {
    name: /permanently delete/i,
  });
  await expect(confirmDeleteButton).toBeVisible();
  await confirmDeleteButton.click();

  // 5. Verify the goal is removed and the empty state is displayed again
  await expect(createdGoalTitle).not.toBeVisible({ timeout: 10_000 });
  await expect(emptyState).toBeVisible({ timeout: 10_000 });
});
