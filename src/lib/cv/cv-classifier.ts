/**
 * cv-classifier.ts
 *
 * Pure classification engine that analyses raw GitHub contribution data and
 * produces a structured classification: detected technologies, engineering
 * domains, per-repository analyses, and contribution scores.
 *
 * Every function in this module is **pure** — no network calls, no database
 * access, no mutations of shared state.
 *
 * @module cv-classifier
 */

import type {
  GitHubContributionData,
  RepositoryData,
  TechStack,
  TechItem,
  DomainScore,
  EngineeringDomain,
  ContributionClassification,
  ContributionScores,
  RepositoryAnalysis,
} from "@/types/cv-types";

/* ------------------------------------------------------------------ */
/*  Domain keyword & technology maps                                   */
/* ------------------------------------------------------------------ */

/** Technologies mapped to each engineering domain. */
const DOMAIN_TECH_MAP: Record<EngineeringDomain, string[]> = {
  Frontend: [
    "React", "Vue", "Angular", "TypeScript", "CSS", "Tailwind",
    "Next.js", "Svelte", "HTML", "SCSS", "Sass", "Webpack", "Vite",
  ],
  Backend: [
    "Node.js", "Python", "Go", "Java", "Ruby", "Express", "FastAPI",
    "Django", "Spring", "Rust", "C#", "ASP.NET", "NestJS", "Elixir",
  ],
  AI_ML: [
    "TensorFlow", "PyTorch", "scikit-learn", "Pandas", "NumPy",
    "Jupyter", "Keras", "Hugging Face", "OpenCV", "ONNX", "MLflow",
  ],
  DevOps: [
    "Docker", "Kubernetes", "Terraform", "AWS", "GCP", "Azure",
    "Jenkins", "Ansible", "Helm", "Pulumi", "GitHub Actions",
  ],
  DataScience: [
    "R", "Pandas", "NumPy", "Matplotlib", "Jupyter", "SQL",
    "Tableau", "Seaborn", "Plotly", "dbt",
  ],
  Security: [
    "OAuth", "JWT", "OpenSSL", "Vault", "SAST", "DAST",
  ],
  Mobile: [
    "Swift", "Kotlin", "React Native", "Flutter", "Dart",
    "Objective-C", "Xamarin", "Ionic",
  ],
  Systems: [
    "C", "C++", "Rust", "Assembly", "LLVM",
  ],
  FullStack: [], // Synthetic — derived from Frontend + Backend scores
};

/** Keyword patterns that signal a domain when found in PR titles,
 *  commit messages, topics, or repo descriptions. */
const DOMAIN_KEYWORD_MAP: Record<EngineeringDomain, string[]> = {
  Frontend: [
    "component", "ui", "responsive", "frontend", "layout", "design",
    "css", "tailwind", "react", "vue", "angular", "svelte", "markup",
  ],
  Backend: [
    "api", "endpoint", "middleware", "authentication", "server",
    "database", "rest", "graphql", "grpc", "microservice",
  ],
  AI_ML: [
    "model", "training", "inference", "nlp", "recommendation",
    "neural", "prediction", "deep learning", "machine learning",
    "llm", "transformer", "fine-tune",
  ],
  DevOps: [
    "deploy", "ci/cd", "pipeline", "infrastructure", "monitoring",
    "docker", "kubernetes", "terraform", "helm", "iac",
  ],
  DataScience: [
    "analytics", "preprocessing", "visualization", "statistical",
    "dataset", "data analysis", "etl", "dashboard",
  ],
  Security: [
    "oauth", "jwt", "encryption", "authentication", "vulnerability",
    "cors", "csrf", "security", "xss", "penetration", "audit",
  ],
  Mobile: [
    "ios", "android", "mobile", "app", "swift", "kotlin", "flutter",
    "react native",
  ],
  Systems: [
    "kernel", "driver", "embedded", "firmware", "low-level", "syscall",
  ],
  FullStack: [],
};

/** Classify a technology name into language / framework / tool. */
const FRAMEWORK_NAMES = new Set([
  "React", "Vue", "Angular", "Svelte", "Next.js", "Express",
  "FastAPI", "Django", "Spring", "NestJS", "Tailwind", "TensorFlow",
  "PyTorch", "scikit-learn", "Keras", "Flutter", "React Native",
  "ASP.NET", "Ionic", "Xamarin", "Helm", "Pulumi",
]);

