/**
 * 1200x630 share card for a compare duel: two fighters, VS, the score.
 * Rendered by next/og (Satori): flexbox only. Fixed text uses the pixel
 * font as SVG; usernames use the default font (the pixel font has no
 * lowercase).
 */

import type { DuelFighter, DuelResult } from "@/lib/duel";
import { TIER_STYLE } from "./tier-palette";
import {
  ACCENT,
  Backdrop,
  Header,
  MUTED,
  Pixel,
  WHITE,
  SHARE_CARD_SIZE,
} from "./share-card";

const P2 = "#fb7185";

function Side({
  fighter,
  color,
  label,
  wins,
}: {
  fighter: DuelFighter;
  color: string;
  label: string;
  wins: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        width: 380,
      }}
    >
      <Pixel text={label} scale={3} color={color} />
      <div style={{ display: "flex", padding: 6, background: "#000000" }}>
        <div style={{ display: "flex", padding: 6, background: color }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori */}
          <img
            src={`https://avatars.githubusercontent.com/${encodeURIComponent(fighter.login)}?s=360`}
            width={180}
            height={180}
            alt=""
            style={{ display: "flex" }}
          />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          color: WHITE,
          fontSize: 32,
          fontWeight: 700,
          maxWidth: 380,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        @{fighter.login}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {fighter.tier && (
          <Pixel
            text={TIER_STYLE[fighter.tier].label.toUpperCase()}
            scale={3}
            color={TIER_STYLE[fighter.tier].accent}
          />
        )}
        <Pixel text={`LV ${fighter.level}`} scale={3} color={MUTED} />
      </div>
      <Pixel text={String(wins)} scale={14} color={color} />
    </div>
  );
}

export function DuelCard({
  left,
  right,
  result,
}: {
  left: DuelFighter;
  right: DuelFighter;
  result: DuelResult;
}) {
  const verdict = result.winner
    ? result.flawless
      ? "FLAWLESS VICTORY"
      : `${result.winner === "left" ? "P1" : "P2"} WINS`
    : "DRAW";
  return (
    <div
      style={{
        width: SHARE_CARD_SIZE.width,
        height: SHARE_CARD_SIZE.height,
        display: "flex",
        position: "relative",
        fontFamily: "sans-serif",
      }}
    >
      <Backdrop />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: SHARE_CARD_SIZE.width,
          height: SHARE_CARD_SIZE.height,
          display: "flex",
          flexDirection: "column",
          padding: "56px 72px",
        }}
      >
        <Header />
        <div
          style={{
            display: "flex",
            flexGrow: 1,
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 18,
          }}
        >
          <Side
            fighter={left}
            color={ACCENT}
            label="PLAYER 1"
            wins={result.wins.left}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 26,
            }}
          >
            <Pixel text="VS" scale={16} color={WHITE} />
            <Pixel text={verdict} scale={3} color={MUTED} />
          </div>
          <Side
            fighter={right}
            color={P2}
            label="PLAYER 2"
            wins={result.wins.right}
          />
        </div>
      </div>
    </div>
  );
}
