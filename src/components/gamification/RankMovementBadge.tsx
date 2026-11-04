import type { RankMovement } from "@/lib/gamification/ranking";

/** ▲3 / ▼1 / NEW beside a rank. Renders nothing when there is no baseline. */
export default function RankMovementBadge({
  movement,
  since,
}: {
  movement: RankMovement;
  /** Human date of the baseline, for the tooltip. */
  since?: string;
}) {
  const when = since ? ` since ${since}` : "";
  switch (movement.kind) {
    case "up":
      return (
        <span
          title={`Up ${movement.places}${when}`}
          aria-label={`Up ${movement.places} ${movement.places === 1 ? "place" : "places"}${when}`}
          className="font-mono text-[10px] font-bold leading-none tabular-nums text-[var(--success)]"
        >
          ▲{movement.places}
        </span>
      );
    case "down":
      return (
        <span
          title={`Down ${movement.places}${when}`}
          aria-label={`Down ${movement.places} ${movement.places === 1 ? "place" : "places"}${when}`}
          className="font-mono text-[10px] font-bold leading-none tabular-nums text-[var(--destructive)]"
        >
          ▼{movement.places}
        </span>
      );
    case "new":
      return (
        <span
          title={`New on the board${when}`}
          aria-label="New on the board"
          className="font-mono text-[10px] font-bold uppercase leading-none tracking-wide text-[var(--accent)]"
        >
          New
        </span>
      );
    case "same":
      return (
        <span
          title={`No change${when}`}
          aria-label="No change"
          className="font-mono text-[10px] leading-none text-[var(--muted-foreground)]"
        >
          –
        </span>
      );
    default:
      return null;
  }
}
