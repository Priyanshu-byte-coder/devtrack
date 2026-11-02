import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";

test("session endpoint keeps provider credentials inside the HttpOnly cookie", async ({
  page,
}) => {
  const secret =
    process.env.NEXTAUTH_SECRET || "test-nextauth-secret-for-playwright-tests";
  const accessToken = "private-github-canary";
  const gitlabToken = "private-gitlab-canary";
  const value = await encode({
    secret,
    token: {
      sub: "12345",
      name: "Playwright User",
      githubId: "12345",
      githubLogin: "playwright-user",
      accessToken,
      gitlabToken,
      accessTokenValidatedAt: Date.now(),
    },
    maxAge: 3600,
  });
  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
  const response = await page.request.get("/api/auth/session");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.githubId).toBe("12345");
  expect(body.githubLogin).toBe("playwright-user");
  expect(body).not.toHaveProperty("accessToken");
  expect(body).not.toHaveProperty("gitlabToken");
  expect(JSON.stringify(body)).not.toContain(accessToken);
  expect(JSON.stringify(body)).not.toContain(gitlabToken);
  await page.goto("/offline.html");
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "next-auth.session-token"
  );
});

test("production pages hydrate with fresh CSP nonces and worker permission", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) =>
      (window as any).cspViolations.push(event.violatedDirective)
    );
    localStorage.setItem("theme", "modern-light-blue");
  });
  const response = await page.goto("/");
  const csp = response!.headers()["content-security-policy"];
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  const scriptPolicy = csp
    .split(";")
    .find((value) => value.trim().startsWith("script-src"))!;
  expect(scriptPolicy).not.toContain("unsafe-inline");
  expect(scriptPolicy).not.toContain("unsafe-eval");
  expect(csp).toContain("worker-src 'self' blob:");
  expect(response!.headers()["cache-control"]).toContain("no-store");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const inlineNonces = await page.evaluate(() =>
    Array.from(document.scripts)
      .filter(
        (script) =>
          !script.src &&
          script.textContent?.trim() &&
          (!script.type || script.type === "text/javascript")
      )
      .map((script) => script.nonce)
  );
  expect(inlineNonces.length).toBeGreaterThan(0);
  expect(inlineNonces.every((value) => value === nonce)).toBeTruthy();
  expect(
    await page.evaluate(() => document.documentElement.dataset.theme)
  ).toBe("modern-light-blue");
  expect(
    await page.evaluate(() =>
      (window as any).cspViolations.filter(
        (value: string) =>
          value.startsWith("script-src") || value.startsWith("worker-src")
      )
    )
  ).toEqual([]);
  const second = await page.request.get("/");
  expect(second.headers()["content-security-policy"]).not.toContain(
    `'nonce-${nonce}'`
  );
});

test("worker cleans legacy private caches and never serves an API response offline", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  const value = await encode({
    secret:
      process.env.NEXTAUTH_SECRET ||
      "test-nextauth-secret-for-playwright-tests",
    maxAge: 3600,
    token: {
      sub: "12345",
      name: "private-session-canary",
      githubId: "12345",
      githubLogin: "playwright-user",
      accessToken: "dummy",
      accessTokenValidatedAt: Date.now(),
    },
  });
  await page.goto("/");
  const seeded = await page.evaluate(async () => {
    const waitFor = <T>(promise: Promise<T>, phase: string) =>
      Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(async () => {
            const registrations =
              await navigator.serviceWorker.getRegistrations();
            reject(
              new Error(
                `Worker phase timed out: ${phase}; registrations=${JSON.stringify(registrations.map((r) => ({ scope: r.scope, installing: r.installing?.state, waiting: r.waiting?.state, active: r.active?.state })))}; caches=${JSON.stringify(await caches.keys())}`
              )
            );
          }, 30_000)
        ),
      ]);
    await waitFor(navigator.serviceWorker.ready, "initial registration");
    const cache = await caches.open("legacy-private-api");
    await cache.put("/api/user/settings", new Response("private-cache-canary"));
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("keyval-store", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("keyval");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("keyval", "readwrite");
        tx.objectStore("keyval").put(
          "private-idb-canary",
          "contrib-graph-default-30"
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
    const registration = await navigator.serviceWorker.register(
      "/sw.js?repair-regression=1"
    );
    const worker =
      registration.installing || registration.waiting || registration.active;
    if (worker?.state !== "activated")
      await waitFor(
        new Promise<void>((resolve, reject) => {
          if (!worker) {
            reject(Error("No worker"));
            return;
          }
          worker.addEventListener("statechange", () => {
            if (worker.state === "activated") resolve();
            if (worker.state === "redundant") reject(Error("Worker failed"));
          });
        }),
        "updated worker activation"
      );
    await waitFor(navigator.serviceWorker.ready, "updated registration");
    return {
      caches: await caches.keys(),
      databases: (await indexedDB.databases()).map((db) => db.name),
    };
  });
  expect(seeded.caches).not.toContain("legacy-private-api");
  expect(seeded.databases).not.toContain("keyval-store");
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller))
    )
    .toBeTruthy();
  await context.addCookies([
    {
      name: "next-auth.session-token",
      value,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
  const onlineSession = await page.evaluate(async () =>
    (await fetch("/api/auth/session", { cache: "no-store" })).text()
  );
  expect(onlineSession).toContain("private-session-canary");
  await context.setOffline(true);
  const offlineSession = await page.evaluate(async () => {
    try {
      return await (
        await fetch("/api/auth/session", { cache: "no-store" })
      ).text();
    } catch {
      return "network-unavailable";
    }
  });
  expect(offlineSession).not.toContain("private-session-canary");
  const result = await page.evaluate(async () => {
    try {
      return await (
        await fetch("/api/user/settings", { cache: "no-store" })
      ).text();
    } catch {
      return "network-unavailable";
    }
  });
  expect(result).not.toContain("private-cache-canary");
  expect(result).not.toContain("private-idb-canary");
  await page.goto("/dashboard");
  await expect(page).toHaveTitle("DevTrack Offline");
  expect(await page.locator("body").innerText()).not.toContain(
    "private-session-canary"
  );
  await context.setOffline(false);
});
