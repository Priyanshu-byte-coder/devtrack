import { describe, expect, it } from "vitest";
import {
  FRAMES,
  PALETTE,
  SPRITE_HEIGHT,
  SPRITE_WIDTH,
  frameToRuns,
} from "@/components/buddy/sprites";
import { fillLine, scriptFor } from "@/lib/buddy-lines";

describe("Bit's sprite frames", () => {
  it.each(Object.entries(FRAMES))(
    "%s is a full grid of known colours",
    (_, rows) => {
      expect(rows).toHaveLength(SPRITE_HEIGHT);
      for (const row of rows) {
        expect(row).toHaveLength(SPRITE_WIDTH);
        for (const ch of row) {
          expect(ch === "." || ch in PALETTE).toBe(true);
        }
      }
    }
  );

  it("merges a row into runs of one colour", () => {
    expect(frameToRuns(["KKGG.K"])).toEqual([
      { x: 0, y: 0, width: 2, color: PALETTE.K },
      { x: 2, y: 0, width: 2, color: PALETTE.G },
      { x: 5, y: 0, width: 1, color: PALETTE.K },
    ]);
  });
});

describe("scriptFor", () => {
  it("picks the most specific page", () => {
    expect(scriptFor("/dashboard/goals").stage).toBe("Quest log");
    expect(scriptFor("/dashboard").stage).toBe("HQ");
    expect(scriptFor("/dashboard/rooms/abc").stage).toBe("HQ");
    expect(scriptFor("/u/octocat").stage).toBe("Player card");
    expect(scriptFor("/").stage).toBe("Title screen");
  });

  it("taunts on the leaderboard, with a greeting", () => {
    const script = scriptFor("/leaderboard");
    expect(script.greeting).toBeTruthy();
    expect(script.lines.length).toBeGreaterThan(4);
  });

  it("does not match a prefix inside another word", () => {
    expect(scriptFor("/topics").stage).toBe("DevTrack");
    expect(scriptFor("/compare-x").stage).toBe("DevTrack");
  });
});

describe("fillLine", () => {
  it("names the player, or says player", () => {
    expect(fillLine("Hi {name}!", "octocat")).toBe("Hi @octocat!");
    expect(fillLine("Hi {name}!", null)).toBe("Hi player!");
  });
});
