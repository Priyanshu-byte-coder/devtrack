import { describe, expect, it } from "vitest";
import { canonicalRedirectUrl } from "@/lib/canonical-host";

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
});
