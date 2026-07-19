/**
 * cv-prompts.ts
 *
 * AI prompt templates for the CV / Resume Generator feature.
 * Each function builds a fully-contextualised prompt string from the complete
 * ContributionClassification and TargetRole that can be sent to the Groq LLM.
 *
 * Prompts embed real GitHub contribution data and explicitly instruct the
 * model to avoid fabricating metrics or technologies.
 *
 * @module cv-prompts
 */

import type { ContributionClassification, TargetRole } from "@/types/cv-types";

const HONESTY_CLAUSE = `
IMPORTANT RULES:
- ONLY reference technologies, metrics, and contributions that are explicitly provided in the data below.
- DO NOT fabricate, exaggerate, or infer any statistics, technologies, company names, or outcomes.
- If the data is insufficient for a strong bullet point, produce fewer bullets rather than inventing content.
- Use strong action verbs: Developed, Engineered, Implemented, Optimized, Scaled, Integrated, Architected, Refactored, Automated, Designed.
- Write for ATS (Applicant Tracking System) optimisation: use industry-standard terminology and avoid obscure abbreviations.
`.trim();

/**
 * Generates the prompt for generating ATS-friendly resume bullet points.
 * Sorts and serializes the most relevant repositories and their merged pull requests.
 */
export function cvBulletPointPrompt(
  classification: ContributionClassification,
  role: TargetRole
): string {
  // Sort repositories by relevance to the target role
  const relevantRepos = [...classification.repositoryAnalyses]
    .sort((a, b) => (b.relevanceByRole[role] ?? 0) - (a.relevanceByRole[role] ?? 0))
    .slice(0, 5); // Take top 5 repos

  let repoDataString = "";
  relevantRepos.forEach((repo, idx) => {
    const prs = repo.prsMerged;
    const adds = repo.totalAdditions;
    const dels = repo.totalDeletions;
    const langs = repo.languages.join(", ");
    
    repoDataString += `\n${idx + 1}. REPOSITORY: ${repo.nameWithOwner}\n`;
    repoDataString += `   DESCRIPTION: ${repo.description ?? "No description"}\n`;
    repoDataString += `   LANGUAGES: ${langs}\n`;
    repoDataString += `   STATS: ${prs} merged PRs, +${adds}/-${dels} lines\n`;
  });

  return `You are an expert resume writer specialising in software engineering roles.

${HONESTY_CLAUSE}

TARGET ROLE: ${role}

RELEVANT REPOSITORIES AND CONTRIBUTIONS:
${repoDataString || "No contribution data available."}

TASK:
Generate a JSON array containing 3-5 ATS-optimised resume bullet points across the repositories above.
Each bullet should:
- Start with a strong action verb
- Reference specific technologies from the LANGUAGES list of the repository
- Include quantifiable metrics ONLY from the provided data (lines changed, files modified, PRs merged)
- Reference the exact repository name in the "repository" field
- Be 1-2 sentences, concise and impactful
- Be tailored toward the TARGET ROLE

Respond ONLY with valid JSON in this exact format:
[
  {
    "text": "Engineered a responsive dashboard component using React and TypeScript, merging 4 pull requests and adding 1,200 lines of code.",
    "repository": "repo-name",
    "technologies": ["React", "TypeScript"],
    "confidence": 95
  }
]`;
}

/**
 * Generates the prompt for generating polished project descriptions.
 */
