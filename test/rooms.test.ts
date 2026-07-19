import { describe, expect, it } from "vitest";
import {
  githubUsernamesEqual,
  normalizeRoomGithubUsername,
} from "@/lib/rooms";

describe("room username helpers", () => {
  it("normalizes valid GitHub usernames", () => {
    expect(normalizeRoomGithubUsername(" Octocat ")).toBe("Octocat");
  });

  it("rejects invalid GitHub usernames", () => {
    expect(normalizeRoomGithubUsername("../octocat")).toBeNull();
    expect(normalizeRoomGithubUsername("-octocat")).toBeNull();
    expect(normalizeRoomGithubUsername("octocat-")).toBeNull();
  });

  it("compares GitHub usernames case-insensitively", () => {
    expect(githubUsernamesEqual("Octocat", "octocat")).toBe(true);
    expect(githubUsernamesEqual("hubot", "octocat")).toBe(false);
  });
});
