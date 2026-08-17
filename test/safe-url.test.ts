import { describe, it, expect } from "vitest";
import { safeExternalHref } from "../src/lib/safe-url";

describe("safeExternalHref", () => {
  it("allows http and https URLs", () => {
    expect(safeExternalHref("https://github.com/vercel/next.js")).toBe(
      "https://github.com/vercel/next.js"
    );
    expect(safeExternalHref("http://example.com")).toBe("http://example.com");
  });

  it("allows mailto links", () => {
    expect(safeExternalHref("mailto:hello@example.com")).toBe(
      "mailto:hello@example.com"
    );
  });

  it("rejects javascript: URIs", () => {
    expect(safeExternalHref("javascript:alert(1)")).toBeUndefined();
  });

  it("rejects javascript: URIs regardless of casing or padding", () => {
    expect(safeExternalHref("  JavaScript:alert(1)  ")).toBeUndefined();
    expect(safeExternalHref("JAVASCRIPT:alert(1)")).toBeUndefined();
  });

  it("rejects data: and vbscript: URIs", () => {
    expect(
      safeExternalHref("data:text/html,<script>alert(1)</script>")
    ).toBeUndefined();
    expect(safeExternalHref("vbscript:msgbox(1)")).toBeUndefined();
  });

  it("allows relative and protocol-relative URLs", () => {
    expect(safeExternalHref("/dashboard")).toBe("/dashboard");
    expect(safeExternalHref("//cdn.example.com/a.png")).toBe(
      "//cdn.example.com/a.png"
    );
  });

  it("returns undefined for empty, blank and nullish input", () => {
    expect(safeExternalHref("")).toBeUndefined();
    expect(safeExternalHref("   ")).toBeUndefined();
    expect(safeExternalHref(null)).toBeUndefined();
    expect(safeExternalHref(undefined)).toBeUndefined();
  });

  it("returns undefined for strings that are not URLs at all", () => {
    expect(safeExternalHref("not a url")).toBeUndefined();
  });
});
