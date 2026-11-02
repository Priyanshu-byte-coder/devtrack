/**
 * The README rank badge: an arcade-style SVG ("#1 GLOBAL · LEGEND · LV 54").
 *
 * Pure: data in, SVG string out. Drawing primitives are in pixel-badge.ts.
 */

import { pixelTextWidth, GLYPH_HEIGHT } from "./pixel-font";
import {
  DOWN,
  MUTED,
  UP,
  WHITE,
  frame,
  gem,
  sheen,
  text,
  wrap,
} from "./pixel-badge";
import { TIER_STYLE } from "./tier-palette";
import type { Tier } from "./scoring";
import type { RankMovement } from "./ranking";

export type BadgeBoard = "all" | "month" | "week";

export type RankBadgeData =
  | {
      state: "ranked";
      board: BadgeBoard;
      rank: number;
      total: number;
      tier: Tier;
      scoreV2: number;
      level: number | null;
      /** Progress to the next level, 0..1, when known. */
      levelProgress: number | null;
      movement: RankMovement;
    }
  | { state: "unranked" };

const BOARD_LABEL: Record<BadgeBoard, string> = {
  all: "GLOBAL",
  month: "SEASON",
  week: "THIS WEEK",
};

export function renderRankBadge(data: RankBadgeData): string {
  const H = 64;

  if (data.state === "unranked") {
    const line1 = "DEVTRACK";
    const line2 = "NOT RANKED YET";
    const textX = 64;
    const W =
      textX + Math.max(pixelTextWidth(line1, 2), pixelTextWidth(line2, 2)) + 18;
    const body =
      frame(W, H) +
      gem(18, 18, 4, "#4b5873", "#8a9bc0", false) +
      text(line1, textX, 18, 2, MUTED) +
      text(line2, textX, 18 + GLYPH_HEIGHT * 2 + 8, 2, WHITE);
    return wrap(W, H, "DevTrack: not ranked yet", body);
  }

  const style = TIER_STYLE[data.tier];
  const rankText = `#${data.rank}`;
  const boardText = BOARD_LABEL[data.board];
  const brand = "DEVTRACK";

  // Left: tier tile with a big gem.
  const tile = 64;
  const parts: string[] = [];
  parts.push(
    `<rect x="4" y="4" width="${tile - 4}" height="${H - 8}" fill="${style.fill}"/>`
  );
  parts.push(
    `<rect x="4" y="4" width="${tile - 4}" height="2" fill="#ffffff" opacity="0.35"/>`
  );
  parts.push(
    `<rect x="${tile - 2}" y="4" width="2" height="${H - 8}" fill="#000000" opacity="0.25"/>`
  );
  parts.push(
    gem(4 + (tile - 4 - 28) / 2, (H - 28) / 2, 4, style.text, style.gem, true)
  );

  // Middle: brand, then the big rank with its board.
  const midX = tile + 12;
  parts.push(text(brand, midX, 12, 2, MUTED));
  parts.push(text(rankText, midX, 30, 3, WHITE));
  let cursor = midX + pixelTextWidth(rankText, 3) + 8;
  parts.push(text(boardText, cursor, 37, 2, MUTED));
  cursor += pixelTextWidth(boardText, 2);

  const move = data.movement;
  if (move.kind === "up" || move.kind === "down") {
    const label = `${move.kind === "up" ? "^" : "v"}${move.places}`;
    cursor += 8;
    parts.push(text(label, cursor, 37, 2, move.kind === "up" ? UP : DOWN));
    cursor += pixelTextWidth(label, 2);
  } else if (move.kind === "new") {
    cursor += 8;
    parts.push(text("NEW", cursor, 37, 2, UP));
    cursor += pixelTextWidth("NEW", 2);
  }
  const midEnd = Math.max(cursor, midX + pixelTextWidth(brand, 2));

  // Right: tier name, level, XP bar.
  const rightX = midEnd + 18;
  const tierText = style.label.toUpperCase();
  const levelText = data.level ? `LV ${data.level}` : `${data.scoreV2}/1000`;
  const barW = Math.max(
    pixelTextWidth(tierText, 2),
    pixelTextWidth(levelText, 2),
    72
  );
  parts.push(text(tierText, rightX, 12, 2, style.accent));
  parts.push(text(levelText, rightX, 28, 2, WHITE));
  if (data.levelProgress !== null) {
    const fill = Math.max(
      2,
      Math.round(barW * Math.min(1, Math.max(0, data.levelProgress)))
    );
    parts.push(
      `<rect x="${rightX}" y="44" width="${barW}" height="8" fill="#000000"/>`
    );
    parts.push(
      `<rect x="${rightX + 1}" y="45" width="${barW - 2}" height="6" fill="#1a2440"/>`
    );
    parts.push(
      `<rect x="${rightX + 1}" y="45" width="${Math.max(0, fill - 2)}" height="6" fill="${style.accent}">` +
        `<animate attributeName="width" from="0" to="${Math.max(0, fill - 2)}" dur="1s" begin="0.2s" fill="freeze"/></rect>`
    );
  }

  const W = rightX + barW + 16;
  const body = frame(W, H) + parts.join("") + sheen(W, H);

  const where =
    data.board === "all"
      ? "globally"
      : data.board === "month"
        ? "this season"
        : "this week";
  const title = `DevTrack: #${data.rank} of ${data.total} ${where}, ${style.label} tier${data.level ? `, level ${data.level}` : ""}`;
  return wrap(W, H, title, body);
}
