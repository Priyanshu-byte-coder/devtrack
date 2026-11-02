/**
 * Page frame for public profile routes.
 *
 * Colours come from the theme tokens, which the inline script in the root
 * layout applies before first paint. That lets this render on the server: an
 * earlier version waited for mount, so profiles reached crawlers (and anyone
 * without JS) as an empty page.
 */
export default function ProfileThemeWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {children}
    </div>
  );
}
