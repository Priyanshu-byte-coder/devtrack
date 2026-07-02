import { describe, it, expect } from "vitest";
import {
  detectTechnologies,
  mapToDomains,
  scoreContributions,
  analyzeRepository,
  classifyContributions,
  filterByRole,
} from "../src/lib/cv/cv-classifier";
import type {
  GitHubContributionData,
  RepositoryData,
  PullRequestData,
  CommitData,
} from "@/types/cv-types";

const makeRepo = (overrides = {}) => ({
  name: "test-repo",
  nameWithOwner: "owner/test-repo",
  description: "A test repository",
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

const makePR = (overrides = {}) => ({
  title: "Add feature",
  body: null,
  additions: 50,
  deletions: 10,
  changedFiles: 3,
  labels: [],
  state: "MERGED",
  mergedAt: "2024-01-01T00:00:00Z",
  createdAt: "2023-12-31T00:00:00Z",
  ...overrides,
});

const makeCommit = (overrides = {}) => ({
  message: "feat: add feature",
  committedDate: "2024-01-01T00:00:00Z",
  additions: 20,
  deletions: 5,
  ...overrides,
});

const minimalData = {
  user: { login: "testuser", avatarUrl: "", bio: null },
  repositories: [],
  contributionStats: {
    totalCommitContributions: 0,
    totalPullRequestContributions: 0,
    totalIssueContributions: 0,
    totalPullRequestReviewContributions: 0,
    totalContributions: 0,
  },
  fetchedAt: new Date().toISOString(),
};

describe("cv-classifier", () => {
  describe("detectTechnologies", () => {
    it("buckets known languages into the languages array", () => {
      const repo = makeRepo({ languages: ["TypeScript", "Python"] });
      const stack = detectTechnologies([repo]);
      expect(stack.languages.map(l => l.name)).toContain("TypeScript");
      expect(stack.languages.map(l => l.name)).toContain("Python");
    });
    it("buckets known frameworks into the frameworks array", () => {
      const repo = makeRepo({ languages: ["React", "Vue"] });
      const stack = detectTechnologies([repo]);
      expect(stack.frameworks.map(f => f.name)).toContain("React");
      expect(stack.frameworks.map(f => f.name)).toContain("Vue");
    });
    it("buckets known tools into the tools array", () => {
      const repo = makeRepo({ languages: ["Docker", "Kubernetes"] });
      const stack = detectTechnologies([repo]);
      expect(stack.tools.map(t => t.name)).toContain("Docker");
      expect(stack.tools.map(t => t.name)).toContain("Kubernetes");
    });
    it("deduplicates and sums occurrences across repos", () => {
      const repo1 = makeRepo({ name: "repo1", languages: ["TypeScript"] });
      const repo2 = makeRepo({ name: "repo2", languages: ["TypeScript"] });
      const stack = detectTechnologies([repo1, repo2]);
      const ts = stack.languages.find(l => l.name === "TypeScript");
      expect(ts?.occurrences).toBe(2);
    });
    it("sorts each bucket by occurrences descending", () => {
      const repo = makeRepo({ languages: ["Docker", "TypeScript", "Python", "Docker"] });
      const stack = detectTechnologies([repo]);
      expect(stack.languages.map(l => l.name)[0]).toBe("Docker");
    });
    it("assigns high confidence for language source", () => {
      const repo = makeRepo({ languages: ["Python"] });
      const stack = detectTechnologies([repo]);
      const py = stack.languages.find(l => l.name === "Python");
      expect(py?.confidence).toBe("high");
    });
    it("returns empty stack for repo with no detectable technologies", () => {
      const repo = makeRepo({ languages: [], topics: [], pullRequests: [], commits: [] });
      const stack = detectTechnologies([repo]);
      expect(stack.languages).toHaveLength(0);
      expect(stack.frameworks).toHaveLength(0);
      expect(stack.tools).toHaveLength(0);
    });
  });
  describe("mapToDomains", () => {
    it("scores Frontend domain when React/TypeScript are present", () => {
      const repo = makeRepo({ languages: ["React", "TypeScript", "CSS"] });
      const stack = detectTechnologies([repo]);
      const domains = mapToDomains(stack, [repo]);
      const frontend = domains.find(d => d.domain === "Frontend");
      expect(frontend?.score).toBeGreaterThan(0);
    });
    it("scores Backend domain when Python/Node.js are present", () => {
      const repo = makeRepo({ languages: ["Python", "Node.js"] });
      const stack = detectTechnologies([repo]);
      const domains = mapToDomains(stack, [repo]);
      const backend = domains.find(d => d.domain === "Backend");
      expect(backend?.score).toBeGreaterThan(0);
    });
    it("does not add FullStack when only Frontend score > 30", () => {
      const repo = makeRepo({ languages: ["React", "TypeScript", "CSS", "HTML", "SCSS", "Webpack", "Svelte", "Vue"] });
      const stack = detectTechnologies([repo]);
      const domains = mapToDomains(stack, [repo]);
      expect(domains.find(d => d.domain === "FullStack")).toBeUndefined();
    });
    it("adds FullStack when both Frontend and Backend scores exceed 30", () => {
      const repo = makeRepo({ languages: ["React", "TypeScript", "CSS", "HTML", "SCSS", "Webpack", "Svelte", "Vue", "Python", "Node.js", "Express", "Django"] });
      const stack = detectTechnologies([repo]);
      const domains = mapToDomains(stack, [repo]);
      const fullstack = domains.find(d => d.domain === "FullStack");
      expect(fullstack).toBeDefined();
      expect(fullstack!.score).toBeGreaterThan(0);
    });
    it("sorts domains by score descending", () => {
      const repo = makeRepo({ languages: ["React", "TensorFlow", "Python"] });
      const stack = detectTechnologies([repo]);
      const domains = mapToDomains(stack, [repo]);
      for (let i = 1; i < domains.length; i++) {
        expect(domains[i - 1].score).toBeGreaterThanOrEqual(domains[i].score);
      }
    });
    it("returns empty array when no technologies match any domain", () => {
      const repo = makeRepo({ languages: ["SomeUnknownLang"] });
      const stack = detectTechnologies([repo]);
      const domains = mapToDomains(stack, [repo]);
      expect(domains).toHaveLength(0);
    });
  });
  describe("scoreContributions", () => {
    it("sums merged PRs correctly", () => {
      const repo = makeRepo({ pullRequests: [makePR({ state: "MERGED", additions: 10, deletions: 2 }), makePR({ state: "MERGED", additions: 20, deletions: 5 }), makePR({ state: "OPEN", additions: 30, deletions: 10 })] });
      const scores = scoreContributions({ ...minimalData, repositories: [repo] });
      expect(scores.totalPRsMerged).toBe(2);
    });
    it("computes avgPRSize correctly", () => {
      const repo = makeRepo({ pullRequests: [makePR({ additions: 100, deletions: 10 }), makePR({ additions: 200, deletions: 20 })] });
      const scores = scoreContributions({ ...minimalData, repositories: [repo] });
      expect(scores.avgPRSize).toBe(165);
    });
    it("returns avgPRSize of 0 when no merged PRs", () => {
      const repo = makeRepo({ pullRequests: [makePR({ state: "OPEN" })] });
      const scores = scoreContributions({ ...minimalData, repositories: [repo] });
      expect(scores.avgPRSize).toBe(0);
    });
    it("counts commits across repos", () => {
      const repo1 = makeRepo({ commits: [makeCommit(), makeCommit()] });
      const repo2 = makeRepo({ commits: [makeCommit()] });
      const scores = scoreContributions({ ...minimalData, repositories: [repo1, repo2] });
      expect(scores.totalCommits).toBe(3);
    });
    it("computes topLanguages sorted by frequency", () => {
      const repo1 = makeRepo({ languages: ["Python", "Python", "TypeScript"] });
      const repo2 = makeRepo({ languages: ["Python", "Go"] });
      const scores = scoreContributions({ ...minimalData, repositories: [repo1, repo2] });
      expect(scores.topLanguages[0]).toBe("Python");
    });
  });
  describe("analyzeRepository", () => {
    it("classifies as high complexity for > 5000 total lines changed", () => {
      const repo = makeRepo({ pullRequests: [makePR({ additions: 3000, deletions: 3000 })], commits: [] });
      expect(analyzeRepository(repo).complexity).toBe("high");
    });
    it("classifies as medium complexity for > 1000 total lines changed", () => {
      const repo = makeRepo({ pullRequests: [makePR({ additions: 600, deletions: 600 })], commits: [] });
      expect(analyzeRepository(repo).complexity).toBe("medium");
    });
    it("classifies as low complexity for small changes", () => {
      const repo = makeRepo({ pullRequests: [makePR({ additions: 50, deletions: 10 })], commits: [] });
      expect(analyzeRepository(repo).complexity).toBe("low");
    });
    it("classifies as high complexity for > 10 merged PRs", () => {
      const prs = Array.from({ length: 11 }, () => makePR({ additions: 10, deletions: 2 }));
      const repo = makeRepo({ pullRequests: prs });
      expect(analyzeRepository(repo).complexity).toBe("high");
    });
    it("includes detected domains in analysis", () => {
      const repo = makeRepo({ languages: ["React", "TypeScript"] });
      expect(analyzeRepository(repo).detectedDomains.length).toBeGreaterThan(0);
    });
    it("computes relevance scores for each role", () => {
      const repo = makeRepo({ languages: ["React", "TypeScript", "CSS"] });
      const analysis = analyzeRepository(repo);
      expect(analysis.relevanceByRole["Frontend Developer"]).toBeGreaterThan(0);
    });
  });
  describe("classifyContributions", () => {
    it("produces a valid ContributionClassification object", () => {
      const repo = makeRepo({ languages: ["TypeScript"] });
      const classification = classifyContributions({ ...minimalData, repositories: [repo] });
      expect(classification).toHaveProperty("techStack");
      expect(classification).toHaveProperty("domains");
      expect(classification).toHaveProperty("primaryDomain");
      expect(classification).toHaveProperty("repositoryAnalyses");
      expect(classification).toHaveProperty("contributionScores");
      expect(classification).toHaveProperty("generatedAt");
    });
    it("primaryDomain defaults to FullStack when no domains detected", () => {
      expect(classifyContributions(minimalData).primaryDomain).toBe("FullStack");
    });
    it("sets generatedAt to an ISO timestamp", () => {
      expect(classifyContributions(minimalData).generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
  describe("filterByRole", () => {
    it("returns a new classification object (not mutated)", () => {
      const repo = makeRepo({ languages: ["React"] });
      const classification = classifyContributions({ ...minimalData, repositories: [repo] });
      expect(filterByRole(classification, "Frontend Developer")).not.toBe(classification);
    });
    it("removes non-Frontend technologies when filtering for Frontend Developer", () => {
      const repo = makeRepo({ languages: ["React", "Python", "Docker"] });
      const classification = classifyContributions({ ...minimalData, repositories: [repo] });
      const filtered = filterByRole(classification, "Frontend Developer");
      const allTechs = [...filtered.techStack.languages, ...filtered.techStack.frameworks, ...filtered.techStack.tools];
      const techNames = allTechs.map(t => t.name);
      expect(techNames).not.toContain("Python");
      expect(techNames).not.toContain("Docker");
    });
    it("filters out repos with 0 relevance for the target role", () => {
      const repo1 = makeRepo({ name: "frontend-repo", languages: ["React"] });
      const repo2 = makeRepo({ name: "backend-repo", languages: ["Python"] });
      const classification = classifyContributions({ ...minimalData, repositories: [repo1, repo2] });
      const filtered = filterByRole(classification, "Frontend Developer");
      expect(filtered.repositoryAnalyses.map(r => r.name)).not.toContain("backend-repo");
    });
    it("keeps repos sorted by relevance descending", () => {
      const repo1 = makeRepo({ name: "big-react-repo", languages: ["React", "TypeScript", "CSS", "HTML"] });
      const repo2 = makeRepo({ name: "small-react-repo", languages: ["React"] });
      const classification = classifyContributions({ ...minimalData, repositories: [repo1, repo2] });
      const filtered = filterByRole(classification, "Frontend Developer");
      expect(filtered.repositoryAnalyses[0].name).toBe("big-react-repo");
    });
    it("returns classification as-is for unknown role", () => {
      const repo = makeRepo({ languages: ["TypeScript"] });
      const classification = classifyContributions({ ...minimalData, repositories: [repo] });
      const filtered = filterByRole(classification, "Unknown Role");
      expect(filtered.techStack.languages).toHaveLength(classification.techStack.languages.length);
    });
  });
});