export function cvProjectDescriptionPrompt(
  classification: ContributionClassification,
  role: TargetRole
): string {
  // Sort repositories by relevance to the target role
  const relevantRepos = [...classification.repositoryAnalyses]
    .sort((a, b) => (b.relevanceByRole[role] ?? 0) - (a.relevanceByRole[role] ?? 0))
    .slice(0, 4); // Take top 4 repos

  let repoDataString = "";
  relevantRepos.forEach((repo, idx) => {
    repoDataString += `\n${idx + 1}. PROJECT: ${repo.nameWithOwner}\n`;
    repoDataString += `   DESCRIPTION: ${repo.description ?? "No description"}\n`;
    repoDataString += `   URL: ${repo.url}\n`;
    repoDataString += `   LANGUAGES: ${repo.languages.join(", ")}\n`;
    repoDataString += `   TOPICS: ${repo.topics.join(", ") || "None"}\n`;
    repoDataString += `   COMPLEXITY: ${repo.complexity}\n`;
    repoDataString += `   STATS: ${repo.prsMerged} merged PRs, +${repo.totalAdditions}/-${repo.totalDeletions} lines\n`;
  });

  return `You are an expert resume writer specialising in software engineering roles.

${HONESTY_CLAUSE}

TARGET ROLE: ${role}

RELEVANT PROJECTS:
${repoDataString || "No projects available."}

TASK:
Generate a JSON array of project descriptions (one for each of the top projects above, max 4).
For each project, generate:
- A concise description (1-2 sentences) conveying the project's purpose and contribution scope.
- 2-3 highlight bullet points emphasizing measurable impact using ONLY the metrics above.
- A list of technologies used (matching the languages/topics above).

Respond ONLY with valid JSON in this exact format:
[
  {
    "name": "repo-name",
    "nameWithOwner": "owner/repo-name",
    "url": "https://github.com/...",
    "description": "A high-complexity web application designed to track development progress.",
    "highlights": [
      "Merged 5 pull requests contributing 2,300 lines of code",
      "Integrated React and Tailwind CSS to build the frontend dashboard"
    ],
    "technologies": ["React", "Tailwind CSS"]
  }
]`;
}

/**
 * Generates the prompt for generating the professional summary.
 */
export function cvProfessionalSummaryPrompt(
  classification: ContributionClassification,
  role: TargetRole
): string {
  const { contributionScores, primaryDomain, techStack } = classification;
  const langs = techStack.languages.map((l) => l.name).slice(0, 5).join(", ");
  const frameworks = techStack.frameworks.map((f) => f.name).slice(0, 5).join(", ");

  return `You are an expert resume writer specialising in software engineering roles.

${HONESTY_CLAUSE}

TARGET ROLE: ${role}

DEVELOPER CONTRIBUTION PROFILE:
- Primary Domain: ${primaryDomain}
- Top Languages: ${langs || "Not detected"}
- Top Frameworks: ${frameworks || "Not detected"}
- Repositories Contributed: ${contributionScores.totalReposContributed}
- Merged Pull Requests: ${contributionScores.totalPRsMerged}
- Total Commits: ${contributionScores.totalCommits}
- Code Reviews Conducted: ${contributionScores.totalReviews}

TASK:
Write a professional summary paragraph (3-4 sentences) suitable for the top of a resume.
- Open with the developer's strongest qualifications relevant to the TARGET ROLE.
- Mention specific technologies from the provided lists.
- Reference contribution volume using ONLY the metrics above.
- Use a confident, third-person professional tone.
- Do NOT wrap in JSON. Just return the raw text of the summary.

Respond with ONLY the plain-text paragraph.`;
}

/**
 * Generates the prompt for generating the skill summary and categories.
 */
export function cvSkillSummaryPrompt(
  classification: ContributionClassification,
  role: TargetRole
): string {
  const { techStack, domains } = classification;
  
  const langList = techStack.languages.map((l) => `${l.name} (${l.occurrences} repos)`).join(", ");
  const fwList = techStack.frameworks.map((f) => `${f.name} (${f.occurrences} repos)`).join(", ");
  const toolList = techStack.tools.map((t) => `${t.name} (${t.occurrences} repos)`).join(", ");
  const domainList = domains.map((d) => `${d.domain}: ${d.score}/100`).join(", ");

  return `You are an expert resume writer specialising in software engineering roles.

${HONESTY_CLAUSE}

TARGET ROLE: ${role}

DETECTED TECHNICAL PROFILE:
- Languages: ${langList || "None"}
- Frameworks: ${fwList || "None"}
- Tools: ${toolList || "None"}
- Domain Scores: ${domainList || "None"}

TASK:
1. Write a brief 1-2 sentence skills summary paragraph that highlights the developer's strongest technical competencies for the TARGET ROLE.
2. Organise the detected technologies into 3-5 ATS-friendly categories (e.g. "Programming Languages", "Frameworks & Libraries", "Cloud & DevOps", "Tools & Platforms").
   - ONLY include technologies that appear in the DETECTED TECHNICAL PROFILE above.
   - Prioritise technologies most relevant to the TARGET ROLE.

Respond ONLY with valid JSON in this exact format:
{
  "summary": "Technical skills spanning languages and frameworks, with primary expertise in...",
  "skills": [
    {
      "category": "Programming Languages",
      "skills": ["TypeScript", "Python"]
    },
    {
      "category": "Frameworks & Libraries",
      "skills": ["React", "Express"]
    }
  ]
}`;
}
