import Link from "next/link";
import { PLACEMENT_SPONSORS } from "@/lib/sponsor-links";

/**
 * The one sponsor placement. Shows the current placement sponsor, clearly
 * labelled, or a house ad for sponsoring DevTrack while the slot is open.
 */
export default function SponsorSlot({
  className = "",
}: {
  className?: string;
}) {
  const sponsor = PLACEMENT_SPONSORS[0];

  if (sponsor) {
    return (
      <aside
        aria-label="Sponsor"
        className={`px-frame flex flex-wrap items-center justify-between gap-3 bg-[var(--card)] px-4 py-3 ${className}`}
      >
        <div className="min-w-0">
          <p className="font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            Sponsored
          </p>
          <p className="mt-1 truncate text-sm text-[var(--card-foreground)]">
            <strong>{sponsor.name}</strong> · {sponsor.tagline}
          </p>
        </div>
        <a
          href={sponsor.url}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="px-btn px-btn-sm px-btn-ghost"
        >
          Visit
        </a>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Sponsor slot"
      className={`flex flex-wrap items-center justify-between gap-3 border-2 border-dashed border-[var(--border)] px-4 py-3 ${className}`}
    >
      <div className="min-w-0">
        <p className="font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          Sponsor slot open
        </p>
        <p className="mt-1 text-sm text-[var(--card-foreground)]">
          Put your dev tool in front of developers who ship.
        </p>
      </div>
      <Link href="/sponsor" className="px-btn px-btn-sm px-btn-ghost">
        Sponsor DevTrack
      </Link>
    </aside>
  );
}
