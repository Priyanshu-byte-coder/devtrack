import {
  FRAMES,
  SPRITE_HEIGHT,
  SPRITE_WIDTH,
  frameToRuns,
  type FrameName,
} from "./sprites";

const RUNS = Object.fromEntries(
  Object.entries(FRAMES).map(([name, rows]) => [name, frameToRuns(rows)])
) as Record<FrameName, ReturnType<typeof frameToRuns>>;

interface PixelSpriteProps {
  frame?: FrameName;
  /** Screen pixels per sprite pixel. */
  scale?: number;
  /** Face left instead of right. */
  flip?: boolean;
  className?: string;
}

/** Bit, one frame. No hooks, so loading screens can render it on the server. */
export default function PixelSprite({
  frame = "idle",
  scale = 3,
  flip = false,
  className,
}: PixelSpriteProps) {
  return (
    <svg
      width={SPRITE_WIDTH * scale}
      height={SPRITE_HEIGHT * scale}
      viewBox={`0 0 ${SPRITE_WIDTH} ${SPRITE_HEIGHT}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      {RUNS[frame].map((run) => (
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
