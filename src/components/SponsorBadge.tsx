export default function SponsorBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-pink-500/30 bg-pink-500/10 px-2 py-0.5 text-xs font-semibold text-pink-500 shadow-sm ${className}`}
      title="GitHub Sponsor — thank you for supporting DevTrack!"
      aria-label="GitHub Sponsor"
    >
      <span aria-hidden="true">💎</span> Sponsor
    </span>
  );
}
