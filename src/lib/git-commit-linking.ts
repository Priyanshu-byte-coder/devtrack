import { supabaseAdmin } from "./supabase";

/**
 * Normalizes a repository URL to facilitate accurate, protocol-agnostic comparison.
 * e.g., "https://github.com/username/repo-name.git" -> "github.com/username/repo-name"
 */
export function normalizeRepoUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr.trim().toLowerCase());
    let hostname = url.hostname.replace(/^www\./, "");
    let pathname = url.pathname.replace(/^\/|\/$/g, "").replace(/\.git$/, "");
    return `${hostname}/${pathname}`;
  } catch {
    // Fallback for non-standard or malformed strings
    return urlStr
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/$/, "")
      .replace(/\.git$/, "");
  }
}

interface ParsedReference {
  issueNumber: number;
  keyword?: string;
}

/**
 * Parses a commit message to find issue references of the format KEY-123.
 * Optionally extracts preceding status-change trigger keywords (e.g. Fixes, Resolves).
 */
export function parseCommitMessage(message: string, projectKey: string): ParsedReference[] {
  const refs: ParsedReference[] = [];
  const escapedKey = projectKey.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  
  // Regex pattern matching optional triggers, optional colon, and key-number pattern
  // Matches e.g. "Fixes: PROJ-123", "closes PROJ-45", "PROJ-78"
  const regex = new RegExp(
    `\\b(fixes|fixed|fix|closes|closed|close|resolves|resolved|resolve|reviews|review|in-review)?\\s*:?\\s*\\b(${escapedKey}-(\\d+))\\b`,
    "gi"
  );

  let match;
  while ((match = regex.exec(message)) !== null) {
    const keyword = match[1]?.toLowerCase();
    const issueNumber = parseInt(match[3], 10);
    if (!isNaN(issueNumber)) {
      refs.push({ issueNumber, keyword });
    }
  }

  return refs;
}

interface CommitInput {
  id: string;
  message: string;
  url: string;
  author?: {
    name?: string;
    email?: string;
  };
}

const DONE_KEYWORDS = ["fixes", "fixed", "fix", "closes", "closed", "close", "resolves", "resolved", "resolve"];
const IN_REVIEW_KEYWORDS = ["reviews", "review", "in-review"];

/**
 * Processes incoming commits, looks up matching projects and issues in the database,
 * logs commit reference activities, and triggers status changes where applicable.
 */
export async function processCommits(repoUrl: string, commits: CommitInput[]): Promise<void> {
  if (!commits || commits.length === 0) return;

  const normalizedInputUrl = normalizeRepoUrl(repoUrl);

  // Fetch all repository links and their corresponding projects
  const { data: repos, error: reposError } = await supabaseAdmin
    .from("devtrack_repositories")
    .select("*, devtrack_projects(*)");

  if (reposError) {
    console.error("Error fetching devtrack repositories for commit linking:", reposError);
    return;
  }

  if (!repos || repos.length === 0) return;

  // Filter repos that match the normalized repository URL
  const matchedRepos = repos.filter(
    (r) => normalizeRepoUrl(r.repo_url) === normalizedInputUrl
  );

  if (matchedRepos.length === 0) return;

  for (const r of matchedRepos) {
    const project = r.devtrack_projects;
    if (!project) continue;

    const projectKey = project.key;

    for (const commit of commits) {
      const message = commit.message || "";
      const parsedRefs = parseCommitMessage(message, projectKey);

      if (parsedRefs.length === 0) continue;

      // Deduplicate refs for the same issue, keeping the one with trigger keywords if multiple exist
      const uniqueRefs = new Map<number, ParsedReference>();
      for (const ref of parsedRefs) {
        if (!uniqueRefs.has(ref.issueNumber) || ref.keyword) {
          uniqueRefs.set(ref.issueNumber, ref);
        }
      }

      for (const ref of uniqueRefs.values()) {
        // Query the issue
        const { data: issue, error: issueError } = await supabaseAdmin
          .from("devtrack_issues")
          .select("*")
          .eq("project_id", project.id)
          .eq("issue_number", ref.issueNumber)
          .maybeSingle();

        if (issueError) {
          console.error(`Error fetching issue ${projectKey}-${ref.issueNumber}:`, issueError);
          continue;
        }

        if (!issue) continue;

        // Check if this commit was already linked to this issue (idempotency check)
        const { data: existingActivity, error: activityError } = await supabaseAdmin
          .from("devtrack_issue_activities")
          .select("id")
          .eq("issue_id", issue.id)
          .eq("commit_hash", commit.id)
          .maybeSingle();

        if (activityError) {
          console.error("Error checking existing issue activity:", activityError);
          continue;
        }

        if (existingActivity) {
          // Commit already linked, skip
          continue;
        }

        // Insert commit_link activity
        const commitMsgFirstLine = message.split("\n")[0] || "";
        const authorName = commit.author?.name || "Unknown Author";
        const cleanMessage = commitMsgFirstLine.length > 80 
          ? `${commitMsgFirstLine.substring(0, 80)}...` 
          : commitMsgFirstLine;

        const content = `Referenced in commit [${commit.id.substring(0, 7)}](${commit.url}) by ${authorName}: "${cleanMessage}"`;

        const { error: insertActError } = await supabaseAdmin
          .from("devtrack_issue_activities")
          .insert({
            issue_id: issue.id,
            type: "commit_link",
            content,
            commit_hash: commit.id,
            commit_url: commit.url,
            author_name: authorName,
          });

        if (insertActError) {
          console.error("Failed to insert commit link activity:", insertActError);
          continue;
        }

        // Handle trigger keywords for status changes if enabled on project
        if (project.enable_keyword_triggers && ref.keyword) {
          let newStatus: string | null = null;
          
          if (DONE_KEYWORDS.includes(ref.keyword)) {
            newStatus = "Done";
          } else if (IN_REVIEW_KEYWORDS.includes(ref.keyword)) {
            newStatus = "In Review";
          }

          if (newStatus && newStatus !== issue.status) {
            // Update issue status
            const { error: updateIssueError } = await supabaseAdmin
              .from("devtrack_issues")
              .update({
                status: newStatus,
                updated_at: new Date().toISOString(),
              })
              .eq("id", issue.id);

            if (updateIssueError) {
              console.error(`Failed to update status for issue ${projectKey}-${ref.issueNumber}:`, updateIssueError);
              continue;
            }

            // Insert status change activity
            const { error: insertStatusActError } = await supabaseAdmin
              .from("devtrack_issue_activities")
              .insert({
                issue_id: issue.id,
                type: "status_change",
                content: `Status changed from ${issue.status} to ${newStatus} via commit ${commit.id.substring(0, 7)}`,
              });

            if (insertStatusActError) {
              console.error("Failed to insert status change activity:", insertStatusActError);
            }
          }
        }
      }
    }
  }
}
