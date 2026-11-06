/**
 * Motion tokens: the one place durations, easings and springs are defined.
 *
 * CSS animations read the matching custom properties in globals.css
 * (`--ease-*`, `--duration-*`), exposed to Tailwind as `ease-*` and
 * `duration-*`. Keep the two in sync.
 */

/** Seconds, for motion. Multiply by 1000 for CSS. */
export const duration = {
  instant: 0.1,
  fast: 0.18,
  base: 0.28,
  slow: 0.45,
  slower: 0.7,
} as const;

/** Cubic-bezier control points. */
export const ease = {
  /** Fast start, long settle. The house curve for entrances. */
  out: [0.16, 1, 0.3, 1],
  /** Symmetric, for elements moving between two resting states. */
  inOut: [0.65, 0, 0.35, 1],
  /** Slow start, for exits that should get out of the way. */
  in: [0.7, 0, 0.84, 0],
} as const;

/** Springs, for anything that should feel physical: numbers, ranks, tiers. */
export const spring = {
  /** UI feedback: toggles, presses, small layout shifts. */
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 0.8 },
  /** Default for counters and position changes. */
  smooth: { type: "spring", stiffness: 140, damping: 26, mass: 1 },
  /** Celebrations: tier-ups, personal bests. Overshoots on purpose. */
  bouncy: { type: "spring", stiffness: 260, damping: 14, mass: 1 },
} as const;

/** Delay between siblings in a staggered entrance, in seconds. */
export const stagger = {
  tight: 0.03,
  base: 0.06,
  loose: 0.1,
} as const;

/** Distance an element travels on entrance, in px. Small reads as polish; big reads as a slideshow. */
export const entranceOffset = 16;
