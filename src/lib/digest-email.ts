/**
 * Weekly digest email template builder.
 *
 * Produces an HTML version in DevTrack's light arcade style and a plain-text
 * fallback. Email clients are not browsers, so the HTML sticks to what they
 * all render:
 *   • Tables and inline styles only; no flexbox, grid or <style> rules.
 *   • Square corners and hard offset "pixel shadows" built from table cells
 *     (box-shadow and border-radius are dropped by several clients anyway).
 *   • Silkscreen for display text where the client loads web fonts (Apple
 *     Mail, iOS); Gmail and Outlook fall back to bold monospace.
 *   • No images, so nothing waits on "load images" and nothing breaks.
 *   • Light theme only: `color-scheme: light` asks dark-mode clients not to
 *     invert it.
 * Every section is skipped when its data is missing, so a user without
 * metrics still gets a sensible email.
 */

import type { DigestMetrics } from "@/lib/weekly-digest";
import { TIER_STYLE } from "@/lib/gamification/tier-palette";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pluralise(
  n: number,
  singular: string,
  plural = `${singular}s`
): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

function appUrl(): string {
  return (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
}

// Language colours, as GitHub shows them.
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

// ─── Brand ────────────────────────────────────────────────────────────────────

// The light arcade palette from the brand kit.
const PAPER = "#f6f8fc";
const CARD = "#ffffff";
const INK = "#0b1220";
const MUTED = "#4b5875";
const LINE = "#dbe3f0";
const BLUE = "#2563eb";
const YELLOW = "#facc15";
const GREEN = "#16a34a";

const PIXEL = "'Silkscreen','Courier New',Courier,monospace";
const BODY =
  "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** A small uppercase pixel label. */
function label(text: string, colour = BLUE): string {
  return `<p style="margin:0 0 6px 0;font-family:${PIXEL};font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${colour};">${text}</p>`;
}

/**
 * A square-cornered panel with a hard ink shadow on the right and bottom, the
 * site's pixel frame. An ink cell padded on two sides draws the shadow, since
 * box-shadow isn't safe in email.
 */
function pixelFrame(inner: string, background = CARD): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="background:${INK};padding:0 4px 4px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="background:${background};border:2px solid ${INK};padding:0;">${inner}</td></tr>
    </table>
  </td></tr>
</table>`;
}

/** One stat tile: pixel label over a big pixel number. */
function statTile(name: string, value: string, extra = ""): string {
  return `<td width="50%" valign="top" style="width:50%;padding:6px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="background:${CARD};border:2px solid ${INK};padding:14px 16px;">
      ${label(name)}
      <p style="margin:0;font-family:${PIXEL};font-size:30px;font-weight:700;line-height:1.1;color:${INK};">${value}</p>
      ${extra}
    </td></tr>
  </table>
</td>`;
}

/** Seven squares, one per day, filled for the days with commits. */
function dayBlocks(activeDays: number): string {
  const cells = Array.from(
    { length: 7 },
    (_, i) =>
      `<td width="14" style="width:14px;height:14px;padding:0;background:${i < activeDays ? GREEN : LINE};border:1px solid ${i < activeDays ? INK : LINE};font-size:0;line-height:0;">&nbsp;</td><td width="3" style="width:3px;font-size:0;">&nbsp;</td>`
  ).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;"><tr>${cells}</tr></table>`;
}

/** Short, specific line under the headline. */
function verdict(m: DigestMetrics | null): string {
  if (!m)
    return "Your stats are being counted. Open your dashboard for the full picture.";
  if (m.weeklyCommits === 0 && m.prsThisWeek === 0)
    return "A quiet week. One commit starts the next streak.";
  if (m.weeklyRank?.rank === 1)
    return "Number one on this week's leaderboard. Defend the title.";
  if (m.weeklyRank && m.weeklyRank.rank <= 3)
    return `#${m.weeklyRank.rank} on this week's leaderboard. The top spot is in reach.`;
  if (m.weeklyActiveDays >= 7)
    return "Seven days out of seven. A perfect week.";
  if (m.streak.current >= 7)
    return `${pluralise(m.streak.current, "day")} in a row and counting.`;
  return `${pluralise(m.weeklyCommits, "commit")} shipped this week. Keep the run going.`;
}

// ─── HTML template ────────────────────────────────────────────────────────────

export interface DigestEmailData {
  githubLogin: string;
  metrics: DigestMetrics | null;
  unsubscribeUrl: string;
  weekLabel: string; // e.g. "November 10, 2026"
}

