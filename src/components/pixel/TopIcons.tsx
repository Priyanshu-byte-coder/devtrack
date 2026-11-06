import { frameToRuns } from "@/components/buddy/sprites";
import { FLAG_ICONS, LANGUAGE_ICONS, type PixelGlyphData } from "./top-icons";

type LanguageSlug = keyof typeof LANGUAGE_ICONS;
type CountrySlug = keyof typeof FLAG_ICONS;

function toRuns<K extends string>(icons: Record<K, PixelGlyphData>) {
  return Object.fromEntries(
    Object.entries<PixelGlyphData>(icons).map(([slug, icon]) => [
      slug,
      frameToRuns(icon.rows, icon.palette),
    ])
  ) as Record<K, ReturnType<typeof frameToRuns>>;
}

const LANGUAGE_RUNS = toRuns(LANGUAGE_ICONS);
const FLAG_RUNS = toRuns(FLAG_ICONS);

function Glyph({
  icon,
  runs,
  scale,
  className,
}: {
  icon: PixelGlyphData;
  runs: ReturnType<typeof frameToRuns>;
  scale: number;
  className?: string;
}) {
  const width = icon.rows[0].length;
  const height = icon.rows.length;
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
      {runs.map((run) => (
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

/** A language's logo in pixels. Decorative: the name sits beside it. */
export function LanguageIcon({
  slug,
  scale = 3,
  className,
}: {
  slug: LanguageSlug;
  scale?: number;
  className?: string;
}) {
  return (
    <Glyph
      icon={LANGUAGE_ICONS[slug]}
      runs={LANGUAGE_RUNS[slug]}
      scale={scale}
      className={className}
    />
  );
}

/** A country's flag in pixels, framed so white flags show on light themes. */
export function CountryFlag({
  slug,
  scale = 2,
  className = "",
}: {
  slug: CountrySlug;
  scale?: number;
  className?: string;
}) {
  return (
    <Glyph
      icon={FLAG_ICONS[slug]}
      runs={FLAG_RUNS[slug]}
      scale={scale}
      className={`shadow-[0_0_0_2px_var(--border)] ${className}`}
    />
  );
}
