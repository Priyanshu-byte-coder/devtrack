/**
 * Arcade README badges for the streak and monthly commits, in the same frame
 * and pixel font as the rank badge so a README row of them reads as one set.
 *
 * Pure: data in, SVG string out.
 */

import { pixelTextWidth } from "./pixel-font";
import {
  BADGE_HEIGHT as H,
  MUTED,
  WHITE,
  frame,
  sheen,
  text,
  wrap,
} from "./pixel-badge";

const fmt = new Intl.NumberFormat("en-US");

const TILE = 64;
const EMBER = "#ff7a1a";
const FLAME_MID = "#ffd166";
const FLAME_CORE = "#fff4c2";
const COLD = "#4b5873";
const COLD_LIGHT = "#8a9bc0";
const COMMIT_BLUE = "#6ba8ff";

/** Coloured left tile, with the same highlight and shadow as the rank badge's. */
function tile(fill: string): string {
  return (
    `<rect x="4" y="4" width="${TILE - 4}" height="${H - 8}" fill="${fill}"/>` +
    `<rect x="4" y="4" width="${TILE - 4}" height="2" fill="#ffffff" opacity="0.2"/>` +
    `<rect x="${TILE - 2}" y="4" width="2" height="${H - 8}" fill="#000000" opacity="0.25"/>`
  );
}

/** Two-line message badge for states with no number to show. */
function messageBadge(
  icon: string,
  tileFill: string,
  line1: string,
  line2: string,
  title: string
): string {
  const x = TILE + 12;
  const W =
    x + Math.max(pixelTextWidth(line1, 2), pixelTextWidth(line2, 2)) + 18;
  const body =
    frame(W, H) +
    tile(tileFill) +
    icon +
    text(line1, x, 18, 2, MUTED) +
    text(line2, x, 36, 2, WHITE);
  return wrap(W, H, title, body);
}

// ── Streak ──────────────────────────────────────────────────────────────

const FLAME = [
  "...O...",
  "...OO..",
  "..OOO..",
  ".OOYOO.",
  ".OYYOO.",
  "OOYYYOO",
  "OYYWYYO",
  "OYWWWYO",
  ".OYYYO.",
];

function flame(lit: boolean): string {
  const px = 4;
  const x0 = 4 + (TILE - 4 - 7 * px) / 2;
  const y0 = (H - FLAME.length * px) / 2;
  const paths: Record<string, string> = { O: "", Y: "", W: "" };
  FLAME.forEach((row, ry) =>
    [...row].forEach((c, rx) => {
      if (c !== ".")
        paths[c] += `M${x0 + rx * px} ${y0 + ry * px}h${px}v${px}h${-px}z`;
    })
  );
  if (!lit) {
    return (
      `<path d="${paths.O}" fill="${COLD}"/>` +
      `<path d="${paths.Y}${paths.W}" fill="${COLD_LIGHT}"/>`
    );
  }
  // The inner flame flickers a few times, then settles fully lit.
  return (
    `<path d="${paths.O}" fill="${EMBER}"/>` +
    `<path d="${paths.Y}" fill="${FLAME_MID}">` +
    `<animate attributeName="opacity" values="1;0.55;1;0.8;1" dur="0.6s" begin="0.2s" repeatCount="4"/></path>` +
    `<path d="${paths.W}" fill="${FLAME_CORE}"/>`
  );
}

export type StreakBadgeData =
  | {
      state: "ok";
      current: number;
      longest: number;
      /** The counts are lower bounds (GitHub search capped the history). */
      lowerBound: boolean;
      /** The last seven days, oldest first: was there a contribution? */
      lastWeek: boolean[];
    }
  | { state: "syncing" }
  | { state: "error" };

/** The seven days ending today, oldest first, as YYYY-MM-DD. */
export function lastSevenDays(today: string): string[] {
  const end = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, i) =>
    new Date(end - (6 - i) * 86_400_000).toISOString().slice(0, 10)
  );
}

