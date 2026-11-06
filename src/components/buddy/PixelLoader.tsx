import PixelSprite from "./PixelSprite";

interface PixelLoaderProps {
  /** Read to screen readers, and shown under the scene. */
  label?: string;
  className?: string;
}

/**
 * The loading screen: Bit runs along scrolling ground and headbutts a "?"
 * block for a coin, on a loop. Pure CSS (`.pixel-loader` in globals.css),
 * so it works in a server-rendered loading.tsx before any JavaScript runs.
 */
export default function PixelLoader({
  label = "Loading",
  className = "",
}: PixelLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-4 py-16 ${className}`}
    >
      <span className="sr-only">{label}</span>
      <div className="pixel-loader" aria-hidden="true">
        <span className="pixel-loader__coin" />
        <span className="pixel-loader__block font-pixel">?</span>
        <span className="pixel-loader__runner">
          <PixelSprite frame="runA" className="pixel-loader__frame-a" />
          <PixelSprite frame="runB" className="pixel-loader__frame-b" />
        </span>
        <span className="pixel-loader__ground" />
      </div>
      <p
        aria-hidden="true"
        className="font-pixel text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]"
      >
        {label}
        <span className="pixel-loader__dots" />
      </p>
    </div>
  );
}
