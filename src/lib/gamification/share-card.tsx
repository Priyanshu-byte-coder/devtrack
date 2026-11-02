/**
 * The 1200x630 arcade share card, used as a profile's Open Graph image (what
 * X, LinkedIn, Slack and Discord show for a shared link) and for download.
 *
 * Rendered by next/og (Satori): flexbox only, every multi-child element needs
 * display:flex. Fixed labels and numbers use the pixel font drawn as SVG
 * paths, so no font has to load. Usernames use the default font instead: the
 * pixel font has no lowercase and maps "v" to the down arrow.
 */

import { GLYPH_HEIGHT, pixelTextPath, pixelTextWidth } from "./pixel-font";
import { TIER_STYLE } from "./tier-palette";
import type { Tier } from "./scoring";
import type { RankMovement } from "./ranking";

export const SHARE_CARD_SIZE = { width: 1200, height: 630 };

export type ShareCardData =
  | {
      state: "ranked";
      login: string;
      boardLabel: string;
      rank: number;
      total: number;
      tier: Tier;
      scoreV2: number;
      level: number | null;
      xp: number | null;
      levelProgress: number | null;
      movement: RankMovement;
      streak: number;
      commits: number;
      prs: number;
      /** A guest's would-be rank: they haven't joined, so it's an estimate. */
      estimated?: boolean;
    }
  /** Login is empty for private or unknown profiles: brand card only. */
  | { state: "unranked"; login: string };

const BG = "#05070f";
const PANEL = "#0b1020";
const MUTED = "#8a9bc0";
const WHITE = "#f5f7fb";
const ACCENT = "#6ba8ff";
const UP = "#4ade80";
const DOWN = "#fb7185";

const fmt = new Intl.NumberFormat("en-US");

function Pixel({
  text,
  scale,
  color,
}: {
  text: string;
  scale: number;
  color: string;
}) {
  const w = Math.max(1, pixelTextWidth(text, scale));
  const h = GLYPH_HEIGHT * scale;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ display: "flex" }}
    >
      <path d={pixelTextPath(text, 0, 0, scale)} fill={color} />
    </svg>
  );
}

const GEM = [
  "..XXX..",
  ".XHHXX.",
  "XHHXXXX",
  "XXXXXXX",
  ".XXXXX.",
  "..XXX..",
  "...X...",
];

function Gem({ px, body, shine }: { px: number; body: string; shine: string }) {
  let bodyPath = "";
  let shinePath = "";
  GEM.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === ".") return;
      const seg = `M${x * px} ${y * px}h${px}v${px}h${-px}z`;
      if (c === "H") shinePath += seg;
      else bodyPath += seg;
    })
  );
  return (
    <svg
      width={7 * px}
      height={7 * px}
      viewBox={`0 0 ${7 * px} ${7 * px}`}
      style={{ display: "flex" }}
    >
      <path d={bodyPath} fill={body} />
      <path d={shinePath} fill={shine} />
    </svg>
  );
}

/** Faint CRT scanlines and a bevelled pixel frame, as one background SVG. */
function Backdrop() {
  const { width: W, height: H } = SHARE_CARD_SIZE;
  let lines = "";
  for (let y = 0; y < H; y += 4) lines += `M0 ${y}h${W}v1h-${W}z`;
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", top: 0, left: 0, display: "flex" }}
    >
      <rect x="0" y="0" width={W} height={H} fill={BG} />
      <rect x="16" y="16" width={W - 32} height={H - 32} fill="#000000" />
      <rect x="22" y="22" width={W - 44} height={H - 44} fill={PANEL} />
      <rect x="22" y="22" width={W - 44} height="4" fill="#2b3a5c" />
      <rect x="22" y="22" width="4" height={H - 44} fill="#2b3a5c" />
      <rect x="22" y={H - 26} width={W - 44} height="4" fill="#03050b" />
      <rect x={W - 26} y="22" width="4" height={H - 44} fill="#03050b" />
      <path d={lines} fill="#ffffff" opacity="0.025" />
    </svg>
  );
}

function Avatar({ login, frame }: { login: string; frame: string }) {
  return (
    <div style={{ display: "flex", padding: 6, background: "#000000" }}>
      <div style={{ display: "flex", padding: 6, background: frame }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori, not the browser */}
        <img
          src={`https://avatars.githubusercontent.com/${encodeURIComponent(login)}?s=440`}
          width={220}
          height={220}
          alt=""
          style={{ display: "flex" }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Pixel text={label} scale={3} color={MUTED} />
      <Pixel text={value} scale={6} color={WHITE} />
    </div>
  );
}

function Header() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Pixel text="^" scale={4} color={ACCENT} />
        <Pixel text="DEVTRACK" scale={4} color={WHITE} />
      </div>
      <Pixel text="DEVTRACK.LIVE" scale={3} color={MUTED} />
    </div>
  );
}

