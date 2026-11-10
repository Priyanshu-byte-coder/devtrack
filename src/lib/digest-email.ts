/**
 * Weekly digest email template builder.
 *
 * Produces an HTML version in DevTrack's light arcade style and a plain-text
 * fallback. Email clients are not browsers, so the HTML sticks to what they
 * all render:
 *   • Tables and inline styles only; no flexbox, grid or <style> rules.
 *   • Square corners and hard offset "pixel shadows" built from table cells
 *     (box-shadow and border-radius are dropped by several clients anyway).
 *   • Pixel display type (Press Start 2P, Silkscreen) where the client loads
 *     web fonts (Apple Mail, iOS); Gmail and Outlook fall back to bold
 *     monospace, which keeps the arcade feel.
 *   • Art (the header scene, tier gems, Bit) is static PNGs in public/email,
 *     drawn by scripts/generate-email-art.mjs. Every image has alt text and
 *     the layout reads fine with images blocked.
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

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}TH`;
  return `${n}${["TH", "ST", "ND", "RD"][n % 10] ?? "TH"}`;
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
const LINE = "#e3e9f4";
const BLUE = "#2563eb";
const BLUE_SOFT = "#dbe6fb";
const YELLOW = "#facc15";
const GREEN = "#16a34a";

const HEADLINE = "'Press Start 2P','Courier New',Courier,monospace";
const PIXEL = "'Silkscreen','Courier New',Courier,monospace";
const BODY =
  "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** A small uppercase pixel label. */
function label(text: string, colour = BLUE): string {
  return `<p style="margin:0 0 6px 0;font-family:${PIXEL};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${colour};">${text}</p>`;
}

/**
 * A square-cornered panel with a hard ink shadow on the right and bottom, the
 * site's pixel frame. An ink cell padded on two sides draws the shadow, since
 * box-shadow isn't safe in email.
 */
function pixelFrame(
  inner: string,
  background = CARD,
  border = `2px solid ${INK}`
): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="background:${INK};padding:0 4px 4px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="background:${background};border:${border};padding:0;">${inner}</td></tr>
    </table>
  </td></tr>
</table>`;
}

/** Seven squares, one per day, filled for the days with commits. */
function dayBlocks(activeDays: number): string {
  const cells = Array.from(
    { length: 7 },
    (_, i) =>
      `<td width="12" style="width:12px;height:12px;padding:0;background:${i < activeDays ? GREEN : LINE};border:1px solid ${i < activeDays ? INK : LINE};font-size:0;line-height:0;">&nbsp;</td><td width="3" style="width:3px;font-size:0;">&nbsp;</td>`
  ).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr>${cells}</tr></table>`;
}

/** One line of the hi-score screen: label left, score right. */
function scoreRow(
  name: string,
  value: string,
  extra = "",
  last = false
): string {
  const rule = last ? "" : `border-bottom:2px dotted ${BLUE_SOFT};`;
  return `<tr>
  <td style="padding:13px 0;${rule}font-family:${PIXEL};font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${INK};">${name}</td>
  <td align="right" style="padding:13px 0;${rule}">
    <span style="font-family:${HEADLINE};font-size:20px;font-weight:700;font-synthesis:none;line-height:1;color:${INK};">${value}</span>
    ${extra ? `<div style="padding-top:8px;">${extra}</div>` : ""}
  </td>
</tr>`;
}

/** Short pixel headline, then one plain line under it. */
function verdict(m: DigestMetrics | null): { title: string; line: string } {
  if (!m)
    return {
      title: "Your week is in.",
      line: "This week's numbers are still being counted. Your dashboard has the latest.",
    };
  const r = m.weeklyRank;
  if (m.weeklyCommits === 0 && m.prsThisWeek === 0)
    return {
      title: "Game paused.",
      line: "A quiet week. One commit starts the next run.",
    };
  if (r?.rank === 1)
    return {
      title: "Number one.",
      line: `Top of the weekly board out of ${r.players} players. Defend the title.`,
    };
  if (r && r.rank <= 3)
    return {
      title: `${ordinal(r.rank)} place.`,
      line: "On the weekly podium. The top spot is in reach.",
    };
  if (m.weeklyActiveDays >= 7)
    return {
      title: "Perfect week.",
      line: "Seven days out of seven. That's how high scores are built.",
    };
  if (m.streak.current >= 7)
    return {
      title: `${m.streak.current}-day run.`,
      line: "Your streak is alive. Keep it going this week.",
    };
  return {
    title: "Level complete.",
    line: `${pluralise(m.weeklyCommits, "commit")} shipped this week. Keep the run going.`,
  };
}

