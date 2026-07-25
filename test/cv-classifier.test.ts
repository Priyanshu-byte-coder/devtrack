import { describe, it, expect } from "vitest";
import {
  detectTechnologies,
  mapToDomains,
  scoreContributions,
  analyzeRepository,
  classifyContributions,
  filterByRole,
} from "@/lib/cv/cv-classifier";
import type {
  RepositoryData,
  PullRequestData,
  CommitData,
  GitHubContributionData,
  ContributionClassification,
  TechStack,
} from "@/types/cv-types";

/* ------------------------------------------------------------------ */
/*  Fixture builders                                                   */
/* ------------------------------------------------------------------ */

const makePR = (overrides: Partial<PullRequestData> = {}): PullRequestData => ({
  title: "Add feature",
  body: null,
  additions: 0,
  deletions: 0,
  changedFiles: 0,
  labels: [],
  state: "MERGED",
  mergedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeCommit = (overrides: Partial<CommitData> = {}): CommitData => ({
  message: "fix: update code",
  committedDate: "2026-01-01T00:00:00.000Z",
  additions: 0,
  deletions: 0,
  ...overrides,
});

const makeRepo = (overrides: Partial<RepositoryData> = {}): RepositoryData => ({
  name: "my-repo",
  nameWithOwner: "owner/my-repo",
  description: null,
  url: "https://github.com/owner/my-repo",
  stargazerCount: 0,
  forkCount: 0,
  isForked: false,
  languages: [],
  topics: [],
  pullRequests: [],
  commits: [],
  ...overrides,
});

const makeContributionData = (
  overrides: Partial<GitHubContributionData> = {}
): GitHubContributionData => ({
  user: { login: "octocat", avatarUrl: "https://example.com/avatar.png", bio: null },
  repositories: [],
  contributionStats: {
    totalCommitContributions: 0,
    totalPullRequestContributions: 0,
    totalIssueContributions: 0,
    totalPullRequestReviewContributions: 0,
    totalContributions: 0,
  },
  fetchedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const emptyTechStack: TechStack = { languages: [], frameworks: [], tools: [] };

const makeClassification = (
  overrides: Partial<ContributionClassification> = {}
): ContributionClassification => ({
  techStack: emptyTechStack,
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
  generatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

/* ------------------------------------------------------------------ */
/*  detectTechnologies                                                 */
/* ------------------------------------------------------------------ */

describe("detectTechnologies", () => {
  it("returns empty buckets for no repositories", () => {
    const result = detectTechnologies([]);
    expect(result).toEqual(emptyTechStack);
  });

  it("buckets languages, frameworks, and tools correctly", () => {
    const repo = makeRepo({ languages: ["TypeScript", "React", "Docker"] });
    const result = detectTechnologies([repo]);

    expect(result.languages.map((t) => t.name)).toContain("TypeScript");
    expect(result.frameworks.map((t) => t.name)).toContain("React");
    expect(result.tools.map((t) => t.name)).toContain("Docker");
  });

  it("sums occurrences for the same technology found across signals", () => {
    const repo = makeRepo({
      languages: ["TypeScript"],
      topics: ["typescript"],
      pullRequests: [makePR({ title: "Migrate to TypeScript" })],
    });
    const result = detectTechnologies([repo]);

    const ts = result.languages.find((t) => t.name === "TypeScript");
    expect(ts).toBeDefined();
    // language (1) + topic (1) + PR title mention (1) = 3
    expect(ts?.occurrences).toBe(3);
  });

  it("upgrades confidence to the highest seen for a technology", () => {
    const repo = makeRepo({
      // commit_message signal gives "low" confidence
      commits: [makeCommit({ message: "chore: bump Docker version" })],
      // language signal gives "high" confidence
      languages: ["Docker"],
    });
    const result = detectTechnologies([repo]);

    const docker = result.tools.find((t) => t.name === "Docker");
    expect(docker?.confidence).toBe("high");
  });

  it("sorts each bucket by occurrences descending", () => {
    const repo = makeRepo({
      languages: ["TypeScript", "Python"],
      topics: ["typescript"],
    });
    const result = detectTechnologies([repo]);

    const names = result.languages.map((t) => t.name);
    const tsIndex = names.indexOf("TypeScript");
    const pyIndex = names.indexOf("Python");
    // TypeScript has 2 occurrences (language + topic), Python has 1
    expect(tsIndex).toBeLessThan(pyIndex);
  });

  it("detects technologies from PR body mentions with low confidence", () => {
    const repo = makeRepo({
      pullRequests: [makePR({ title: "Update deps", body: "Bumps Kubernetes config" })],
    });
    const result = detectTechnologies([repo]);

    const k8s = result.tools.find((t) => t.name === "Kubernetes");
    expect(k8s).toBeDefined();
    expect(k8s?.confidence).toBe("low");
    expect(k8s?.source).toBe("pr_content");
  });
});

/* ------------------------------------------------------------------ */
/*  mapToDomains                                                       */
/* ------------------------------------------------------------------ */

describe("mapToDomains", () => {
  it("returns an empty array when there is no signal at all", () => {
    const result = mapToDomains(emptyTechStack, []);
    expect(result).toEqual([]);
  });

  it("computes a Frontend score from direct tech matches", () => {
    const techStack = detectTechnologies([makeRepo({ languages: ["React", "TypeScript"] })]);
    const result = mapToDomains(techStack, [makeRepo({ languages: ["React", "TypeScript"] })]);

    const frontend = result.find((d) => d.domain === "Frontend");
    expect(frontend).toBeDefined();
    expect(frontend!.score).toBeGreaterThan(0);
  });

  it("adds keyword-match evidence when repo text contains domain keywords", () => {
    const repo = makeRepo({
      description: "A responsive frontend component library",
    });
    const techStack = detectTechnologies([repo]);
    const result = mapToDomains(techStack, [repo]);

    const frontend = result.find((d) => d.domain === "Frontend");
    expect(frontend).toBeDefined();
    expect(frontend!.evidence.some((e) => e.includes("keyword matches"))).toBe(true);
  });

  it("adds a synthetic FullStack domain when Frontend and Backend both exceed 30", () => {
    const repo = makeRepo({
      languages: ["React", "TypeScript", "CSS", "Node.js", "Express", "Python"],
      description:
        "A responsive frontend component ui layout design with rest api endpoint middleware server database",
    });
    const techStack = detectTechnologies([repo]);
    const result = mapToDomains(techStack, [repo]);

    const frontend = result.find((d) => d.domain === "Frontend");
    const backend = result.find((d) => d.domain === "Backend");
    const fullStack = result.find((d) => d.domain === "FullStack");

    expect(frontend!.score).toBeGreaterThan(30);
    expect(backend!.score).toBeGreaterThan(30);
    expect(fullStack).toBeDefined();
    expect(fullStack!.score).toBe(Math.min(frontend!.score, backend!.score));
  });

  it("does not add FullStack when only one of Frontend/Backend exceeds 30", () => {
    const repo = makeRepo({ languages: ["React", "TypeScript"] });
    const techStack = detectTechnologies([repo]);
    const result = mapToDomains(techStack, [repo]);

    const fullStack = result.find((d) => d.domain === "FullStack");
    expect(fullStack).toBeUndefined();
  });

  it("sorts domains by score descending", () => {
    const repo = makeRepo({
      languages: ["React", "TypeScript", "Node.js"],
    });
    const techStack = detectTechnologies([repo]);
    const result = mapToDomains(techStack, [repo]);

    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it("caps score at 100", () => {
    // Heavily saturate Frontend signal: all techs + lots of keyword hits + popularity
    const repo = makeRepo({
      languages: [
        "React", "Vue", "Angular", "TypeScript", "CSS", "Tailwind",
        "Next.js", "Svelte", "HTML", "SCSS", "Sass", "Webpack", "Vite",
      ],
      description:
        "component ui responsive frontend layout design css tailwind react vue angular svelte markup",
      stargazerCount: 1000,
      forkCount: 1000,
    });
    const techStack = detectTechnologies([repo]);
    const result = mapToDomains(techStack, [repo]);

    const frontend = result.find((d) => d.domain === "Frontend");
    expect(frontend!.score).toBeLessThanOrEqual(100);
  });
});

/* ------------------------------------------------------------------ */
/*  scoreContributions                                                 */
/* ------------------------------------------------------------------ */

describe("scoreContributions", () => {
  it("returns all zeros for empty contribution data", () => {
    const result = scoreContributions(makeContributionData());
    expect(result).toEqual({
      totalPRsMerged: 0,
      totalCommits: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      totalReposContributed: 0,
      totalIssues: 0,
      totalReviews: 0,
      avgPRSize: 0,
      topLanguages: [],
    });
  });

  it("sums merged PRs, commits, additions, and deletions across repos", () => {
    const data = makeContributionData({
      repositories: [
        makeRepo({
          pullRequests: [
            makePR({ state: "MERGED", additions: 10, deletions: 5 }),
            makePR({ state: "OPEN", additions: 100, deletions: 100 }), // not counted
          ],
          commits: [makeCommit({ additions: 3, deletions: 1 })],
        }),
        makeRepo({
          pullRequests: [makePR({ state: "MERGED", additions: 20, deletions: 0 })],
          commits: [],
        }),
      ],
    });

    const result = scoreContributions(data);

    expect(result.totalPRsMerged).toBe(2);
    expect(result.totalCommits).toBe(1);
    // additions: 10 (merged PR) + 3 (commit) + 20 (merged PR) = 33 (open PR excluded)
    expect(result.totalAdditions).toBe(33);
    // deletions: 5 + 1 + 0 = 6
    expect(result.totalDeletions).toBe(6);
    expect(result.totalReposContributed).toBe(2);
  });

  it("computes avgPRSize correctly from merged PRs only", () => {
    const data = makeContributionData({
      repositories: [
        makeRepo({
          pullRequests: [
            makePR({ state: "MERGED", additions: 10, deletions: 10 }), // size 20
            makePR({ state: "MERGED", additions: 30, deletions: 10 }), // size 40
            makePR({ state: "CLOSED", additions: 1000, deletions: 1000 }), // excluded
          ],
        }),
      ],
    });

    const result = scoreContributions(data);
    // (20 + 40) / 2 = 30
    expect(result.avgPRSize).toBe(30);
  });

  it("returns avgPRSize of 0 when there are no merged PRs", () => {
    const data = makeContributionData({
      repositories: [makeRepo({ pullRequests: [makePR({ state: "OPEN" })] })],
    });
    const result = scoreContributions(data);
    expect(result.avgPRSize).toBe(0);
  });

  it("returns topLanguages sorted by frequency across repos, capped at 5", () => {
    const data = makeContributionData({
      repositories: [
        makeRepo({ languages: ["TypeScript", "Python"] }),
        makeRepo({ languages: ["TypeScript", "Go"] }),
        makeRepo({ languages: ["TypeScript", "Rust", "Java", "C#", "Ruby", "Elixir"] }),
      ],
    });

    const result = scoreContributions(data);

    expect(result.topLanguages[0]).toBe("TypeScript");
    expect(result.topLanguages.length).toBeLessThanOrEqual(5);
  });

  it("carries totalIssues and totalReviews through from contributionStats", () => {
    const data = makeContributionData({
      contributionStats: {
        totalCommitContributions: 0,
        totalPullRequestContributions: 0,
        totalIssueContributions: 7,
        totalPullRequestReviewContributions: 4,
        totalContributions: 11,
      },
    });

    const result = scoreContributions(data);
    expect(result.totalIssues).toBe(7);
    expect(result.totalReviews).toBe(4);
  });
});

/* ------------------------------------------------------------------ */
/*  analyzeRepository                                                  */
/* ------------------------------------------------------------------ */

describe("analyzeRepository", () => {
  it("classifies complexity as low for small repos", () => {
    const repo = makeRepo({
      pullRequests: [makePR({ state: "MERGED", additions: 50, deletions: 20 })],
    });
    const result = analyzeRepository(repo);
    expect(result.complexity).toBe("low");
  });

  it("classifies complexity as medium when lines changed exceed 1000", () => {
    const repo = makeRepo({
      pullRequests: [makePR({ state: "MERGED", additions: 800, deletions: 300 })],
    });
    const result = analyzeRepository(repo);
    expect(result.complexity).toBe("medium");
  });

  it("classifies complexity as medium when merged PR count exceeds 3", () => {
    const repo = makeRepo({
      pullRequests: Array.from({ length: 4 }, () =>
        makePR({ state: "MERGED", additions: 1, deletions: 1 })
      ),
    });
    const result = analyzeRepository(repo);
    expect(result.complexity).toBe("medium");
  });

  it("classifies complexity as high when lines changed exceed 5000", () => {
    const repo = makeRepo({
      pullRequests: [makePR({ state: "MERGED", additions: 4000, deletions: 2000 })],
    });
    const result = analyzeRepository(repo);
    expect(result.complexity).toBe("high");
  });

  it("classifies complexity as high when merged PR count exceeds 10", () => {
    const repo = makeRepo({
      pullRequests: Array.from({ length: 11 }, () =>
        makePR({ state: "MERGED", additions: 1, deletions: 1 })
      ),
    });
    const result = analyzeRepository(repo);
    expect(result.complexity).toBe("high");
  });

  it("only counts merged PRs toward prsMerged", () => {
    const repo = makeRepo({
      pullRequests: [
        makePR({ state: "MERGED" }),
        makePR({ state: "OPEN" }),
        makePR({ state: "CLOSED" }),
      ],
    });
    const result = analyzeRepository(repo);
    expect(result.prsMerged).toBe(1);
  });

  it("populates detectedDomains for a repo with clear frontend signal", () => {
    const repo = makeRepo({
      languages: [
        "React", "Vue", "Angular", "TypeScript", "CSS", "Tailwind",
        "Next.js", "Svelte", "HTML", "SCSS",
      ],
      description: "component ui responsive frontend layout design",
    });
    const result = analyzeRepository(repo);
    expect(result.detectedDomains).toContain("Frontend");
  });

  it("computes relevanceByRole with all expected role keys", () => {
    const repo = makeRepo({ languages: ["React"] });
    const result = analyzeRepository(repo);

    expect(Object.keys(result.relevanceByRole)).toEqual(
      expect.arrayContaining([
        "Machine Learning Engineer",
        "Frontend Developer",
        "Backend Developer",
        "Full Stack Developer",
        "DevOps Engineer",
        "Data Analyst",
        "Mobile Developer",
        "Security Engineer",
      ])
    );
  });

  it("caps relevanceByRole scores at 100", () => {
    const repo = makeRepo({
      languages: [
        "React", "Vue", "Angular", "TypeScript", "CSS", "Tailwind",
        "Next.js", "Svelte", "HTML", "SCSS", "Sass", "Webpack", "Vite",
      ],
      description:
        "component ui responsive frontend layout design css tailwind react vue angular svelte markup",
      stargazerCount: 1000,
      forkCount: 1000,
    });
    const result = analyzeRepository(repo);
    expect(result.relevanceByRole["Frontend Developer"]).toBeLessThanOrEqual(100);
  });
});

/* ------------------------------------------------------------------ */
/*  classifyContributions                                              */
/* ------------------------------------------------------------------ */

describe("classifyContributions", () => {
  it("produces a valid ContributionClassification with all required fields", () => {
    const data = makeContributionData({
      repositories: [
        makeRepo({
          languages: ["React", "TypeScript"],
          pullRequests: [makePR({ state: "MERGED", additions: 100, deletions: 20 })],
        }),
      ],
    });

    const result = classifyContributions(data);

    expect(result).toHaveProperty("techStack");
    expect(result).toHaveProperty("domains");
    expect(result).toHaveProperty("primaryDomain");
    expect(result).toHaveProperty("repositoryAnalyses");
    expect(result).toHaveProperty("contributionScores");
    expect(result).toHaveProperty("generatedAt");
    expect(result.repositoryAnalyses).toHaveLength(1);
    expect(typeof result.generatedAt).toBe("string");
  });

  it("falls back to FullStack as primaryDomain when no domains are detected", () => {
    const result = classifyContributions(makeContributionData());
    expect(result.primaryDomain).toBe("FullStack");
    expect(result.domains).toEqual([]);
  });

  it("sets primaryDomain to the highest-scoring detected domain", () => {
    const data = makeContributionData({
      repositories: [
        makeRepo({
          languages: ["React", "Vue", "Angular", "TypeScript"],
          description: "component ui responsive frontend layout design",
        }),
      ],
    });

    const result = classifyContributions(data);
    expect(result.primaryDomain).toBe(result.domains[0]?.domain);
  });
});

/* ------------------------------------------------------------------ */
/*  filterByRole                                                       */
/* ------------------------------------------------------------------ */

describe("filterByRole", () => {
  it("returns the classification unchanged for an unrecognized role", () => {
    const classification = makeClassification({
      techStack: {
        languages: [{ name: "React", confidence: "high", source: "language", occurrences: 1 }],
        frameworks: [],
        tools: [],
      },
    });
    const result = filterByRole(classification, "Unknown Role");
    expect(result).toEqual(classification);
  });

  it("removes technologies not associated with the target role's domains", () => {
    const classification = makeClassification({
      techStack: {
        languages: [
          { name: "React", confidence: "high", source: "language", occurrences: 1 },
          { name: "Go", confidence: "high", source: "language", occurrences: 1 },
        ],
        frameworks: [],
        tools: [],
      },
    });

    const result = filterByRole(classification, "Frontend Developer");

    const names = result.techStack.languages.map((t) => t.name);
    expect(names).toContain("React");
    expect(names).not.toContain("Go");
  });

  it("removes repositories with zero relevance for the target role", () => {
    const classification = makeClassification({
      repositoryAnalyses: [
        {
          name: "frontend-repo",
          nameWithOwner: "owner/frontend-repo",
          url: "https://github.com/owner/frontend-repo",
          description: null,
          detectedDomains: ["Frontend"],
          languages: ["React"],
          topics: [],
          complexity: "low",
          prsMerged: 1,
          totalAdditions: 10,
          totalDeletions: 5,
          relevanceByRole: { "Frontend Developer": 40, "Backend Developer": 0 },
        },
        {
          name: "backend-only-repo",
          nameWithOwner: "owner/backend-only-repo",
          url: "https://github.com/owner/backend-only-repo",
          description: null,
          detectedDomains: ["Backend"],
          languages: ["Go"],
          topics: [],
          complexity: "low",
          prsMerged: 1,
          totalAdditions: 10,
          totalDeletions: 5,
          relevanceByRole: { "Frontend Developer": 0, "Backend Developer": 40 },
        },
      ],
    });

    const result = filterByRole(classification, "Frontend Developer");

    expect(result.repositoryAnalyses).toHaveLength(1);
    expect(result.repositoryAnalyses[0].name).toBe("frontend-repo");
  });

  it("sorts remaining repositories by role relevance descending", () => {
    const classification = makeClassification({
      repositoryAnalyses: [
        {
          name: "low-relevance",
          nameWithOwner: "owner/low-relevance",
          url: "https://github.com/owner/low-relevance",
          description: null,
          detectedDomains: [],
          languages: [],
          topics: [],
          complexity: "low",
          prsMerged: 1,
          totalAdditions: 10,
          totalDeletions: 5,
          relevanceByRole: { "Frontend Developer": 10 },
        },
        {
          name: "high-relevance",
          nameWithOwner: "owner/high-relevance",
          url: "https://github.com/owner/high-relevance",
          description: null,
          detectedDomains: [],
          languages: [],
          topics: [],
          complexity: "low",
          prsMerged: 1,
          totalAdditions: 10,
          totalDeletions: 5,
          relevanceByRole: { "Frontend Developer": 90 },
        },
      ],
    });

    const result = filterByRole(classification, "Frontend Developer");

    expect(result.repositoryAnalyses[0].name).toBe("high-relevance");
    expect(result.repositoryAnalyses[1].name).toBe("low-relevance");
  });

  it("preserves domains array unfiltered", () => {
    const classification = makeClassification({
      domains: [
        { domain: "Frontend", score: 80, evidence: [] },
        { domain: "Backend", score: 20, evidence: [] },
      ],
    });

    const result = filterByRole(classification, "Frontend Developer");
    expect(result.domains).toEqual(classification.domains);
  });
});
