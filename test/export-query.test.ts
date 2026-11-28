import { describe, it, expect } from "vitest";
import { checkedExportQuery } from "@/lib/export-query";

describe("checkedExportQuery", () => {
  it("returns the original result when there is no error", () => {
    const result = { data: [{ id: 1 }], error: null };

    expect(checkedExportQuery(result)).toBe(result);
  });

  it("preserves empty datasets when the query succeeds", () => {
    const result = { data: [], error: null };

    expect(checkedExportQuery(result)).toEqual(result);
  });

  it("throws when the query returns an error", () => {
    const result = { data: null, error: new Error("Database unavailable") };

    expect(() => checkedExportQuery(result)).toThrow(
      "Export data is unavailable"
    );
  });

  it("throws for any truthy error value", () => {
    expect(() =>
      checkedExportQuery({ data: null, error: "query failed" })
    ).toThrow("Export data is unavailable");
  });

  it("allows results without an error property", () => {
    const result = { data: ["export"] };

    expect(checkedExportQuery(result)).toBe(result);
  });
});
