import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { CVExportRequest, ResumeContent } from "@/types/cv-types";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Build a Markdown string from ResumeContent. */
function toMarkdown(content: ResumeContent): string {
  const lines: string[] = [];

  lines.push(`# Resume — ${content.role}`);
  lines.push("");

  // Professional Summary
  lines.push("## Professional Summary");
  lines.push("");
  lines.push(content.professionalSummary);
  lines.push("");

  // Experience / Bullet Points
  if (content.bulletPoints.length > 0) {
    lines.push("## Experience Highlights");
    lines.push("");
    for (const bp of content.bulletPoints) {
      const techs =
        bp.technologies.length > 0
          ? ` _(${bp.technologies.join(", ")})_`
          : "";
      lines.push(`- ${bp.text}${techs}`);
    }
    lines.push("");
  }

  // Projects
  if (content.projectDescriptions.length > 0) {
    lines.push("## Projects");
    lines.push("");
    for (const proj of content.projectDescriptions) {
      lines.push(`### [${proj.name}](${proj.url})`);
      lines.push("");
      lines.push(proj.description);
      lines.push("");
      if (proj.highlights.length > 0) {
        for (const h of proj.highlights) {
          lines.push(`- ${h}`);
        }
        lines.push("");
      }
      if (proj.technologies.length > 0) {
        lines.push(`**Technologies:** ${proj.technologies.join(", ")}`);
        lines.push("");
      }
    }
  }

  // Skills
  if (content.skills.length > 0) {
    lines.push("## Skills");
    lines.push("");
    for (const cat of content.skills) {
      lines.push(`**${cat.category}:** ${cat.skills.join(", ")}`);
    }
    lines.push("");
  }

  // Skill Summary
  if (content.skillSummary) {
    lines.push("## Skill Summary");
    lines.push("");
    lines.push(content.skillSummary);
    lines.push("");
  }

  lines.push(`---`);
  lines.push(`_Generated at ${content.generatedAt}_`);

  return lines.join("\n");
}

/** Build a PDF buffer using jsPDF. */
async function toPdf(content: ResumeContent): Promise<ArrayBuffer> {
  // Dynamic imports so the modules are only loaded when needed.
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const usable = pageWidth - margin * 2;
  let y = margin;

  /** Helper: add text and advance y. */
  const bg_addWrapped = (text: string, fontSize: number, isBold = false) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    const split = doc.splitTextToSize(text, usable);
    const lineHeight = fontSize * 0.5;
    // Check page break
    if (y + split.length * lineHeight > 280) {
      doc.addPage();
      y = margin;
    }
    doc.text(split, margin, y);
    y += split.length * lineHeight + 2;
  };

  // ── Title ──
  bg_addWrapped(`Resume — ${content.role}`, 18, true);
  y += 4;

  // ── Professional Summary ──
  bg_addWrapped("Professional Summary", 14, true);
  bg_addWrapped(content.professionalSummary, 10);
  y += 2;

  // ── Experience Highlights ──
  if (content.bulletPoints.length > 0) {
    bg_addWrapped("Experience Highlights", 14, true);
    for (const bp of content.bulletPoints) {
      bg_addWrapped(`• ${bp.text}`, 10);
    }
    y += 2;
  }

  // ── Projects ──
  if (content.projectDescriptions.length > 0) {
    bg_addWrapped("Projects", 14, true);
    for (const proj of content.projectDescriptions) {
      bg_addWrapped(proj.name, 12, true);
      bg_addWrapped(proj.description, 10);
      for (const h of proj.highlights) {
        bg_addWrapped(`• ${h}`, 10);
      }
      if (proj.technologies.length > 0) {
        bg_addWrapped(`Technologies: ${proj.technologies.join(", ")}`, 9);
      }
      y += 2;
    }
  }

  // ── Skills Table ──
  if (content.skills.length > 0) {
    bg_addWrapped("Skills", 14, true);
    const tableBody = content.skills.map((cat) => [
      cat.category,
      cat.skills.join(", "),
    ]);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Category", "Skills"]],
      body: tableBody,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185] },
    });
    y = (doc as any).lastAutoTable?.finalY ?? y + 20;
    y += 4;
  }

  // ── Footer ──
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generated at ${content.generatedAt}`, margin, 290);

  return doc.output("arraybuffer");
}

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
    const body = (await request.json()) as CVExportRequest;
    const { format, content } = body;

    if (!format || !content) {
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

    /* ── 3. Export based on format ────────────────────────────── */

    // JSON
    if (format === "json") {
      return new NextResponse(JSON.stringify(content, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="resume-${content.role.replace(/\s+/g, "-").toLowerCase()}.json"`,
        },
      });
    }

    // Markdown
    if (format === "markdown") {
      const md = toMarkdown(content);
      return new NextResponse(md, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="resume-${content.role.replace(/\s+/g, "-").toLowerCase()}.md"`,
        },
      });
    }

    // PDF
    if (format === "pdf") {
      const pdfBuffer = await toPdf(content);
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="resume-${content.role.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
        },
      });
    }

    // Shouldn't reach here
    return NextResponse.json({ error: "Unknown format" }, { status: 400 });
  } catch (err) {
    console.error("CV export error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
