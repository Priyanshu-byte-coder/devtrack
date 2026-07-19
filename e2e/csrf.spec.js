import { expect, test } from "@playwright/test";

test("POST with invalid origin returns 403", async ({ request }) => {
  const res = await request.post("/api/goals", {
    headers: {
      "Content-Type": "application/json",
      Origin: "https://evil.com",
    },
    data: { title: "x", target: 1, unit: "commits", recurrence: "none" },
  });
  expect(res.status()).toBe(403);
});

test("POST with invalid referer returns 403", async ({ request }) => {
  const res = await request.post("/api/goals", {
    headers: {
      "Content-Type": "application/json",
      referer: "https://evil.com/fake",
    },
    data: { title: "x", target: 1, unit: "commits", recurrence: "none" },
  });
  expect(res.status()).toBe(403);
});

test("GET is not blocked by CSRF", async ({ request }) => {
  const res = await request.get("/api/goals");
  expect(res.status()).toBeGreaterThanOrEqual(200);
  expect(res.status()).not.toBe(403);
});

test("webhook POST without origin is not blocked", async ({ request }) => {
  const res = await request.post("/api/webhooks/github", {
    data: { ref: "refs/heads/main" },
  });
  expect(res.status()).not.toBe(403);
});

test("same-origin POST reaches handler", async ({ request }) => {
  const res = await request.post("/api/goals", {
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:3002",
    },
    data: { title: "x", target: 1, unit: "commits", recurrence: "none" },
  });
  expect(res.status()).not.toBe(403);
});
