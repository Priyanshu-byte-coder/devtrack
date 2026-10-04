import { describe, it, expect, afterEach } from "vitest";
import { getAppBaseUrl, getProfileUrl } from "@/lib/profile-url";

describe("profile-url", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalAuthUrl = process.env.NEXTAUTH_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    process.env.NEXTAUTH_URL = originalAuthUrl;
  });

  it("builds profile URL from explicit origin", () => {
    expect(getProfileUrl("alice", "https://devtrack.example")).toBe(
      "https://devtrack.example/u/alice",
    );
  });

  it("strips trailing slash from base URL", () => {
    expect(getProfileUrl("bob", "https://devtrack.example/")).toBe(
      "https://devtrack.example/u/bob",
    );
  });

  it("falls back to NEXT_PUBLIC_APP_URL when origin is omitted", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.devtrack.io";
    delete process.env.NEXTAUTH_URL;

    expect(getProfileUrl("carol")).toBe("https://app.devtrack.io/u/carol");
    expect(getAppBaseUrl()).toBe("https://app.devtrack.io");
  });
});
