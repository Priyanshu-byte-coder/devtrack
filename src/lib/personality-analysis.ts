/**
 * Deterministic scoring for the AI Code Personality Report.
 *
 * Every dimension here is computed directly from metrics DevTrack already
 * gathers (no new GitHub API calls). This module is the single source of
 * truth for the *numbers* — the Groq prompt only ever turns these numbers
 * into prose/an archetype name. If Groq is unavailable, `buildFallbackReport`
 * produces a complete report from these same dimensions so the page never
 * dead-ends on a missing AI key or a rate limit.
 */

export interface PersonalityTimeBlocks {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
}

export interface PersonalityInputMetrics {
    timeBlocks: PersonalityTimeBlocks;
    totalCommits: number;
    activeDays: number;
    longestStreak: number;
    currentStreak: number;
    prsMerged: number;
    prsOpen: number;
    avgMergeTimeDays: number;
    topRepoName: string;
    repoCount: number;
    commitsByDay: { date: string; count: number }[];
}

export type WorkingStyle = "Night Owl" | "Early Bird" | "9-to-5 Developer";
export type CommitPattern = "Sprinter" | "Marathoner";
export type CollaborationStyle = "Solo Coder" | "Team Player" | "Open Source Hero";

export interface PersonalityDimensions {
    workingStyle: WorkingStyle;
    commitPattern: CommitPattern;
    collaborationStyle: CollaborationStyle;
    perfectionismScore: number; // 0-100
    nightCommitPct: number; // 0-100
    morningCommitPct: number; // 0-100
}

export interface PersonalityReport extends PersonalityDimensions {
    archetype: string;
    tagline: string;
    description: string;
    strengths: string[];
    funFact: string;
    source: "ai" | "fallback";
}

function pct(part: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((part / total) * 100);
}

/**
 * Standard deviation of daily commit counts, normalised against the mean,
 * gives a simple "burstiness" signal: a high coefficient of variation means
 * a few huge days (Sprinter), a low one means steady daily output (Marathoner).
 */
function commitBurstiness(commitsByDay: { count: number }[]): number {
    const counts = commitsByDay.map((d) => d.count);
    const n = counts.length;
    if (n === 0) return 0;

    const mean = counts.reduce((s, c) => s + c, 0) / n;
    if (mean === 0) return 0;

    const variance =
        counts.reduce((s, c) => s + (c - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);

    return stdDev / mean; // coefficient of variation
}

export function computePersonalityDimensions(
    metrics: PersonalityInputMetrics
): PersonalityDimensions {
    const { timeBlocks, prsMerged, avgMergeTimeDays, repoCount, activeDays, totalCommits } =
        metrics;

    const totalTimedCommits =
        timeBlocks.morning + timeBlocks.afternoon + timeBlocks.evening + timeBlocks.night;

    const nightCommitPct = pct(timeBlocks.night, totalTimedCommits);
    const morningCommitPct = pct(timeBlocks.morning, totalTimedCommits);

    let workingStyle: WorkingStyle = "9-to-5 Developer";
    if (nightCommitPct >= 35) {
        workingStyle = "Night Owl";
    } else if (morningCommitPct >= 35) {
        workingStyle = "Early Bird";
    }

    const burstiness = commitBurstiness(metrics.commitsByDay);
    const commitPattern: CommitPattern = burstiness >= 1.1 ? "Sprinter" : "Marathoner";

    let collaborationStyle: CollaborationStyle = "Solo Coder";
    if (repoCount >= 8 || prsMerged >= 15) {
        collaborationStyle = "Open Source Hero";
    } else if (prsMerged >= 4) {
        collaborationStyle = "Team Player";
    }

    // Perfectionism proxy: thorough (slower) PR turnaround + consistent daily
    // cadence both read as "careful", scaled to a 0-100 band. Capped inputs
    // keep one extreme value (e.g. a single 30-day-old PR) from dominating.
    const reviewThoroughness = Math.min(avgMergeTimeDays / 3, 1) * 60; // up to 60 pts
    const consistency = Math.min(activeDays / Math.max(totalCommits, 1), 1) * 40; // up to 40 pts
    const perfectionismScore = Math.round(reviewThoroughness + consistency);

    return {
        workingStyle,
        commitPattern,
        collaborationStyle,
        perfectionismScore: Math.max(0, Math.min(100, perfectionismScore)),
        nightCommitPct,
        morningCommitPct,
    };
}

const ARCHETYPE_BY_STYLE: Record<WorkingStyle, Record<CommitPattern, string>> = {
    "Night Owl": {
        Sprinter: "The Midnight Architect",
        Marathoner: "The Nocturnal Craftsman",
    },
    "Early Bird": {
        Sprinter: "The Dawn Raider",
        Marathoner: "The Sunrise Strategist",
    },
    "9-to-5 Developer": {
        Sprinter: "The Deadline Sprinter",
        Marathoner: "The Steady Builder",
    },
};

/**
 * Used when Groq is not configured, rate-limited, or returns malformed
 * output. Keeps the dimensions identical to the AI path — only the prose
 * is templated instead of generated — so the report is never empty.
 */
export function buildFallbackReport(
    dims: PersonalityDimensions,
    metrics: Pick<PersonalityInputMetrics, "topRepoName" | "longestStreak" | "prsMerged">
): PersonalityReport {
    const archetype = ARCHETYPE_BY_STYLE[dims.workingStyle][dims.commitPattern];

    return {
        ...dims,
        archetype,
        tagline: `${dims.workingStyle} energy meets ${dims.commitPattern.toLowerCase()} habits.`,
        description: `You do most of your best work as a ${dims.workingStyle.toLowerCase()}, with a ${dims.commitPattern.toLowerCase()} commit rhythm. Your collaboration style leans toward "${dims.collaborationStyle}", and your longest streak of ${metrics.longestStreak} days shows real follow-through on ${metrics.topRepoName}.`,
        strengths: [
            dims.commitPattern === "Sprinter" ? "Fast under pressure" : "Reliable, steady output",
            dims.collaborationStyle === "Solo Coder" ? "Deep focus work" : "Strong collaborator",
            dims.perfectionismScore >= 50 ? "Careful, thorough reviewer" : "Ships quickly",
        ],
        funFact: `${metrics.prsMerged} merged PRs and counting — your commit history tells a clearer story than your resume.`,
        source: "fallback",
    };
}