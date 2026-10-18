import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import {
  resumeFileSlug,
  resumeToMarkdown,
  resumeToPdf,
} from "@/lib/cv/cv-export";
import type { CVExportRequest } from "@/types/cv-types";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

/**
 * POST /api/cv/export
 *
 * Exports resume content in the requested format (json | markdown | pdf).
 * Request body: `{ format: "pdf" | "markdown" | "json", content: ResumeContent }`
 */
export async function POST(request: Request) {
  try {
    /* ── 1. Auth ─────────────────────────────────────────────── */
    const session = await getServerSession(authOptions);

    if (!session?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* ── 2. Parse body ───────────────────────────────────────── */
    const body = (await request
      .json()
      .catch(() => null)) as CVExportRequest | null;
    const format = body?.format;
    const content = body?.content;

    if (!format || !content || typeof content.role !== "string") {
      return NextResponse.json(
        { error: "Missing required fields: format, content" },
        { status: 400 }
      );
    }

    const validFormats = ["pdf", "markdown", "json"] as const;
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Must be one of: ${validFormats.join(", ")}` },
        { status: 400 }
      );
    }

    // Resumes generated before contact headers existed fall back to the
    // signed-in account so the export is never anonymous.
    const resume = {
      ...content,
      professionalSummary: content.professionalSummary ?? "",
      bulletPoints: content.bulletPoints ?? [],
      projectDescriptions: content.projectDescriptions ?? [],
      skills: content.skills ?? [],
      profile: content.profile ?? {
        name: session.user?.name ?? null,
        login: session.githubLogin ?? "",
        email: session.user?.email ?? null,
        location: null,
        website: null,
      },
    };
    const slug = resumeFileSlug(resume);

    /* ── 3. Export based on format ────────────────────────────── */
    if (format === "json") {
      return new NextResponse(JSON.stringify(resume, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${slug}.json"`,
        },
      });
    }

    if (format === "markdown") {
      return new NextResponse(resumeToMarkdown(resume), {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${slug}.md"`,
        },
      });
    }

    const pdf = await resumeToPdf(resume);
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}.pdf"`,
      },
    });
  } catch (err) {
    console.error("CV export error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
