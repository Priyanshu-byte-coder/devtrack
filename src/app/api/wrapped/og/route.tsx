import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import {
  Backdrop,
  Header,
  MUTED,
  Pixel,
  SHARE_CARD_SIZE,
  WHITE,
} from "@/lib/gamification/share-card";

export const runtime = "nodejs";

// Gold, as on the Year in Code screens.
const GOLD = "#f2c14e";
const fmt = new Intl.NumberFormat("en-US");

function getParam(req: NextRequest, key: string, fallback: string) {
  const value = req.nextUrl.searchParams.get(key);
  return value && value.trim().length > 0 ? value.slice(0, 80) : fallback;
}

/** Digits only, so a crafted URL can't draw arbitrary text in the pixel font. */
function getCount(req: NextRequest, key: string): string | null {
  const value = Number(req.nextUrl.searchParams.get(key));
  return Number.isFinite(value) && value >= 0
    ? fmt.format(Math.floor(value))
    : null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        width: 330,
      }}
    >
      <Pixel text={label} scale={3} color={MUTED} />
      <Pixel text={value} scale={6} color={WHITE} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        flex: 1,
        minWidth: 0,
      }}
    >
      <Pixel text={label} scale={3} color={MUTED} />
      <div
        style={{
          display: "flex",
          fontSize: 34,
          fontWeight: 700,
          color: WHITE,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          maxWidth: 500,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export async function GET(req: NextRequest) {
  const username = getParam(req, "username", "developer");
  const year = String(
    Math.min(
      2100,
      Math.max(
        2008,
        Number(getParam(req, "year", "")) || new Date().getFullYear()
      )
    )
  );
  const commits = getCount(req, "commits") ?? "0";
  const streak = getCount(req, "streak") ?? "0";
  const prs = getCount(req, "prs");
  const days = getCount(req, "days");
  const language = getParam(req, "language", "Code");
  const repo = getParam(req, "repo", "DevTrack");

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
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
          padding: "52px 64px",
          gap: 26,
        }}
      >
        <Header />

        <div style={{ display: "flex", gap: 56, alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", padding: 6, background: "#000000" }}>
              <div style={{ display: "flex", padding: 6, background: GOLD }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori, not the browser */}
                <img
                  src={`https://avatars.githubusercontent.com/${encodeURIComponent(username)}?s=360`}
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
                fontSize: 28,
                color: WHITE,
                maxWidth: 240,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              {`@${username}`}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
              <Pixel text={year} scale={12} color={GOLD} />
              <div style={{ display: "flex", paddingBottom: 6 }}>
                <Pixel text="YEAR IN CODE" scale={4} color={WHITE} />
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                rowGap: 20,
                width: 660,
              }}
            >
              <Stat label="COMMITS" value={commits} />
              <Stat label="BEST STREAK" value={`${streak}D`} />
              {prs !== null && <Stat label="PRS MERGED" value={prs} />}
              {days !== null && <Stat label="ACTIVE DAYS" value={days} />}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 40,
            marginTop: "auto",
            paddingTop: 22,
            borderTop: "4px solid #1c2740",
          }}
        >
          <Detail label="TOP LANGUAGE" value={language} />
          <Detail label="TOP REPO" value={repo} />
        </div>
      </div>
    </div>,
    {
      ...SHARE_CARD_SIZE,
      // Drawn only from the query string, so the same URL is the same image.
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      },
    }
  );
}
