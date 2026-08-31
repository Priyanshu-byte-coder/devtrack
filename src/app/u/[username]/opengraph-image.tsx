import { ImageResponse } from "next/og";
import { getUserByUsername } from "@/lib/supabase";
import {
  fetchPublicContributions,
  fetchPublicStreak,
  fetchTopLanguage,
} from "@/lib/public-profile-data";

export const runtime = "nodejs";
export const alt = "DevTrack Profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Do not export `revalidate` here because the GitHub-backed data fetches used by
// this route are currently performed as uncached requests by the shared helpers.

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  try {
    const user = await getUserByUsername(username);

    if (!user) {
      return new ImageResponse(
        (
          <div
            style={{
              height: "100%",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#09090b",
              color: "#ffffff",
              fontFamily: "sans-serif",
            }}
          >
            <h1 style={{ fontSize: 80, fontWeight: "bold", color: "#f8fafc" }}>
              DevTrack
            </h1>
            <p style={{ fontSize: 40, color: "#a1a1aa", marginTop: 20 }}>
              Profile Not Found
            </p>
          </div>
        ),
        { ...size }
      );
    }

    const githubToken = process.env.GITHUB_TOKEN;

    const [contributions, streak, topLanguage] = await Promise.all([
      fetchPublicContributions(user.github_login, githubToken, 30),
      fetchPublicStreak(user.github_login, githubToken, user.timezone),
      fetchTopLanguage(user.github_login, githubToken),
    ]);

    const avatarUrl = `https://avatars.githubusercontent.com/${user.github_login}`;

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            backgroundColor: "#09090b", // Deep dark background
            backgroundImage: "linear-gradient(to bottom right, #09090b, #18181b)",
            color: "#ffffff",
            padding: 80,
            fontFamily: "sans-serif",
          }}
        >
          {/* Header Section */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 60 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy"
              src={avatarUrl}
              alt={user.github_login}
              style={{
                width: 160,
                height: 160,
                borderRadius: "50%",
                marginRight: 40,
                border: "4px solid #3b82f6", // DevTrack accent color
              }}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <h1
                style={{
                  fontSize: 72,
                  fontWeight: "bold",
                  margin: 0,
                  lineHeight: 1,
                  color: "#f8fafc",
                }}
              >
                {user.github_login}
              </h1>
              <p
                style={{
                  fontSize: 32,
                  color: "#a1a1aa",
                  margin: 0,
                  marginTop: 10,
                }}
              >
                DevTrack Profile
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ display: "flex", gap: 30, width: "100%" }}>
            {/* Streak Stat */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                backgroundColor: "rgba(255,255,255,0.05)",
                padding: "30px 40px",
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.1)",
                flex: 1,
              }}
            >
              <span style={{ fontSize: 28, color: "#a1a1aa", marginBottom: 10 }}>
                Current Streak
              </span>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <span style={{ fontSize: 56, fontWeight: "bold", color: "#3b82f6" }}>
                  {streak.current}
                </span>
                <span style={{ fontSize: 24, marginLeft: 10, color: "#a1a1aa" }}>
                  days
                </span>
              </div>
            </div>

            {/* Commits Stat */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                backgroundColor: "rgba(255,255,255,0.05)",
                padding: "30px 40px",
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.1)",
                flex: 1,
              }}
            >
              <span style={{ fontSize: 28, color: "#a1a1aa", marginBottom: 10 }}>
                Commits (30d)
              </span>
              <span style={{ fontSize: 56, fontWeight: "bold", color: "#10b981" }}>
                {contributions.total}
              </span>
            </div>

            {/* Top Language Stat */}
            {topLanguage && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  padding: "30px 40px",
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.1)",
                  flex: 1,
                }}
              >
                <span style={{ fontSize: 28, color: "#a1a1aa", marginBottom: 10 }}>
                  Top Language
                </span>
                <span style={{ fontSize: 56, fontWeight: "bold", color: "#f59e0b" }}>
                  {topLanguage}
                </span>
              </div>
            )}
          </div>
        </div>
      ),
      { ...size }
    );
  } catch (e) {
    console.error("Error generating OG image:", e);
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#09090b",
            color: "#ffffff",
            fontFamily: "sans-serif",
          }}
        >
          <h1 style={{ fontSize: 80, fontWeight: "bold", color: "#f8fafc" }}>
            DevTrack
          </h1>
          <p style={{ fontSize: 40, color: "#a1a1aa", marginTop: 20 }}>
            Error generating image
          </p>
        </div>
      ),
      { ...size }
    );
  }
}
