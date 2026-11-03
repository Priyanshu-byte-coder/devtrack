import { describe, expect, it } from "vitest";
import { celebrationFor } from "@/components/gamification/LevelUpCelebration";

describe("celebrationFor", () => {
  it("celebrates nothing on the first visit", () => {
    expect(celebrationFor(null, { level: 9, tier: "gold" })).toBeNull();
  });

  it("celebrates a level up", () => {
    expect(
      celebrationFor({ level: 9, tier: "gold" }, { level: 11, tier: "gold" })
    ).toEqual({ kind: "level", from: 9, to: 11 });
  });

  it("prefers a tier up over a level up", () => {
    expect(
      celebrationFor(
        { level: 9, tier: "gold" },
        { level: 12, tier: "platinum" }
      )
    ).toEqual({ kind: "tier", from: "gold", to: "platinum" });
  });

  it("stays quiet when nothing went up", () => {
    expect(
      celebrationFor({ level: 9, tier: "gold" }, { level: 9, tier: "silver" })
    ).toBeNull();
    expect(
      celebrationFor({ level: null, tier: "gold" }, { level: 4, tier: "gold" })
    ).toBeNull();
  });
});
