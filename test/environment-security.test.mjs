import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const validator = resolve("scripts/validate-env.js");
const scanner = resolve("scripts/check-env-security.js");
function isolated(run) {
  const dir = mkdtempSync(join(tmpdir(), "devtrack-env-test-"));
  const env = { ...process.env, ENCRYPTION_KEY: "a".repeat(64) };
  for (const name of Object.keys(env))
    if (name.startsWith("NEXT_PUBLIC_") || ["NEXTAUTH_URL"].includes(name))
      delete env[name];
  try {
    run(dir, env);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
test("private credentials pass in CI and normal builds", () =>
  isolated((dir, env) => {
    for (const CI of ["true", "false"]) {
      const result = spawnSync(process.execPath, [validator], {
        cwd: dir,
        env: {
          ...env,
          CI,
          NEXTAUTH_SECRET: "dummy",
          GITHUB_SECRET: "dummy",
          GROQ_API_KEY: "dummy",
        },
        encoding: "utf8",
      });
      assert.equal(result.status, 0, result.stderr);
    }
  }));
test("dotenv public secret canary fails even in CI without disclosing its value", () =>
  isolated((dir, env) => {
    const canary = "harmless-canary-value";
    writeFileSync(
      join(dir, ".env.local"),
      `NEXT_PUBLIC_PRIVATE_TOKEN=${canary}`
    );
    const result = spawnSync(process.execPath, [validator], {
      cwd: dir,
      env: { ...env, CI: "true" },
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /NEXT_PUBLIC_PRIVATE_TOKEN/);
    assert.ok(!result.stderr.includes(canary));
  }));
test("invalid encryption key is rejected", () =>
  isolated((dir, env) => {
    assert.equal(
      spawnSync(process.execPath, [validator], {
        cwd: dir,
        env: { ...env, ENCRYPTION_KEY: "wrong" },
      }).status,
      1
    );
  }));
for (const ext of ["js", "jsx", "ts", "tsx", "mjs", "cjs"])
  test(`source scanner detects ${ext} secret references`, () =>
    isolated((dir, env) => {
      writeFileSync(
        join(dir, `canary.${ext}`),
        "process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"
      );
      assert.equal(
        spawnSync(process.execPath, [scanner, dir], { env }).status,
        1
      );
    }));
