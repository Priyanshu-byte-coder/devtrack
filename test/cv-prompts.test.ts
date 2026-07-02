import { describe, it, expect } from "vitest";
import {
  cvBulletPointPrompt,
  cvProjectDescriptionPrompt,
  cvProfessionalSummaryPrompt,
  cvSkillSummaryPrompt,
} from "../src/lib/cv/cv-prompts";
import type { ContributionClassification } from "@/types/cv-types";

const makeClassification = (overrides = {}) => ({
  techStack: { languages: [], frameworks: [], tools: [] },
  domains: [],
  primaryDomain: "FullStack",
  repositoryAnalyses: [],
  contributionScores: {
    totalPRsMerged: 0,
    totalCommits: 0,
    totalAdditions: 0,
    totalDeletions: 0,
    totalReposContributed: 0,
    totalIssues: 0,
    totalReviews: 0,
    avgPRSize: 0,
    topLanguages: [],
  },
  generatedAt: new Date().toISOString(),
  ...overrides,
});

const ROLE = "Frontend Developer";

describe("cv-prompts", () => {
  describe("cvBulletPointPrompt", () => {
    it("includes the target role in the prompt string", () => {
      expect(cvBulletPointPrompt(makeClassification(), ROLE)).toContain(ROLE);
    });
    it("includes repository names when repos are present", () => {
      const prompt = cvBulletPointPrompt(makeClassification({
        repositoryAnalyses: [{ name: "my-repo", nameWithOwner: "owner/my-repo", url: "https://github.com/owner/my-repo", description: "A cool project", detectedDomains: [], languages: ["TypeScript"], topics: [], complexity: "medium", prsMerged: 5, totalAdditions: 500, totalDeletions: 100, relevanceByRole: { "Frontend Developer": 80 } }],
      }), ROLE);
      expect(prompt).toContain("owner/my-repo");
      expect(prompt).toContain("my-repo");
    });
    it("includes language data for repositories", () => {
      const prompt = cvBulletPointPrompt(makeClassification({
        repositoryAnalyses: [{ name: "ts-app", nameWithOwner: "owner/ts-app", url: "https://github.com/owner/ts-app", description: null, detectedDomains: [], languages: ["TypeScript", "React"], topics: [], complexity: "medium", prsMerged: 3, totalAdditions: 300, totalDeletions: 50, relevanceByRole: { "Frontend Developer": 90 } }],
      }), ROLE);
      expect(prompt).toContain("TypeScript");
      expect(prompt).toContain("React");
    });
    it("handles empty repository list gracefully", () => {
      const prompt = cvBulletPointPrompt(makeClassification(), ROLE);
      expect(prompt).toContain(ROLE);
      expect(prompt).toContain("No contribution data available");
    });
    it("limits included repos to top 5 by relevance", () => {
      const repos = Array.from({ length: 10 }, (_, i) => ({
        name: `repo-${i}`, nameWithOwner: `owner/repo-${i}`, url: `https://github.com/owner/repo-${i}`,
        description: null, detectedDomains: [], languages: ["React"], topics: [], complexity: "low",
        prsMerged: 1, totalAdditions: 10, totalDeletions: 2,
        relevanceByRole: { "Frontend Developer": 100 - i },
      }));
      const prompt = cvBulletPointPrompt(makeClassification({ repositoryAnalyses: repos }), ROLE);
      expect(prompt).toContain("repo-0");
      expect(prompt).not.toContain("repo-9");
    });
  });
  describe("cvProjectDescriptionPrompt", () => {
    it("includes repository names when repos are present", () => {
      const prompt = cvProjectDescriptionPrompt(makeClassification({
        repositoryAnalyses: [{ name: "awesome-project", nameWithOwner: "owner/awesome-project", url: "https://github.com/owner/awesome-project", description: "An awesome project", detectedDomains: [], languages: ["TypeScript"], topics: ["react", "typescript"], complexity: "high", prsMerged: 10, totalAdditions: 2000, totalDeletions: 500, relevanceByRole: { "Frontend Developer": 95 } }],
      }), ROLE);
      expect(prompt).toContain("awesome-project");
      expect(prompt).toContain("owner/awesome-project");
    });
    it("includes repository URL", () => {
      const prompt = cvProjectDescriptionPrompt(makeClassification({
        repositoryAnalyses: [{ name: "proj", nameWithOwner: "owner/proj", url: "https://github.com/owner/proj", description: null, detectedDomains: [], languages: ["React"], topics: [], complexity: "medium", prsMerged: 5, totalAdditions: 500, totalDeletions: 100, relevanceByRole: { "Frontend Developer": 70 } }],
      }), ROLE);
      expect(prompt).toContain("https://github.com/owner/proj");
    });
    it("includes complexity level", () => {
      const prompt = cvProjectDescriptionPrompt(makeClassification({
        repositoryAnalyses: [{ name: "proj", nameWithOwner: "owner/proj", url: "https://github.com/owner/proj", description: null, detectedDomains: [], languages: ["Python"], topics: [], complexity: "high", prsMerged: 15, totalAdditions: 6000, totalDeletions: 2000, relevanceByRole: { "Frontend Developer": 50 } }],
      }), ROLE);
      expect(prompt).toContain("high");
    });
    it("handles empty repository list gracefully", () => {
      expect(cvProjectDescriptionPrompt(makeClassification(), ROLE)).toContain("No projects available");
    });
    it("limits repos to top 4 by relevance", () => {
      const repos = Array.from({ length: 8 }, (_, i) => ({
        name: `repo-${i}`, nameWithOwner: `owner/repo-${i}`, url: `https://github.com/owner/repo-${i}`,
        description: null, detectedDomains: [], languages: ["React"], topics: [], complexity: "low",
        prsMerged: 1, totalAdditions: 10, totalDeletions: 2,
        relevanceByRole: { "Frontend Developer": 100 - i },
      }));
      const prompt = cvProjectDescriptionPrompt(makeClassification({ repositoryAnalyses: repos }), ROLE);
      expect(prompt).toContain("repo-0");
      expect(prompt).not.toContain("repo-5");
    });
  });
  describe("cvProfessionalSummaryPrompt", () => {
    it("includes the primary domain", () => {
      expect(cvProfessionalSummaryPrompt(makeClassification({ primaryDomain: "Frontend" }), ROLE)).toContain("Frontend");
    });
    it("includes contribution statistics", () => {
      const prompt = cvProfessionalSummaryPrompt(makeClassification({
        contributionScores: {
          totalPRsMerged: 42,
          totalCommits: 300,
          totalAdditions: 10000,
          totalDeletions: 2000,
          totalReposContributed: 5,
          totalIssues: 10,
          totalReviews: 20,
          avgPRSize: 238,
          topLanguages: ["TypeScript", "Python"],
        },
      }), ROLE);
      expect(prompt).toContain("42");
      expect(prompt).toContain("300");
    });
    it("includes top languages", () => {
      const prompt = cvProfessionalSummaryPrompt(makeClassification({
        techStack: { languages: [{ name: "TypeScript", confidence: "high", source: "language", occurrences: 5 }], frameworks: [], tools: [] },
      }), ROLE);
      expect(prompt).toContain("TypeScript");
    });
    it("does not include unrecognised technologies", () => {
      const prompt = cvProfessionalSummaryPrompt(makeClassification({
        techStack: { languages: [{ name: "SomeFakeLang", confidence: "low", source: "pr_content", occurrences: 1 }], frameworks: [], tools: [] },
      }), ROLE);
      expect(prompt).not.toContain("SomeFakeLang");
    });
  });
  describe("cvSkillSummaryPrompt", () => {
    it("returns a JSON-parseable string", () => {
      expect(() => JSON.parse(cvSkillSummaryPrompt(makeClassification(), ROLE))).not.toThrow();
    });
    it("parsed result contains required top-level fields", () => {
      const parsed = JSON.parse(cvSkillSummaryPrompt(makeClassification(), ROLE));
      expect(parsed).toHaveProperty("summary");
      expect(parsed).toHaveProperty("skills");
    });
    it("skills array contains objects with category and skills fields", () => {
      const parsed = JSON.parse(cvSkillSummaryPrompt(makeClassification({
        techStack: {
          languages: [{ name: "TypeScript", confidence: "high", source: "language", occurrences: 3 }],
          frameworks: [{ name: "React", confidence: "high", source: "language", occurrences: 2 }],
          tools: [],
        },
      }), ROLE));
      expect(Array.isArray(parsed.skills)).toBe(true);
      for (const cat of parsed.skills) {
        expect(cat).toHaveProperty("category");
        expect(cat).toHaveProperty("skills");
        expect(Array.isArray(cat.skills)).toBe(true);
      }
    });
    it("skills are filtered to detected technologies only", () => {
      const parsed = JSON.parse(cvSkillSummaryPrompt(makeClassification({
        techStack: {
          languages: [{ name: "TypeScript", confidence: "high", source: "language", occurrences: 5 }],
          frameworks: [{ name: "React", confidence: "high", source: "language", occurrences: 3 }],
          tools: [],
        },
      }), ROLE));
      const allSkills = parsed.skills.flatMap((cat) => cat.skills);
      expect(allSkills).toContain("React");
      expect(allSkills).toContain("TypeScript");
    });
    it("includes domain scores", () => {
      const result = cvSkillSummaryPrompt(makeClassification({
        domains: [
          { domain: "Frontend", score: 75, evidence: ["Tech: React"] },
          { domain: "Backend", score: 20, evidence: [] },
        ],
      }), ROLE);
      expect(result).toContain("Frontend");
      expect(result).toContain("75");
    });
  });
});