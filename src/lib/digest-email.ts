/**
 * Weekly digest email template builder.
 *
 * Produces both a responsive HTML version and a plain-text fallback.
 * The HTML template uses inline styles and table-based layout for broad
 * email-client compatibility (Outlook, Gmail, Apple Mail, mobile).
 *
 * Design principles:
 *   • Dark/light friendly — a dark header with light body reads well in
 *     both light mode and dark-mode email clients.
 *   • Mobile-first widths — max-width 600 px, 100% on narrow viewports.
 *   • No external assets — everything is inline so the email renders
 *     correctly without image-loading permission.
 *   • Graceful degradation — every section is hidden when its data is
 *     absent, so a user with no metrics still gets a sensible email.
 */

import type { DigestMetrics } from "@/lib/weekly-digest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pluralise(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

// Language badge colours — keeps the email visually distinct without images.
const LANG_COLOURS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f7df1e",
  Python: "#3776ab",
  Go: "#00add8",
  Rust: "#ce412b",
  Java: "#b07219",
  "C#": "#178600",
  "C++": "#f34b7d",
  PHP: "#777bb4",
  Ruby: "#701516",
  Swift: "#f05138",
  Kotlin: "#a97bff",
  CSS: "#563d7c",
  HTML: "#e34c26",
  Shell: "#89e051",
  Dart: "#00b4ab",
  Scala: "#c22d40",
  R: "#198ce7",
  Vue: "#41b883",
  Svelte: "#ff3e00",
};

function langColour(name: string): string {
  return LANG_COLOURS[name] ?? "#64748b";
}

// ─── HTML template ────────────────────────────────────────────────────────────

export interface DigestEmailData {
  githubLogin: string;
  metrics: DigestMetrics | null;
  unsubscribeUrl: string;
  weekLabel: string; // e.g. "Week of 2 June 2025"
}

