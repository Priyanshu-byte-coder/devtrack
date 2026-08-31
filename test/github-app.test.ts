/**
 * Tests for the GitHub App service layer (issue #238).
 *
 * Coverage:
 *  - isGitHubAppConfigured      â€” env-var presence checks
 *  - readAppConfig              â€” validation and \n normalisation
 *  - buildAppJwt                â€” JWT structure, RS256 signing, correct claims
 *  - fetchInstallationToken     â€” HTTP request/response handling
 *  - getInstallationToken       â€” caching, refresh, concurrent deduplication
 *  - clearTokenCache            â€” cache eviction
 *  - resolveServerGitHubToken   â€” priority chain (App â†’ PAT â†’ undefined)
 *  - getInstallationRateLimitInfo â€” diagnostics
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { generateKeyPairSync } from "node:crypto";

// â”€â”€ Shared RSA key for all JWT/signing tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Generated once â€” avoids repeated keygen overhead while keeping tests realistic.
const { privateKey: TEST_PRIVATE_KEY } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

// â”€â”€ fetch mock â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** One-hour expiry from a given Unix-ms timestamp. */
function expiresAt(fromMs = Date.now()): string {
  return new Date(fromMs + 60 * 60 * 1000).toISOString();
}

/** Mock a successful installation-token GitHub response. */
function mockSuccessfulTokenFetch(token = "ghs_test_token", fromMs?: number) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ token, expires_at: expiresAt(fromMs) }),
    text: async () => "",
  });
}

/** Decode a base64url string to a plain UTF-8 string. */
function b64urlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

// â”€â”€ env helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function setAppEnv(overrides: Partial<Record<string, string>> = {}) {
  const defaults: Record<string, string> = {
    GITHUB_APP_ID: "12345",
    GITHUB_APP_PRIVATE_KEY: TEST_PRIVATE_KEY,
    GITHUB_APP_INSTALLATION_ID: "99",
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    process.env[k] = v;
  }
}

function clearAppEnv() {
  delete process.env.GITHUB_APP_ID;
  delete process.env.GITHUB_APP_PRIVATE_KEY;
  delete process.env.GITHUB_APP_INSTALLATION_ID;
}

// â”€â”€ isGitHubAppConfigured â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("isGitHubAppConfigured", () => {
  afterEach(clearAppEnv);

  it("returns true when all three env vars are set", async () => {
    setAppEnv();
    const { isGitHubAppConfigured } = await import("@/lib/github-app");
    expect(isGitHubAppConfigured()).toBe(true);
  });

  it("returns false when GITHUB_APP_ID is missing", async () => {
    setAppEnv({ GITHUB_APP_ID: "" });
    const { isGitHubAppConfigured } = await import("@/lib/github-app");
    expect(isGitHubAppConfigured()).toBe(false);
  });

  it("returns false when GITHUB_APP_PRIVATE_KEY is missing", async () => {
    setAppEnv({ GITHUB_APP_PRIVATE_KEY: "" });
    const { isGitHubAppConfigured } = await import("@/lib/github-app");
    expect(isGitHubAppConfigured()).toBe(false);
  });

  it("returns false when GITHUB_APP_INSTALLATION_ID is missing", async () => {
    setAppEnv({ GITHUB_APP_INSTALLATION_ID: "" });
    const { isGitHubAppConfigured } = await import("@/lib/github-app");
    expect(isGitHubAppConfigured()).toBe(false);
  });

  it("returns false when none of the env vars are set", async () => {
    clearAppEnv();
    const { isGitHubAppConfigured } = await import("@/lib/github-app");
    expect(isGitHubAppConfigured()).toBe(false);
  });
});

