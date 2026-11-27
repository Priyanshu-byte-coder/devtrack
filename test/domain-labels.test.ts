import { describe, expect, it } from "vitest";
import { domainDisplayName, domainLabel } from "@/lib/cv/domain-labels";

describe("engineering domain labels", () => {
  it.each([
    ["Frontend", "Frontend", "frontend"],
    ["Backend", "Backend", "backend"],
    ["AI_ML", "AI / ML", "AI/ML"],
    ["DevOps", "DevOps", "DevOps"],
    ["DataScience", "Data science", "data science"],
    ["Security", "Security", "security"],
    ["Mobile", "Mobile", "mobile"],
    ["Systems", "Systems", "systems"],
    ["FullStack", "Full-stack", "full-stack"],
  ])("formats %s for UI and prose", (domain, display, label) => {
    expect(domainDisplayName(domain)).toBe(display);
    expect(domainLabel(domain)).toBe(label);
  });

  it("preserves unknown values and empty input as fallback labels", () => {
    expect(domainDisplayName("Quantum Computing")).toBe("Quantum Computing");
    expect(domainLabel("Quantum Computing")).toBe("quantum computing");
    expect(domainDisplayName("")).toBe("");
    expect(domainLabel("")).toBe("");
  });
});
