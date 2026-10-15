// Records real API responses for demo mode.
// Usage: node scripts/demo/record.mjs <session-jwt-file> [baseUrl]
// Run against a normal (non-demo) dev server signed in with a real GitHub token.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const [jwtFile, baseUrl = "http://localhost:3000"] = process.argv.slice(2);
if (!jwtFile) {
  console.error("usage: node scripts/demo/record.mjs <session-jwt-file> [baseUrl]");
  process.exit(1);
}
const jwt = fs.readFileSync(jwtFile, "utf8").trim();
const outFile = path.join(process.cwd(), "demo", "fixtures.json");
const MAX_PASSES = Number(process.env.DEMO_RECORD_PASSES ?? 5);

const store = fs.existsSync(outFile)
  ? JSON.parse(fs.readFileSync(outFile, "utf8"))
  : { responses: {} };

const sessionRes = await fetch(`${baseUrl}/api/auth/session`, {
  headers: { Cookie: `next-auth.session-token=${jwt}` },
});
const session = await sessionRes.json();
if (!session?.githubId) throw new Error("Session cookie not accepted by server");
store.user = {
  githubId: session.githubId,
  githubLogin: session.githubLogin,
  name: session.user?.name ?? session.githubLogin,
  image: session.user?.image ?? "",
};
const login = session.githubLogin;

const pages = [
  "/dashboard",
  "/dashboard/career-intelligence",
  "/dashboard/personality",
  "/dashboard/repo-comparison",
  "/dashboard/repo-health",
  "/dashboard/settings",
  "/settings",
  "/leaderboard",
  `/u/${login}`,
  "/wrapped",
  "/profile-card",
  "/rooms",
  "/friend-compare",
  "/project-tutor",
];

// Fetched server-to-server by pages (never visible to the browser).
const serverSideApis = [
  `/api/public/${login.toLowerCase()}?achievements=1`,
  `/api/public/${login.toLowerCase()}`,
];

const browser = await chromium.launch();
const origin = new URL(baseUrl);

for (let pass = 1; pass <= MAX_PASSES; pass++) {
  const failed = new Map();
  let saved = 0;
  for (const key of serverSideApis) {
    if (store.responses[key]) continue;
    const res = await fetch(`${baseUrl}${key}`, {
      headers: { Cookie: `next-auth.session-token=${jwt}` },
    }).catch(() => null);
    if (!res) continue;
    const body = await res.text();
    if (res.ok) {
      const fixture = { status: res.status, contentType: res.headers.get("content-type") ?? "application/json", body };
      store.responses[key] = fixture;
      store.responses[new URL(key, baseUrl).pathname] ??= fixture;
      saved++;
    } else {
      failed.set(key, res.status);
    }
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    { name: "next-auth.session-token", value: jwt, domain: origin.hostname, path: "/", httpOnly: true, sameSite: "Lax" },
  ]);

  for (const route of pages) {
    const page = await context.newPage();
    // Every API call is fetched here (not by the browser) so each one is captured
    // deterministically; already-recorded ones are replayed so retries spend
    // GitHub quota only on gaps.
    const pending = [];
    await page.route("**/api/**", async (r) => {
      const req = r.request();
      const url = new URL(req.url());
      if (url.pathname === "/api/stream") {
        return r.fulfill({ status: 200, contentType: "text/event-stream", body: "data: {}\n\n" });
      }
      if (url.pathname.startsWith("/api/auth/") || req.method() !== "GET") return r.continue();
      const key = `${url.pathname}${url.search}`;
      const hit = store.responses[key];
      if (hit) return r.fulfill({ status: hit.status, contentType: hit.contentType, body: hit.body });
      const work = (async () => {
        try {
          const res = await r.fetch({ timeout: 60_000 });
          const body = await res.text();
          const contentType = res.headers()["content-type"] ?? "application/json";
          if (res.status() < 400) {
            const fixture = { status: res.status(), contentType, body };
            store.responses[key] = fixture;
            store.responses[url.pathname] ??= fixture;
            failed.delete(key);
            saved++;
          } else {
            failed.set(key, res.status());
          }
          await r.fulfill({ status: res.status(), contentType, body });
        } catch {
          failed.set(key, "timeout");
          await r.abort().catch(() => {});
        }
      })();
      pending.push(work);
      return work;
    });
    try {
      await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.waitForTimeout(3000);
      // Scroll the window and every inner scroll container so lazy widgets mount.
      for (let step = 0; step < 60; step++) {
        const atEnd = await page.evaluate(() => {
          const scrollers = [document.scrollingElement, ...document.querySelectorAll("*")].filter(
            (el) =>
              el &&
              el.scrollHeight > el.clientHeight + 40 &&
              (el === document.scrollingElement ||
                ["auto", "scroll"].includes(getComputedStyle(el).overflowY))
          );
          let moved = false;
          for (const el of scrollers) {
            const before = el.scrollTop;
            el.scrollTop += 600;
            if (el.scrollTop !== before) moved = true;
          }
          return !moved;
        });
        await page.waitForTimeout(900);
        if (atEnd) break;
      }
      await page.waitForTimeout(8000);
      await Promise.all(pending);
    } catch (e) {
      console.warn(`  ${route}: ${e.message.split("\n")[0]}`);
    }
    await page.close();
    console.log(`pass ${pass} ${route}: total fixtures ${Object.keys(store.responses).length}`);
  }
  await context.close();
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(store, null, 1));

  const retryable = [...failed.values()].filter((s) => [429, 502, 503, 504, "timeout"].includes(s)).length;
  console.log(`pass ${pass}: saved ${saved}, still failing ${failed.size} (${retryable} retryable)`);
  for (const [key, status] of failed) console.log(`  ${status} ${key}`);
  if (retryable === 0) break;
  if (pass < MAX_PASSES) {
    console.log("waiting 65s for GitHub search quota to reset...");
    await new Promise((r) => setTimeout(r, 65_000));
  }
}
await browser.close();
