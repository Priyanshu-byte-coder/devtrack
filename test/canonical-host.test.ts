import { describe, expect, it } from "vitest";
import {
  canonicalRedirectUrl,
  lowercaseProfilePath,
} from "@/lib/canonical-host";

describe("canonicalRedirectUrl", () => {
  it("sends production vercel.app aliases to the canonical domain", () => {
    expect(
      canonicalRedirectUrl(
        "devtrack-silk-kappa.vercel.app",
        "/u/octocat?tab=stats",
        "production"
      )
    ).toBe("https://devtrack.live/u/octocat?tab=stats");
  });

  it("leaves preview deployments and the canonical host alone", () => {
    expect(
      canonicalRedirectUrl("devtrack-git-feature.vercel.app", "/", "preview")
    ).toBeNull();
    expect(canonicalRedirectUrl("devtrack.live", "/", "production")).toBeNull();
    expect(canonicalRedirectUrl("localhost:3000", "/", undefined)).toBeNull();
  });

  it("only touches vercel.app hosts, not other custom domains", () => {
    expect(
      canonicalRedirectUrl("www.devtrack.live", "/", "production")
    ).toBeNull();
  });

  it("never redirects API routes, so scheduled jobs reach the handler", () => {
    for (const path of [
      "/api/cron/gamification",
      "/api/cron/goals-sync?x=1",
      "/api/notifications/weekly",
      "/api",
    ])
      expect(
        canonicalRedirectUrl("devtrack-abc.vercel.app", path, "production")
      ).toBeNull();
    // Pages on the same alias still go to the canonical domain.
    expect(
      canonicalRedirectUrl("devtrack-abc.vercel.app", "/apis", "production")
    ).not.toBeNull();
  });
});

describe("lowercaseProfilePath", () => {
  it("lowercases the login of a profile path", () => {
    expect(lowercaseProfilePath("/u/Neal006")).toBe("/u/neal006");
    expect(lowercaseProfilePath("/u/Neal006/goals/42")).toBe(
      "/u/neal006/goals/42"
    );
  });

  it("leaves canonical and non-profile paths alone", () => {
    expect(lowercaseProfilePath("/u/neal006")).toBeNull();
    expect(lowercaseProfilePath("/u/neal006/goals/AbC")).toBeNull();
    expect(lowercaseProfilePath("/leaderboard")).toBeNull();
    expect(lowercaseProfilePath("/U/Neal006")).toBeNull();
  });
});