const TOOL_NAMES = new Set([
  "Docker", "Kubernetes", "Terraform", "AWS", "GCP", "Azure",
  "Jenkins", "Ansible", "GitHub Actions", "Webpack", "Vite",
  "Jupyter", "Tableau", "MLflow", "dbt", "Vault", "OpenSSL",
  "Plotly", "Seaborn",
]);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Case-insensitive check whether `text` contains `keyword`. */
function containsKeyword(text: string, keyword: string): boolean {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

/** Deduplicate tech items by name, summing occurrences and keeping the
 *  highest confidence and earliest source priority. */
function dedupeTechItems(items: TechItem[]): TechItem[] {
  const map = new Map<string, TechItem>();
  for (const item of items) {
    const key = item.name.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.occurrences += item.occurrences;
      // Upgrade confidence
      if (
        item.confidence === "high" ||
        (item.confidence === "medium" && existing.confidence === "low")
      ) {
        existing.confidence = item.confidence;
      }
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

/** Classify a tech name into the appropriate TechStack bucket. */
function categorizeTech(name: string): "languages" | "frameworks" | "tools" {
  if (FRAMEWORK_NAMES.has(name)) return "frameworks";
  if (TOOL_NAMES.has(name)) return "tools";
  return "languages";
}

/** Concatenate all searchable text for a repository (description, PR
 *  titles, PR bodies, commit messages, topics). */
function gatherRepoText(repo: RepositoryData): string {
  const parts: string[] = [];
  if (repo.description) parts.push(repo.description);
  for (const topic of repo.topics) parts.push(topic);
  for (const pr of repo.pullRequests) {
    parts.push(pr.title);
    if (pr.body) parts.push(pr.body);
  }
  for (const commit of repo.commits) {
    parts.push(commit.message);
  }
  return parts.join(" ");
}

/* ------------------------------------------------------------------ */
/*  detectTechnologies                                                 */
/* ------------------------------------------------------------------ */

/**
 * Detect technologies from multiple signals across all repositories.
 *
 * Signals analysed:
 * - Repository `languages` (GitHub's linguist data)
 * - Repository `topics`
 * - File-path hints in PR titles (e.g. ".tsx", "Dockerfile")
 * - Commit message mentions
 * - PR body mentions
 *
 * @param repos - Array of repository data
 * @returns Categorised tech stack with confidence and occurrence counts
 */
export function detectTechnologies(repos: RepositoryData[]): TechStack {
  const rawItems: TechItem[] = [];

  // All known tech names across every domain
  const allTechNames: string[] = Object.values(DOMAIN_TECH_MAP).flat();
  const uniqueTechNames = [...new Set(allTechNames)];

  for (const repo of repos) {
    // Signal 1: Languages from GitHub linguist
    for (const lang of repo.languages) {
      rawItems.push({
        name: lang,
        confidence: "high",
        source: "language",
        occurrences: 1,
      });
    }

    // Signal 2: Topics
    for (const topic of repo.topics) {
      const matchedTech = uniqueTechNames.find(
        (t) => t.toLowerCase() === topic.toLowerCase()
      );
      if (matchedTech) {
        rawItems.push({
          name: matchedTech,
          confidence: "high",
          source: "topic",
          occurrences: 1,
        });
      }
    }

    // Signal 3: PR titles — look for file-extension and tech-name hints
    for (const pr of repo.pullRequests) {
      for (const tech of uniqueTechNames) {
        if (containsKeyword(pr.title, tech)) {
          rawItems.push({
            name: tech,
            confidence: "medium",
            source: "file_path",
            occurrences: 1,
          });
        }
      }

      // Signal 4: PR body mentions
      if (pr.body) {
        for (const tech of uniqueTechNames) {
          if (containsKeyword(pr.body, tech)) {
            rawItems.push({
              name: tech,
              confidence: "low",
              source: "pr_content",
              occurrences: 1,
            });
          }
        }
      }
    }

    // Signal 5: Commit messages
    for (const commit of repo.commits) {
      for (const tech of uniqueTechNames) {
        if (containsKeyword(commit.message, tech)) {
          rawItems.push({
            name: tech,
            confidence: "low",
            source: "commit_message",
            occurrences: 1,
          });
        }
      }
    }
  }

  // De-duplicate and bucket
  const deduped = dedupeTechItems(rawItems);
  const stack: TechStack = { languages: [], frameworks: [], tools: [] };

  for (const item of deduped) {
    const bucket = categorizeTech(item.name);
    stack[bucket].push(item);
  }

  // Sort each bucket by occurrences descending
  for (const key of ["languages", "frameworks", "tools"] as const) {
    stack[key].sort((a, b) => b.occurrences - a.occurrences);
  }

  return stack;
}

/* ------------------------------------------------------------------ */
/*  mapToDomains                                                       */
/* ------------------------------------------------------------------ */

/**
 * Map detected technologies and repository signals to engineering domains
 * with a numeric score (0-100) and supporting evidence strings.
 *
 * Scoring factors:
 * - Direct technology match (each hit = +5, max 50)
 * - Keyword matches in repo text (each hit = +3, max 30)
 * - Stars / forks on matching repos add a small bonus (max 20)
 * - FullStack is synthetic: score = min(Frontend, Backend) when both > 30
 *
 * @param techStack - Output of `detectTechnologies`
 * @param repos - Repository data for keyword analysis
 * @returns Sorted domain scores (highest first)
 */
export function mapToDomains(
  techStack: TechStack,
  repos: RepositoryData[]
): DomainScore[] {
  const allItems = [
    ...techStack.languages,
    ...techStack.frameworks,
    ...techStack.tools,
  ];
  const allTechNames = new Set(allItems.map((i) => i.name.toLowerCase()));

  // Pre-compute combined repo text for keyword searches
  const repoTexts = repos.map((r) => ({
    text: gatherRepoText(r),
    stars: r.stargazerCount,
    forks: r.forkCount,
  }));

  const scores: DomainScore[] = [];

  for (const domain of Object.keys(DOMAIN_TECH_MAP) as EngineeringDomain[]) {
    if (domain === "FullStack") continue; // handled below

    const evidence: string[] = [];
    let score = 0;

    // Tech matches
    const domainTechs = DOMAIN_TECH_MAP[domain];
    for (const tech of domainTechs) {
      if (allTechNames.has(tech.toLowerCase())) {
        score += 5;
        evidence.push(`Tech: ${tech}`);
      }
    }
    score = Math.min(score, 50);

    // Keyword matches across all repos
    const domainKeywords = DOMAIN_KEYWORD_MAP[domain];
    let keywordHits = 0;
    for (const { text } of repoTexts) {
      for (const kw of domainKeywords) {
        if (containsKeyword(text, kw)) {
          keywordHits++;
        }
      }
    }
    const keywordScore = Math.min(keywordHits * 3, 30);
    if (keywordScore > 0) {
      evidence.push(`${keywordHits} keyword matches`);
    }
    score += keywordScore;

    // Popularity bonus — repos whose text matches domain keywords
    let popularityBonus = 0;
    for (const { text, stars, forks } of repoTexts) {
      const matches = domainKeywords.some((kw) => containsKeyword(text, kw)) ||
        domainTechs.some((t) => containsKeyword(text, t));
      if (matches) {
        popularityBonus += Math.min(stars + forks, 10);
      }
    }
    popularityBonus = Math.min(popularityBonus, 20);
    if (popularityBonus > 0) {
      evidence.push(`Popularity bonus: +${popularityBonus}`);
    }
    score += popularityBonus;

    score = Math.min(score, 100);

    if (score > 0) {
      scores.push({ domain, score, evidence });
    }
  }

  // FullStack: synthetic domain
  const frontendScore = scores.find((s) => s.domain === "Frontend")?.score ?? 0;
  const backendScore = scores.find((s) => s.domain === "Backend")?.score ?? 0;

  if (frontendScore > 30 && backendScore > 30) {
    scores.push({
      domain: "FullStack",
      score: Math.min(frontendScore, backendScore),
      evidence: [
        `Frontend score: ${frontendScore}`,
        `Backend score: ${backendScore}`,
      ],
    });
  }

  // Sort highest-score first
  scores.sort((a, b) => b.score - a.score);

  return scores;
}

/* ------------------------------------------------------------------ */
/*  scoreContributions                                                 */
/* ------------------------------------------------------------------ */

/**
 * Quantify a developer's overall contribution impact from raw data.
 *
 * @param data - Raw GitHub contribution data
 * @returns Aggregate contribution scores
 */
export function scoreContributions(
  data: GitHubContributionData
): ContributionScores {
  let totalPRsMerged = 0;
  let totalCommits = 0;
  let totalAdditions = 0;
  let totalDeletions = 0;
  let prCount = 0;
  let prSizeSum = 0;

  const languageCounts = new Map<string, number>();

  for (const repo of data.repositories) {
    for (const pr of repo.pullRequests) {
      if (pr.state === "MERGED") {
        totalPRsMerged++;
        prCount++;
        prSizeSum += pr.additions + pr.deletions;
        totalAdditions += pr.additions;
        totalDeletions += pr.deletions;
      }
    }

    for (const commit of repo.commits) {
      totalCommits++;
      totalAdditions += commit.additions;
      totalDeletions += commit.deletions;
    }

    for (const lang of repo.languages) {
      languageCounts.set(lang, (languageCounts.get(lang) ?? 0) + 1);
    }
  }

  const topLanguages = [...languageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  return {
    totalPRsMerged,
    totalCommits,
    totalAdditions,
    totalDeletions,
    totalReposContributed: data.repositories.length,
    totalIssues: data.contributionStats.totalIssueContributions,
    totalReviews: data.contributionStats.totalPullRequestReviewContributions,
    avgPRSize: prCount > 0 ? Math.round(prSizeSum / prCount) : 0,
    topLanguages,
  };
}

/* ------------------------------------------------------------------ */
/*  analyzeRepository                                                  */
/* ------------------------------------------------------------------ */

/**
 * Produce a per-repository analysis summary.
 *
 * Complexity is heuristically classified based on the total lines changed
 * and number of PRs:
 * - **high**: > 5000 lines changed OR > 10 merged PRs
 * - **medium**: > 1000 lines changed OR > 3 merged PRs
 * - **low**: everything else
 *
 * @param repo - Single repository data
 * @returns Repository analysis with detected domains and relevance scores
 */
export function analyzeRepository(repo: RepositoryData): RepositoryAnalysis {
  const prsMerged = repo.pullRequests.filter((p) => p.state === "MERGED").length;

  let totalAdditions = 0;
  let totalDeletions = 0;
  for (const pr of repo.pullRequests) {
    totalAdditions += pr.additions;
    totalDeletions += pr.deletions;
  }
  for (const commit of repo.commits) {
    totalAdditions += commit.additions;
    totalDeletions += commit.deletions;
  }

  const totalLines = totalAdditions + totalDeletions;

  // Determine complexity
  let complexity: "low" | "medium" | "high";
  if (totalLines > 5000 || prsMerged > 10) {
    complexity = "high";
  } else if (totalLines > 1000 || prsMerged > 3) {
    complexity = "medium";
  } else {
    complexity = "low";
  }

  // Detect domains for this single repo
  const singleRepoTech = detectTechnologies([repo]);
  const singleRepoDomains = mapToDomains(singleRepoTech, [repo]);
  const detectedDomains = singleRepoDomains
    .filter((d) => d.score > 10)
    .map((d) => d.domain);

  // Compute relevance for common roles
  const roles = [
    "Machine Learning Engineer",
    "Frontend Developer",
    "Backend Developer",
    "Full Stack Developer",
    "DevOps Engineer",
    "Data Analyst",
    "Mobile Developer",
    "Security Engineer",
  ];

  const roleDomainMap: Record<string, EngineeringDomain[]> = {
    "Machine Learning Engineer": ["AI_ML", "DataScience", "Backend"],
    "Frontend Developer": ["Frontend"],
    "Backend Developer": ["Backend"],
    "Full Stack Developer": ["FullStack", "Frontend", "Backend"],
    "DevOps Engineer": ["DevOps", "Backend"],
    "Data Analyst": ["DataScience"],
    "Mobile Developer": ["Mobile"],
    "Security Engineer": ["Security", "Backend"],
  };

  const relevanceByRole: Record<string, number> = {};
  for (const role of roles) {
    const targetDomains = roleDomainMap[role] ?? [];
    let relevance = 0;
    for (const ds of singleRepoDomains) {
      if (targetDomains.includes(ds.domain)) {
        relevance += ds.score;
      }
    }
    relevanceByRole[role] = Math.min(relevance, 100);
  }

  return {
    name: repo.name,
    nameWithOwner: repo.nameWithOwner,
    url: repo.url,
    description: repo.description,
    detectedDomains,
    languages: repo.languages,
    topics: repo.topics,
    complexity,
    prsMerged,
    totalAdditions,
    totalDeletions,
    relevanceByRole,
  };
}

/* ------------------------------------------------------------------ */
/*  classifyContributions                                              */
/* ------------------------------------------------------------------ */

/**
 * Main classifier — orchestrates tech detection, domain mapping,
 * per-repo analysis, and contribution scoring into a single
 * {@link ContributionClassification} object.
 *
 * @param data - Raw GitHub contribution data from the fetcher
 * @returns Complete contribution classification
 */
export function classifyContributions(
  data: GitHubContributionData
): ContributionClassification {
  const techStack = detectTechnologies(data.repositories);
  const domains = mapToDomains(techStack, data.repositories);
  const primaryDomain: EngineeringDomain =
    domains.length > 0 ? domains[0].domain : "FullStack";
  const repositoryAnalyses = data.repositories.map(analyzeRepository);
  const contributionScores = scoreContributions(data);

  return {
    techStack,
    domains,
    primaryDomain,
    repositoryAnalyses,
    contributionScores,
    generatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  filterByRole                                                       */
/* ------------------------------------------------------------------ */

/**
 * Filter a classification to emphasise content relevant to a target role.
 *
 * - Repositories are sorted by their relevance score for the given role
 *   (highest first) and only those scoring > 0 are kept.
 * - Tech stack items are filtered to technologies associated with the
 *   role's target domains.
 * - Domain scores are preserved (not filtered) so callers can still
 *   see the full picture.
 *
 * @param classification - Full classification output
 * @param role - Target job role string (e.g. "Frontend Developer")
 * @returns A new classification object scoped to the role
 */
export function filterByRole(
  classification: ContributionClassification,
  role: string
): ContributionClassification {
  const roleDomainMap: Record<string, EngineeringDomain[]> = {
    "Machine Learning Engineer": ["AI_ML", "DataScience", "Backend"],
    "Frontend Developer": ["Frontend", "FullStack"],
    "Backend Developer": ["Backend", "FullStack"],
    "Full Stack Developer": ["FullStack", "Frontend", "Backend"],
    "DevOps Engineer": ["DevOps", "Backend"],
    "Data Analyst": ["DataScience"],
    "Mobile Developer": ["Mobile"],
    "Security Engineer": ["Security", "Backend"],
  };

  const targetDomains = roleDomainMap[role] ?? [];

  // If no known mapping, return as-is
  if (targetDomains.length === 0) {
    return { ...classification };
  }

  // Collect relevant tech names
  const relevantTechNames = new Set<string>();
  for (const domain of targetDomains) {
    for (const tech of DOMAIN_TECH_MAP[domain]) {
      relevantTechNames.add(tech.toLowerCase());
    }
  }

  const filterItems = (items: TechItem[]): TechItem[] =>
    items.filter((i) => relevantTechNames.has(i.name.toLowerCase()));

  const filteredTechStack: TechStack = {
    languages: filterItems(classification.techStack.languages),
    frameworks: filterItems(classification.techStack.frameworks),
    tools: filterItems(classification.techStack.tools),
  };

  // Sort repos by role relevance, keep only those with relevance > 0
  const filteredRepos = [...classification.repositoryAnalyses]
    .filter((r) => (r.relevanceByRole[role] ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.relevanceByRole[role] ?? 0) - (a.relevanceByRole[role] ?? 0)
    );

  return {
    ...classification,
    techStack: filteredTechStack,
    repositoryAnalyses: filteredRepos,
  };
}
