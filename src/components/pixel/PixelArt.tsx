import { frameToRuns } from "@/components/buddy/sprites";

/**
 * Small pixel-art icons drawn from character grids, like Bit's sprite.
 * "." is transparent; every other character is a key into the palette.
 */
const OUTLINE = "#141a2e";

export const PIXEL_ICONS = {
  coin: {
    palette: { K: OUTLINE, Y: "#facc15", y: "#c98a14", W: "#fff7c2" },
    rows: [
      "..KKKK..",
      ".KYYYyK.",
      "KYWYYYyK",
      "KYWYYYyK",
      "KYWYYYyK",
      "KYWYYYyK",
      "KYWYYYyK",
      ".KYYYyK.",
      "..KKKK..",
    ],
  },
  gem: {
    palette: { K: OUTLINE, C: "#34d399", c: "#059669", W: "#ecfdf5" },
    rows: [
      "..KKKKK..",
      ".KCWCCcK.",
      "KCWCCCCcK",
      "KKKKKKKKK",
      ".KCCCCcK.",
      "..KCCcK..",
      "...KcK...",
      "....K....",
    ],
  },
  heart: {
    palette: { K: OUTLINE, R: "#f43f5e", r: "#be123c", W: "#ffe4e6" },
    rows: [
      ".KK...KK.",
      "KRRK.KRRK",
      "KRWRKRRrK",
      "KRRRRRRrK",
      ".KRRRRrK.",
      "..KRRrK..",
      "...KrK...",
      "....K....",
    ],
  },
  star: {
    palette: { K: OUTLINE, Y: "#facc15", y: "#eab308" },
    rows: [
      ".....K.....",
      "....KYK....",
      "....KYK....",
      "KKKKYYYKKKK",
      ".KYYYYYYYK.",
      "..KYKYKYK..",
      "..KYYYYYK..",
      ".KYYYKYYyK.",
      ".KYyK.KYyK.",
      "KKK.....KKK",
    ],
  },
} as const;

export type PixelIconName = keyof typeof PIXEL_ICONS;

const RUNS = Object.fromEntries(
  Object.entries(PIXEL_ICONS).map(([name, icon]) => [
    name,
    frameToRuns(icon.rows, icon.palette),
  ])
) as Record<PixelIconName, ReturnType<typeof frameToRuns>>;

export default function PixelArt({
  icon,
  scale = 4,
  className,
}: {
  icon: PixelIconName;
  scale?: number;
  className?: string;
}) {
  const { rows } = PIXEL_ICONS[icon];
  const width = rows[0].length;
  const height = rows.length;
  return (
    <svg
      width={width * scale}
      height={height * scale}
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {RUNS[icon].map((run) => (
        <rect
          key={`${run.x}-${run.y}`}
          x={run.x}
          y={run.y}
          width={run.width}
          height={1}
          fill={run.color}
        />
      ))}
    </svg>
  );
}
