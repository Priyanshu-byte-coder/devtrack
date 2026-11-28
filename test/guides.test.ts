import { describe, expect, it } from "vitest";
import { findGuide, GUIDES } from "@/content/guides";
import { renderToStaticMarkup } from "react-dom/server";

describe("pull-request-checklist guide (#3801)", () => {
  it("exists and is registered in GUIDES list", () => {
    const guide = findGuide("pull-request-checklist");
    expect(guide).toBeDefined();
    expect(guide?.title).toBe("Writing a pull request maintainers want to merge");
    expect(GUIDES.some((g) => g.slug === "pull-request-checklist")).toBe(true);
  });

  it("has a description under 160 characters", () => {
    const guide = findGuide("pull-request-checklist");
    expect(guide?.description.length).toBeLessThanOrEqual(160);
    expect(guide?.description.length).toBeGreaterThan(50);
  });

  it("has between 2 and 4 FAQ entries", () => {
    const guide = findGuide("pull-request-checklist");
    expect(guide?.faq.length).toBeGreaterThanOrEqual(2);
    expect(guide?.faq.length).toBeLessThanOrEqual(4);
    for (const item of guide?.faq ?? []) {
      expect(item.q).toBeTruthy();
      expect(item.a).toBeTruthy();
    }
  });

  it("renders body with word count between 700 and 1200 words", () => {
    const guide = findGuide("pull-request-checklist");
    expect(guide).toBeDefined();
    const html = renderToStaticMarkup(guide!.body() as any);
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const words = text.split(" ").filter(Boolean);
    expect(words.length).toBeGreaterThanOrEqual(700);
    expect(words.length).toBeLessThanOrEqual(1200);
  });

  it("links to GitHub documentation and internal DevTrack guides", () => {
    const guide = findGuide("pull-request-checklist");
    const html = renderToStaticMarkup(guide!.body() as any);
    expect(html).toContain("https://docs.github.com");
    expect(html).toContain("/guides/devtrack-score");
    expect(html).toContain("/guides/github-activity-tracker");
  });
});

describe("first-open-source-issue guide (#3800)", () => {
  it("exists and is registered in GUIDES list", () => {
    const guide = findGuide("first-open-source-issue");
    expect(guide).toBeDefined();
    expect(guide?.title).toBe("How to pick your first open-source issue");
    expect(GUIDES.some((g) => g.slug === "first-open-source-issue")).toBe(true);
  });

  it("has a description under 160 characters", () => {
    const guide = findGuide("first-open-source-issue");
    expect(guide?.description.length).toBeLessThanOrEqual(160);
    expect(guide?.description.length).toBeGreaterThan(50);
  });

  it("has between 2 and 4 FAQ entries", () => {
    const guide = findGuide("first-open-source-issue");
    expect(guide?.faq.length).toBeGreaterThanOrEqual(2);
    expect(guide?.faq.length).toBeLessThanOrEqual(4);
    for (const item of guide?.faq ?? []) {
      expect(item.q).toBeTruthy();
      expect(item.a).toBeTruthy();
    }
  });

  it("renders body with word count between 700 and 1200 words", () => {
    const guide = findGuide("first-open-source-issue");
    expect(guide).toBeDefined();
    const html = renderToStaticMarkup(guide!.body() as any);
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const words = text.split(" ").filter(Boolean);
    expect(words.length).toBeGreaterThanOrEqual(700);
    expect(words.length).toBeLessThanOrEqual(1200);
  });

  it("links to GitHub documentation and internal DevTrack guides", () => {
    const guide = findGuide("first-open-source-issue");
    const html = renderToStaticMarkup(guide!.body() as any);
    expect(html).toContain("https://docs.github.com");
    expect(html).toContain("/guides/devtrack-score");
    expect(html).toContain("/guides/pull-request-checklist");
  });
});


describe("code-review-for-beginners guide (#3802)", () => {
  it("exists and is registered in GUIDES list", () => {
    const guide = findGuide("code-review-for-beginners");
    expect(guide).toBeDefined();
    expect(guide?.title).toBe(
      "Reviewing other people's pull requests (and why it grows your profile)"
    );
    expect(GUIDES.some((g) => g.slug === "code-review-for-beginners")).toBe(true);
  });

  it("has a description under 160 characters and 2–4 FAQs", () => {
    const guide = findGuide("code-review-for-beginners");
    expect(guide?.description.length).toBeLessThanOrEqual(160);
    expect(guide?.faq.length).toBeGreaterThanOrEqual(2);
    expect(guide?.faq.length).toBeLessThanOrEqual(4);
  });

  it("renders a 700–1,200 word guide with GitHub and DevTrack references", () => {
    const guide = findGuide("code-review-for-beginners");
    expect(guide).toBeDefined();
    const html = renderToStaticMarkup(guide!.body() as any);
    const text = html.replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
    const words = text.split(" ").filter(Boolean);
    expect(words.length).toBeGreaterThanOrEqual(700);
    expect(words.length).toBeLessThanOrEqual(1200);
    expect(html).toContain("https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference");
    expect(html).toContain("standalone repository");
    expect(html).toContain("/guides/devtrack-score");
    expect(html).toContain("/guides/pull-request-checklist");
    expect(html).toContain("15 lifetime XP");
  });
});