// â”€â”€ readAppConfig â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("readAppConfig", () => {
  afterEach(clearAppEnv);

  it("returns config when all vars are present", async () => {
    setAppEnv();
    const { readAppConfig } = await import("@/lib/github-app");
    const cfg = readAppConfig();
    expect(cfg.appId).toBe("12345");
    expect(cfg.installationId).toBe("99");
  });

  it("normalises literal \\n sequences in the private key", async () => {
    // Store key with literal \n (as common in Vercel env dashboards)
    const compact = TEST_PRIVATE_KEY.replace(/\n/g, "\\n");
    setAppEnv({ GITHUB_APP_PRIVATE_KEY: compact });
    const { readAppConfig } = await import("@/lib/github-app");
    const cfg = readAppConfig();
    expect(cfg.privateKey).toContain("\n");
    expect(cfg.privateKey).not.toContain("\\n");
  });

  it("throws when GITHUB_APP_ID is absent", async () => {
    setAppEnv({ GITHUB_APP_ID: "" });
    const { readAppConfig } = await import("@/lib/github-app");
    expect(() => readAppConfig()).toThrow("GITHUB_APP_ID is not configured");
  });

  it("throws when GITHUB_APP_PRIVATE_KEY is absent", async () => {
    setAppEnv({ GITHUB_APP_PRIVATE_KEY: "" });
    const { readAppConfig } = await import("@/lib/github-app");
    expect(() => readAppConfig()).toThrow("GITHUB_APP_PRIVATE_KEY is not configured");
  });

  it("throws when GITHUB_APP_INSTALLATION_ID is absent", async () => {
    setAppEnv({ GITHUB_APP_INSTALLATION_ID: "" });
    const { readAppConfig } = await import("@/lib/github-app");
    expect(() => readAppConfig()).toThrow("GITHUB_APP_INSTALLATION_ID is not configured");
  });
});

// â”€â”€ buildAppJwt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("buildAppJwt", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a JWT with three dot-separated parts", async () => {
    const { buildAppJwt } = await import("@/lib/github-app");
    const jwt = buildAppJwt("42", TEST_PRIVATE_KEY);
    expect(jwt.split(".")).toHaveLength(3);
  });

  it("encodes the correct RS256 / JWT header", async () => {
    const { buildAppJwt } = await import("@/lib/github-app");
    const jwt = buildAppJwt("42", TEST_PRIVATE_KEY);
    const header = JSON.parse(b64urlDecode(jwt.split(".")[0]));
    expect(header.alg).toBe("RS256");
    expect(header.typ).toBe("JWT");
  });

  it("encodes the correct iss, iat, and exp claims in the payload", async () => {
    const { buildAppJwt } = await import("@/lib/github-app");
    const jwt = buildAppJwt("99999", TEST_PRIVATE_KEY);
    const payload = JSON.parse(b64urlDecode(jwt.split(".")[1]));

    const now = Math.floor(Date.now() / 1000);
    expect(payload.iss).toBe("99999");
    expect(payload.iat).toBe(now - 60);   // 60 s clock-skew buffer
    expect(payload.exp).toBe(now + 600);  // 10 min lifetime
  });

  it("produces a non-empty signature in the third part", async () => {
    const { buildAppJwt } = await import("@/lib/github-app");
    const jwt = buildAppJwt("1", TEST_PRIVATE_KEY);
    const sig = jwt.split(".")[2];
    expect(sig).toBeTruthy();
    expect(sig.length).toBeGreaterThan(10);
  });

  it("produces different JWTs for different app IDs", async () => {
    const { buildAppJwt } = await import("@/lib/github-app");
    const jwt1 = buildAppJwt("1", TEST_PRIVATE_KEY);
    const jwt2 = buildAppJwt("2", TEST_PRIVATE_KEY);
    expect(jwt1).not.toBe(jwt2);
  });
});

