/** "LV 24" in the pixel style. Static, so it renders on the server. */
export default function LevelChip({
  level,
  className = "",
}: {
  level: number;
  className?: string;
}) {
  return (
    <span
      title={`Level ${level}`}
      aria-label={`Level ${level}`}
      className={`inline-flex shrink-0 items-center rounded-[3px] border border-[var(--border)] bg-[var(--control)] px-1.5 py-[3px] font-mono text-[10px] font-bold leading-none tracking-[0.06em] tabular-nums text-[var(--card-foreground)] ${className}`}
    >
      LV {level}
    </span>
  );
}