export function buildDigestHtml(data: DigestEmailData): string {
  const { githubLogin, metrics: m, unsubscribeUrl, weekLabel } = data;
  const base = appUrl();

  // Inbox preview line, hidden in the body.
  const preview = m
    ? `${pluralise(m.weeklyCommits, "commit")}, ${pluralise(m.prsThisWeek, "PR")} and a ${pluralise(m.streak.current, "day")} streak this week.`
    : "Your week on DevTrack.";

  // ── Rank strip ────────────────────────────────────────────────────────────
  const rank = m?.weeklyRank;
  const tier = rank?.tier ? TIER_STYLE[rank.tier] : null;
  const rankHtml = rank
    ? `<tr><td style="padding:0 34px 18px 34px;">
  ${pixelFrame(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td valign="middle" style="padding:14px 18px;">
        ${label("Weekly rank", YELLOW)}
        <p style="margin:0;font-family:${PIXEL};font-size:34px;font-weight:700;line-height:1;color:#ffffff;">#${rank.rank} <span style="font-size:14px;color:#9fb0cc;">/ ${rank.players}</span></p>
      </td>
      ${
        tier
          ? `<td align="right" valign="middle" style="padding:14px 18px;">
        <span style="display:inline-block;background:${tier.fill};color:${tier.text};font-family:${PIXEL};font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:8px 12px;border:2px solid #ffffff;">${tier.label}</span>
      </td>`
          : ""
      }
    </tr></table>`,
    INK
  )}
</td></tr>`
    : "";

  // ── Stat tiles ────────────────────────────────────────────────────────────
  const statsHtml = m
    ? `<tr><td style="padding:0 28px 12px 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      ${statTile("Commits", m.weeklyCommits.toLocaleString("en-US"))}
      ${statTile("PRs merged", m.prsThisWeek.toLocaleString("en-US"))}
    </tr>
    <tr>
      ${statTile("Active days", `${m.weeklyActiveDays}<span style="font-size:16px;color:${MUTED};">/7</span>`, dayBlocks(m.weeklyActiveDays))}
      ${statTile(
        "Streak",
        `${m.streak.current}<span style="font-size:16px;color:${MUTED};"> ${m.streak.current === 1 ? "day" : "days"}</span>`,
        // Same height as the day squares beside it.
        `<p style="margin:8px 0 0 0;font-family:${BODY};font-size:12px;line-height:16px;color:${MUTED};">${
          m.streak.longest !== null
            ? `Longest streak: ${pluralise(m.streak.longest, "day")}`
            : m.streak.current > 0
              ? "Commit today to keep it alive."
              : "One commit starts a new one."
        }</p>`
      )}
    </tr>
  </table>
</td></tr>`
    : `<tr><td style="padding:0 34px 18px 34px;">
  ${pixelFrame(
    `<p style="margin:0;padding:18px 20px;font-family:${BODY};font-size:14px;line-height:1.6;color:${MUTED};">This week's numbers aren't ready yet. Your <a href="${esc(base)}/dashboard" style="color:${BLUE};font-weight:600;">dashboard</a> always has the latest.</p>`
  )}
</td></tr>`;

  // ── Languages ─────────────────────────────────────────────────────────────
  const languagesHtml =
    m && m.topLanguages.length > 0
      ? `<tr><td style="padding:12px 34px 8px 34px;">
  ${label("Languages")}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${m.topLanguages
      .map((l) => {
        const pct = Math.max(2, Math.min(100, Math.round(l.percentage)));
        return `<tr>
      <td width="34%" style="width:34%;padding:5px 10px 5px 0;font-family:${BODY};font-size:13px;color:${INK};white-space:nowrap;">${esc(l.name)}</td>
      <td style="padding:5px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid ${INK};"><tr>
          <td width="${pct}%" style="width:${pct}%;height:10px;background:${langColour(l.name)};font-size:0;line-height:0;">&nbsp;</td>
          <td style="height:10px;background:${CARD};font-size:0;line-height:0;">&nbsp;</td>
        </tr></table>
      </td>
      <td width="44" align="right" style="width:44px;padding:5px 0 5px 10px;font-family:${PIXEL};font-size:12px;font-weight:700;color:${MUTED};">${Math.round(l.percentage)}%</td>
    </tr>`;
      })
      .join("")}
  </table>
</td></tr>`
      : "";

  // ── Top repositories ──────────────────────────────────────────────────────
  const reposHtml =
    m && m.topRepos.length > 0
      ? `<tr><td style="padding:12px 34px 8px 34px;">
  ${label("Most active repos")}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${m.topRepos
      .map(
        (r, i) => `<tr>
      <td width="34" style="width:34px;padding:6px 0;font-family:${PIXEL};font-size:13px;font-weight:700;color:${BLUE};">${i + 1}.</td>
      <td style="padding:6px 0;border-bottom:1px solid ${LINE};font-family:${BODY};font-size:14px;"><a href="${esc(r.url)}" style="color:${INK};text-decoration:none;font-weight:600;">${esc(r.name)}</a></td>
      <td align="right" style="padding:6px 0;border-bottom:1px solid ${LINE};font-family:${PIXEL};font-size:12px;font-weight:700;color:${MUTED};white-space:nowrap;">${pluralise(r.commits, "commit")}</td>
    </tr>`
      )
      .join("")}
  </table>
