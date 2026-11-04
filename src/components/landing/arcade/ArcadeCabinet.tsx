import type { CSSProperties, ReactNode, Ref } from "react";
import PixelSprite from "@/components/buddy/PixelSprite";

/**
 * The hero's arcade cabinet, drawn like the DevTrack poster: seen from the
 * front-left, so its right side panel shows as a band, the control deck juts
 * out with a sloped top, and the screen sits deep in a thick bezel. Every
 * part has a chunky outline with pixel-rounded corners. It is navy in dark
 * mode and white in light mode. All CSS (`.cab*` in globals.css); only the
 * screen's contents are live.
 *
 * `coins` counts Play presses: each new value drops a coin into the slot.
 * `glow` tints the screen, e.g. in the tier colour of a looked-up player.
 * `busy` wiggles the joystick while a lookup runs.
 */
export default function ArcadeCabinet({
  children,
  coins = 0,
  glow,
  busy = false,
  screenRef,
}: {
  children: ReactNode;
  coins?: number;
  glow?: string;
  busy?: boolean;
  screenRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div className="cabinet" data-busy={busy || undefined}>
      <span aria-hidden="true" className="cab-floor" />
      {/* The right side panel, behind the front parts. */}
      <span aria-hidden="true" className="cab-side">
        <span className="cab-side__stripes" />
      </span>

      <div className="cab-part cab-head">
        <div className="cab-sign">
          <span aria-hidden="true" className="cab-sign__logo">
            ▲
          </span>
          <span>DEVTRACK</span>
        </div>
      </div>

      <div className="cab-part cab-mid">
        <div className="cab-bezel">
          <div
            ref={screenRef}
            className="cabinet-screen"
            style={
              glow ? ({ "--screen-glow": glow } as CSSProperties) : undefined
            }
          >
            {children}
          </div>
        </div>
      </div>

      <div className="cab-deck" aria-hidden="true">
        <span className="cab-deck__top" />
        <span className="cab-deck__lip" />
        <span className="cab-stick">
          <span className="cab-stick__ball" />
        </span>
        <span className="cab-buttons">
          <span className="cab-button [--btn:#22c55e]" />
          <span className="cab-button [--btn:#3b8cff]" />
          <span className="cab-button [--btn:#b26bff]" />
        </span>
      </div>

      <div className="cab-part cab-low" aria-hidden="true">
        <span className="cab-vent" />
        <span className="cab-door">
          <span className="cab-door__slot">
            {coins > 0 && <span key={coins} className="cab-coin" />}
          </span>
          <span className="cab-door__key" />
        </span>
        <span className="cab-vent" />
      </div>

      {/* Bit hangs out by the machine where there is room. */}
      <span aria-hidden="true" className="cabinet-bit">
        <PixelSprite frame="idle" scale={5} />
      </span>
    </div>
  );
}
