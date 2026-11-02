export default function SponsorBadge({
  className = "",
  /**
   * Classes for the "Sponsor" word only. Pass `hidden sm:inline` where space
   * is tight to leave just the gem; `aria-label` still names it in full.
   */
  labelClassName = "",
}: {
  className?: string;
  labelClassName?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-pink-500/30 bg-pink-500/10 px-2 py-0.5 text-xs font-semibold text-pink-500 shadow-sm ${className}`}
      title="GitHub Sponsor — thank you for supporting DevTrack!"
      aria-label="GitHub Sponsor"
    >
      <span aria-hidden="true">💎</span>
      <span className={labelClassName}>Sponsor</span>
    </span>
  );
}
