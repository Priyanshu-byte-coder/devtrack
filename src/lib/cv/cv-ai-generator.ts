import "server-only";

import type {
  ContributionClassification,
  TargetRole,
  ResumeContent,
  ResumeBulletPoint,
  ProjectDescription,
  SkillCategory,
  RepositoryAnalysis,
  TechItem,
} from "@/types/cv-types";

import {
  cvBulletPointPrompt,
  cvProjectDescriptionPrompt,
  cvProfessionalSummaryPrompt,
  cvSkillSummaryPrompt,
} from "@/lib/cv/cv-prompts";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const MAX_TOKENS = 2000;

/* ------------------------------------------------------------------ */
/*  Groq API helper                                                    */
/* ------------------------------------------------------------------ */

/**
 * Sends a prompt to the Groq API (Llama 3.3 70B) and returns the raw
 * text response. Returns an empty string on any failure so callers can
 * safely fall back to rule-based content.
 */
async function callGroqAPI(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn("GROQ_API_KEY is not set — skipping AI generation");
    return "";
  }

  try {
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error("Groq API error", res.status, await res.text());
      return "";
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return data.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.error("Groq API call failed — falling back to rule-based content", err);
    return "";
  }
}

/* ------------------------------------------------------------------ */
/*  JSON parsing helpers                                               */
/* ------------------------------------------------------------------ */

/**
 * Safely parses a JSON string that may be wrapped in markdown fences.
 * Returns `null` on failure so callers can fall back.
 */
