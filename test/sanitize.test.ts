import { describe, it, expect } from "vitest";
import { stripHtml, validateTextInput } from "../src/lib/sanitize";

describe("stripHtml", () => {
  it("returns plain text unchanged", () => {
    expect(stripHtml("hello world")).toBe("hello world");
  });

  it("strips simple tags", () => {
    expect(stripHtml("<b>bold</b>")).toBe("bold");
  });

  it("strips nested tags", () => {
    expect(stripHtml("<div><p>text</p></div>")).toBe("text");
  });

  it("strips tags with attributes", () => {
    expect(stripHtml('<a href="http://evil.com">link</a>')).toBe("link");
  });

  it("decodes &amp;", () => {
    expect(stripHtml("A &amp; B")).toBe("A & B");
  });

  it("decodes &quot;", () => {
    expect(stripHtml("He said &quot;hi&quot;")).toBe('He said "hi"');
  });

  it("decodes entity-encoded tags to empty (entities decoded then stripped as tags)", () => {
    expect(stripHtml("&lt;script&gt;")).toBe("");
  });

  it("strips entity-encoded tags with content", () => {
    expect(stripHtml("&lt;b&gt;bold&lt;/b&gt;")).toBe("bold");
  });

  it("handles newlines in tags", () => {
    expect(stripHtml("line1\n<tag>\nline2")).toBe("line1\n\nline2");
  });

  it("trims whitespace", () => {
    expect(stripHtml("  hello  ")).toBe("hello");
  });

  it("handles empty string", () => {
    expect(stripHtml("")).toBe("");
  });
});

describe("validateTextInput", () => {
  it("returns ok for valid non-empty string", () => {
    const result = validateTextInput("hello world", "name");
    expect(result.ok).toBe(true);
    expect(result.value).toBe("hello world");
  });

  it("strips HTML from value", () => {
    const result = validateTextInput("<b>hello</b>", "name");
    expect(result.ok).toBe(true);
    expect(result.value).toBe("hello");
  });

  it("returns error for non-string", () => {
    const result = validateTextInput(123, "name");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/must be a string/);
  });

  it("returns error for null", () => {
    const result = validateTextInput(null, "name");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/must be a string/);
  });

  it("returns error for undefined", () => {
    const result = validateTextInput(undefined, "name");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/must be a string/);
  });

  it("returns error for empty string after HTML strip", () => {
    const result = validateTextInput("<b></b>", "name");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/must not be empty/);
  });

  it("returns error for string exceeding maxLen", () => {
    const result = validateTextInput("hello world", "name", 5);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/5 characters/);
  });

  it("uses default maxLen of 200", () => {
    const long = "x".repeat(201);
    const result = validateTextInput(long, "name");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/200 characters/);
  });

  it("custom maxLen parameter", () => {
    const result = validateTextInput("hello", "name", 3);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/3 characters/);
  });

  it("includes field name in error message", () => {
    const result = validateTextInput(42, "username");
    expect(result.error).toMatch(/username/);
  });
});
