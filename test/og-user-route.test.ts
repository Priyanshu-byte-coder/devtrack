import { describe, expect, it } from "vitest";
import { normalizeOgUserParams } from "@/lib/og-user-params";

describe("normalizeOgUserParams", () => {
  it("derives the avatar from a validated username instead of trusting avatar input", () => {
    const params = new URLSearchParams({
      username: "octocat",
      avatar: "http://127.0.0.1/internal.png",
    });

    expect(normalizeOgUserParams(params)).toMatchObject({
      username: "octocat",
      avatar: "https://github.com/octocat.png?size=200",
    });
  });

  it("falls back to safe defaults for invalid usernames and metrics", () => {
    const params = new URLSearchParams({
      username: "../not-a-user",
      streak: "-5",
      commits: "not-a-number",
    });

    expect(normalizeOgUserParams(params)).toMatchObject({
      username: "developer",
      streak: 0,
      commits: 0,
    });
  });

  it("bounds oversized text and metric values", () => {
    const params = new URLSearchParams({
      username: "octocat",
      name: "a".repeat(80),
      topLang: "TypeScript".repeat(8),
      streak: "42.9",
      commits: "999999999",
    });
    const normalized = normalizeOgUserParams(params);

    expect(normalized.name).toHaveLength(48);
    expect(normalized.topLang).toHaveLength(24);
    expect(normalized.streak).toBe(42);
    expect(normalized.commits).toBe(999999);
  });
});
