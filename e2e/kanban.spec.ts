import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";

const AUTH_SECRET =
  process.env.NEXTAUTH_SECRET ?? "test-nextauth-secret-for-playwright-tests";

async function setupKanbanMocks(page: import("@playwright/test").Page) {
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

  // Auth session mock
  await page.route("**/api/auth/session**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: { name: "Playwright User", email: "playwright@devtrack.test" },
        githubLogin: "playwright-user",
        githubId: "99001",
        accessToken: "mock-access-token",
        expires: "2099-01-01T00:00:00.000Z",
      }),
    })
  );

  // Settings mock
  await page.route("**/api/user/settings**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ is_public: true }),
    })
  );

  // Kanban Projects mock
  await page.route("**/api/kanban", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          project: {
            id: "proj-123",
            name: "New Playwright Project",
            created_at: new Date().toISOString(),
          },
        }),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        projects: [
          { id: "proj-123", name: "E2E Project", created_at: new Date().toISOString() },
        ],
      }),
    });
  });

  // Project details mock (stages, tasks, dependencies)
  await page.route("**/api/kanban/proj-123", (route) => {
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        project: { id: "proj-123", name: "E2E Project", created_at: new Date().toISOString() },
        stages: [
          { id: "stage-todo", name: "To Do", color: "#6366f1", position: 0 },
          { id: "stage-progress", name: "In Progress", color: "#f59e0b", position: 1 },
          { id: "stage-done", name: "Done", color: "#10b981", position: 2 },
        ],
        tasks: [
          {
            id: "task-1",
            project_id: "proj-123",
            stage_id: "stage-todo",
            title: "Playwright Task 1",
            description: "Finish E2E suite",
            position: 0,
          },
        ],
        dependencies: [],
      }),
    });
  });

  // Task API mocks (updates, creations)
  await page.route("**/api/kanban/proj-123/tasks", (route) => {
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  // Activity log mock
  await page.route("**/api/kanban/proj-123/activity*", (route) => {
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        activities: [
          {
            id: "act-1",
            project_id: "proj-123",
            user_id: "user-1",
            action: "task_created",
            entity_type: "task",
            entity_id: "task-1",
            metadata: { title: "Playwright Task 1" },
            created_at: new Date().toISOString(),
          },
        ],
      }),
    });
  });
}

test.describe("Kanban Board E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await setupKanbanMocks(page);
  });

  test("should load the projects landing page and lists projects", async ({ page }) => {
    await page.goto("/dashboard/kanban");
    await expect(page.locator("h1")).toContainText("Kanban Boards");
    await expect(page.locator("text=E2E Project")).toBeVisible();
  });

  test("should navigate to a project board and render stages and tasks", async ({ page }) => {
    await page.goto("/dashboard/kanban");
    await page.click("text=E2E Project");

    // Verify board workspace details
    await expect(page).toHaveURL(/\/dashboard\/kanban\/proj-123/);
    await expect(page.locator("h1")).toContainText("E2E Project");
    await expect(page.locator("text=Playwright Task 1")).toBeVisible();

    // Verify stages
    await expect(page.locator("text=To Do")).toBeVisible();
    await expect(page.locator("text=In Progress")).toBeVisible();
    await expect(page.locator("text=Done")).toBeVisible();
  });

  test("should toggle the activity feed history panel", async ({ page }) => {
    await page.goto("/dashboard/kanban/proj-123");

    // Click Show History button
    await page.click("text=Show History");
    await expect(page.locator("text=Activity History")).toBeVisible();
    await expect(page.locator("text=created task")).toBeVisible();

    // Click Hide History button
    await page.click("text=Hide History");
    await expect(page.locator("text=Activity History")).not.toBeVisible();
  });
});
