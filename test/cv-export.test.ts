import { describe, it, expect } from "vitest";
import {
  resumeFileSlug,
  resumeToMarkdown,
  resumeToPdf,
  toPdfSafeText,
} from "../src/lib/cv/cv-export";
import { cleanPlainText, safeParseJSON } from "../src/lib/cv/cv-ai-generator";
import { domainLabel } from "../src/lib/cv/cv-prompts";
import type { ResumeContent } from "@/types/cv-types";

const makeContent = (
  overrides: Partial<ResumeContent> = {}
): ResumeContent => ({
  role: "Full Stack Developer",
  profile: {
    name: "Ada Lovelace",
    login: "ada",
    email: "ada@example.com",
    location: "London",
    website: "ada.dev",
  },
  professionalSummary: "Full-stack developer shipping TypeScript services.",
  bulletPoints: [
    {
      text: "Built the sync engine.",
      repository: "app",
      confidence: 90,
      technologies: [],
    },
  ],
  projectDescriptions: [
    {
      name: "app",
      nameWithOwner: "ada/app",
      url: "https://github.com/ada/app",
      description: "An app.",
      highlights: ["Merged 3 pull requests"],
      technologies: ["TypeScript", "React"],
    },
  ],
  skillSummary: "",
  skills: [{ category: "Languages", skills: ["TypeScript", "Python"] }],
  generatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("toPdfSafeText", () => {
  it("maps arrows and dashes that Helvetica cannot draw", () => {
    expect(toPdfSafeText("A → B ≥ 2 ‑ ok")).toBe("A -> B >= 2 - ok");
  });

  it("drops emoji but keeps Latin-1 and typographic quotes", () => {
    expect(toPdfSafeText("Shipped 🚀 café “fast”")).toBe("Shipped café “fast”");
  });
});

describe("resumeToMarkdown", () => {
  it("leads with the person's name, role and contact links", () => {
    const md = resumeToMarkdown(makeContent());
    expect(md.startsWith("# Ada Lovelace\n")).toBe(true);
    expect(md).toContain("**Full Stack Developer**");
    expect(md).toContain("[github.com/ada](https://github.com/ada)");
    expect(md).toContain("## Key Contributions");
    expect(md).not.toContain("Generated at");
  });

  it("falls back to the login when the profile has no name", () => {
    const md = resumeToMarkdown(
      makeContent({
        profile: {
          name: null,
          login: "ada",
          email: null,
          location: null,
          website: null,
        },
      })
    );
    expect(md.startsWith("# ada\n")).toBe(true);
  });
});

describe("resumeFileSlug", () => {
  it("includes the login and role", () => {
    expect(resumeFileSlug(makeContent())).toBe(
      "resume-ada-full-stack-developer"
    );
  });
});

describe("resumeToPdf", () => {
  it("renders a PDF document", async () => {
    const buf = Buffer.from(await resumeToPdf(makeContent()));
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("paginates long content instead of drawing off the page", async () => {
    const many = Array.from({ length: 80 }, (_, i) => ({
      text: `Contribution ${i} with enough words to wrap onto a second line of the resume body text.`,
      repository: "app",
      confidence: 90,
      technologies: [],
    }));
    const buf = Buffer.from(
      await resumeToPdf(makeContent({ bulletPoints: many }))
    );
    const pages = buf.toString("latin1").match(/\/Type \/Page\b/g) ?? [];
    expect(pages.length).toBeGreaterThan(1);
  });
});

describe("AI output cleanup", () => {
  it("parses JSON wrapped in a preamble", () => {
    expect(
      safeParseJSON<number[]>(
        "Here are the bullets:\n[1, 2, 3]\nHope this helps!"
      )
    ).toEqual([1, 2, 3]);
  });

  it("parses fenced JSON", () => {
    expect(safeParseJSON<{ a: number }>('```json\n{"a": 1}\n```')).toEqual({
      a: 1,
    });
  });

  it("returns null for non-JSON", () => {
    expect(safeParseJSON("no json here")).toBeNull();
  });

  it("strips summary preambles and quotes", () => {
    expect(
      cleanPlainText('Here is a professional summary:\n"Builds things."')
    ).toBe("Builds things.");
  });

  it("labels engineering domains for humans", () => {
    expect(domainLabel("AI_ML")).toBe("AI/ML");
    expect(domainLabel("Frontend")).toBe("frontend");
  });
});