export function buildDigestHtml(data: DigestEmailData): string {
  const { githubLogin, metrics, unsubscribeUrl, weekLabel } = data;
  const m = metrics;

  // ── Streak section ──────────────────────────────────────────────────────────
  const streakHtml = m
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
        <tr>
          <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;color:#16a34a;
                             text-transform:uppercase;letter-spacing:0.05em;">Current Streak</p>
                  <p style="margin:0;font-size:32px;font-weight:700;color:#15803d;">
                    ${m.streak.current} ${m.streak.current === 1 ? "day" : "days"} 🔥
                  </p>
                </td>
                <td align="right" valign="middle">
                  <p style="margin:0 0 4px 0;font-size:12px;color:#64748b;">Longest streak</p>
                  <p style="margin:0;font-size:20px;font-weight:600;color:#374151;">
                    ${m.streak.longest} ${m.streak.longest === 1 ? "day" : "days"}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`
    : "";

  // ── Weekly activity section ─────────────────────────────────────────────────
  const activityHtml = m
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
        <tr>
          <td style="padding:0 0 12px 0;">
            <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">
              This week's activity
            </p>
          </td>
        </tr>
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="33%" align="center"
                    style="background:#f8fafc;border:1px solid #e2e8f0;
                           border-radius:8px;padding:16px;text-align:center;">
                  <p style="margin:0 0 4px 0;font-size:28px;font-weight:700;color:#0f172a;">
                    ${m.weeklyCommits}
                  </p>
                  <p style="margin:0;font-size:12px;color:#64748b;">Commits</p>
                </td>
                <td width="4%"></td>
                <td width="30%" align="center"
                    style="background:#f8fafc;border:1px solid #e2e8f0;
                           border-radius:8px;padding:16px;text-align:center;">
                  <p style="margin:0 0 4px 0;font-size:28px;font-weight:700;color:#0f172a;">
                    ${m.prsThisWeek}
                  </p>
                  <p style="margin:0;font-size:12px;color:#64748b;">PRs merged</p>
                </td>
                <td width="4%"></td>
                <td width="29%" align="center"
                    style="background:#f8fafc;border:1px solid #e2e8f0;
                           border-radius:8px;padding:16px;text-align:center;">
                  <p style="margin:0 0 4px 0;font-size:28px;font-weight:700;color:#0f172a;">
                    ${m.weeklyActiveDays}<span style="font-size:16px;color:#64748b;">/7</span>
                  </p>
                  <p style="margin:0;font-size:12px;color:#64748b;">Active days</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`
    : "";

  // ── Top languages section ───────────────────────────────────────────────────
  const languagesHtml =
    m && m.topLanguages.length > 0
      ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
        <tr>
          <td style="padding:0 0 12px 0;">
            <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">Top languages</p>
          </td>
        </tr>
        ${m.topLanguages
          .map(
            (l) => `
        <tr>
          <td style="padding:0 0 8px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="120">
                  <span style="display:inline-block;background:${langColour(l.name)};
                               color:#fff;font-size:11px;font-weight:600;
                               padding:2px 8px;border-radius:9999px;">${esc(l.name)}</span>
                </td>
                <td>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:#e2e8f0;border-radius:4px;height:8px;">
                        <div style="background:${langColour(l.name)};width:${Math.min(100, l.percentage)}%;
                                    height:8px;border-radius:4px;"></div>
                      </td>
                    </tr>
                  </table>
                </td>
                <td width="48" align="right" style="font-size:12px;color:#64748b;padding-left:8px;">
                  ${l.percentage.toFixed(1)}%
                </td>
              </tr>
            </table>
          </td>
        </tr>`
          )
          .join("")}
      </table>`
      : "";

  // ── Top repos section ───────────────────────────────────────────────────────
  const reposHtml =
    m && m.topRepos.length > 0
      ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
        <tr>
          <td style="padding:0 0 12px 0;">
            <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">
              Most active repositories this week
            </p>
          </td>
        </tr>
        ${m.topRepos
          .map(
            (r, i) => `
        <tr>
          <td style="padding:0 0 8px 0;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f8fafc;border:1px solid #e2e8f0;
                          border-radius:8px;padding:12px;">
              <tr>
                <td>
                  <span style="font-size:12px;color:#94a3b8;">#${i + 1}</span>
                  <a href="${esc(r.url)}"
                     style="display:block;font-size:14px;font-weight:600;
                            color:#2563eb;text-decoration:none;margin-top:2px;">
                    ${esc(r.name)}
                  </a>
                </td>
                <td align="right" valign="middle">
                  <p style="margin:0;font-size:14px;font-weight:600;color:#0f172a;">
                    ${r.commits}
                  </p>
                  <p style="margin:0;font-size:11px;color:#64748b;">commits</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
          )
          .join("")}
      </table>`
      : "";

  // ── No-metrics fallback ─────────────────────────────────────────────────────
  const noMetricsFallback = !m
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
        <tr>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
                     padding:20px;text-align:center;">
            <p style="margin:0;color:#64748b;font-size:14px;">
              Metrics are loading. Visit your
              <a href="${esc((process.env.NEXTAUTH_URL ?? "").replace(/\/$/, ""))}/dashboard"
                 style="color:#2563eb;">DevTrack dashboard</a>
              to see your full activity summary.
            </p>
          </td>
        </tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Your Weekly DevTrack Digest — ${weekLabel}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,
             BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center">

        <!-- Email card — max 600px, full width on mobile -->
        <table width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background:#ffffff;
                      border-radius:12px;overflow:hidden;
                      box-shadow:0 1px 3px rgba(0,0,0,.10);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);
                       padding:32px 40px;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:13px;font-weight:500;
                         color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;">
                DevTrack
              </p>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#f8fafc;">
                Weekly Coding Digest
              </h1>
              <p style="margin:8px 0 0 0;font-size:13px;color:#94a3b8;">${esc(weekLabel)}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 40px 20px 40px;">
              <p style="margin:0;font-size:16px;color:#374151;">
                Hey <strong>${esc(githubLogin)}</strong> 👋
              </p>
              <p style="margin:8px 0 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
                Here is your weekly snapshot of what you built and shipped.
                Keep the momentum going!
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;">
            </td>
          </tr>

          <!-- Content area -->
          <tr>
            <td style="padding:24px 40px 0 40px;">
              ${noMetricsFallback}
              ${streakHtml}
              ${activityHtml}
              ${languagesHtml}
              ${reposHtml}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 40px 32px 40px;text-align:center;">
              <a href="${esc((process.env.NEXTAUTH_URL ?? "").replace(/\/$/, ""))}/dashboard"
                 style="display:inline-block;background:#2563eb;color:#ffffff;
                        font-size:14px;font-weight:600;padding:12px 28px;
                        border-radius:8px;text-decoration:none;margin-top:8px;">
                Open Dashboard →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;
                       border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:12px;color:#94a3b8;">
                You are receiving this because you opted into the weekly digest in your
                <a href="${esc((process.env.NEXTAUTH_URL ?? "").replace(/\/$/, ""))}/settings"
                   style="color:#64748b;">DevTrack settings</a>.
              </p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                <a href="${esc(unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">
                  Unsubscribe from weekly digest
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Plain-text fallback ──────────────────────────────────────────────────────

export function buildDigestText(data: DigestEmailData): string {
  const { githubLogin, metrics: m, unsubscribeUrl, weekLabel } = data;

  const lines: string[] = [
    `DevTrack — Weekly Coding Digest`,
    `${weekLabel}`,
    ``,
    `Hey ${githubLogin}!`,
    ``,
  ];

  if (!m) {
    lines.push(
      `Visit your dashboard to see your full activity summary:`,
      `${(process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")}/dashboard`,
      ``
    );
  } else {
    if (m.streak.current > 0) {
      lines.push(
        `🔥 Current streak: ${pluralise(m.streak.current, "day")}`,
        `   Longest streak: ${pluralise(m.streak.longest, "day")}`,
        ``
      );
    }

    lines.push(
      `This week's activity`,
      `  Commits:    ${m.weeklyCommits}`,
      `  PRs merged: ${m.prsThisWeek}`,
      `  Active days: ${m.weeklyActiveDays}/7`,
      ``
    );

    if (m.topLanguages.length > 0) {
      lines.push(`Top languages:`);
      m.topLanguages.forEach((l) => {
        lines.push(`  ${l.name.padEnd(14)} ${l.percentage.toFixed(1)}%`);
      });
      lines.push(``);
    }

    if (m.topRepos.length > 0) {
      lines.push(`Most active repositories:`);
      m.topRepos.forEach((r, i) => {
        lines.push(`  ${i + 1}. ${r.name} — ${pluralise(r.commits, "commit")}`);
      });
      lines.push(``);
    }
  }

  lines.push(
    `Open your dashboard: ${(process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")}/dashboard`,
    ``,
    `──────────────────────────────────────────`,
    `To stop receiving these weekly emails, click the link below:`,
    unsubscribeUrl,
    ``
  );

  return lines.join("\n");
}
