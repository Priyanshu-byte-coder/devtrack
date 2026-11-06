import { describe, expect, it } from "vitest";
import { biggestClimbers } from "@/lib/gamification/ranking";

const entries = [
  { id: "a", username: "ada", rank: 1 },
  { id: "b", username: "bob", rank: 2 },
  { id: "c", username: "cy", rank: 3 },
  { id: "d", username: "dee", rank: 4 },
  { id: "e", username: "eve", rank: 5 },
];

describe("biggestClimbers", () => {
  it("ranks by places gained, then by current rank", () => {
    const climbers = biggestClimbers(
      entries,
      { a: 3, b: 4, c: 3, d: 9, e: 4 },
      true
    );
    expect(climbers).toEqual([
      { username: "dee", rank: 4, places: 5 },
      { username: "ada", rank: 1, places: 2 },
      { username: "bob", rank: 2, places: 2 },
    ]);
  });

  it("ignores people who fell, held or are new", () => {
    expect(biggestClimbers(entries, { a: 1, b: 1, e: 2 }, true)).toEqual([]);
  });

  it("has no climbers without a baseline", () => {
    expect(biggestClimbers(entries, { d: 9 }, false)).toEqual([]);
  });

  it("respects the limit", () => {
    expect(
      biggestClimbers(entries, { a: 9, b: 9, c: 9, d: 9 }, true, 2)
    ).toHaveLength(2);
  });
});