function safeParseJSON<T>(raw: string): T | null {
  try {
    // Strip markdown code fences (```json ... ```) that LLMs sometimes add
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Utility helpers                                                    */
/* ------------------------------------------------------------------ */

/** Collect all known tech names from the classification into a Set. */
function buildKnownTechSet(classification: ContributionClassification): Set<string> {
  const s = new Set<string>();
  const addItems = (items: TechItem[]) => items.forEach((i) => s.add(i.name.toLowerCase()));
  addItems(classification.techStack.languages);
  addItems(classification.techStack.frameworks);
  addItems(classification.techStack.tools);
  return s;
}

/** Collect all known repository names from the classification. */
function buildKnownRepoSet(classification: ContributionClassification): Set<string> {
  const s = new Set<string>();
  for (const repo of classification.repositoryAnalyses) {
    s.add(repo.name.toLowerCase());
    s.add(repo.nameWithOwner.toLowerCase());
  }
  return s;
}

/**
 * Filters repository analyses to those most relevant for a target role,
 * sorted descending by relevance score.
 */
function filterReposForRole(
  classification: ContributionClassification,
  role: TargetRole,
): RepositoryAnalysis[] {
  return [...classification.repositoryAnalyses]
    .map((repo) => ({
      repo,
      score: repo.relevanceByRole[role] ?? 0,
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ repo }) => repo);
}

/* ------------------------------------------------------------------ */
/*  Hallucination-prevention validators                                */
/* ------------------------------------------------------------------ */

/**
 * Validates bullet points against the actual classification data.
 * Strips any technologies that don't appear in the real tech stack and
 * clamps confidence to 0-100.
 */
function validateBulletPoints(
  bullets: ResumeBulletPoint[],
  classification: ContributionClassification,
): ResumeBulletPoint[] {
  const knownTech = buildKnownTechSet(classification);
  const knownRepos = buildKnownRepoSet(classification);

  return bullets
    .filter((b) => typeof b.text === "string" && b.text.length > 0)
    .map((b) => ({
      text: b.text.trim(),
      repository: knownRepos.has((b.repository ?? "").toLowerCase())
        ? b.repository
        : classification.repositoryAnalyses[0]?.name ?? "unknown",
      confidence: Math.max(0, Math.min(100, Number(b.confidence) || 50)),
      technologies: (b.technologies ?? []).filter((t) =>
        knownTech.has(t.toLowerCase()),
      ),
    }));
}

/**
 * Validates project descriptions against actual classification data.
 * Ensures repository names match real repos and technologies are genuine.
 */
function validateProjectDescriptions(
  projects: ProjectDescription[],
  classification: ContributionClassification,
): ProjectDescription[] {
  const knownTech = buildKnownTechSet(classification);
  const repoMap = new Map<string, RepositoryAnalysis>();
  for (const repo of classification.repositoryAnalyses) {
    repoMap.set(repo.name.toLowerCase(), repo);
    repoMap.set(repo.nameWithOwner.toLowerCase(), repo);
  }

  return projects
    .filter((p) => {
      const key = (p.name ?? "").toLowerCase();
      return repoMap.has(key) || repoMap.has((p.nameWithOwner ?? "").toLowerCase());
    })
    .map((p) => {
      const match =
        repoMap.get(p.name.toLowerCase()) ??
        repoMap.get((p.nameWithOwner ?? "").toLowerCase())!;
      return {
        name: match.name,
        nameWithOwner: match.nameWithOwner,
        url: match.url,
        description:
          typeof p.description === "string" && p.description.length > 0
            ? p.description.trim()
            : match.description ?? "",
        highlights: Array.isArray(p.highlights)
          ? p.highlights.filter((h) => typeof h === "string" && h.length > 0)
          : [],
        technologies: (p.technologies ?? []).filter((t) =>
          knownTech.has(t.toLowerCase()),
        ),
      };
    });
}

/* ------------------------------------------------------------------ */
/*  Rule-based fallback generators                                     */
/* ------------------------------------------------------------------ */

/** Generates simple template-based bullet points when AI is unavailable. */
function fallbackBulletPoints(
  classification: ContributionClassification,
  role: TargetRole,
): ResumeBulletPoint[] {
  const repos = filterReposForRole(classification, role).slice(0, 6);
  const { contributionScores } = classification;

  const bullets: ResumeBulletPoint[] = [];

  for (const repo of repos) {
    const langs = repo.languages.slice(0, 3).join(", ");
    const prs = repo.prsMerged;
    const adds = repo.totalAdditions;

    if (prs > 0) {
      bullets.push({
        text: `Contributed ${prs} merged pull request${prs > 1 ? "s" : ""} to ${repo.name}, adding ${adds.toLocaleString()} lines across ${langs}.`,
        repository: repo.name,
        confidence: 90,
        technologies: repo.languages.slice(0, 3),
      });
    } else if (adds > 0) {
      bullets.push({
        text: `Developed features for ${repo.name} using ${langs}, contributing ${adds.toLocaleString()} lines of code.`,
        repository: repo.name,
        confidence: 80,
        technologies: repo.languages.slice(0, 3),
      });
    }
  }

  // Add an overall stats bullet if we have enough data
  if (contributionScores.totalPRsMerged > 0) {
    bullets.push({
      text: `Merged ${contributionScores.totalPRsMerged} pull requests across ${contributionScores.totalReposContributed} repositories with an average PR size of ${contributionScores.avgPRSize} changed lines.`,
      repository: repos[0]?.name ?? "various",
      confidence: 95,
      technologies: contributionScores.topLanguages.slice(0, 3),
    });
  }

  return bullets;
}

/** Generates simple template-based project descriptions. */
function fallbackProjectDescriptions(
  classification: ContributionClassification,
  role: TargetRole,
): ProjectDescription[] {
  return filterReposForRole(classification, role)
    .slice(0, 4)
    .map((repo) => ({
      name: repo.name,
      nameWithOwner: repo.nameWithOwner,
      url: repo.url,
      description: repo.description ?? `A ${repo.complexity}-complexity project using ${repo.languages.slice(0, 3).join(", ")}.`,
      highlights: [
        repo.prsMerged > 0 ? `${repo.prsMerged} pull requests merged` : null,
        repo.totalAdditions > 0 ? `${repo.totalAdditions.toLocaleString()} lines added` : null,
        repo.topics.length > 0 ? `Topics: ${repo.topics.slice(0, 4).join(", ")}` : null,
      ].filter((h): h is string => h !== null),
      technologies: repo.languages.slice(0, 5),
    }));
}

/** Generates a simple professional summary from classification data. */
function fallbackProfessionalSummary(
  classification: ContributionClassification,
  role: TargetRole,
): string {
  const { contributionScores, primaryDomain } = classification;
  const topLangs = contributionScores.topLanguages.slice(0, 3).join(", ");
  return (
    `${role} with demonstrated experience in ${primaryDomain} engineering. ` +
    `Contributed ${contributionScores.totalCommits} commits and ${contributionScores.totalPRsMerged} merged pull requests ` +
    `across ${contributionScores.totalReposContributed} repositories. ` +
    `Proficient in ${topLangs}.`
  );
}

/** Generates a simple skill summary and categories from classification data. */
function fallbackSkillSummary(
  classification: ContributionClassification,
): { summary: string; skills: SkillCategory[] } {
  const { techStack } = classification;

  const skills: SkillCategory[] = [];

  if (techStack.languages.length > 0) {
    skills.push({
      category: "Languages",
      skills: techStack.languages.map((t) => t.name),
    });
  }
  if (techStack.frameworks.length > 0) {
    skills.push({
      category: "Frameworks & Libraries",
      skills: techStack.frameworks.map((t) => t.name),
    });
  }
  if (techStack.tools.length > 0) {
    skills.push({
      category: "Tools & Platforms",
      skills: techStack.tools.map((t) => t.name),
    });
  }

  const allNames = skills.flatMap((c) => c.skills);
  const summary = `Technical skills spanning ${allNames.length} technologies including ${allNames.slice(0, 5).join(", ")}.`;

  return { summary, skills };
}

/* ------------------------------------------------------------------ */
/*  AI-powered generators                                              */
/* ------------------------------------------------------------------ */

/**
 * Generates ATS-optimized resume bullet points for the target role
 * using the Groq API.
 */
async function generateBulletPoints(
  classification: ContributionClassification,
  role: TargetRole,
): Promise<ResumeBulletPoint[]> {
  const prompt = cvBulletPointPrompt(classification, role);
  const raw = await callGroqAPI(prompt);

  if (!raw) {
    return fallbackBulletPoints(classification, role);
  }

  const parsed = safeParseJSON<ResumeBulletPoint[]>(raw);
  if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
    console.warn("Failed to parse bullet points from AI — using fallback");
    return fallbackBulletPoints(classification, role);
  }

  const validated = validateBulletPoints(parsed, classification);
  return validated.length > 0 ? validated : fallbackBulletPoints(classification, role);
}

/**
 * Generates rich project descriptions for the target role using the
 * Groq API.
 */
async function generateProjectDescriptions(
  classification: ContributionClassification,
  role: TargetRole,
): Promise<ProjectDescription[]> {
  const prompt = cvProjectDescriptionPrompt(classification, role);
  const raw = await callGroqAPI(prompt);

  if (!raw) {
    return fallbackProjectDescriptions(classification, role);
  }

  const parsed = safeParseJSON<ProjectDescription[]>(raw);
  if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
    console.warn("Failed to parse project descriptions from AI — using fallback");
    return fallbackProjectDescriptions(classification, role);
  }

  const validated = validateProjectDescriptions(parsed, classification);
  return validated.length > 0 ? validated : fallbackProjectDescriptions(classification, role);
}

