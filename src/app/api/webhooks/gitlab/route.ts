import { NextRequest, NextResponse } from "next/server";
import { processCommits } from "@/lib/git-commit-linking";

export const dynamic = "force-dynamic";

interface GitLabPushPayload {
  object_kind?: string;
  after?: string;
  project?: {
    name?: string;
    web_url?: string;
  };
  commits?: Array<{
    id: string;
    message: string;
    url: string;
    author: {
      name: string;
      email: string;
    };
  }>;
}

export async function POST(req: NextRequest) {
  const secret = process.env.GITLAB_WEBHOOK_SECRET || process.env.GITHUB_WEBHOOK_SECRET;
  const token = req.headers.get("x-gitlab-token");

  if (secret && token !== secret) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let payload: GitLabPushPayload;
  try {
    const body = await req.text();
    payload = JSON.parse(body) as GitLabPushPayload;
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  // Only handle push events
  const objectKind = payload.object_kind || "push";
  if (objectKind !== "push") {
    return NextResponse.json({ received: true });
  }

  const repoUrl = payload.project?.web_url;
  const commits = payload.commits;

  if (repoUrl && commits && Array.isArray(commits)) {
    try {
      await processCommits(repoUrl, commits);
    } catch (e) {
      console.error("Error processing commits for GitLab webhook:", e);
      return NextResponse.json(
        { error: "Failed to process commits" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}
