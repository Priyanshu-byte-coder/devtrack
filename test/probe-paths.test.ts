import { describe, expect, it } from "vitest";
import { isProbePath } from "@/lib/probe-paths";

describe("isProbePath", () => {
  it("spots scanner probes", () => {
    for (const p of [
      "/wp-admin/install.php",
      "/wp-login.php",
      "/xmlrpc.php",
      "/.env",
      "/.git/config",
      "/phpmyadmin/",
      "/backup.sql",
      "/index.php",
    ])
      expect(isProbePath(p), p).toBe(true);
  });

  it("leaves real pages alone", () => {
    for (const p of [
      "/",
      "/u/octocat",
      "/u/wp-dev",
      "/guides/github-streak",
      "/api/leaderboard",
      "/leaderboard",
    ])
      expect(isProbePath(p), p).toBe(false);
  });
});
