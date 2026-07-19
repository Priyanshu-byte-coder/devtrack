const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadCryptoModule() {
  const sourcePath = path.join(__dirname, "..", "src", "lib", "crypto.ts");
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "devtrack-crypto-"));
  const outPath = path.join(outDir, "crypto.cjs");
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

test("decryptToken rejects malformed IV before decipher creation", () => {
  const { decryptToken } = loadCryptoModule();
  process.env.ENCRYPTION_KEY = "a".repeat(64);
  const originalError = console.error;
  console.error = () => {};

  try {
    assert.equal(decryptToken("0".repeat(32), "abcd"), null);
  } finally {
    console.error = originalError;
  }
});

test("decryptToken rejects payloads shorter than the auth tag", () => {
  const { decryptToken } = loadCryptoModule();
  process.env.ENCRYPTION_KEY = "b".repeat(64);
  const originalError = console.error;
  console.error = () => {};

  try {
    assert.equal(decryptToken("0".repeat(30), "1".repeat(24)), null);
  } finally {
    console.error = originalError;
  }
});

test("decryptToken still decrypts valid encrypted tokens", () => {
  const { decryptToken, encryptToken } = loadCryptoModule();
  process.env.ENCRYPTION_KEY = "c".repeat(64);

  const encrypted = encryptToken("github-token-123");

  assert.equal(
    decryptToken(encrypted.encrypted, encrypted.iv),
    "github-token-123"
  );
});

test("safeCompare returns true for identical strings", () => {
  const { safeCompare } = loadCryptoModule();
  assert.equal(safeCompare("test", "test"), true);
});

test("safeCompare returns false for different length strings", () => {
  const { safeCompare } = loadCryptoModule();
  assert.equal(safeCompare("short", "longerstring"), false);
});

test("safeCompare returns false for non-identical strings of same length", () => {
  const { safeCompare } = loadCryptoModule();
  assert.equal(safeCompare("aaaa", "bbbb"), false);
});

test("safeCompare returns true for empty strings", () => {
  const { safeCompare } = loadCryptoModule();
  assert.equal(safeCompare("", ""), true);
});

test("safeCompare returns false for empty vs non-empty", () => {
  const { safeCompare } = loadCryptoModule();
  assert.equal(safeCompare("", "a"), false);
  assert.equal(safeCompare("a", ""), false);
});

test("verifyGitHubSignature returns true for valid signature", () => {
  const { verifyGitHubSignature, getExpectedSignature } = loadCryptoModule();
  const secret = "webhook-secret-123";
  const body = '{"action":"push"}';
  const validSignature = getExpectedSignature(secret, body);
  assert.equal(verifyGitHubSignature(body, validSignature, secret), true);
});

test("verifyGitHubSignature returns false for invalid signature", () => {
  const { verifyGitHubSignature } = loadCryptoModule();
  const secret = "webhook-secret-123";
  const body = '{"action":"push"}';
  const invalidSignature = "sha256=0000000000000000000000000000000000000000000000000000000000000000";
  assert.equal(verifyGitHubSignature(body, invalidSignature, secret), false);
});

test("verifyGitHubSignature returns false for null signature", () => {
  const { verifyGitHubSignature } = loadCryptoModule();
  const secret = "webhook-secret-123";
  const body = '{"action":"push"}';
  assert.equal(verifyGitHubSignature(body, null, secret), false);
});

test("verifyGitHubSignature returns false for signature without sha256 prefix", () => {
  const { verifyGitHubSignature } = loadCryptoModule();
  const secret = "webhook-secret-123";
  const body = '{"action":"push"}';
  const badSignature = "abc123def456";
  assert.equal(verifyGitHubSignature(body, badSignature, secret), false);
});
