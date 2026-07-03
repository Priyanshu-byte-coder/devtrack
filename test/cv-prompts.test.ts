import { describe, it, expect } from "vitest";
import {
  cvBulletPointPrompt,
  cvProjectDescriptionPrompt,
  cvProfessionalSummaryPrompt,
  cvSkillSummaryPrompt,
} from "../src/lib/cv/cv-prompts";
import type { ContributionClassification, TechItem } from "@/types/cv-types";

const makeTechItem = (name: string, overrides: Partial<TechItem> = {}): TechItem => ({
  name,
  confidence: "high",
  source: "language",
  occurrences: 1,
  ...overrides,
});

const makeClassification = (overrides: Partial<ContributionClassification> = {}): ContributionClassification => ({
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
      const classification = makeClassification();
      const prompt = cvBulletPointPrompt(classification, ROLE);
      expect(prompt).toContain(ROLE);
    });

    it("includes repository names when repos are present", () => {
      const classification = makeClassification({
        repositoryAnalyses: [
          {
            name: "my-repo",
            nameWithOwner: "owner/my-repo",
            url: "https://github.com/owner/my-repo",
            description: "A cool project",
            detectedDomains: [],
            languages: ["TypeScript"],
            topics: [],
            complexity: "medium",
            prsMerged: 5,
            totalAdditions: 500,
            totalDeletions: 100,
            relevanceByRole: { "Frontend Developer": 80 },
          },
        ],
      });
      const prompt = cvBulletPointPrompt(classification, ROLE);
      expect(prompt).toContain("owner/my-repo");
      expect(prompt).toContain("my-repo");
    });

    it("includes language data for repositories", () => {
      const classification = makeClassification({
        repositoryAnalyses: [
          {
            name: "ts-app",
            nameWithOwner: "owner/ts-app",
            url: "https://github.com/owner/ts-app",
            description: null,
            detectedDomains: [],
            languages: ["TypeScript", "React"],
            topics: [],
            complexity: "medium",
            prsMerged: 3,
            totalAdditions: 300,
            totalDeletions: 50,
            relevanceByRole: { "Frontend Developer": 90 },
          },
        ],
      });
      const prompt = cvBulletPointPrompt(classification, ROLE);
      expect(prompt).toContain("TypeScript");
      expect(prompt).toContain("React");
    });

    it("handles empty repository list gracefully", () => {
      const classification = makeClassification();
      const prompt = cvBulletPointPrompt(classification, ROLE);
      expect(prompt).toContain(ROLE);
      expect(prompt).toContain("No contribution data available");
    });

    it("limits included repos to top 5 by relevance", () => {
      const repos = Array.from({ length: 10 }, (_, i) => ({
        name: `repo-${i}`,
        nameWithOwner: `owner/repo-${i}`,
        url: `https://github.com/owner/repo-${i}`,
        description: null,
        detectedDomains: [],
        languages: ["React"],
        topics: [],
        complexity: "low",
        prsMerged: 1,
        totalAdditions: 10,
        totalDeletions: 2,
        relevanceByRole: { "Frontend Developer": 100 - i },
      }));
      const classification = makeClassification({ repositoryAnalyses: repos as any });
      const prompt = cvBulletPointPrompt(classification, ROLE);
      expect(prompt).toContain("repo-0");
      expect(prompt).not.toContain("repo-9");
    });
  });

  describe("cvProjectDescriptionPrompt", () => {
    it("includes repository names when repos are present", () => {
      const classification = makeClassification({
        repositoryAnalyses: [
          {
            name: "awesome-project",
            nameWithOwner: "owner/awesome-project",
            url: "https://github.com/owner/awesome-project",
            description: "An awesome project",
            detectedDomains: [],
            languages: ["TypeScript"],
            topics: ["react", "typescript"],
            complexity: "high",
            prsMerged: 10,
            totalAdditions: 2000,
            totalDeletions: 500,
            relevanceByRole: { "Frontend Developer": 95 },
          },
        ],
      });
      const prompt = cvProjectDescriptionPrompt(classification, ROLE);
      expect(prompt).toContain("awesome-project");
      expect(prompt).toContain("owner/awesome-project");
    });

    it("includes repository URL", () => {
      const classification = makeClassification({
        repositoryAnalyses: [
          {
            name: "proj",
            nameWithOwner: "owner/proj",
            url: "https://github.com/owner/proj",
            description: null,
            detectedDomains: [],
            languages: ["React"],
            topics: [],
            complexity: "medium",
            prsMerged: 5,
            totalAdditions: 500,
            totalDeletions: 100,
            relevanceByRole: { "Frontend Developer": 70 },
          },
        ],
      });
      const prompt = cvProjectDescriptionPrompt(classification, ROLE);
      expect(prompt).toContain("https://github.com/owner/proj");
    });

    it("includes complexity level", () => {
      const classification = makeClassification({
        repositoryAnalyses: [
          {
            name: "proj",
            nameWithOwner: "owner/proj",
            url: "https://github.com/owner/proj",
            description: null,
            detectedDomains: [],
            languages: ["Python"],
            topics: [],
            complexity: "high",
            prsMerged: 15,
            totalAdditions: 6000,
            totalDeletions: 2000,
            relevanceByRole: { "Frontend Developer": 50 },
          },
        ],
      });
      const prompt = cvProjectDescriptionPrompt(classification, ROLE);
      expect(prompt).toContain("high");
    });

    it("handles empty repository list gracefully", () => {
      const classification = makeClassification();
      const prompt = cvProjectDescriptionPrompt(classification, ROLE);
      expect(prompt).toContain("No projects available");
    });

    it("limits repos to top 4 by relevance", () => {
      const repos = Array.from({ length: 8 }, (_, i) => ({
        name: `repo-${i}`,
        nameWithOwner: `owner/repo-${i}`,
        url: `https://github.com/owner/repo-${i}`,
        description: null,
        detectedDomains: [],
        languages: ["React"],
        topics: [],
        complexity: "low",
        prsMerged: 1,
        totalAdditions: 10,
        totalDeletions: 2,
        relevanceByRole: { "Frontend Developer": 100 - i },
      }));
      const classification = makeClassification({ repositoryAnalyses: repos as any });
      const prompt = cvProjectDescriptionPrompt(classification, ROLE);
      expect(prompt).toContain("repo-0");
      expect(prompt).not.toContain("repo-5");
    });
  });

  describe("cvProfessionalSummaryPrompt", () => {
    it("includes the primary domain", () => {
      const classification = makeClassification({ primaryDomain: "Frontend" });
      const prompt = cvProfessionalSummaryPrompt(classification, ROLE);
      expect(prompt).toContain("Frontend");
    });

    it("includes contribution statistics", () => {
      const classification = makeClassification({
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
      });
      const prompt = cvProfessionalSummaryPrompt(classification, ROLE);
      expect(prompt).toContain("42");
      expect(prompt).toContain("300");
    });

    it("includes top languages", () => {
      const classification = makeClassification({
        techStack: {
          languages: [makeTechItem("TypeScript", { confidence: "high", source: "language", occurrences: 3 })],
          frameworks: [],
          tools: [],
        },
      });
      const prompt = cvProfessionalSummaryPrompt(classification, ROLE);
      expect(prompt).toContain("TypeScript");
    });

    it("includes all languages from techStack without filtering by confidence", () => {
      const classification = makeClassification({
        techStack: {
          languages: [
            makeTechItem("TypeScript", { confidence: "high", source: "language", occurrences: 3 }),
            makeTechItem("Webpack", { confidence: "low", source: "pr_content", occurrences: 1 }),
          ],
          frameworks: [],
          tools: [],
        },
      });
      const prompt = cvProfessionalSummaryPrompt(classification, ROLE);
      expect(prompt).toContain("TypeScript");
      expect(prompt).toContain("Webpack");
    });
  });

  describe("cvSkillSummaryPrompt", () => {
    it("returns a string prompt that instructs the LLM to respond with JSON", () => {
      const classification = makeClassification();
      const result = cvSkillSummaryPrompt(classification, ROLE);
      expect(typeof result).toBe("string");
      expect(result).toContain("You are an expert");
      expect(result).toContain("TARGET ROLE");
      expect(result).toContain("Respond ONLY with valid JSON");
    });

    it("includes detected languages in the prompt", () => {
      const classification = makeClassification({
        techStack: {
          languages: [makeTechItem("TypeScript", { confidence: "high", source: "language", occurrences: 3 })],
          frameworks: [makeTechItem("React", { confidence: "high", source: "language", occurrences: 2 })],
          tools: [],
        },
      });
      const result = cvSkillSummaryPrompt(classification, ROLE);
      expect(result).toContain("TypeScript");
      expect(result).toContain("React");
    });

    it("includes domain scores when domains are provided", () => {
      const classification = makeClassification({
        domains: [
          { domain: "Frontend", score: 75, evidence: ["Tech: React"] },
          { domain: "Backend", score: 20, evidence: [] },
        ],
      });
      const result = cvSkillSummaryPrompt(classification, ROLE);
      expect(result).toContain("Frontend");
      expect(result).toContain("75");
    });

    it("handles empty techStack gracefully", () => {
      const classification = makeClassification();
      const result = cvSkillSummaryPrompt(classification, ROLE);
      expect(typeof result).toBe("string");
      expect(result).toContain("TARGET ROLE");
    });
  });
});
