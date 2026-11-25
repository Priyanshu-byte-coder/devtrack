import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { locales } from "../src/i18n/config";

/** The allowed values in the most recent users.preferred_locale CHECK. */
function allowedLocalesInSchema(): string[] {
  const dir = join(__dirname, "..", "supabase", "migrations");
  let allowed: string[] = [];
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(join(dir, file), "utf8");
    for (const match of sql.matchAll(/preferred_locale\s+IN\s*\(([^)]*)\)/gi)) {
      allowed = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    }
  }
  return allowed;
}

describe("users.preferred_locale constraint", () => {
  it("allows every locale the app offers", () => {
    // A new UI language also needs a migration widening this CHECK, or
    // saving it in Settings fails with "preference not saved".
    const allowed = allowedLocalesInSchema();
    for (const locale of locales) expect(allowed).toContain(locale);
  });
});
