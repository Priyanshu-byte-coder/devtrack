/**
 * Tests for src/lib/utils.ts
 *
 * Coverage
 * --------
 * cn                       -- clsx + tailwind-merge class merging, conflict resolution
 */

import { describe, it, expect } from "vitest";
import { cn } from "../src/lib/utils";

describe("cn", () => {
  it("merges class names without conflicts", () => {
    const result = cn("flex", "flex-col");
    expect(result).toBe("flex flex-col");
  });

  it("resolves conflicting Tailwind classes via tailwind-merge", () => {
    // When two classes from the same category (e.g. bg) are passed,
    // tailwind-merge keeps the last one
    const result = cn("bg-red-500", "bg-blue-500");
    expect(result).toBe("bg-blue-500");
  });

  it("accepts undefined and null as falsy class values", () => {
    const result = cn("flex", undefined, null, "gap-4");
    expect(result).toContain("flex");
    expect(result).toContain("gap-4");
    expect(result).not.toContain("undefined");
    expect(result).not.toContain("null");
  });

  it("accepts an empty input array", () => {
    const result = cn();
    expect(result).toBe("");
  });

  it("handles string arrays via clsx", () => {
    const result = cn(["flex", "items-center"]);
    expect(result).toContain("flex");
    expect(result).toContain("items-center");
  });

  it("handles mixed string and array inputs", () => {
    const result = cn("flex", ["items-center", "justify-between"]);
    expect(result).toContain("flex");
    expect(result).toContain("items-center");
    expect(result).toContain("justify-between");
  });
});
