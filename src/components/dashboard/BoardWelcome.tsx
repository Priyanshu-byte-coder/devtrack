"use client";

import Link from "@/components/Link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import PixelArt from "@/components/pixel/PixelArt";

const DISMISSED_KEY = "devtrack:board-welcome-dismissed";
/** Only accounts that went public this recently see the banner. */
const NEW_PLAYER_DAYS = 14;

export function isNewPlayer(publicSince: string | null, now = Date.now()) {
  if (!publicSince) return false;
  const since = Date.parse(publicSince);
  return Number.isFinite(since) && now - since < NEW_PLAYER_DAYS * 86_400_000;
}

/**
 * New accounts start on the public leaderboard. This tells them once, on
 * the dashboard, with a one-click way out.
 */
export default function BoardWelcome({
  publicSince,
  onHidden,
}: {
  publicSince: string | null;
  onHidden: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (!isNewPlayer(publicSince)) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // Storage blocked: show it; dismissing just won't stick.
    }
    setVisible(true);
  }, [publicSince]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Ignore.
    }
  };

  const hide = async () => {
    setHiding(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: false, leaderboard_opt_in: false }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success("You're hidden. Rejoin any time in Settings.");
      dismiss();
      onHidden();
    } catch {
      toast.error("Couldn't hide your profile. Try again from Settings.");
    } finally {
      setHiding(false);
    }
  };

  if (!visible) return null;

  return (
    <section
      aria-label="You're on the leaderboard"
      className="px-frame mb-6 flex flex-col gap-4 bg-[var(--card)] p-4 sm:flex-row sm:items-center"
    >
      <span className="hud-icon-star shrink-0 self-start sm:self-center">
        <PixelArt icon="star" scale={3} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
          New challenger
        </p>
        <p className="mt-1 text-sm leading-6 text-[var(--card-foreground)]">
          You&apos;re on the public leaderboard. Your score, tier, streak and
          contribution totals are visible to everyone; private repository names
          and code never are.
        </p>
      </div>
      <div className="-m-1 flex shrink-0 flex-wrap items-center gap-2">
        <Link href="/leaderboard" className="px-btn px-btn-sm">
          See the board
        </Link>
        <button
          type="button"
          onClick={hide}
          disabled={hiding}
          className="px-btn px-btn-sm px-btn-ghost disabled:opacity-60"
        >
          {hiding ? "Hiding…" : "Hide me"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="px-2 font-pixel text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          ✕
        </button>
      </div>
    </section>
  );
}