// â”€â”€ fetchInstallationToken â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("fetchInstallationToken", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("returns token and expiresAt on a successful response", async () => {
    const exp = "2025-01-15T13:00:00Z";
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "ghs_abc123", expires_at: exp }),
      text: async () => "",
    });

    const { fetchInstallationToken } = await import("@/lib/github-app");
    const result = await fetchInstallationToken({
      appId: "1",
      privateKey: TEST_PRIVATE_KEY,
      installationId: "99",
    });

    expect(result.token).toBe("ghs_abc123");
    expect(result.expiresAt).toBe(new Date(exp).getTime());
  });

  it("POSTs to the correct GitHub App endpoint", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "t", expires_at: expiresAt() }),
      text: async () => "",
    });

    const { fetchInstallationToken } = await import("@/lib/github-app");
    await fetchInstallationToken({
      appId: "1",
      privateKey: TEST_PRIVATE_KEY,
      installationId: "42",
    });

    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("/app/installations/42/access_tokens");
  });

  it("sends the App JWT in the Authorization header", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "t", expires_at: expiresAt() }),
      text: async () => "",
    });

    const { fetchInstallationToken } = await import("@/lib/github-app");
    await fetchInstallationToken({
      appId: "1",
      privateKey: TEST_PRIVATE_KEY,
      installationId: "1",
    });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers?.Authorization).toMatch(/^Bearer /);
  });

  it("throws when GitHub returns a non-2xx status", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Bad credentials",
    });

    const { fetchInstallationToken } = await import("@/lib/github-app");
    await expect(
      fetchInstallationToken({ appId: "1", privateKey: TEST_PRIVATE_KEY, installationId: "1" })
    ).rejects.toThrow("HTTP 401");
  });

  it("throws when the response body is missing required fields", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
      text: async () => "",
    });

    const { fetchInstallationToken } = await import("@/lib/github-app");
    await expect(
      fetchInstallationToken({ appId: "1", privateKey: TEST_PRIVATE_KEY, installationId: "1" })
    ).rejects.toThrow("missing required fields");
  });
});

// â”€â”€ getInstallationToken â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("getInstallationToken", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(0);
    fetchMock.mockReset();
  });

  afterEach(async () => {
    vi.useRealTimers();
    const mod = await import("@/lib/github-app");
    mod.clearTokenCache();
    clearAppEnv();
  });

  it("fetches a token on the first call", async () => {
    setAppEnv();
    mockSuccessfulTokenFetch("tok-1");
    const { getInstallationToken } = await import("@/lib/github-app");
    const token = await getInstallationToken();
    expect(token).toBe("tok-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the cached token on the second call without a new fetch", async () => {
    setAppEnv();
    mockSuccessfulTokenFetch("tok-cached");
    const { getInstallationToken } = await import("@/lib/github-app");
    const first = await getInstallationToken();
    const second = await getInstallationToken();
    expect(first).toBe("tok-cached");
    expect(second).toBe("tok-cached");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes the token after it crosses the 5-minute refresh threshold", async () => {
    setAppEnv();
    // T=0: token expires at T+1h; refresh threshold = T+55min
    vi.setSystemTime(0);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: "tok-old",
        expires_at: new Date(60 * 60 * 1000).toISOString(),
      }),
      text: async () => "",
    });

    const { getInstallationToken } = await import("@/lib/github-app");
    await getInstallationToken();

    // Advance to T+56min â€” past the 55-minute refresh threshold
    vi.setSystemTime(56 * 60 * 1000);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: "tok-new",
        expires_at: new Date(56 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
      }),
      text: async () => "",
    });

    const refreshed = await getInstallationToken();
    expect(refreshed).toBe("tok-new");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT refresh when the token still has >5 min remaining", async () => {
    setAppEnv();
    vi.setSystemTime(0);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: "tok-valid",
        expires_at: new Date(60 * 60 * 1000).toISOString(),
      }),
      text: async () => "",
    });

    const { getInstallationToken } = await import("@/lib/github-app");
    await getInstallationToken();

    // Advance to T+50min â€” still within the safe window
    vi.setSystemTime(50 * 60 * 1000);
    const second = await getInstallationToken();
    expect(second).toBe("tok-valid");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clears the cache and rethrows when the token request fails", async () => {
    setAppEnv();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    });

    const { getInstallationToken } = await import("@/lib/github-app");
    await expect(getInstallationToken()).rejects.toThrow("HTTP 403");

    // Second call must retry (cache was cleared on failure)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "tok-retry", expires_at: expiresAt() }),
      text: async () => "",
    });

    const token = await getInstallationToken();
    expect(token).toBe("tok-retry");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent refresh requests into a single HTTP call", async () => {
    setAppEnv();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "tok-dedup", expires_at: expiresAt() }),
      text: async () => "",
    });

    const { getInstallationToken } = await import("@/lib/github-app");

    // Three concurrent calls must share the single in-flight request.
    const [a, b, c] = await Promise.all([
      getInstallationToken(),
      getInstallationToken(),
      getInstallationToken(),
    ]);

    expect(a).toBe("tok-dedup");
    expect(b).toBe("tok-dedup");
    expect(c).toBe("tok-dedup");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// â”€â”€ clearTokenCache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("clearTokenCache", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(clearAppEnv);

  it("forces a fresh fetch after the cache is cleared", async () => {
    setAppEnv();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ token: "tok-x", expires_at: expiresAt() }),
      text: async () => "",
    });

    const { getInstallationToken, clearTokenCache } = await import("@/lib/github-app");
    await getInstallationToken(); // populates cache
    clearTokenCache();
    await getInstallationToken(); // should fetch again

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// â”€â”€ resolveServerGitHubToken â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("resolveServerGitHubToken", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(async () => {
    delete process.env.GITHUB_TOKEN;
    clearAppEnv();
    const mod = await import("@/lib/github-app");
    mod.clearTokenCache();
  });

  it("returns the installation token when the App is configured", async () => {
    setAppEnv();
    mockSuccessfulTokenFetch("inst-tok");

    const { resolveServerGitHubToken, clearTokenCache } = await import("@/lib/github-app");
    clearTokenCache();
    const token = await resolveServerGitHubToken();
    expect(token).toBe("inst-tok");
  });

  it("falls back to GITHUB_TOKEN when the App is not configured", async () => {
    clearAppEnv();
    process.env.GITHUB_TOKEN = "pat-token";

    const { resolveServerGitHubToken } = await import("@/lib/github-app");
    const token = await resolveServerGitHubToken();
    expect(token).toBe("pat-token");
    // No GitHub API call should have been made
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to GITHUB_TOKEN when the App token fetch fails", async () => {
    setAppEnv();
    process.env.GITHUB_TOKEN = "fallback-pat";
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Server Error",
    });

    const { resolveServerGitHubToken, clearTokenCache } = await import("@/lib/github-app");
    clearTokenCache();
    const token = await resolveServerGitHubToken();
    expect(token).toBe("fallback-pat");
  });

  it("returns undefined when neither App nor GITHUB_TOKEN is configured", async () => {
    clearAppEnv();
    delete process.env.GITHUB_TOKEN;

    const { resolveServerGitHubToken } = await import("@/lib/github-app");
    const token = await resolveServerGitHubToken();
    expect(token).toBeUndefined();
  });
});