/**
 * Generates a professional summary paragraph tailored to the target role
 * using the Groq API.
 */
async function generateProfessionalSummary(
  classification: ContributionClassification,
  role: TargetRole,
): Promise<string> {
  const prompt = cvProfessionalSummaryPrompt(classification, role);
  const raw = await callGroqAPI(prompt);

  if (!raw) {
    return fallbackProfessionalSummary(classification, role);
  }

  // The professional summary is plain text — no JSON parsing needed.
  // Basic sanity check: must be at least 50 characters.
  if (raw.length < 50) {
    return fallbackProfessionalSummary(classification, role);
  }

  return raw;
}

/**
 * Generates a skills summary with categorised skill groups using the
 * Groq API.
 */
async function generateSkillSummary(
  classification: ContributionClassification,
  role: TargetRole,
): Promise<{ summary: string; skills: SkillCategory[] }> {
  const prompt = cvSkillSummaryPrompt(classification, role);
  const raw = await callGroqAPI(prompt);

  if (!raw) {
    return fallbackSkillSummary(classification);
  }

  const parsed = safeParseJSON<{ summary: string; skills: SkillCategory[] }>(raw);
  if (
    !parsed ||
    typeof parsed.summary !== "string" ||
    !Array.isArray(parsed.skills) ||
    parsed.skills.length === 0
  ) {
    console.warn("Failed to parse skill summary from AI — using fallback");
    return fallbackSkillSummary(classification);
  }

  // Filter each category's skills to only include known technologies
  const knownTech = buildKnownTechSet(classification);
  const validatedSkills: SkillCategory[] = parsed.skills
    .map((cat) => ({
      category: cat.category,
      skills: (cat.skills ?? []).filter((s) => knownTech.has(s.toLowerCase())),
    }))
    .filter((cat) => cat.skills.length > 0);

  if (validatedSkills.length === 0) {
    return fallbackSkillSummary(classification);
  }

  return { summary: parsed.summary, skills: validatedSkills };
}

/* ------------------------------------------------------------------ */
/*  Main orchestrator                                                  */
/* ------------------------------------------------------------------ */

/**
 * Generates a complete ATS-friendly `ResumeContent` object for the
 * given classification and target role. Calls Groq (Llama 3.3 70B) for
 * each section in parallel, validates outputs against real data to
 * prevent hallucinations, and falls back to rule-based templates when
 * the API is unavailable or returns unusable content.
 *
 * @param classification - The user's classified GitHub contributions.
 * @param role           - The target job role for the resume.
 * @returns A complete `ResumeContent` ready for rendering or export.
 */
export async function generateResumeContent(
  classification: ContributionClassification,
  role: TargetRole,
): Promise<ResumeContent> {
  // Run all four generators in parallel for speed
  const [bulletPoints, projectDescriptions, professionalSummary, skillResult] =
    await Promise.all([
      generateBulletPoints(classification, role),
      generateProjectDescriptions(classification, role),
      generateProfessionalSummary(classification, role),
      generateSkillSummary(classification, role),
    ]);

  return {
    role,
    professionalSummary,
    bulletPoints,
    projectDescriptions,
    skillSummary: skillResult.summary,
    skills: skillResult.skills,
    generatedAt: new Date().toISOString(),
  };
}
