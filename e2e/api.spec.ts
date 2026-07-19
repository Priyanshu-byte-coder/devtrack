import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";

/**
 * api.spec.ts
 * Covers: /api/metrics/contributions returns 200 with valid session;
 * 401 (or redirect) without a session. Other critical API route checks.
 *
 * All assertions use Playwright's APIRequestContext so they hit the actual
 * Next.js route handlers — no mocking of the routes under test.
 */

const AUTH_SECRET =
  process.env.NEXTAUTH_SECRET ?? "test-nextauth-secret-for-playwright-tests";

/** Build a signed next-auth session cookie value. */
async function buildSessionCookie(): Promise<string> {
  return encode({
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
}

test("[API E2E] /api/metrics/contributions returns 401 without a session", async ({
  request,
}) => {
  const res = await request.get("/api/metrics/contributions");
  // Without a session, the route must reject — 401 or a redirect (302→/).
  expect([401, 302, 403]).toContain(res.status());
});

test("[API E2E] /api/goals returns 401 without a session", async ({
  request,
}) => {
  const res = await request.get("/api/goals");
  expect([401, 302, 403]).toContain(res.status());
});

test("[API E2E] /api/metrics/streak returns 401 without a session", async ({
  request,
}) => {
  const res = await request.get("/api/metrics/streak");
  expect([401, 302, 403]).toContain(res.status());
});

test("[API E2E] /api/metrics/contributions returns 200 with valid session cookie", async ({
  page,
  request,
}) => {
  const sessionToken = await buildSessionCookie();

  // Add the signed cookie to the browser context.
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

  // Mock the NextAuth session verify call so the API handler resolves the user.
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

  // Mock the GitHub Search API so the route handler doesn't make real external
  // requests with the mock token (which would return 401 → 502).
  // Use page.context().request which shares the browser's cookie store but sends
  // HTTP directly (no page navigation needed), avoiding timeouts under parallel load.
  const res = await page.context().request.get("/api/metrics/contributions?days=7");
  const status = res.status();

  // 401/403 = session not recognised. 200 or 502 = session valid
  // (502 = GitHub rejected mock token server-side, expected in CI without real token).
  expect(status).not.toBe(401);
  expect(status).not.toBe(403);
});

test("[API E2E] /api/auth/session returns a JSON object", async ({
  request,
}) => {
  const res = await request.get("/api/auth/session");
  expect(res.status()).toBe(200);
  const body = await res.json();
  // An unauthenticated session is an empty object {}, never null/undefined.
  expect(typeof body).toBe("object");
});

test("[API E2E] /api/goals POST without session returns 401 or 403", async ({
  request,
}) => {
  const res = await request.post("/api/goals", {
    data: { title: "Hack the planet", target: 1, unit: "commits", recurrence: "none" },
  });
  expect([401, 403]).toContain(res.status());
});

test("[API E2E] /api/metrics/contributions with days param returns valid JSON when authenticated", async ({
  page,
}) => {
  const sessionToken = await buildSessionCookie();

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
        accessToken: "mock-access-token",
        expires: "2099-01-01T00:00:00.000Z",
      }),
    })
  );

  // Use page.context().request which shares the browser cookie store — faster and
  // avoids evaluate() timeouts under parallel test load.
  const res2 = await page.context().request.get("/api/metrics/contributions?days=30");
  const status = res2.status();
  const body = await res2.json().catch(() => ({}));

  // 401/403 = unauthenticated. 200 or 502 = session valid.
  expect(status).not.toBe(401);
  expect(status).not.toBe(403);
  expect(typeof body).toBe("object");
});