// ─── HTML template ────────────────────────────────────────────────────────────

export interface DigestEmailData {
  githubLogin: string;
  metrics: DigestMetrics | null;
  unsubscribeUrl: string;
  weekLabel: string; // e.g. "November 10, 2026"
  /** Where the art lives; defaults to this site's /email folder. */
  assetBase?: string;
}

export function buildDigestHtml(data: DigestEmailData): string {
  const { githubLogin, metrics: m, unsubscribeUrl, weekLabel } = data;
  const base = appUrl();
  const art = (data.assetBase ?? `${base}/email`).replace(/\/$/, "");
  const v = verdict(m);

  // Inbox preview line, hidden in the body.
  const preview = m
    ? `${pluralise(m.weeklyCommits, "commit")}, ${pluralise(m.prsThisWeek, "PR")} and a ${pluralise(m.streak.current, "day")} streak this week.`
    : "Your week on DevTrack.";

  // ── Hi-score screen ───────────────────────────────────────────────────────
  const scoresHtml = m
    ? `<tr><td style="padding:0 30px 22px 30px;">
  ${pixelFrame(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:16px 20px 10px 20px;border-bottom:2px dashed #c7d4ee;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="font-family:${PIXEL};font-size:14px;font-weight:700;letter-spacing:3px;color:${INK};">HI-SCORES</td>
          <td align="right" style="font-family:${PIXEL};font-size:11px;font-weight:700;letter-spacing:1.5px;color:${BLUE};text-transform:uppercase;">This week &middot; Live</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:2px 20px 4px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${scoreRow("Commits", m.weeklyCommits.toLocaleString("en-US"))}
          ${scoreRow("PRs merged", m.prsThisWeek.toLocaleString("en-US"))}
          ${scoreRow("Active days", `${m.weeklyActiveDays}/7`, dayBlocks(m.weeklyActiveDays))}
          ${scoreRow(
            "Streak",
            `${m.streak.current}<span style="font-size:11px;color:${MUTED};">&nbsp;${m.streak.current === 1 ? "DAY" : "DAYS"}</span>`,
            m.streak.longest !== null
              ? `<span style="font-family:${BODY};font-size:12px;color:${MUTED};">Longest streak: ${pluralise(m.streak.longest, "day")}</span>`
              : "",
            true
          )}
        </table>
      </td></tr>
    </table>`,
    CARD,
    `3px solid ${BLUE}`
  )}
</td></tr>`
    : `<tr><td style="padding:0 30px 22px 30px;">
  ${pixelFrame(
    `<p style="margin:0;padding:18px 20px;font-family:${BODY};font-size:14px;line-height:1.6;color:${MUTED};">This week's numbers aren't ready yet. Your <a href="${esc(base)}/dashboard" style="color:${BLUE};font-weight:600;">dashboard</a> always has the latest.</p>`
  )}