export function ShareCard({ data }: { data: ShareCardData }) {
  const frame =
    data.state === "ranked" ? TIER_STYLE[data.tier].accent : "#4b5873";

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
          gap: 34,
        }}
      >
        <Header />

        <div
          style={{
            display: "flex",
            gap: 56,
            alignItems: "center",
            flexGrow: data.state === "ranked" ? 0 : 1,
          }}
        >
          {data.login && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 18,
              }}
            >
              <Avatar login={data.login} frame={frame} />
              <div
                style={{
                  display: "flex",
                  color: WHITE,
                  fontSize: 30,
                  fontWeight: 700,
                  maxWidth: 260,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                @{data.login}
              </div>
            </div>
          )}

          {data.state === "ranked" ? (
            <RankedPanel data={data} />
          ) : (
            <UnrankedPanel />
          )}
        </div>

        {data.state === "ranked" && (
          <div style={{ display: "flex", gap: 64, marginTop: 4 }}>
            <Stat label="SCORE" value={`${data.scoreV2}/1000`} />
            <Stat label="STREAK" value={`${data.streak}D`} />
            <Stat label="COMMITS" value={fmt.format(data.commits)} />
            <Stat label="PRS" value={fmt.format(data.prs)} />
          </div>
        )}
      </div>
    </div>
  );
}

function RankedPanel({
  data,
}: {
  data: Extract<ShareCardData, { state: "ranked" }>;
}) {
  const style = TIER_STYLE[data.tier];
  const move = data.movement;
  const moveLabel =
    move.kind === "up"
      ? `^${move.places}`
      : move.kind === "down"
        ? `v${move.places}`
        : move.kind === "new"
          ? "NEW"
          : null;
  const barWidth = 380;
  const fill =
    data.levelProgress === null
      ? 0
      : Math.max(8, Math.round(barWidth * data.levelProgress));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <Pixel
        text={`${data.estimated ? "ESTIMATED " : ""}${data.boardLabel} RANK OUT OF ${fmt.format(data.total)}`}
        scale={3}
        color={MUTED}
      />
      <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
        <Pixel text={`#${data.rank}`} scale={16} color={WHITE} />
        {moveLabel && (
          <div style={{ display: "flex", paddingBottom: 6 }}>
            <Pixel
              text={moveLabel}
              scale={6}
              color={move.kind === "down" ? DOWN : UP}
            />
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <Gem px={8} body={style.accent} shine={style.gem} />
        <Pixel
          text={style.label.toUpperCase()}
          scale={7}
          color={style.accent}
        />
      </div>
      {data.level !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Pixel text={`LV ${data.level}`} scale={4} color={WHITE} />
          <div
            style={{
              display: "flex",
              width: barWidth,
              height: 20,
              background: "#000000",
              padding: 3,
            }}
          >
            <div
              style={{
                display: "flex",
                width: barWidth - 6,
                height: 14,
                background: "#1a2440",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: Math.max(0, fill - 6),
                  height: 14,
                  background: style.accent,
                }}
              />
            </div>
          </div>
          {data.xp !== null && (
            <Pixel text={`${fmt.format(data.xp)} XP`} scale={3} color={MUTED} />
          )}
        </div>
      )}
    </div>
  );
}

const LADDER = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
  "legend",
] as const;

function UnrankedPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <Pixel text="DEVTRACK PROFILE" scale={3} color={MUTED} />
      <Pixel text="NOT RANKED YET" scale={9} color={WHITE} />
      <Pixel
        text="TRACK YOUR STREAK. CLIMB THE BOARD."
        scale={3}
        color={ACCENT}
      />
      {/* The ladder there is to climb: one gem per tier, Bronze to Legend. */}
      <div style={{ display: "flex", gap: 30, marginTop: 18 }}>
        {LADDER.map((tier) => (
          <div
            key={tier}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Gem
              px={7}
              body={TIER_STYLE[tier].accent}
              shine={TIER_STYLE[tier].gem}
            />
            <Pixel
              text={TIER_STYLE[tier].label.toUpperCase()}
              scale={2}
              color={TIER_STYLE[tier].accent}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
