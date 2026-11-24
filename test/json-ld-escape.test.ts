import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "../src/lib/seo/json-ld";

describe("serializeJsonLd", () => {
  it("escapes < so a bio cannot close the script tag", () => {
    const out = serializeJsonLd({
      description: "hi </script><script>alert(1)</script>",
    });
    expect(out).not.toContain("<");
    // A backslash, then u003c: the JSON escape for "<".
    expect(out).toContain(String.fromCharCode(92) + "u003c/script>");
  });

  it("still parses back to the original value", () => {
    const data = { name: "<b>ada</b>", list: ["a<b"] };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });
});