// â”€â”€ getInstallationRateLimitInfo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("getInstallationRateLimitInfo", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(async () => {
    clearAppEnv();
    const mod = await import("@/lib/github-app");
    mod.clearTokenCache();
  });

  it("returns null when the App is not configured", async () => {
    clearAppEnv();
    const { getInstallationRateLimitInfo } = await import("@/lib/github-app");
    const info = await getInstallationRateLimitInfo();
    expect(info).toBeNull();
  });

  it("returns rate limit details on a successful response", async () => {
    setAppEnv();
    mockSuccessfulTokenFetch("tok-rl");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        resources: {
          core: { remaining: 4800, limit: 5000, reset: 1700000000 },
        },
      }),
    });

    const { getInstallationRateLimitInfo, clearTokenCache } = await import("@/lib/github-app");
    clearTokenCache();
    const info = await getInstallationRateLimitInfo();

    expect(info).not.toBeNull();
    expect(info!.remaining).toBe(4800);
    expect(info!.limit).toBe(5000);
    expect(info!.resource).toBe("core");
    expect(info!.resetAt).toBeInstanceOf(Date);
  });

  it("returns null when the rate-limit request fails (non-2xx)", async () => {
    setAppEnv();
    mockSuccessfulTokenFetch("tok-rl2");
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    const { getInstallationRateLimitInfo, clearTokenCache } = await import("@/lib/github-app");
    clearTokenCache();
    const info = await getInstallationRateLimitInfo();
    expect(info).toBeNull();
  });

  it("returns null on network error without throwing", async () => {
    setAppEnv();
    mockSuccessfulTokenFetch("tok-rl3");
    fetchMock.mockRejectedValueOnce(new Error("network failure"));

    const { getInstallationRateLimitInfo, clearTokenCache } = await import("@/lib/github-app");
    clearTokenCache();
    const info = await getInstallationRateLimitInfo();
    expect(info).toBeNull();
  });
});
