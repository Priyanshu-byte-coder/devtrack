import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

function getParam(req: NextRequest, key: string, fallback: string) {
  const value = req.nextUrl.searchParams.get(key);
  return value && value.trim().length > 0 ? value.slice(0, 80) : fallback;
}

export async function GET(req: NextRequest) {
  const username = getParam(req, "username", "developer");
  const year = getParam(req, "year", String(new Date().getFullYear()));
  const commits = getParam(req, "commits", "0");
  const streak = getParam(req, "streak", "0");
  const language = getParam(req, "language", "Code");
  const repo = getParam(req, "repo", "DevTrack");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0b1020",
          color: "#f8fafc",
          padding: "58px 64px",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                color: "#67e8f9",
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: 3,
                textTransform: "uppercase",
              }}
            >
              DevTrack Wrapped
            </div>
            <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 0.95 }}>
              {`@${username}`}
            </div>
          </div>
          <div
            style={{
              border: "2px solid rgba(248,250,252,0.2)",
              borderRadius: 18,
              padding: "18px 24px",
              fontSize: 32,
              fontWeight: 800,
              color: "#fde68a",
              height: 72,
            }}
          >
            {year}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 22,
            width: "100%",
          }}
        >
          <Stat label="Commits" value={commits} color="#67e8f9" />
          <Stat label="Longest streak" value={`${streak}d`} color="#a7f3d0" />
          <Stat label="Top language" value={language} color="#fde68a" />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(248,250,252,0.16)",
            paddingTop: 24,
          }}
        >
          <div style={{ fontSize: 28, color: "#cbd5e1" }}>
            {`Most contributed repo: ${repo}`}
          </div>
          <div style={{ fontSize: 24, color: "#94a3b8" }}>devtrack.app</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        border: "1px solid rgba(248,250,252,0.16)",
        borderRadius: 20,
        background: "rgba(255,255,255,0.06)",
        padding: 28,
        minHeight: 168,
      }}
    >
      <div style={{ color, fontSize: 54, fontWeight: 900, lineHeight: 1 }}>
        {value}
      </div>
      <div
        style={{
          color: "#cbd5e1",
          fontSize: 22,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}
