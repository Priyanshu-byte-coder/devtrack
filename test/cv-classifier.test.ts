import { describe, it, expect } from "vitest";
import {
  detectTechnologies,
  mapToDomains,
  scoreContributions,
  analyzeRepository,
  classifyContributions,
  filterByRole,
} from "../src/lib/cv/cv-classifier";
import type { RepositoryData } from "@/types/cv-types";

const makeRepo = (overrides: Partial<RepositoryData> = {}): RepositoryData => ({
  name: "test-repo",
  nameWithOwner: "owner/test-repo",
  description: null,
  url: "https://github.com/owner/test-repo",
  stargazerCount: 10,
  forkCount: 2,
  isForked: false,
  languages: [],
  topics: [],
  pullRequests: [],
  commits: [],
  ...overrides,
});

const ROLE = "Frontend Developer";

describe("cv-classifier", () => {
  describe("detectTechnologies", () => {
    it("buckets known languages into the languages array", () => {
      const repo = makeRepo({ languages: ["Python", "Go"] });
      const stack = detectTechnologies([repo]);
      expect(stack.languages.map(l => l.name)).toContain("Python");
      expect(stack.languages.map(l => l.name)).toContain("Go");
    });

    it("buckets known frameworks into the frameworks array", () => {
      const repo = makeRepo({ languages: ["TypeScript"] });
      const stack = detectTechnologies([repo]);
      expect(stack.frameworks.map(f => f.name)).toContain("React");
      expect(stack.frameworks.map(f => f.name)).toContain("Express");
    });

    it("buckets known tools into the tools array", () => {
      const repo = makeRepo({ languages: ["Python"] });
      const stack = detectTechnologies([repo]);
      expect(stack.tools.map(t => t.name)).toContain("Docker");
      expect(stack.tools.map(t => t.name)).toContain("Kubernetes");
    });

    it("deduplicates and sums occurrences across repos", () => {
      const repo1 = makeRepo({ languages: ["Python"], name: "repo1" });
      const repo2 = makeRepo({ languages: ["Python"], name: "repo2" });
      const stack = detectTechnologies([repo1, repo2]);
      const python = stack.languages.find(l => l.name === "Python");
      expect(python?.occurrences).toBe(2);
    });

    it("sorts each bucket by occurrences descending", () => {
      const repo = makeRepo({
        languages: ["Python"],
        pullRequests: [{ title: "Add TypeScript support", body: null, additions: 10, deletions: 2, changedFiles: 1, labels: [], state: "MERGED" as const, mergedAt: null, createdAt: "" }],
        commits: [{ message: "Add Docker config", committedDate: "", additions: 5, deletions: 1 }],
      });
      const stack = detectTechnologies([repo]);
      const langs = stack.languages.map(l => l.occurrences);
      for (let i = 0; i < langs.length - 1; i++) {
        expect(langs[i]).toBeGreaterThanOrEqual(langs[i + 1]);
      }
    });

    it("assigns high confidence for language source", () => {
      const repo = makeRepo({ languages: ["Python"] });
      const stack = detectTechnologies([repo]);
      const python = stack.languages.find(l => l.name === "Python");
      expect(python?.confidence).toBe("high");
    });

    it("returns empty stack for repo with no detectable technologies", () => {
      const repo = makeRepo({ languages: ["RandomLang1", "RandomLang2"] });
      const stack = detectTechnologies([repo]);
      expect(stack.languages).toHaveLength(0);
      expect(stack.frameworks).toHaveLength(0);
      expect(stack.tools).toHaveLength(0);
    });
  });

  describe("mapToDomains", () => {
    it("scores Frontend domain when React/TypeScript are present", () => {
      const repo = makeRepo({ languages: ["React", "TypeScript"] });
      const stack = detectTechnologies([repo]);
      const domains = mapToDomains(stack, [repo]);
      const frontend = domains.find(d => d.domain === "Frontend");
      expect(frontend).toBeDefined();
      expect(frontend!.score).toBeGreaterThan(0);
    });

    it("scores Backend domain when Python/Node.js are present", () => {
      const repo = makeRepo({ languages: ["Python", "Node.js"] });
      const stack = detectTechnologies([repo]);
      const domains = mapToDomains(stack, [repo]);
      const backend = domains.find(d => d.domain === "Backend");
      expect(backend).toBeDefined();
      expect(backend!.score).toBeGreaterThan(0);
    });

    it("does not add FullStack when only Frontend score > 30", () => {
      const repo = makeRepo({
        languages: ["React", "TypeScript"],
        description: "ui component css tailwind react responsive layout",
      });
      const stack = detectTechnologies([repo]);
      const domains = mapToDomains(stack, [repo]);
      const fullstack = domains.find(d => d.domain === "FullStack");
      expect(fullstack).toBeUndefined();
    });

    it("adds FullStack when both Frontend and Backend scores exceed 30", () => {
      const frontendRepo = makeRepo({
        languages: ["React", "TypeScript"],
        description: "ui component css tailwind react responsive layout design markup frontend",
      });
      const backendRepo = makeRepo({
        languages: ["Python", "Node.js"],
        description: "api endpoint middleware authentication server database rest graphql microservice",
      });
      const stack = detectTechnologies([frontendRepo, backendRepo]);
      const domains = mapToDomains(stack, [frontendRepo, backendRepo]);
      const fullstack = domains.find(d => d.domain === "FullStack");
      expect(fullstack).toBeDefined();
      expect(fullstack!.score).toBeGreaterThan(0);
    });

    it("sorts domains by score descending", () => {
      const repo = makeRepo({ languages: ["React", "TypeScript", "Python"] });
      const stack = detectTechnologies([repo]);
      const domains = mapToDomains(stack, [repo]);
      for (let i = 0; i < domains.length - 1; i++) {
        expect(domains[i].score).toBeGreaterThanOrEqual(domains[i + 1].score);
      }
    });

    it("returns empty array when no technologies match any domain", () => {
      const repo = makeRepo({ languages: ["RandomLang1", "RandomLang2"] });
      const stack = detectTechnologies([repo]);
      const domains = mapToDomains(stack, [repo]);
      expect(domains).toHaveLength(0);
    });
  });

  describe("scoreContributions", () => {
    it("sums merged PRs correctly", () => {
      const data = {
        user: { login: "test", avatarUrl: "", bio: null },
        repositories: [
          makeRepo({
            pullRequests: [
              { title: "PR1", body: null, additions: 10, deletions: 2, changedFiles: 1, labels: [], state: "MERGED", mergedAt: "2024-01-01", createdAt: "2024-01-01" },
              { title: "PR2", body: null, additions: 5, deletions: 1, changedFiles: 1, labels: [], state: "MERGED", mergedAt: "2024-01-02", createdAt: "2024-01-02" },
            ],
            commits: [],
          }),
        ],
        contributionStats: { totalCommitContributions: 0, totalPullRequestContributions: 2, totalIssueContributions: 0, totalPullRequestReviewContributions: 0, totalContributions: 2 },
        fetchedAt: "",
      };
      expect(scoreContributions(data as any).totalPRsMerged).toBe(2);
    });

    it("computes avgPRSize correctly", () => {
      const data = {
        user: { login: "test", avatarUrl: "", bio: null },
        repositories: [
          makeRepo({
            pullRequests: [
              { title: "PR1", body: null, additions: 100, deletions: 20, changedFiles: 1, labels: [], state: "MERGED", mergedAt: "", createdAt: "" },
              { title: "PR2", body: null, additions: 200, deletions: 40, changedFiles: 1, labels: [], state: "MERGED", mergedAt: "", createdAt: "" },
            ],
            commits: [],
          }),
        ],
        contributionStats: { totalCommitContributions: 0, totalPullRequestContributions: 2, totalIssueContributions: 0, totalPullRequestReviewContributions: 0, totalContributions: 2 },
        fetchedAt: "",
      };
      expect(scoreContributions(data as any).avgPRSize).toBe(180);
    });

    it("returns avgPRSize of 0 when no merged PRs", () => {
      const data = {
        user: { login: "test", avatarUrl: "", bio: null },
        repositories: [makeRepo({ pullRequests: [], commits: [] })],
        contributionStats: { totalCommitContributions: 0, totalPullRequestContributions: 0, totalIssueContributions: 0, totalPullRequestReviewContributions: 0, totalContributions: 0 },
        fetchedAt: "",
      };
      expect(scoreContributions(data as any).avgPRSize).toBe(0);
    });

    it("counts commits across repos", () => {
      const data = {
        user: { login: "test", avatarUrl: "", bio: null },
        repositories: [
          makeRepo({ commits: [{ message: "c1", committedDate: "", additions: 10, deletions: 2 }] }),
          makeRepo({ commits: [{ message: "c2", committedDate: "", additions: 5, deletions: 1 }] }),
        ],
        contributionStats: { totalCommitContributions: 2, totalPullRequestContributions: 0, totalIssueContributions: 0, totalPullRequestReviewContributions: 0, totalContributions: 2 },
        fetchedAt: "",
      };
      expect(scoreContributions(data as any).totalCommits).toBe(2);
    });

    it("computes topLanguages sorted by frequency", () => {
      const data = {
        user: { login: "test", avatarUrl: "", bio: null },
        repositories: [
          makeRepo({ languages: ["Python", "Go"] }),
          makeRepo({ languages: ["Python", "Rust"] }),
          makeRepo({ languages: ["Go"] }),
        ],
        contributionStats: { totalCommitContributions: 0, totalPullRequestContributions: 0, totalIssueContributions: 0, totalPullRequestReviewContributions: 0, totalContributions: 0 },
        fetchedAt: "",
      };
      const scores = scoreContributions(data as any);
      expect(scores.topLanguages[0]).toBe("Python");
      expect(scores.topLanguages[1]).toBe("Go");
    });
  });

  describe("analyzeRepository", () => {
    it("classifies as high complexity for > 5000 total lines changed", () => {
      const repo = makeRepo({
        pullRequests: [
          { title: "big PR", body: null, additions: 3000, deletions: 1000, changedFiles: 1, labels: [], state: "MERGED", mergedAt: null, createdAt: "" },
          { title: "big PR 2", body: null, additions: 3000, deletions: 1000, changedFiles: 1, labels: [], state: "MERGED", mergedAt: null, createdAt: "" },
        ],
        commits: [],
      });
      expect(analyzeRepository(repo).complexity).toBe("high");
    });

    it("classifies as medium complexity for > 1000 total lines changed", () => {
      const repo = makeRepo({
        pullRequests: [{ title: "medium PR", body: null, additions: 800, deletions: 300, changedFiles: 1, labels: [], state: "MERGED", mergedAt: null, createdAt: "" }],
        commits: [],
      });
      expect(analyzeRepository(repo).complexity).toBe("medium");
    });

    it("classifies as low complexity for small changes", () => {
      const repo = makeRepo({
        pullRequests: [{ title: "small PR", body: null, additions: 50, deletions: 10, changedFiles: 1, labels: [], state: "MERGED", mergedAt: null, createdAt: "" }],
        commits: [],
      });
      expect(analyzeRepository(repo).complexity).toBe("low");
    });

    it("classifies as high complexity for > 10 merged PRs", () => {
      const prs = Array.from({ length: 11 }, (_, i) => ({
        title: `PR ${i}`, body: null, additions: 10, deletions: 2, changedFiles: 1, labels: [], state: "MERGED" as const, mergedAt: null, createdAt: "",
      }));
      expect(analyzeRepository(makeRepo({ pullRequests: prs, commits: [] })).complexity).toBe("high");
    });

    it("includes detected domains when keywords boost the score above threshold", () => {
      const repo = makeRepo({
        languages: ["React", "TypeScript"],
        description: "ui component css tailwind react responsive layout design markup frontend framework",
      });
      expect(analyzeRepository(repo).detectedDomains.length).toBeGreaterThan(0);
    });

    it("computes relevance scores for each role", () => {
      const repo = makeRepo({ languages: ["React", "TypeScript"] });
      expect(analyzeRepository(repo).relevanceByRole["Frontend Developer"]).toBeGreaterThan(0);
    });
  });

  describe("classifyContributions", () => {
    it("produces a valid ContributionClassification object", () => {
      const data = {
        user: { login: "test", avatarUrl: "", bio: null },
        repositories: [makeRepo({ languages: ["Python"], name: "py-repo" })],
        contributionStats: { totalCommitContributions: 5, totalPullRequestContributions: 3, totalIssueContributions: 1, totalPullRequestReviewContributions: 2, totalContributions: 10 },
        fetchedAt: "",
      };
      const result = classifyContributions(data as any);
      expect(result).toHaveProperty("techStack");
      expect(result).toHaveProperty("domains");
      expect(result).toHaveProperty("primaryDomain");
      expect(result).toHaveProperty("repositoryAnalyses");
      expect(result).toHaveProperty("contributionScores");
      expect(result).toHaveProperty("generatedAt");
    });

    it("primaryDomain defaults to FullStack when no domains detected", () => {
      const data = {
        user: { login: "test", avatarUrl: "", bio: null },
        repositories: [makeRepo({ languages: ["Random"] })],
        contributionStats: { totalCommitContributions: 0, totalPullRequestContributions: 0, totalIssueContributions: 0, totalPullRequestReviewContributions: 0, totalContributions: 0 },
        fetchedAt: "",
      };
      expect(classifyContributions(data as any).primaryDomain).toBe("FullStack");
    });

    it("sets generatedAt to an ISO timestamp", () => {
      const data = {
        user: { login: "test", avatarUrl: "", bio: null },
        repositories: [],
        contributionStats: { totalCommitContributions: 0, totalPullRequestContributions: 0, totalIssueContributions: 0, totalPullRequestReviewContributions: 0, totalContributions: 0 },
        fetchedAt: "",
      };
      const result = classifyContributions(data as any);
      expect(new Date(result.generatedAt).toISOString()).toBe(result.generatedAt);
    });
  });

  describe("filterByRole", () => {
    it("returns a new classification object (not mutated)", () => {
      const data = {
        user: { login: "test", avatarUrl: "", bio: null },
        repositories: [makeRepo({ languages: ["React", "TypeScript"], name: "repo" })],
        contributionStats: { totalCommitContributions: 5, totalPullRequestContributions: 3, totalIssueContributions: 0, totalPullRequestReviewContributions: 0, totalContributions: 8 },
        fetchedAt: "",
      };
      const original = classifyContributions(data as any);
      expect(filterByRole(original, ROLE)).not.toBe(original);
    });

    it("removes non-Frontend technologies when filtering for Frontend Developer", () => {
      const data = {
        user: { login: "test", avatarUrl: "", bio: null },
        repositories: [makeRepo({ languages: ["React", "TypeScript", "Python"], name: "repo" })],
        contributionStats: { totalCommitContributions: 5, totalPullRequestContributions: 3, totalIssueContributions: 0, totalPullRequestReviewContributions: 0, totalContributions: 8 },
        fetchedAt: "",
      };
      const filtered = filterByRole(classifyContributions(data as any), "Frontend Developer");
      expect(filtered.techStack.languages.map(l => l.name)).not.toContain("Python");
    });

    it("filters out repos with 0 relevance for the target role", () => {
      const data = {
        user: { login: "test", avatarUrl: "", bio: null },
        repositories: [
          makeRepo({ languages: ["React"], name: "frontend-repo" }),
          makeRepo({ languages: ["Python"], name: "backend-repo" }),
        ],
        contributionStats: { totalCommitContributions: 5, totalPullRequestContributions: 3, totalIssueContributions: 0, totalPullRequestReviewContributions: 0, totalContributions: 8 },
        fetchedAt: "",
      };
      const filtered = filterByRole(classifyContributions(data as any), "Frontend Developer");
      expect(filtered.repositoryAnalyses.map(r => r.name)).toContain("frontend-repo");
    });

    it("keeps repos sorted by relevance descending", () => {
      const data = {
        user: { login: "test", avatarUrl: "", bio: null },
        repositories: [
          makeRepo({ languages: ["React"], name: "low-relevance" }),
          makeRepo({ languages: ["React"], name: "high-relevance" }),
        ],
        contributionStats: { totalCommitContributions: 0, totalPullRequestContributions: 0, totalIssueContributions: 0, totalPullRequestReviewContributions: 0, totalContributions: 0 },
        fetchedAt: "",
      };
      const filtered = filterByRole(classifyContributions(data as any), "Frontend Developer");
      const relevances = filtered.repositoryAnalyses.map(r => r.relevanceByRole["Frontend Developer"]);
      for (let i = 0; i < relevances.length - 1; i++) {
        expect(relevances[i]).toBeGreaterThanOrEqual(relevances[i + 1]);
      }
    });

    it("returns classification as-is for unknown role", () => {
      const data = {
        user: { login: "test", avatarUrl: "", bio: null },
        repositories: [makeRepo({ languages: ["React"] })],
        contributionStats: { totalCommitContributions: 0, totalPullRequestContributions: 0, totalIssueContributions: 0, totalPullRequestReviewContributions: 0, totalContributions: 0 },
        fetchedAt: "",
      };
      const original = classifyContributions(data as any);
      expect(filterByRole(original, "Unknown Role")).toEqual(original);
    });
  });
});