</td></tr>`;

  // ── Rank card ─────────────────────────────────────────────────────────────
  const rank = m?.weeklyRank;
  const tier = rank?.tier ? TIER_STYLE[rank.tier] : null;
  const topPct = rank
    ? Math.max(1, Math.ceil((rank.rank / Math.max(rank.players, 1)) * 100))
    : 0;
  const place = rank
    ? rank.rank <= 3
      ? `<span style="color:${YELLOW};">${ordinal(rank.rank)}</span>`
      : `#${rank.rank}`
    : "";
  const rankHtml = rank
    ? `<tr><td style="padding:0 30px 22px 30px;">
  ${pixelFrame(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      ${
        tier && rank.tier
          ? `<td width="76" valign="middle" style="width:76px;padding:16px 0 16px 18px;">
        <img src="${esc(art)}/gem-${rank.tier}.png" width="56" height="56" alt="${tier.label} gem" style="display:block;width:56px;height:56px;border:0;image-rendering:pixelated;">
      </td>`
          : ""
      }
      <td valign="middle" style="padding:16px 18px;">
        <p style="margin:0 0 6px 0;font-family:${PIXEL};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${YELLOW};white-space:nowrap;">Weekly rank</p>
        <p style="margin:0;font-family:${HEADLINE};font-size:24px;font-weight:700;font-synthesis:none;line-height:1.2;color:#ffffff;white-space:nowrap;">${place} <span style="font-family:${PIXEL};font-size:12px;letter-spacing:1px;color:#9fb0cc;">of ${rank.players}</span></p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;"><tr>
          <td style="background:${YELLOW};color:${INK};font-family:${BODY};font-size:12px;font-weight:800;letter-spacing:1px;padding:5px 8px;white-space:nowrap;">TOP ${topPct}%</td>
          ${tier ? `<td style="padding:0 0 0 10px;font-family:${PIXEL};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${tier.accent};white-space:nowrap;">${tier.label} tier</td>` : ""}
        </tr></table>
      </td>
    </tr></table>`,
    INK
  )}
</td></tr>`
    : "";

  // ── Languages: one stacked bar, GitHub style, with a key ──────────────────
  const langs = m?.topLanguages ?? [];
  const langTotal = langs.reduce((s, l) => s + l.percentage, 0) || 1;
  const languagesHtml =
    langs.length > 0
      ? `<tr><td style="padding:0 30px 22px 30px;">
  ${label("Languages")}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid ${INK};"><tr>
    ${langs
      .map((l) => {
        const w = Math.max(1, Math.round((l.percentage / langTotal) * 100));
        return `<td width="${w}%" style="width:${w}%;height:14px;background:${langColour(l.name)};font-size:0;line-height:0;">&nbsp;</td>`;
      })
      .join("")}
  </tr></table>
  <p style="margin:10px 0 0 0;font-family:${BODY};font-size:13px;line-height:1.9;color:${INK};">
    ${langs
      .map(
        (l) =>
          `<span style="white-space:nowrap;margin-right:14px;"><span style="display:inline-block;width:9px;height:9px;background:${langColour(l.name)};border:1px solid ${INK};"></span>&nbsp;${esc(l.name)} <span style="font-family:${BODY};font-size:12px;font-weight:600;color:${MUTED};">${Math.round(l.percentage)}%</span></span>`
      )
      .join(" ")}
  </p>
