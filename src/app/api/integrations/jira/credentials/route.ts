import { isSafeUrl } from "@/lib/ssrf-protection";

import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser, AppUser } from "@/lib/resolve-user";
import { encryptToken } from "@/lib/crypto";

export const dynamic = "force-dynamic";

interface JiraCredentialsInput {
  jiraDomain: string;
  email: string;
  apiToken: string;
  projectKey?: string;
}

function validateJiraDomain(domain: string): boolean {
  const domainRegex = /^[a-zA-Z0-9][-a-zA-Z0-9]*\.atlassian\.net$/;
  return domainRegex.test(domain);
}

function validateProjectKey(key: string): boolean {
  const projectKeyRegex = /^[A-Z][A-Z0-9]{0,9}$/;
  return projectKeyRegex.test(key);
}
async function testJiraConnection(
  domain: string,
  email: string,
  token: string
): Promise<boolean> {
  const url = `https://${domain}/rest/api/3/myself`;
  if (!(await isSafeUrl(url))) {
    return false;
  }
  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  return response.ok;
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

export async function GET(req: NextRequest) {
  const result = await requireUser();
  if ("error" in result) return result.error;

  const { data: credentials, error } = await supabaseAdmin
    .from("jira_credentials")
    .select("id, jira_domain, email, project_key, is_active, created_at")
    .eq("user_id", result.user.id);

  if (error) {
    console.error("Failed to fetch Jira credentials:", error);
    return Response.json(
      { error: "Failed to fetch Jira credentials" },
      { status: 500 }
    );
  }

  return Response.json({ credentials: credentials ?? [] });
}

export async function POST(req: NextRequest) {
  const result = await requireUser();
  if ("error" in result) return result.error;

  let body: JiraCredentialsInput;
  try {
    body = await req.json();
  } catch (e) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { jiraDomain, email, apiToken, projectKey } = body;

  if (!jiraDomain || !email || !apiToken) {
    return Response.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (!validateJiraDomain(jiraDomain)) {
    return Response.json(
      { error: "Invalid Jira domain format" },
      { status: 400 }
    );
  }

  if (projectKey && !validateProjectKey(projectKey)) {
    return Response.json(
      { error: "Invalid project key format (use uppercase letters and numbers, e.g. PROJ)" },
      { status: 400 }
    );
  }
  const valid = await testJiraConnection(jiraDomain, email, apiToken);
  if (!valid) {
    return Response.json(
      { error: "Could not connect to Jira with provided credentials" },
      { status: 400 }
    );
  }

  const { encrypted, iv } = encryptToken(apiToken);

  await supabaseAdmin.from("jira_credentials").upsert(
    {
      user_id: result.user.id,
      jira_domain: jiraDomain,
      email,
      api_token: encrypted,
      token_iv: iv,
      project_key: projectKey || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  return Response.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const result = await requireUser();
  if ("error" in result) return result.error;

  const { searchParams } = new URL(req.url);
  const credentialId = searchParams.get("id");

  if (credentialId) {
    await supabaseAdmin
      .from("jira_credentials")
      .delete()
      .eq("id", credentialId)
      .eq("user_id", result.user.id);
  } else {
    await supabaseAdmin
      .from("jira_credentials")
      .delete()
      .eq("user_id", result.user.id);
  }

  return Response.json({ success: true });
}
