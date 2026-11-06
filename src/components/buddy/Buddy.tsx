"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { fillLine, scriptFor } from "@/lib/buddy-lines";
import PixelSprite from "./PixelSprite";
import type { FrameName } from "./sprites";

const HIDDEN_KEY = "devtrack:buddy-hidden";
/** Lets e2e tests opt in; automated browsers don't see Bit otherwise. */
export const BUDDY_FORCE_KEY = "devtrack:buddy-force";
const GREETED_PREFIX = "devtrack:buddy-greeted:";

type Mode = "idle" | "run" | "jump";

function readStorage(storage: "local" | "session", key: string) {
  try {
    return (storage === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(
  storage: "local" | "session",
  key: string,
  value: string | null
) {
  try {
    const target = storage === "local" ? localStorage : sessionStorage;
    if (value === null) target.removeItem(key);
    else target.setItem(key, value);
  } catch {
    // Storage blocked: Bit just forgets.
  }
}

/**
 * Bit, the pixel mascot in the corner of every page. He runs while you
 * scroll, jumps when you stop hard, finds a coin at the bottom of the page
 * and, when clicked, says something about the page you're on (the copy is
 * in lib/buddy-lines.ts). On the leaderboard he's less helpful.
 */
export default function Buddy() {
  const pathname = usePathname() ?? "/";
  const { data: session } = useSession();
  const login = session?.githubLogin;
  const script = scriptFor(pathname);

  const [enabled, setEnabled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [facingLeft, setFacingLeft] = useState(false);
  const [tick, setTick] = useState(0);
  const [blink, setBlink] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [typed, setTyped] = useState(0);
  const [coins, setCoins] = useState(0);
  const lineIndex = useRef(0);

  const typing = open && typed < text.length;

  useEffect(() => {
    const forced = readStorage("local", BUDDY_FORCE_KEY) === "1";
    if (window.navigator.webdriver && !forced) return;
    setEnabled(true);
    setHidden(readStorage("local", HIDDEN_KEY) === "1");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(motion.matches);
    const onChange = () => setReduced(motion.matches);
    motion.addEventListener("change", onChange);
    return () => motion.removeEventListener("change", onChange);
  }, []);

  const say = useCallback(
    (line: string) => {
      const filled = fillLine(line, login);
      setText(filled);
      setTyped(reduced ? filled.length : 0);
      setOpen(true);
    },
    [login, reduced]
  );

  // A new page: close the box and start that page's script from the top.
  useEffect(() => {
    setOpen(false);
    lineIndex.current = 0;
  }, [pathname]);

  // Some pages get an unprompted line, once per session.
  useEffect(() => {
    const greeting = script.greeting;
    if (!enabled || hidden || !greeting) return;
    const key = GREETED_PREFIX + script.stage;
    if (readStorage("session", key)) return;
    const timer = window.setTimeout(() => {
      writeStorage("session", key, "1");
      say(greeting);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [enabled, hidden, script, say]);

  // Scrolling: run, face the way the page moves, jump on a hard stop, and
  // find a coin at the very bottom.
  useEffect(() => {
    if (!enabled || hidden || reduced) return;
    let lastY = window.scrollY;
    let lastT = performance.now();
    let peak = 0;
    let stopTimer: number | undefined;
    let landTimer: number | undefined;

    const onScroll = () => {
      const y = window.scrollY;
      const now = performance.now();
      const dy = y - lastY;
      if (dy !== 0) setFacingLeft(dy < 0);
      peak = Math.max(peak, Math.abs(dy) / Math.max(now - lastT, 1));
      lastY = y;
      lastT = now;
      setMode("run");
      window.clearTimeout(stopTimer);
      stopTimer = window.setTimeout(() => {
        const atBottom =
          window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 4;
        if (atBottom) setCoins((c) => c + 1);
        if (peak > 2.5 || atBottom) {
          setMode("jump");
          landTimer = window.setTimeout(() => setMode("idle"), 420);
        } else {
          setMode("idle");
        }
        peak = 0;
      }, 180);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(stopTimer);
      window.clearTimeout(landTimer);
    };
  }, [enabled, hidden, reduced]);

  // Animation clock, only while there's something to animate.
  useEffect(() => {
    if (reduced || (mode !== "run" && !typing)) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 120);
    return () => window.clearInterval(id);
  }, [mode, typing, reduced]);

  // Blink now and then.
  useEffect(() => {
    if (!enabled || hidden || reduced) return;
    let off: number | undefined;
    const id = window.setInterval(() => {
      setBlink(true);
      off = window.setTimeout(() => setBlink(false), 140);
    }, 3400);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(off);
    };
  }, [enabled, hidden, reduced]);

  // Typewriter.
  useEffect(() => {
    if (!typing) return;
    const id = window.setTimeout(() => setTyped((n) => n + 1), 22);
    return () => window.clearTimeout(id);
  }, [typing, typed]);

  // Escape closes the box.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const nextLine = useCallback(() => {
    const lines = script.lines;
    say(lines[lineIndex.current % lines.length]);
    lineIndex.current += 1;
  }, [script, say]);

  const hop = () => {
    if (reduced) return;
    setMode("jump");
    window.setTimeout(() => setMode("idle"), 420);
  };

  const onBuddyClick = () => {
    if (typing) {
      setTyped(text.length);
      return;
    }
    hop();
    nextLine();
  };

  const hide = () => {
    setOpen(false);
    setHidden(true);
    writeStorage("local", HIDDEN_KEY, "1");
  };

  const unhide = () => {
    setHidden(false);
    writeStorage("local", HIDDEN_KEY, null);
  };

  if (!enabled) return null;

  if (hidden) {
    return (
      <button
        type="button"
        onClick={unhide}
        aria-label="Bring back Bit"
        title="Bring back Bit"
        className="buddy-peek fixed bottom-0 right-24 z-40 h-4 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <PixelSprite frame="idle" scale={2} />
      </button>
    );
  }

  let frame: FrameName = "idle";
  if (mode === "run") frame = tick % 2 ? "runA" : "runB";
  else if (mode === "jump") frame = "jump";
  else if (typing) frame = tick % 2 ? "talk" : "idle";
  else if (blink) frame = "blink";

  const motionClass =
    mode === "jump"
      ? "buddy-jump"
      : mode === "idle" && !open
        ? "buddy-bob"
        : "";

  return (
    <div className="buddy-dock fixed bottom-4 right-24 z-40 flex flex-col items-end">
      {open && (
        <div
          role="dialog"
          aria-label={`Bit says, ${script.stage}`}
          className="buddy-bubble px-frame absolute bottom-full right-0 mb-3 w-[min(20rem,calc(100vw-7rem))] bg-[var(--card)] p-3 text-[var(--card-foreground)]"
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--accent)]">
              Bit · {script.stage}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="font-pixel text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              ✕
            </button>
          </div>
          <p className="min-h-[2.5rem] text-sm leading-snug" aria-live="polite">
            <span aria-hidden="true">{text.slice(0, typed)}</span>
            <span className="sr-only">{text}</span>
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={hide}
              className="text-[11px] text-[var(--muted-foreground)] underline-offset-2 hover:underline"
            >
              Hide Bit
            </button>
            <button
              type="button"
              onClick={() => (typing ? setTyped(text.length) : nextLine())}
              className="font-pixel text-[10px] uppercase tracking-[0.12em] text-[var(--accent)]"
            >
              {typing ? "Skip" : "Next"}{" "}
              <span className={typing ? "" : "px-blink"} aria-hidden="true">
                ▶
              </span>
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onBuddyClick}
        aria-label={`Bit, the DevTrack guide. Tip about ${script.stage}`}
        aria-expanded={open}
        className="relative block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        {coins > 0 && (
          <span key={coins} className="buddy-coin" aria-hidden="true">
            +1
          </span>
        )}
        <span className={`block ${motionClass}`}>
          <PixelSprite frame={frame} scale={3} flip={facingLeft} />
        </span>
        {mode === "run" && <span className="buddy-dust" aria-hidden="true" />}
        <span className="buddy-shadow" aria-hidden="true" />
      </button>
    </div>
  );
}
