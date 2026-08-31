import { isSafeUrl } from "@/lib/ssrf-protection";

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser, AppUser } from "@/lib/resolve-user";
import { decryptToken } from "@/lib/crypto";
import { JiraIssue, calculateMetrics } from "@/lib/jira-utils";

export const dynamic = "force-dynamic";
interface JiraCredentials {
  id: string;
  jira_domain: string;
  email: string;
  api_token: string;
  token_iv: string;
  project_key: string | null;
}

async function requireUser(): Promise<{ user: AppUser } | { error: Response }> {
  const session = await getServerSession(authOptions);

  if (!session?.githubId || !session?.githubLogin) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const userRow = await resolveAppUser(session.githubId, session.githubLogin);

  if (!userRow) {
    return { error: Response.json({ error: "User not found" }, { status: 404 }) };
  }

  return { user: userRow };
}

function validateProjectKey(key: string): boolean {
  const projectKeyRegex = /^[A-Z][A-Z0-9]{0,9}$/;
  return projectKeyRegex.test(key);
}
async function fetchJiraIssues(
  domain: string,
  email: string,
  token: string,
  projectKey?: string
): Promise<JiraIssue[]> {
  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  let jql = "project is not EMPTY ORDER BY updated DESC";
  if (projectKey) {
    if (!validateProjectKey(projectKey)) {
      throw new Error("Invalid project key format");
    }
    jql = `project = ${projectKey} ORDER BY updated DESC`;
  }

  const searchUrl = `https://${domain}/rest/api/3/search?jql=${encodeURIComponent(
    jql
  )}&maxResults=50&fields=summary,status,created,updated,resolutiondate,assignee,priority`;

  if (!(await isSafeUrl(searchUrl))) {
    throw new Error("Invalid or unsafe Jira domain.");
  }

  const response = await fetch(searchUrl, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Jira API error: ${response.status}`);
  }

  const data = await response.json();

  return (data.issues || []).map((issue: any) => ({
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    statusCategory: issue.fields.status.statusCategory.key,
    created: issue.fields.created,
    updated: issue.fields.updated,
    resolved: issue.fields.resolutiondate,
    assignee: issue.fields.assignee?.displayName || null,
    priority: issue.fields.priority?.name || "Medium",
  }));
}

export async function GET(req: NextRequest) {
  const result = await requireUser();
  if ("error" in result) return result.error;

  const { data: credentials, error } = await supabaseAdmin
    .from("jira_credentials")
    .select("*")
    .eq("user_id", result.user.id)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error || !credentials) {
    return Response.json(
      { error: "No Jira account connected" },
      { status: 404 }
    );
  }

  const cred = credentials as unknown as JiraCredentials;

  let decryptedToken: string;
  try {
    const decrypted = decryptToken(cred.api_token, cred.token_iv);
    if (!decrypted) {
      return Response.json(
        { error: "Failed to decrypt credentials" },
        { status: 500 }
      );
    }
    decryptedToken = decrypted;
  } catch (e) {
    return Response.json(
      { error: "Failed to decrypt credentials" },
      { status: 500 }
    );
  }
  try {
    const issues = await fetchJiraIssues(
      cred.jira_domain,
      cred.email,
      decryptedToken,
      cred.project_key || undefined
    );

    const metrics = calculateMetrics(issues);

    return Response.json({
      metrics,
      recentIssues: issues.slice(0, 10),
    });
  } catch (e) {
    return Response.json(
      { error: "Failed to fetch Jira data" },
      { status: 502 }
    );
  }
}
