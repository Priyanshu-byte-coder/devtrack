import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "../src/lib/csv";

describe("csvCell", () => {
  it("returns empty string for null", () => {
    expect(csvCell(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(csvCell(undefined)).toBe("");
  });

  it("returns plain string unchanged", () => {
    expect(csvCell("hello")).toBe("hello");
  });

  it("returns number as string", () => {
    expect(csvCell(42)).toBe("42");
  });

  it("returns boolean as string", () => {
    expect(csvCell(true)).toBe("true");
    expect(csvCell(false)).toBe("false");
  });

  it("wraps string with comma in double-quotes", () => {
    expect(csvCell("hello, world")).toBe('"hello, world"');
  });

  it("wraps string with double-quote in double-quotes and escapes inner quotes", () => {
    expect(csvCell('say "hello"')).toBe('"say ""hello"""');
  });

  it("wraps string with newline in double-quotes", () => {
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("wraps string with carriage return in double-quotes", () => {
    expect(csvCell("line1\rline2")).toBe('"line1\rline2"');
  });

  it("wraps string with all special chars (comma, quote, newline)", () => {
    expect(csvCell('a, "b"\nc')).toBe('"a, ""b""\nc"');
  });

  it("returns plain string unchanged when it has no special chars", () => {
    expect(csvCell("simple")).toBe("simple");
    expect(csvCell("hello world")).toBe("hello world");
  });
});

describe("toCsv", () => {
  it("returns empty string for empty array", () => {
    expect(toCsv([])).toBe("");
  });

  it("returns header and data row for single row", () => {
  expect(toCsv([{ name: "Alice", age: 30 }])).toBe("name,age\nAlice,30");
  });

  it("serialises multiple rows with correct values", () => {
    const rows = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];
    const result = toCsv(rows);
    expect(result).toBe("name,age\nAlice,30\nBob,25");
  });

  it("omits extra keys not present in first row", () => {
    const rows = [
      { name: "Alice", age: 30 },
      { name: "Bob", extra: "ignored" },
    ];
    expect(toCsv(rows)).toBe("name,age\nAlice,30\nBob,");
  });

  it("fills empty cells for keys missing in later rows", () => {
    const rows = [
      { name: "Alice", age: 30, city: "NYC" },
      { name: "Bob" },
    ];
    expect(toCsv(rows)).toBe("name,age,city\nAlice,30,NYC\nBob,,");
  });

  it("handles values requiring CSV escaping", () => {
    const rows = [
      { value: "simple" },
      { value: "has, comma" },
      { value: 'has "quote"' },
      { value: "multi\nline" },
    ];
    const result = toCsv(rows);
    const lines = result.split("\n");
    expect(lines[1]).toBe("simple");
    expect(lines[2]).toBe('"has, comma"');
    expect(lines[3]).toBe('"has ""quote"""');
    expect(lines[4]).toBe('"multi\nline"');
  });

  it("handles null and undefined in cells", () => {
    const rows = [{ a: null, b: undefined, c: "hello" }];
    const result = toCsv(rows);
    expect(result).toBe("a,b,c\n,,hello");
  });

  it("handles numbers and booleans without quoting", () => {
    const rows = [{ n: 42, b: true }];
    const result = toCsv(rows);
    expect(result).toBe("n,b\n42,true");
  });
});
