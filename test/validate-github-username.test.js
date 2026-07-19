const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadValidatorModule() {
  const sourcePath = path.join(
    __dirname,
    "..",
    "src",
    "lib",
    "validate-github-username.ts"
  );
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "devtrack-github-user-"));
  const outPath = path.join(outDir, "validate-github-username.cjs");
  const source = fs.readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  fs.writeFileSync(outPath, output);
  return require(outPath);
}

test("isValidGitHubUsername accepts valid GitHub usernames", () => {
  const { isValidGitHubUsername } = loadValidatorModule();

  assert.equal(isValidGitHubUsername("octocat"), true);
  assert.equal(isValidGitHubUsername("dev-track"), true);
  assert.equal(isValidGitHubUsername("A1b2C3"), true);
  assert.equal(isValidGitHubUsername("a".repeat(39)), true);
});

test("isValidGitHubUsername rejects path and query injection attempts", () => {
  const { isValidGitHubUsername } = loadValidatorModule();

  assert.equal(isValidGitHubUsername("../search/repositories?q=test"), false);
  assert.equal(isValidGitHubUsername("someuser+org:private-org"), false);
  assert.equal(isValidGitHubUsername("-leadinghyphen"), false);
  assert.equal(isValidGitHubUsername("trailinghyphen-"), false);
  assert.equal(isValidGitHubUsername("a".repeat(40)), false);
});

test("normalizeGitHubUsername trims and validates input", () => {
  const { normalizeGitHubUsername } = loadValidatorModule();

  assert.equal(normalizeGitHubUsername("  octocat  "), "octocat");
  assert.equal(normalizeGitHubUsername(""), null);
  assert.equal(normalizeGitHubUsername("   "), null);
  assert.equal(normalizeGitHubUsername(null), null);
  assert.equal(normalizeGitHubUsername("bad/user"), null);
});

test("normalizeGitHubUsername rejects unicode characters", () => {
  const { normalizeGitHubUsername } = loadValidatorModule();

  assert.equal(normalizeGitHubUsername("user name"), null);
  assert.equal(normalizeGitHubUsername("user@name"), null);
  assert.equal(normalizeGitHubUsername("user#name"), null);
  assert.equal(normalizeGitHubUsername("user$name"), null);
  assert.equal(normalizeGitHubUsername("user%name"), null);
});

test("normalizeGitHubUsername rejects very long strings", () => {
  const { normalizeGitHubUsername } = loadValidatorModule();

  assert.equal(normalizeGitHubUsername("a".repeat(50)), null);
  assert.equal(normalizeGitHubUsername("a".repeat(100)), null);
});

test("normalizeGitHubUsername handles single character", () => {
  const { normalizeGitHubUsername } = loadValidatorModule();

  assert.equal(normalizeGitHubUsername("a"), "a");
  assert.equal(normalizeGitHubUsername("x"), "x");
});

test("normalizeGitHubUsername rejects names with spaces", () => {
  const { normalizeGitHubUsername } = loadValidatorModule();

  assert.equal(normalizeGitHubUsername("user name"), null);
  assert.equal(normalizeGitHubUsername("user name"), null);
});

test("normalizeGitHubUsername rejects special characters", () => {
  const { normalizeGitHubUsername } = loadValidatorModule();

  assert.equal(normalizeGitHubUsername("user!name"), null);
  assert.equal(normalizeGitHubUsername("user&name"), null);
  assert.equal(normalizeGitHubUsername("user*name"), null);
  assert.equal(normalizeGitHubUsername("user/name"), null);
  assert.equal(normalizeGitHubUsername("user_name"), null);
});

test("isValidGitHubUsername rejects underscores and special chars", () => {
  const { isValidGitHubUsername } = loadValidatorModule();

  assert.equal(isValidGitHubUsername("user_name"), false);
  assert.equal(isValidGitHubUsername("user.name"), false);
  assert.equal(isValidGitHubUsername("user@name"), false);
  assert.equal(isValidGitHubUsername("user name"), false);
});

test("isValidGitHubUsername accepts hyphens in middle", () => {
  const { isValidGitHubUsername, normalizeGitHubUsername } = loadValidatorModule();

  assert.equal(isValidGitHubUsername("user-name"), true);
  assert.equal(normalizeGitHubUsername("user-name"), "user-name");
});

test("isValidGitHubUsername rejects underscores and special chars", () => {
  const { isValidGitHubUsername } = loadValidatorModule();

  assert.equal(isValidGitHubUsername("user_name"), false);
  assert.equal(isValidGitHubUsername("user.name"), false);
  assert.equal(isValidGitHubUsername("user@name"), false);
  assert.equal(isValidGitHubUsername("user name"), false);
});

test("normalizeGitHubUsername handles undefined input", () => {
  const { normalizeGitHubUsername } = loadValidatorModule();

  assert.equal(normalizeGitHubUsername(undefined), null);
  assert.equal(normalizeGitHubUsername(), null);
});

test("normalizeGitHubUsername trims leading and trailing whitespace", () => {
  const { normalizeGitHubUsername } = loadValidatorModule();

  assert.equal(normalizeGitHubUsername("  octocat"), "octocat");
  assert.equal(normalizeGitHubUsername("octocat  "), "octocat");
  assert.equal(normalizeGitHubUsername("  octocat  "), "octocat");
});
