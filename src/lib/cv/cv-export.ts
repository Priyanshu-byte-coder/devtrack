import type { ResumeContent, ResumeProfile } from "@/types/cv-types";

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

export function resumeFileSlug(content: ResumeContent): string {
  const who = content.profile?.login ? `${content.profile.login}-` : "";
  return `resume-${who}${content.role}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function displayName(profile: ResumeProfile | undefined): string {
  return profile?.name?.trim() || profile?.login || "Your Name";
}

function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function contactItems(profile: ResumeProfile | undefined) {
  const items: { label: string; url?: string }[] = [];
  if (!profile) return items;
  if (profile.email)
    items.push({ label: profile.email, url: `mailto:${profile.email}` });
  if (profile.login) {
    const url = `https://github.com/${profile.login}`;
    items.push({ label: stripProtocol(url), url });
  }
  if (profile.website) {
    const url = /^https?:\/\//.test(profile.website)
      ? profile.website
      : `https://${profile.website}`;
    items.push({ label: stripProtocol(profile.website), url });
  }
  if (profile.location) items.push({ label: profile.location });
  return items;
}

/* ------------------------------------------------------------------ */
/*  Markdown                                                           */
/* ------------------------------------------------------------------ */

export function resumeToMarkdown(content: ResumeContent): string {
  const lines: string[] = [];
  const contact = contactItems(content.profile)
    .map((c) => (c.url ? `[${c.label}](${c.url})` : c.label))
    .join(" · ");

  lines.push(`# ${displayName(content.profile)}`);
  lines.push("");
  lines.push(`**${content.role}**${contact ? `  \n${contact}` : ""}`);
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push(content.professionalSummary);
  lines.push("");

  if (content.skills.length > 0) {
    lines.push("## Technical Skills");
    lines.push("");
    for (const cat of content.skills) {
      lines.push(`- **${cat.category}:** ${cat.skills.join(", ")}`);
    }
    lines.push("");
  }

  if (content.bulletPoints.length > 0) {
    lines.push("## Key Contributions");
    lines.push("");
    for (const bp of content.bulletPoints) lines.push(`- ${bp.text}`);
    lines.push("");
  }

  if (content.projectDescriptions.length > 0) {
    lines.push("## Projects");
    lines.push("");
    for (const proj of content.projectDescriptions) {
      lines.push(`### [${proj.name}](${proj.url})`);
      if (proj.technologies.length > 0) {
        lines.push(`_${proj.technologies.join(" · ")}_`);
      }
      lines.push("");
      if (proj.description) {
        lines.push(proj.description);
        lines.push("");
      }
      for (const h of proj.highlights) lines.push(`- ${h}`);
      if (proj.highlights.length > 0) lines.push("");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}

/* ------------------------------------------------------------------ */
/*  PDF                                                                */
/* ------------------------------------------------------------------ */

/**
 * jsPDF's built-in Helvetica only covers WinAnsi. AI output regularly
 * contains arrows, non-breaking hyphens and emoji, which otherwise come
 * out as garbage glyphs, so map the common ones and drop the rest.
 */
export function toPdfSafeText(text: string): string {
  return text
    .replace(/[‐‑‒−]/g, "-")
    .replace(/[→⟶⇒]/g, "->")
    .replace(/[←⇐]/g, "<-")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/≈/g, "~")
    .replace(/ | | | /g, " ")
    .replace(/[​-‍﻿]/g, "")
    .replace(/[^\x09\x0a\x0d\x20-\x7e¡-ÿ–—‘’‚“”„†‡•…‰€™]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const PT_TO_MM = 25.4 / 72;
const INK: [number, number, number] = [17, 24, 39];
const BODY: [number, number, number] = [55, 65, 81];
const MUTED: [number, number, number] = [107, 114, 128];
const ACCENT: [number, number, number] = [29, 78, 216];
const RULE: [number, number, number] = [209, 213, 219];

/** Renders a one-or-two page, ATS-readable resume (real text, single column). */
export async function resumeToPdf(
  content: ResumeContent
): Promise<ArrayBuffer> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const name = displayName(content.profile);
  doc.setProperties({
    title: `${name} — ${content.role} resume`,
    subject: `Resume for ${content.role}`,
    author: name,
    creator: "DevTrack",
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const marginTop = 16;
  const marginBottom = 16;
  const width = pageW - marginX * 2;
  let y = marginTop;

  const lineHeight = (size: number, leading = 1.32) =>
    size * PT_TO_MM * leading;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  };

  const setFont = (
    size: number,
    style: "normal" | "bold" | "italic" = "normal",
    color: [number, number, number] = BODY
  ) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  /** Wrapped paragraph; `indent` shifts every line, `hang` only the first. */
  const paragraph = (
    raw: string,
    size: number,
    opts: {
      style?: "normal" | "bold" | "italic";
      color?: [number, number, number];
      indent?: number;
      after?: number;
    } = {}
  ) => {
    const text = toPdfSafeText(raw);
    if (!text) return;
    const indent = opts.indent ?? 0;
    setFont(size, opts.style, opts.color);
    const lines = doc.splitTextToSize(text, width - indent) as string[];
    const lh = lineHeight(size);
    for (const line of lines) {
      ensureSpace(lh);
      doc.text(line, marginX + indent, y + size * PT_TO_MM * 0.8);
      y += lh;
    }
    y += opts.after ?? 0;
  };

  const bullet = (raw: string, size = 9.5) => {
    const text = toPdfSafeText(raw);
    if (!text) return;
    const indent = 4;
    setFont(size);
    const lines = doc.splitTextToSize(text, width - indent) as string[];
    const lh = lineHeight(size);
    ensureSpace(Math.min(lines.length, 2) * lh);
    doc.setFillColor(...MUTED);
    doc.circle(marginX + 1.2, y + size * PT_TO_MM * 0.5, 0.45, "F");
    for (const line of lines) {
      ensureSpace(lh);
      doc.text(line, marginX + indent, y + size * PT_TO_MM * 0.8);
      y += lh;
    }
    y += 0.8;
  };

  const section = (title: string) => {
    // Keep a heading with at least a couple of lines of its content.
    ensureSpace(16);
    y += 3;
    setFont(9.5, "bold", ACCENT);
    doc.setCharSpace(0.4);
    doc.text(title.toUpperCase(), marginX, y + 9.5 * PT_TO_MM * 0.8);
    doc.setCharSpace(0);
    y += lineHeight(9.5) + 0.6;
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.25);
    doc.line(marginX, y, pageW - marginX, y);
    y += 2.6;
  };

  /* ── Header ─────────────────────────────────────────────────── */
  setFont(22, "bold", INK);
  doc.text(toPdfSafeText(name), marginX, y + 22 * PT_TO_MM * 0.8);
  y += lineHeight(22, 1.15);

  setFont(11.5, "normal", ACCENT);
  doc.text(toPdfSafeText(content.role), marginX, y + 11.5 * PT_TO_MM * 0.8);
  y += lineHeight(11.5, 1.4);

  const contact = contactItems(content.profile);
  if (contact.length > 0) {
    setFont(9, "normal", MUTED);
    let x = marginX;
    const sep = "   |   ";
    contact.forEach((item, i) => {
      const label = toPdfSafeText(item.label);
      const w = doc.getTextWidth(label);
      if (x + w > pageW - marginX) {
        x = marginX;
        y += lineHeight(9);
      }
      if (item.url) {
        doc.textWithLink(label, x, y + 9 * PT_TO_MM * 0.8, { url: item.url });
      } else {
        doc.text(label, x, y + 9 * PT_TO_MM * 0.8);
      }
      x += w;
      if (i < contact.length - 1) {
        doc.setTextColor(...RULE);
        doc.text(sep, x, y + 9 * PT_TO_MM * 0.8);
        doc.setTextColor(...MUTED);
        x += doc.getTextWidth(sep);
      }
    });
    y += lineHeight(9, 1.5);
  }

  /* ── Summary ────────────────────────────────────────────────── */
  if (content.professionalSummary.trim()) {
    section("Summary");
    paragraph(content.professionalSummary, 9.8, { after: 0.5 });
  }

  /* ── Skills ─────────────────────────────────────────────────── */
  if (content.skills.length > 0) {
    section("Technical Skills");
    const labelW =
      Math.min(
        42,
        Math.max(
          ...content.skills.map((c) => {
            setFont(9.5, "bold", INK);
            return doc.getTextWidth(toPdfSafeText(c.category) + ":");
          })
        )
      ) + 3;
    for (const cat of content.skills) {
      const label = toPdfSafeText(cat.category) + ":";
      const values = toPdfSafeText(cat.skills.join(", "));
      setFont(9.5, "normal");
      const lines = doc.splitTextToSize(values, width - labelW) as string[];
      const lh = lineHeight(9.5);
      ensureSpace(lines.length * lh);
      setFont(9.5, "bold", INK);
      doc.text(
        doc.splitTextToSize(label, labelW - 2)[0],
        marginX,
        y + 9.5 * PT_TO_MM * 0.8
      );
      setFont(9.5, "normal");
      for (const line of lines) {
        doc.text(line, marginX + labelW, y + 9.5 * PT_TO_MM * 0.8);
        y += lh;
      }
      y += 0.8;
    }
  }

  /* ── Contributions ──────────────────────────────────────────── */
  if (content.bulletPoints.length > 0) {
    section("Key Contributions");
    for (const bp of content.bulletPoints) bullet(bp.text);
  }

  /* ── Projects ───────────────────────────────────────────────── */
  if (content.projectDescriptions.length > 0) {
    section("Projects");
    content.projectDescriptions.forEach((proj, i) => {
      if (i > 0) y += 2.2;
      ensureSpace(14);
      const titleSize = 10.5;
      setFont(titleSize, "bold", INK);
      const title = toPdfSafeText(proj.name);
      const baseline = y + titleSize * PT_TO_MM * 0.8;
      doc.text(title, marginX, baseline);
      const titleW = doc.getTextWidth(title);

      if (proj.url) {
        setFont(8.5, "normal", MUTED);
        const link = toPdfSafeText(stripProtocol(proj.url));
        const linkW = doc.getTextWidth(link);
        if (marginX + titleW + 6 + linkW <= pageW - marginX) {
          doc.textWithLink(link, pageW - marginX - linkW, baseline, {
            url: proj.url,
          });
        }
      }
      y += lineHeight(titleSize, 1.25);

      if (proj.technologies.length > 0) {
        paragraph(proj.technologies.join("  ·  "), 8.8, {
          style: "italic",
          color: MUTED,
          after: 0.6,
        });
      }
      if (proj.description) paragraph(proj.description, 9.5, { after: 0.8 });
      for (const h of proj.highlights) bullet(h);
    });
  }

  /* ── Footer (multi-page only) ───────────────────────────────── */
  const pages = doc.getNumberOfPages();
  if (pages > 1) {
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      setFont(7.5, "normal", MUTED);
      doc.text(toPdfSafeText(name), marginX, pageH - 8);
      const right = `${p} / ${pages}`;
      doc.text(right, pageW - marginX - doc.getTextWidth(right), pageH - 8);
    }
  }

  return doc.output("arraybuffer");
}
