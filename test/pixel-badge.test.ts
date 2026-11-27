import { describe, expect, it } from "vitest";
import {
  BADGE_HEIGHT,
  BG,
  BEVEL_LIGHT,
  BEVEL_DARK,
  DOWN,
  MUTED,
  PANEL_EDGE,
  UP,
  WHITE,
  escapeXml,
  frame,
  gem,
  sheen,
  text,
  wrap,
} from "@/lib/gamification/pixel-badge";

describe("pixel badge exports", () => {
  it("exports the shared badge palette and dimensions", () => {
    expect(BADGE_HEIGHT).toBe(64);
    expect([
      BG,
      PANEL_EDGE,
      BEVEL_LIGHT,
      BEVEL_DARK,
      MUTED,
      WHITE,
      UP,
      DOWN,
    ]).toEqual([
      "#0b1020",
      "#000000",
      "#2b3a5c",
      "#05070f",
      "#8a9bc0",
      "#f5f7fb",
      "#4ade80",
      "#fb7185",
    ]);
  });

  it("escapes all XML-sensitive characters and leaves plain text alone", () => {
    expect(escapeXml(`<tag a="b">Tom & Jerry's`)).toBe(
      "&#60;tag a=&#34;b&#34;&#62;Tom &#38; Jerry&#39;s"
    );
    expect(escapeXml("plain text")).toBe("plain text");
  });

  it("draws gem body and highlights, with optional finite sparkle", () => {
    const still = gem(10, 20, 2, "red", "white", false);
    expect(still).toContain('fill="red"');
    expect(still).toContain('fill="white"');
    expect(still).toContain("M10 26h2v2h-2z");
    expect(still).not.toContain("<animate");

    const sparkling = gem(0, 0, 1, "blue", "silver", true);
    expect(sparkling).toContain('attributeName="opacity"');
    expect(sparkling).toContain('repeatCount="3"');
  });

  it("creates pixel text paths and a beveled frame", () => {
    expect(text("A", 3, 9, 2, "white")).toMatch(/^<path d="M/);
    const panel = frame(100, 64);
    expect(panel).toContain('<rect x="0" y="0" width="100" height="64"');
    expect(panel).toContain(`fill="${BEVEL_LIGHT}"`);
    expect(panel).toContain(`fill="${BEVEL_DARK}"`);
  });

  it("creates a clipped sheen and safely wraps the SVG title", () => {
    expect(sheen(100, 64)).toContain('<g clip-path="url(#panel)">');
    expect(sheen(100, 64)).toContain('repeatCount="2"');
    const svg = wrap(100, 64, 'A <badge> & "title"', "<circle />");
    expect(svg).toContain(
      'aria-label="A &#60;badge&#62; &#38; &#34;title&#34;"'
    );
    expect(svg).toContain(
      "<title>A &#60;badge&#62; &#38; &#34;title&#34;</title>"
    );
    expect(svg).toContain("<circle />");
    expect(svg).toContain('viewBox="0 0 100 64"');
  });
});
