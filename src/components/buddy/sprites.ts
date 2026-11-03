/**
 * Bit, DevTrack's pixel mascot, drawn as 12 x 16 character grids so the
 * sprite needs no image files and stays crisp at any scale.
 *
 * Each character is one pixel; "." is transparent. Frames share the head
 * and torso and differ in the eyes, mouth and legs.
 */

export const SPRITE_WIDTH = 12;
export const SPRITE_HEIGHT = 16;

export const PALETTE: Record<string, string> = {
  K: "#141a2e", // outline
  G: "#22c55e", // cap: commit green
  g: "#15803d", // cap shade
  S: "#f6c79f", // skin
  s: "#d99a6c", // skin shade
  B: "#3b82f6", // hoodie
  b: "#1d4ed8", // hoodie shade
  Y: "#facc15", // hoodie zip
  P: "#334155", // trousers
  F: "#e2e8f0", // shoes
};

const HEAD = [
  "...KKKKK....",
  "..KGGGGGK...",
  ".KGGGGGGGK..",
  ".KggggKKKKKK",
  ".KSSSSSSSK..",
];
const EYES_OPEN = ".KSKSSSKSK..";
const EYES_SHUT = ".KSSSSSSSK..";
const CHEEKS = ".KSSSSSSSK..";
const MOUTH_SHUT = "..KSSsSSK...";
const MOUTH_OPEN = "..KSKKKSK...";
const TORSO = ["..KBBBBBK...", ".KBBBYBBbK..", "KSBBBYBBbSK.", "KKBBBBBBbKK."];
const LEGS_STAND = [
  ".KPPPKPPPK..",
  ".KPPK.KPPK..",
  ".KFFK.KFFK..",
  ".KKKK.KKKK..",
];
const LEGS_STRIDE = [
  ".KPPPPPPK...",
  "KPPK..KPPK..",
  "KFFK...KFFK.",
  "KKK.....KKK.",
];
const LEGS_PASS = [
  "..KPPPPK....",
  "..KPPPK.....",
  "..KFFFFK....",
  "..KKKKKK....",
];
const ARMS_UP = [
  "S.KBBBBBK.S.",
  "KKBBBYBBbKK.",
  ".KBBBYBBbK..",
  ".KBBBBBBbK..",
];

function frame(eyes: string, mouth: string, torso: string[], legs: string[]) {
  return [...HEAD, eyes, CHEEKS, mouth, ...torso, ...legs];
}

export const FRAMES = {
  idle: frame(EYES_OPEN, MOUTH_SHUT, TORSO, LEGS_STAND),
  blink: frame(EYES_SHUT, MOUTH_SHUT, TORSO, LEGS_STAND),
  talk: frame(EYES_OPEN, MOUTH_OPEN, TORSO, LEGS_STAND),
  runA: frame(EYES_OPEN, MOUTH_SHUT, TORSO, LEGS_STRIDE),
  runB: frame(EYES_OPEN, MOUTH_SHUT, TORSO, LEGS_PASS),
  jump: frame(EYES_OPEN, MOUTH_OPEN, ARMS_UP, LEGS_STRIDE),
} as const;

export type FrameName = keyof typeof FRAMES;

export interface PixelRun {
  x: number;
  y: number;
  width: number;
  color: string;
}

/**
 * Turns a frame into horizontal runs of same-coloured pixels, so a sprite
 * is a few dozen <rect>s rather than one per pixel.
 */
export function frameToRuns(
  rows: readonly string[],
  palette: Record<string, string> = PALETTE
): PixelRun[] {
  const runs: PixelRun[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === "." || !palette[ch]) {
        x += 1;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === ch) end += 1;
      runs.push({ x, y, width: end - x, color: palette[ch] });
      x = end;
    }
  });
  return runs;
}
