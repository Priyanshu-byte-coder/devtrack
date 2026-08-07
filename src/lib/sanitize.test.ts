import { describe, it, expect } from "vitest";
import { stripHtml, validateTextInput } from "./sanitize";

describe("stripHtml", () => {
  it("strips raw HTML tags", () => {
    expect(stripHtml("<img src=x onerror=alert(1)>")).toBe("");
    expect(stripHtml("<script>alert(1)</script>")).toBe("");
    expect(stripHtml("<b>hello</b>")).toBe("hello");
  });

  it("blocks entity-encoded script tags (the XSS bypass)", () => {
    const result = stripHtml("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).toBe("");
  });

  it("blocks mixed encoded payloads", () => {
    const result = stripHtml("&lt;img src=x onerror=alert(1)&gt;");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });

  it("keeps plain text intact", () => {
    expect(stripHtml("hello world")).toBe("hello world");
    expect(stripHtml("goal: finish by friday")).toBe("goal: finish by friday");
  });

  it("decodes safe entities in plain text", () => {
    expect(stripHtml("hello &amp; world")).toBe("hello & world");
    expect(stripHtml("say &quot;hi&quot;")).toBe('say "hi"');
  });
});

describe("validateTextInput", () => {
  it("rejects entity-encoded script tags", () => {
    const result = validateTextInput("&lt;script&gt;alert(1)&lt;/script&gt;", "bio");
    expect(result.ok).toBe(false);
  });

  it("accepts normal text", () => {
    const result = validateTextInput("My goal this week", "title");
    expect(result.ok).toBe(true);
    expect(result.value).toBe("My goal this week");
  });

  it("rejects non-string input", () => {
    expect(validateTextInput(123, "field").ok).toBe(false);
  });

  it("rejects empty after stripping", () => {
    expect(validateTextInput("<b></b>", "field").ok).toBe(false);
  });

  it("rejects input over maxLen", () => {
    expect(validateTextInput("a".repeat(201), "field").ok).toBe(false);
  });
});