export function renderStreakBadge(data: StreakBadgeData): string {
  if (data.state === "syncing") {
    return messageBadge(
      flame(false),
      "#1a2440",
      "DEVTRACK",
      "STREAK SYNCING",
      "DevTrack streak: syncing"
    );
  }
  if (data.state === "error") {
    return messageBadge(
      flame(false),
      "#1a2440",
      "DEVTRACK",
      "STREAK UNAVAILABLE",
      "DevTrack streak: unavailable"
    );
  }

  const lit = data.current > 0;
  const plus = data.lowerBound ? "+" : "";
  const count = `${fmt.format(data.current)}${plus}`;
  const unit = "DAY STREAK";
  const parts: string[] = [tile(lit ? "#5c1d06" : "#1a2440"), flame(lit)];

  const midX = TILE + 12;
  parts.push(text("DEVTRACK", midX, 12, 2, MUTED));
  parts.push(text(count, midX, 30, 3, lit ? WHITE : COLD_LIGHT));
  const unitX = midX + pixelTextWidth(count, 3) + 8;
  parts.push(text(unit, unitX, 37, 2, MUTED));
  const midEnd = Math.max(
    unitX + pixelTextWidth(unit, 2),
    midX + pixelTextWidth("DEVTRACK", 2)
  );

  // Right: personal best, and the last week as seven cells.
  const rightX = midEnd + 18;
  const best = `${fmt.format(data.longest)}D${plus}`;
  parts.push(text("BEST", rightX, 12, 2, MUTED));
  parts.push(text(best, rightX, 28, 2, WHITE));
  const cell = 8;
  const gap = 2;
  const week = data.lastWeek.slice(-7);
  week.forEach((on, i) => {
    const x = rightX + i * (cell + gap);
    const fill = on ? EMBER : "#1a2440";
    parts.push(
      `<rect x="${x}" y="44" width="${cell}" height="${cell}" fill="#000000"/>` +
        `<rect x="${x + 1}" y="45" width="${cell - 2}" height="${cell - 2}" fill="${fill}"` +
        (on
          ? `><animate attributeName="opacity" from="0" to="1" dur="0.2s" begin="${(0.3 + i * 0.08).toFixed(2)}s" fill="freeze"/></rect>`
          : `/>`)
    );
  });
  const rightW = Math.max(
    pixelTextWidth("BEST", 2),
    pixelTextWidth(best, 2),
    week.length * (cell + gap) - gap
  );

  const W = rightX + rightW + 16;
  const body = frame(W, H) + parts.join("") + (lit ? sheen(W, H) : "");
  const days = (n: number) =>
    `${fmt.format(n)}${plus} day${n === 1 ? "" : "s"}`;
  const title = `DevTrack: ${fmt.format(data.current)}${plus}-day streak, best ${days(data.longest)}`;
  return wrap(W, H, title, body);
}

// ── Monthly commits ─────────────────────────────────────────────────────

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/** Four pixel bars that grow in from the bottom, one after another. */
function bars(): string {
  const px = 4;
  const heights = [2, 4, 6, 7];
  const x0 = 4 + (TILE - 4 - 7 * px) / 2;
  const bottom = (H + 7 * px) / 2;
  return heights
    .map((h, i) => {
      const x = x0 + i * 2 * px;
      const height = h * px;
      const y = bottom - height;
      const begin = (0.2 + i * 0.12).toFixed(2);
      return (
        `<rect x="${x}" y="${y}" width="${px}" height="${height}" fill="${i === 3 ? "#e3ebff" : COMMIT_BLUE}">` +
        `<animate attributeName="height" from="0" to="${height}" dur="0.35s" begin="${begin}s" fill="freeze"/>` +
        `<animate attributeName="y" from="${bottom}" to="${y}" dur="0.35s" begin="${begin}s" fill="freeze"/>` +
        `</rect>`
      );
    })
    .join("");
}

export type CommitsBadgeData =
  | {
      state: "ok";
      commits: number;
      /** Month the count covers: 0-based month and full year. */
      month: number;
      year: number;
      /** How far through the month we are, 0..1, drawn as a bar. */
      monthProgress: number;
    }
  | { state: "error" };

export function renderCommitsBadge(data: CommitsBadgeData): string {
  if (data.state === "error") {
    return messageBadge(
      bars(),
      "#10224a",
      "DEVTRACK",
      "COMMITS UNAVAILABLE",
      "DevTrack commits: unavailable"
    );
  }

  const parts: string[] = [tile("#10224a"), bars()];
  const midX = TILE + 12;
  const count = fmt.format(data.commits);
  const unit = data.commits === 1 ? "COMMIT" : "COMMITS";
  parts.push(text("DEVTRACK", midX, 12, 2, MUTED));
  parts.push(text(count, midX, 30, 3, WHITE));
  const unitX = midX + pixelTextWidth(count, 3) + 8;
  parts.push(text(unit, unitX, 37, 2, MUTED));
  const midEnd = Math.max(
    unitX + pixelTextWidth(unit, 2),
    midX + pixelTextWidth("DEVTRACK", 2)
  );

  const rightX = midEnd + 18;
  const monthText = `${MONTHS[data.month] ?? "???"} ${data.year}`;
  parts.push(text("THIS MONTH", rightX, 12, 2, MUTED));
  parts.push(text(monthText, rightX, 28, 2, COMMIT_BLUE));
  const rightW = Math.max(
    pixelTextWidth("THIS MONTH", 2),
    pixelTextWidth(monthText, 2)
  );
  const fill = Math.max(
    2,
    Math.round(rightW * Math.min(1, Math.max(0, data.monthProgress)))
  );
  parts.push(
    `<rect x="${rightX}" y="44" width="${rightW}" height="8" fill="#000000"/>` +
      `<rect x="${rightX + 1}" y="45" width="${rightW - 2}" height="6" fill="#1a2440"/>` +
      `<rect x="${rightX + 1}" y="45" width="${Math.max(0, fill - 2)}" height="6" fill="${COMMIT_BLUE}">` +
      `<animate attributeName="width" from="0" to="${Math.max(0, fill - 2)}" dur="1s" begin="0.2s" fill="freeze"/></rect>`
  );

  const W = rightX + rightW + 16;
  const body = frame(W, H) + parts.join("") + sheen(W, H);
  const title = `DevTrack: ${count} ${unit.toLowerCase()} in ${monthText.charAt(0)}${monthText.slice(1, 3).toLowerCase()} ${data.year}`;
  return wrap(W, H, title, body);
}
