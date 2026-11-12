import { describe, expect, it } from "vitest";
import { filterGoals } from "@/lib/goal-tracker";

const goals = [
  {
    id: "1",
    title: "Write Tests",
    target: 5,
    current: 2,
    category: "work" as const,
  },
  {
    id: "2",
    title: "Weekly Commit Goal",
    target: 10,
    current: 10,
    category: null,
  },
  {
    id: "3",
    title: "Solve DSA problems",
    target: 20,
    current: 25,
    category: "dsa" as const,
  },
  {
    id: "4",
    title: "Ship open-source PR",
    target: 3,
    current: 0,
    category: "open-source" as const,
  },
];

const ids = (list: { id: string }[]) => list.map((g) => g.id);

describe("filterGoals", () => {
  it("returns every goal by default", () => {
    expect(ids(filterGoals(goals, {}))).toEqual(["1", "2", "3", "4"]);
  });

  it("matches the title case-insensitively and trims the query", () => {
    expect(ids(filterGoals(goals, { query: "  WEEKLY " }))).toEqual(["2"]);
    expect(ids(filterGoals(goals, { query: "open-source" }))).toEqual(["4"]);
  });

  it("returns nothing when no title matches", () => {
    expect(filterGoals(goals, { query: "zzz" })).toEqual([]);
  });

  it("treats a whitespace-only query as no search", () => {
    expect(filterGoals(goals, { query: "   " })).toHaveLength(4);
  });

  it("filters active goals (current < target)", () => {
    expect(ids(filterGoals(goals, { status: "active" }))).toEqual(["1", "4"]);
  });

  it("filters completed goals, including surpassed ones (current >= target)", () => {
    expect(ids(filterGoals(goals, { status: "completed" }))).toEqual([
      "2",
      "3",
    ]);
  });

  it("combines search, status and category", () => {
    expect(
      ids(filterGoals(goals, { query: "o", status: "completed" }))
    ).toEqual(["2", "3"]);
    expect(
      ids(filterGoals(goals, { status: "completed", category: "dsa" }))
    ).toEqual(["3"]);
    expect(filterGoals(goals, { status: "active", category: "dsa" })).toEqual(
      []
    );
  });

  it("does not mutate the input", () => {
    const copy = [...goals];
    filterGoals(goals, { status: "active" });
    expect(goals).toEqual(copy);
  });
});
