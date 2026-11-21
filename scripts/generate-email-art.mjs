/**
 * Draws the pixel art used in the weekly digest email and writes it to
 * public/email/. Email clients can't render CSS art, so it ships as PNGs,
 * served from the CDN like any other static file.
 *
 *   node scripts/generate-email-art.mjs
 *
 * Needs Playwright's Chromium (already a dev dependency) and network access
 * for the Silkscreen font. Re-run after changing Bit or the palette, then
 * commit the PNGs.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "email"
);
mkdirSync(OUT, { recursive: true });

// Bit, 12x16, from the brand kit sprites. "." is transparent.
const PALETTE = {
  a: "#141a2e", // outline
  b: "#22c55e", // cap
  c: "#15803d", // cap shade
  d: "#f6c79f", // skin
  e: "#d99a6c", // nose
  f: "#3b82f6", // hoodie
  g: "#facc15", // zip
  h: "#1d4ed8", // hoodie shade
  i: "#334155", // trousers
  j: "#e2e8f0", // sneakers
};
const BIT = {
  jump: [
    "...aaaaa....",
    "..abbbbba...",
    ".abbbbbbba..",
    ".accccaaaaaa",
    ".addddddda..",
    ".adadddada..",
    ".addddddda..",
    "..adaaada...",
    "d.afffffa.d.",
    "aafffgffhaa.",
    ".afffgffha..",
    ".affffffha..",
    ".aiiiiiia...",
    "aiia..aiia..",
    "ajja...ajja.",
    "aaa.....aaa.",
  ],
  talk: [
    "...aaaaa....",
    "..abbbbba...",
    ".abbbbbbba..",
    ".accccaaaaaa",
    ".addddddda..",
    ".adadddada..",
    ".addddddda..",
    "..adaaada...",
    "..afffffa...",
    ".afffgffha..",
    "adfffgffhda.",
    "aaffffffhaa.",
    ".aiiiaiiia..",
    ".aiia.aiia..",
    ".ajja.ajja..",
    ".aaaa.aaaa..",
  ],
};

/** A sprite as absolutely positioned squares; crisp at any scale. */
function sprite(rows, cell, x, y) {
  let html = "";
  rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch !== ".")
        html += `<i style="left:${x + c * cell}px;top:${y + r * cell}px;width:${cell}px;height:${cell}px;background:${PALETTE[ch]}"></i>`;
    })
  );
  return html;
}

/** A pixel coin: yellow disc with a highlight, ink outline. */
function coin(x, y, s = 4) {
  const m = [".aaaa.", "aggwga", "agwgga", "agwgga", "agggga", ".aaaa."];
  const col = { a: "#141a2e", g: "#facc15", w: "#fff4c2" };
  let html = "";
  m.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch !== ".")
        html += `<i style="left:${x + c * s}px;top:${y + r * s}px;width:${s}px;height:${s}px;background:${col[ch]}"></i>`;
    })
  );
  return html;
}

/** A four-point pixel sparkle, like the poster's. */
function sparkle(x, y, s = 3, colour = "#93b4f5") {
  const pts = [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [1, 2],
  ];
  return pts
    .map(
      ([c, r]) =>
        `<i style="left:${x + c * s}px;top:${y + r * s}px;width:${s}px;height:${s}px;background:${colour}"></i>`
    )
    .join("");
}

const GREENS = ["#dcfce7", "#86efac", "#22c55e", "#15803d"];

/** A run of contribution squares, the platform Bit stands on. */
function blocks(x, y, count, size, seed) {
  let html = "";
  for (let i = 0; i < count; i++) {
    const shade = GREENS[(i * 7 + seed * 3) % 4];
    html += `<i style="left:${x + i * (size + 3)}px;top:${y}px;width:${size}px;height:${size}px;background:${shade};outline:2px solid #141a2e;outline-offset:-2px"></i>`;
  }
  return html;
}

const FONT = `<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Silkscreen:wght@400;700&display=swap" rel="stylesheet">`;
const BASE_CSS = `*{margin:0;padding:0;box-sizing:border-box}
body{background:transparent}
.stage{position:relative;overflow:hidden;font-family:'Silkscreen',monospace}
.stage i{position:absolute;display:block}`;

// ── Header: 600x210 shown, drawn at 2x ─────────────────────────────────────
const W = 600,
  H = 210;
const header = `<!doctype html><html><head>${FONT}<style>${BASE_CSS}
.stage{width:${W}px;height:${H}px;background:#f6f8fc;
  background-image:linear-gradient(#e6ecf7 1px,transparent 1px),linear-gradient(90deg,#e6ecf7 1px,transparent 1px);
  background-size:24px 24px;background-position:-1px -1px}
.logo{position:absolute;left:28px;top:24px;display:flex;align-items:center;gap:10px}
.mark{width:26px;height:26px;background:#dbe6fb;display:flex;align-items:center;justify-content:center}
.tri{width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:13px solid #2563eb}
.word{font-weight:700;font-size:15px;letter-spacing:5px;color:#0b1220}
.title{position:absolute;left:28px;top:74px;font-family:'Press Start 2P',monospace;line-height:1;text-transform:uppercase}
.t1{font-size:30px;color:#0b1220;letter-spacing:1px}
.t2{font-size:30px;color:#2563eb;letter-spacing:1px;margin-top:12px;text-shadow:3px 3px 0 #bcd0f7}
.chip{position:absolute;left:28px;top:166px;background:#0b1220;color:#facc15;font-size:11px;font-weight:700;letter-spacing:3px;padding:6px 10px}
.chip b{color:#fff;font-weight:700}
</style></head><body><div class="stage" id="art">
  ${Array.from({ length: 26 }, (_, i) => `<i style="left:${i * 24}px;top:${H - 14}px;width:24px;height:14px;background:${GREENS[(i * 5 + 1) % 4]};outline:2px solid #141a2e;outline-offset:-1px"></i>`).join("")}
  ${sparkle(330, 34)}${sparkle(560, 22)}${sparkle(388, 150, 3, "#bcd0f7")}${sparkle(574, 120, 3, "#bcd0f7")}${sparkle(300, 118, 2, "#bcd0f7")}
  ${coin(392, 70)}${coin(424, 34)}${coin(518, 26)}${coin(552, 62)}
  ${blocks(408, 150, 5, 22, 1)}
  ${sprite(BIT.jump, 6, 448, 52)}
  <div class="logo"><div class="mark"><div class="tri"></div></div><div class="word">DEVTRACK</div></div>
  <div class="title"><div class="t1">Weekly</div><div class="t2">High score</div></div>
  <div class="chip">WEEKLY <b>RECAP</b> · PRESS START</div>
</div></body></html>`;

// ── Footer Bit: 72x96 shown ─────────────────────────────────────────────────
const footer = `<!doctype html><html><head><style>${BASE_CSS}
.stage{width:72px;height:96px}</style></head><body>
<div class="stage" id="art">${sprite(BIT.talk, 6, 0, 0)}</div></body></html>`;

const browser = await chromium.launch();
async function render(html, file, width, height) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page
    .locator("#art")
    .screenshot({ path: join(OUT, file), omitBackground: true });
  await page.close();
  console.log("wrote", file);
}
await render(header, "digest-header.png", W, H);
await render(footer, "bit-talk.png", 72, 96);
await browser.close();
