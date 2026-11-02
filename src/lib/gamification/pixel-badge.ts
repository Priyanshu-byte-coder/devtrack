/**
 * Shared pieces of the arcade README badges (rank, streak, commits): the
 * bevelled panel, pixel text, the gem, a one-off sheen and the SVG wrapper.
 *
 * Text is drawn with the pixel font as shapes, because GitHub serves README
 * images through its proxy where web fonts can't load. Animation uses SMIL,
 * which survives that proxy; every animation is finite and ends on the
 * correct frame, so renderers that skip animation see the right badge.
 */

import { pixelTextPath } from "./pixel-font";

export const BADGE_HEIGHT = 64;

export const BG = "#0b1020";
export const PANEL_EDGE = "#000000";
export const BEVEL_LIGHT = "#2b3a5c";
export const BEVEL_DARK = "#05070f";
export const MUTED = "#8a9bc0";
export const WHITE = "#f5f7fb";
export const UP = "#4ade80";
export const DOWN = "#fb7185";

const GEM = [
  "..XXX..",
  ".XHHXX.",
  "XHHXXXX",
  "XXXXXXX",
  ".XXXXX.",
  "..XXX..",
  "...X...",
];

export function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function gem(
  x: number,
  y: number,
  px: number,
  body: string,
  shine: string,
  sparkle: boolean
): string {
  let bodyPath = "";
  let shinePath = "";
  GEM.forEach((row, ry) =>
    [...row].forEach((c, rx) => {
      if (c === ".") return;
      const seg = `M${x + rx * px} ${y + ry * px}h${px}v${px}h${-px}z`;
      if (c === "H") shinePath += seg;
      else bodyPath += seg;
    })
  );
  const twinkle = sparkle
    ? `<animate attributeName="opacity" values="1;0.25;1" dur="1.2s" begin="0.8s" repeatCount="3"/>`
    : "";
  return `<path d="${bodyPath}" fill="${body}"/><path d="${shinePath}" fill="${shine}">${twinkle}</path>`;
}

export function text(
  t: string,
  x: number,
  y: number,
  scale: number,
  fill: string
): string {
  return `<path d="${pixelTextPath(t, x, y, scale)}" fill="${fill}"/>`;
}

/** Bevelled pixel panel: dark outline, light top-left edge, dark bottom-right edge. */
export function frame(w: number, h: number): string {
  return [
    `<rect x="0" y="0" width="${w}" height="${h}" fill="${PANEL_EDGE}"/>`,
    `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" fill="${BG}"/>`,
    `<rect x="2" y="2" width="${w - 4}" height="2" fill="${BEVEL_LIGHT}"/>`,
    `<rect x="2" y="2" width="2" height="${h - 4}" fill="${BEVEL_LIGHT}"/>`,
    `<rect x="2" y="${h - 4}" width="${w - 4}" height="2" fill="${BEVEL_DARK}"/>`,
    `<rect x="${w - 4}" y="2" width="2" height="${h - 4}" fill="${BEVEL_DARK}"/>`,
  ].join("");
}

/** One bright diagonal sheen that sweeps across twice, then rests off-panel. */
export function sheen(w: number, h: number): string {
  return (
    `<g clip-path="url(#panel)"><rect x="-60" y="0" width="22" height="${h}" fill="#ffffff" opacity="0.07" transform="skewX(-20)">` +
    `<animate attributeName="x" from="-60" to="${w + 40}" dur="1.4s" begin="0.3s" repeatCount="2" fill="freeze"/>` +
    `</rect></g>`
  );
}

export function wrap(
  w: number,
  h: number,
  title: string,
  body: string
): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ` +
    `role="img" aria-label="${escapeXml(title)}" shape-rendering="crispEdges">` +
    `<title>${escapeXml(title)}</title>` +
    `<defs><clipPath id="panel"><rect x="4" y="4" width="${w - 8}" height="${h - 8}"/></clipPath></defs>` +
    body +
    `</svg>`
  );
}
