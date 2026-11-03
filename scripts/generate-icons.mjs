#!/usr/bin/env node
/**
 * Draws DevTrack's icons (favicon, tab, home-screen and PWA icons) from one
 * 16 x 16 pixel grid: Bit, the mascot, as a bust on an arcade-yellow tile.
 * Every size is a whole-number scale of the grid, so the pixels stay crisp.
 *
 *   node scripts/generate-icons.mjs
 *
 * Writes to public/. Plain Node only: PNGs are encoded with zlib and the
 * .ico wraps those PNGs, which every current browser reads.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// Bit's head and shoulders, from src/components/buddy/sprites.ts (idle frame).
// "." is the tile colour.
const GRID = [
  "................",
  "................",
  ".....KKKKK......",
  "....KGGGGGK.....",
  "...KGGGGGGGK....",
  "...KggggKKKKKK..",
  "...KSSSSSSSK....",
  "...KSKSSSKSK....",
  "...KSSSSSSSK....",
  "....KSSsSSK.....",
  "....KBBBBBK.....",
  "...KBBBYBBbK....",
  "..KSBBBYBBbSK...",
  "..KKBBBYBBbKK...",
  "...KBBBYBBbK....",
  "...KBBBYBBbK....",
];

const PALETTE = {
  ".": "#facc15", // tile: arcade coin yellow
  K: "#141a2e", // outline
  G: "#22c55e", // cap: commit green
  g: "#15803d", // cap shade
  S: "#f6c79f", // skin
  s: "#d99a6c", // skin shade
  B: "#3b82f6", // hoodie
  b: "#1d4ed8", // hoodie shade
  Y: "#e2e8f0", // zip: light on yellow, so it reads at 16 px
};

const SIZE = GRID.length;
const rgba = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
  255,
];

/**
 * The tile at `scale` pixels per grid pixel, centred on a `size` canvas
 * filled with the tile colour. `notch` cuts the four corner pixels for a
 * pixel-rounded tab icon; home-screen icons get the platform's own mask.
 */
function draw(size, scale, { notch = false } = {}) {
  const px = new Uint8Array(size * size * 4);
  const offset = Math.floor((size - SIZE * scale) / 2);
  const tile = rgba(PALETTE["."]);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - offset) / scale);
      const gy = Math.floor((y - offset) / scale);
      const inGrid = gx >= 0 && gy >= 0 && gx < SIZE && gy < SIZE;
      let colour = inGrid ? rgba(PALETTE[GRID[gy][gx]]) : tile;
      if (notch && inGrid) {
        const edgeX = gx === 0 || gx === SIZE - 1;
        const edgeY = gy === 0 || gy === SIZE - 1;
        if (edgeX && edgeY) colour = [0, 0, 0, 0];
      }
      px.set(colour, (y * size + x) * 4);
    }
  }
  return px;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // no filter
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(
      rows,
      y * (size * 4 + 1) + 1
    );
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header[e] = size >= 256 ? 0 : size;
    header[e + 1] = size >= 256 ? 0 : size;
    header.writeUInt16LE(1, e + 4); // planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((im) => im.data)]);
}
function svg() {
  const rects = [];
  GRID.forEach((row, y) => {
    // One rect per run of same-coloured pixels keeps the file small.
    let x = 0;
    while (x < SIZE) {
      const ch = row[x];
      let end = x + 1;
      while (end < SIZE && row[end] === ch) end++;
      if (ch !== ".")
        rects.push(
          `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${PALETTE[ch]}"/>`
        );
      x = end;
    }
  });
  const tile = `<path d="M1 0h14v1h1v14h-1v1H1v-1H0V1h1z" fill="${PALETTE["."]}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${tile}${rects.join("")}</svg>\n`;
}

const out = (name, data) => {
  writeFileSync(join("public", name), data);
  console.log(`  public/${name}`);
};

const tab = (size) => png(size, draw(size, size / SIZE, { notch: true }));
out("favicon.svg", svg());
out(
  "favicon.ico",
  ico([16, 32, 48].map((size) => ({ size, data: tab(size) })))
);
out("favicon-16x16.png", tab(16));
out("favicon-32x32.png", tab(32));
// Home-screen icons: full bleed (iOS and Android round the corners).
out("apple-touch-icon.png", png(180, draw(180, 11)));
out("android-chrome-192x192.png", png(192, draw(192, 12)));
out("android-chrome-512x512.png", png(512, draw(512, 32)));
// Maskable PWA icons: Bit inside the central safe zone, tile to the edges.
out("pwa-192x192.png", png(192, draw(192, 9)));
out("pwa-512x512.png", png(512, draw(512, 24)));