</td></tr>`
      : "";

  // ── Top repositories ──────────────────────────────────────────────────────
  const reposHtml =
    m && m.topRepos.length > 0
      ? `<tr><td style="padding:0 30px 22px 30px;">
  ${label("Most active repos")}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${m.topRepos
      .map(
        (r, i) => `<tr>
      <td width="34" style="width:34px;padding:7px 0;font-family:${PIXEL};font-size:13px;font-weight:700;color:${BLUE};">${i + 1}.</td>
      <td style="padding:7px 0;border-bottom:2px dotted ${BLUE_SOFT};font-family:${BODY};font-size:14px;"><a href="${esc(r.url)}" style="color:${INK};text-decoration:none;font-weight:600;">${esc(r.name)}</a></td>
      <td align="right" style="padding:7px 0;border-bottom:2px dotted ${BLUE_SOFT};font-family:${PIXEL};font-size:12px;font-weight:700;color:${MUTED};white-space:nowrap;">${pluralise(r.commits, "commit")}</td>
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
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Silkscreen:wght@400;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${PAPER};color-scheme:light;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PAPER};">${esc(preview)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:24px 12px 32px 12px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
          <tr><td>
            ${pixelFrame(
              `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

          <!-- Header art: Bit jumping for coins over a contribution-square level -->
          <tr>
            <td style="background:${PAPER};border-bottom:2px solid ${INK};padding:0;line-height:0;font-size:0;">
              <a href="${esc(base)}" style="display:block;text-decoration:none;">
                <img src="${esc(art)}/digest-header.png" width="596" alt="DevTrack weekly high score" style="display:block;width:100%;max-width:596px;height:auto;border:0;background:${PAPER};font-family:${PIXEL};font-size:16px;line-height:1.4;color:${INK};">
              </a>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:28px 30px 22px 30px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;"><tr>
                <td style="background:${INK};padding:5px 9px;font-family:${PIXEL};font-size:11px;font-weight:700;letter-spacing:2px;color:${YELLOW};">PLAYER 1</td>
                <td style="background:${BLUE_SOFT};padding:5px 9px;font-family:${PIXEL};font-size:11px;font-weight:700;letter-spacing:1px;color:${BLUE};">@${esc(githubLogin)}</td>
              </tr></table>
              <h1 style="margin:0;font-family:${HEADLINE};font-size:22px;font-weight:700;font-synthesis:none;line-height:1.4;text-transform:uppercase;color:${INK};">${esc(v.title)}</h1>
              <p style="margin:12px 0 0 0;font-family:${BODY};font-size:15px;line-height:1.6;color:${MUTED};">${esc(v.line)}</p>
              <p style="margin:10px 0 0 0;font-family:${PIXEL};font-size:11px;font-weight:700;letter-spacing:1.5px;color:#7a88a6;text-transform:uppercase;">Week of ${esc(weekLabel)}</p>
            </td>
          </tr>

          ${scoresHtml}
          ${rankHtml}
          ${languagesHtml}
          ${reposHtml}

          <!-- Press start -->
          <tr>
            <td align="center" style="padding:6px 30px 30px 30px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td>
                ${pixelFrame(
                  `<a href="${esc(base)}/dashboard" style="display:block;padding:14px 30px;font-family:${PIXEL};font-size:15px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#ffffff;text-decoration:none;">&#9658;&nbsp;Press start</a>`,
                  BLUE
                )}
              </td></tr></table>
              <p style="margin:16px 0 0 0;font-family:${BODY};font-size:13px;color:${MUTED};">
                <a href="${esc(base)}/leaderboard" style="color:${BLUE};font-weight:600;text-decoration:none;">See the leaderboard</a>
                &nbsp;&middot;&nbsp;
                <a href="${esc(base)}/u/${encodeURIComponent(githubLogin)}" style="color:${BLUE};font-weight:600;text-decoration:none;">Your profile</a>
              </p>
            </td>
          </tr>

          <!-- Sign-off: Bit with a speech bubble -->
          <tr>
            <td style="border-top:2px solid ${INK};background:${PAPER};padding:20px 30px 22px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="46" valign="bottom" style="width:46px;padding:0 12px 0 0;">
                  <img src="${esc(art)}/bit-talk.png" width="36" height="48" alt="Bit" style="display:block;width:36px;height:48px;border:0;image-rendering:pixelated;">
                </td>
                <td valign="middle">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td style="background:${CARD};border:2px solid ${INK};padding:9px 12px;font-family:${PIXEL};font-size:12px;font-weight:700;letter-spacing:1px;color:${INK};text-transform:uppercase;">See you next Monday, player.</td>
                  </tr></table>
                </td>
              </tr></table>
              <p style="margin:16px 0 4px 0;font-family:${BODY};font-size:12px;line-height:1.6;color:${MUTED};">
                You get this every Monday because the weekly digest is on in your
                <a href="${esc(base)}/dashboard/settings" style="color:${MUTED};">DevTrack settings</a>.
                <a href="${esc(unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>
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
  const v = verdict(m);

  const lines: string[] = [
    `DEVTRACK · WEEKLY HIGH SCORE`,
    `Week of ${weekLabel}`,
    ``,
    `Player 1: @${githubLogin}`,
    `${v.title.toUpperCase()} ${v.line}`,
    ``,
  ];

  if (m) {
    lines.push(
      `HI-SCORES`,
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

    if (m.weeklyRank) {
      const tier = m.weeklyRank.tier
        ? ` · ${TIER_STYLE[m.weeklyRank.tier].label}`
        : "";
      lines.push(
        `Weekly rank: #${m.weeklyRank.rank} of ${m.weeklyRank.players}${tier}`,
        ``
      );
    }

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
    `See you next Monday, player.`,
    `You get this every Monday because the weekly digest is on.`,
    `Unsubscribe: ${unsubscribeUrl}`,
    ``
  );

  return lines.join("\n");
}
