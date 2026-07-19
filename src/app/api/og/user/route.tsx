import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { normalizeOgUserParams } from "@/lib/og-user-params";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const { username, name, avatar, topLang, streak, commits } =
    normalizeOgUserParams(searchParams);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: "0", backgroundImage: "radial-gradient(circle at 1px 1px, rgba(99,102,241,0.18) 1px, transparent 0)", backgroundSize: "44px 44px", display: "flex" }} />
        <div style={{ position: "absolute", top: "-100px", left: "-100px", width: "420px", height: "420px", borderRadius: "50%", background: "rgba(99,102,241,0.18)", filter: "blur(90px)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: "-100px", right: "-100px", width: "420px", height: "420px", borderRadius: "50%", background: "rgba(16,185,129,0.12)", filter: "blur(90px)", display: "flex" }} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "36px", background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.09)", borderRadius: "28px", padding: "52px 72px", zIndex: 10 }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element 
              <img src={avatar} alt={`${username} avatar`} width={100} height={100} style={{ borderRadius: "50%", border: "3px solid rgba(99,102,241,0.7)", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100px", height: "100px", borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#10b981)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "44px", fontWeight: 700, color: "#fff" }}>
                {username[0]?.toUpperCase()}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "38px", fontWeight: 700, color: "#f8fafc" }}>{name}</span>
              <span style={{ fontSize: "20px", color: "#94a3b8" }}>@{username}</span>
            </div>
          </div>

          <div style={{ width: "100%", height: "1px", background: "rgba(255,255,255,0.08)", display: "flex" }} />

          <div style={{ display: "flex", gap: "56px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px", color: "#94a3b8" }}>🔥 Streak</span>
              <span style={{ fontSize: "30px", fontWeight: 700, color: "#f97316" }}>{streak} days</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px", color: "#94a3b8" }}>📦 Commits</span>
              <span style={{ fontSize: "30px", fontWeight: 700, color: "#6366f1" }}>{commits.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px", color: "#94a3b8" }}>⚡ Top Language</span>
              <span style={{ fontSize: "30px", fontWeight: 700, color: "#10b981" }}>{topLang}</span>
            </div>
          </div>
        </div>

        <div style={{ position: "absolute", bottom: "26px", display: "flex", alignItems: "center", gap: "8px", fontSize: "15px", color: "#475569" }}>
          <span style={{ color: "#6366f1", fontWeight: 700 }}>DevTrack</span>
          <span>· devtrack.app/u/{username}</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
