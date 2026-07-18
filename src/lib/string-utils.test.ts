import { describe, it, expect } from "vitest";
import { cleanUsername, formatRepositoryName } from "./string-utils";

describe("String Utilities", () => {
  it("should clean and normalize username", () => {
    expect(cleanUsername("  Pratikshya32  ")).toBe("pratikshya32");
  });

  it("should format repository names", () => {
    expect(formatRepositoryName("Dev Track Repository")).toBe("dev-track-repository");
  });
});
