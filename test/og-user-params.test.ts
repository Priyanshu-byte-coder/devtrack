import { describe, it, expect } from "vitest";
import { normalizeOgUserParams } from "../src/lib/og-user-params";

describe("normalizeOgUserParams", () => {
  it("returns a fully-populated OgUserParams object for valid inputs", () => {
    const params = new URLSearchParams({
      username: "octocat",
      name: "The Octocat",
      topLang: "TypeScript",
      streak: "42",
      commits: "1234",
    });

    const result = normalizeOgUserParams(params);

    expect(result).toEqual({
      username: "octocat",
      name: "The Octocat",
      avatar: "https://github.com/octocat.png?size=200",
      topLang: "TypeScript",
      streak: 42,
      commits: 1234,
    });
  });

  it("falls back to 'developer' when username is missing or invalid", () => {
    const params = new URLSearchParams();
    const result = normalizeOgUserParams(params);

    expect(result.username).toBe("developer");
    expect(result.avatar).toBe("https://github.com/developer.png?size=200");
  });

  it("falls back to 'developer' when username has invalid characters", () => {
    const params = new URLSearchParams({ username: "bad name!" });
    const result = normalizeOgUserParams(params);

    expect(result.username).toBe("developer");
    expect(result.avatar).toBe("https://github.com/developer.png?size=200");
  });

  it("trims and normalises the username", () => {
    const params = new URLSearchParams({ username: "  octocat  " });
    const result = normalizeOgUserParams(params);

    expect(result.username).toBe("octocat");
    expect(result.avatar).toBe("https://github.com/octocat.png?size=200");
  });

  it("falls back to username for the name field when name is missing", () => {
    const params = new URLSearchParams({ username: "octocat" });
    const result = normalizeOgUserParams(params);

    expect(result.name).toBe("octocat");
  });

  it("truncates the name field to MAX_NAME_LENGTH (48)", () => {
    const longName = "x".repeat(120);
    const params = new URLSearchParams({
      username: "octocat",
      name: longName,
    });
    const result = normalizeOgUserParams(params);

    expect(result.name.length).toBe(48);
    expect(result.name).toBe("x".repeat(48));
  });

  it("falls back to 'JavaScript' for topLang when missing", () => {
    const params = new URLSearchParams();
    const result = normalizeOgUserParams(params);

    expect(result.topLang).toBe("JavaScript");
  });

  it("truncates the topLang field to MAX_LANGUAGE_LENGTH (24)", () => {
    const longLang = "L".repeat(60);
    const params = new URLSearchParams({ topLang: longLang });
    const result = normalizeOgUserParams(params);

    expect(result.topLang.length).toBe(24);
    expect(result.topLang).toBe("L".repeat(24));
  });

  it("returns 0 for streak and commits when missing or empty", () => {
    const params = new URLSearchParams();
    const result = normalizeOgUserParams(params);

    expect(result.streak).toBe(0);
    expect(result.commits).toBe(0);
  });

  it("returns 0 for non-numeric streak/commits", () => {
    const params = new URLSearchParams({
      streak: "not-a-number",
      commits: "abc",
    });
    const result = normalizeOgUserParams(params);

    expect(result.streak).toBe(0);
    expect(result.commits).toBe(0);
  });

  it("returns 0 for negative streak/commits", () => {
    const params = new URLSearchParams({
      streak: "-3",
      commits: "-100",
    });
    const result = normalizeOgUserParams(params);

    expect(result.streak).toBe(0);
    expect(result.commits).toBe(0);
  });

  it("floors decimal streak/commits values", () => {
    const params = new URLSearchParams({
      streak: "12.9",
      commits: "100.1",
    });
    const result = normalizeOgUserParams(params);

    expect(result.streak).toBe(12);
    expect(result.commits).toBe(100);
  });

  it("clamps streak/commits to MAX_METRIC_VALUE (999999)", () => {
    const params = new URLSearchParams({
      streak: "5000000",
      commits: "9999999999",
    });
    const result = normalizeOgUserParams(params);

    expect(result.streak).toBe(999999);
    expect(result.commits).toBe(999999);
  });

  it("accepts the boundary value 999999 for streak/commits", () => {
    const params = new URLSearchParams({
      streak: "999999",
      commits: "999999",
    });
    const result = normalizeOgUserParams(params);

    expect(result.streak).toBe(999999);
    expect(result.commits).toBe(999999);
  });
});
