"use client";

import { useEffect, useState } from "react";

const BOOTED_KEY = "devtrack:booted";

/**
 * A one-and-a-half-second arcade boot screen, once per session.
 *
 * The animation, including hiding itself, is pure CSS (`.boot-intro` in
 * globals.css), so it ends on time even before JavaScript loads and can
 * never get stuck. The root layout's head script adds `html.booted` on
 * repeat visits in the same session, which hides it before first paint.
 * Reduced motion skips it entirely. Clicking or pressing a key skips it.
 */
export default function BootIntro() {
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    // Automated browsers (tests, crawlers' renderers) get the page at once.
    if (window.navigator.webdriver) {
      setSkipped(true);
      return;
    }
    try {
      window.sessionStorage.setItem(BOOTED_KEY, "1");
    } catch {
      // Storage blocked: it just plays again next time.
    }
    const skip = () => setSkipped(true);
    window.addEventListener("keydown", skip, { once: true });
    return () => window.removeEventListener("keydown", skip);
  }, []);

  if (skipped) return null;

  return (
    <div
      className="boot-intro"
      aria-hidden="true"
      onClick={() => setSkipped(true)}
    >
      <div className="boot-intro__inner">
        <p className="boot-intro__logo font-pixel">
          <span className="text-[var(--accent)]">▲</span> DEVTRACK
        </p>
        <div className="boot-intro__bar">
          <span />
        </div>
        <p className="boot-intro__press font-pixel">Press start</p>
      </div>
    </div>
  );
}