</td></tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Your week on DevTrack, ${esc(weekLabel)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${PAPER};color-scheme:light;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PAPER};">${esc(preview)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:28px 12px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
          <tr><td>
            ${pixelFrame(
              `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

          <!-- Marquee -->
          <tr>
            <td style="background:${INK};padding:14px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="font-family:${PIXEL};font-size:16px;font-weight:700;letter-spacing:3px;color:#ffffff;"><span style="color:#6ba8ff;">&#9650;</span>&nbsp;DEVTRACK</td>
                <td align="right" style="font-family:${PIXEL};font-size:11px;font-weight:700;letter-spacing:2px;color:${YELLOW};text-transform:uppercase;">Weekly digest</td>
              </tr></table>
            </td>
          </tr>
          <tr><td style="background:${BLUE};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>

          <!-- Headline -->
          <tr>
            <td style="padding:30px 34px 20px 34px;">
              ${label(`Player @${esc(githubLogin)}`)}
              <h1 style="margin:0;font-family:${PIXEL};font-size:30px;font-weight:700;line-height:1.15;letter-spacing:1px;text-transform:uppercase;color:${INK};">Your week<br><span style="color:${BLUE};">in code.</span></h1>
              <p style="margin:12px 0 0 0;font-family:${BODY};font-size:15px;line-height:1.55;color:${MUTED};">${esc(verdict(m))}</p>
              <p style="margin:6px 0 0 0;font-family:${PIXEL};font-size:11px;letter-spacing:1px;color:${MUTED};text-transform:uppercase;">Week of ${esc(weekLabel)}</p>
            </td>
          </tr>

          ${rankHtml}
          ${statsHtml}
          ${languagesHtml}
          ${reposHtml}

          <!-- Press start -->
          <tr>
            <td align="center" style="padding:22px 34px 30px 34px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td>
                ${pixelFrame(
                  `<a href="${esc(base)}/dashboard" style="display:block;padding:13px 28px;font-family:${PIXEL};font-size:15px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#ffffff;text-decoration:none;">&#9658;&nbsp;Press start</a>`,
                  BLUE
                )}
              </td></tr></table>
              <p style="margin:14px 0 0 0;font-family:${BODY};font-size:13px;color:${MUTED};">
                <a href="${esc(base)}/leaderboard" style="color:${BLUE};font-weight:600;text-decoration:none;">See the leaderboard</a>
                &nbsp;&middot;&nbsp;
                <a href="${esc(base)}/u/${encodeURIComponent(githubLogin)}" style="color:${BLUE};font-weight:600;text-decoration:none;">Your profile</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:2px solid ${INK};background:${PAPER};padding:18px 34px;">
              <p style="margin:0 0 6px 0;font-family:${BODY};font-size:12px;line-height:1.6;color:${MUTED};">
                You get this every Monday because the weekly digest is on in your
                <a href="${esc(base)}/dashboard/settings" style="color:${MUTED};">DevTrack settings</a>.
              </p>
              <p style="margin:0;font-family:${BODY};font-size:12px;color:${MUTED};">
                <a href="${esc(unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe from the weekly digest</a>
              </p>
            </td>
          </tr>

              </table>`
            )}
          </td></tr>
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
  const base = appUrl();

  const lines: string[] = [
    `DEVTRACK · WEEKLY DIGEST`,
    `Week of ${weekLabel}`,
    ``,
    `Player @${githubLogin}`,
    verdict(m),
    ``,
  ];

  if (m) {
    if (m.weeklyRank) {
      const tier = m.weeklyRank.tier
        ? ` · ${TIER_STYLE[m.weeklyRank.tier].label}`
        : "";
      lines.push(
        `Weekly rank: #${m.weeklyRank.rank} of ${m.weeklyRank.players}${tier}`,
        ``
      );
    }

    lines.push(
      `This week`,
      `  Commits:      ${m.weeklyCommits}`,
      `  PRs merged:   ${m.prsThisWeek}`,
      `  Active days:  ${m.weeklyActiveDays}/7`
    );
    if (m.streak.current > 0) {
      lines.push(`  Current streak: ${pluralise(m.streak.current, "day")}`);
      if (m.streak.longest !== null)
        lines.push(`  Longest streak: ${pluralise(m.streak.longest, "day")}`);
    }
    lines.push(``);

    if (m.topLanguages.length > 0) {
      lines.push(`Languages`);
      m.topLanguages.forEach((l) => {
        lines.push(`  ${l.name.padEnd(14)} ${Math.round(l.percentage)}%`);
      });
      lines.push(``);
    }

    if (m.topRepos.length > 0) {
      lines.push(`Most active repos`);
      m.topRepos.forEach((r, i) => {
        lines.push(`  ${i + 1}. ${r.name} (${pluralise(r.commits, "commit")})`);
      });
      lines.push(``);
    }
  }

  lines.push(
    `Press start: ${base}/dashboard`,
    `Leaderboard: ${base}/leaderboard`,
    ``,
    `You get this every Monday because the weekly digest is on.`,
    `Unsubscribe: ${unsubscribeUrl}`,
    ``
  );

  return lines.join("\n");
}
