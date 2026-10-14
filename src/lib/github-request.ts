import "server-only";
import {
  GitHubRateLimitError,
  getGitHubRateLimitDetails,
} from "@/lib/github-rate-limit";
import { cacheGet, cacheSet } from "@/lib/metrics-cache";

type StoredResponse = {
  body: string;
  status: number;
  headers: [string, string][];
  savedAt: number;
};
const flights = new Map<string, Promise<StoredResponse>>();
const queues = new Map<string, Promise<void>>();
const cooldowns = new Map<string, number>();
const REQUEST_TIMEOUT_MS = 12_000;
const FRESH_MS = 30_000;

async function hash(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}
function asResponse(value: StoredResponse) {
  const response = new Response(
    [204, 205, 304].includes(value.status) ? null : value.body,
    { status: value.status, headers: value.headers }
  );
  const details = getGitHubRateLimitDetails(response);
  if (details)
    throw new GitHubRateLimitError(
      details,
      Number(response.headers.get("retry-after")) || 60
    );
  return response;
}
function retrySeconds(response: Response, body: string): number | null {
  if (![403, 429].includes(response.status)) return null;
  const rawRetry = response.headers.get("retry-after");
  const remaining = response.headers.get("x-ratelimit-remaining");
  if (
    response.status !== 429 &&
    rawRetry === null &&
    remaining !== "0" &&
    !/secondary rate limit|rate limit exceeded|exceeded a secondary/i.test(body)
  )
    return null;
  const numeric = rawRetry === null ? NaN : Number(rawRetry);
  const dateDelay = rawRetry ? (Date.parse(rawRetry) - Date.now()) / 1000 : NaN;
  if (Number.isFinite(numeric)) return Math.max(1, Math.ceil(numeric));
  if (Number.isFinite(dateDelay)) return Math.max(1, Math.ceil(dateDelay));
  if (remaining === "0") {
    const reset = Number(response.headers.get("x-ratelimit-reset"));
    if (Number.isFinite(reset) && reset > Date.now() / 1000)
      return Math.ceil(reset - Date.now() / 1000);
  }
  return 60;
}
function limited(until: number): StoredResponse {
  const seconds = Math.max(1, Math.ceil((until - Date.now()) / 1000));
  return {
    status: 429,
    body: JSON.stringify({
      message: "GitHub API rate limit exceeded. Retry after the cooldown.",
    }),
    savedAt: Date.now(),
    headers: [
      ["content-type", "application/json"],
      ["retry-after", String(seconds)],
      ["x-ratelimit-reset", String(Math.ceil(until / 1000))],
      ["x-ratelimit-remaining", "0"],
    ],
  };
}

function abortable<T>(
  work: Promise<T>,
  signal?: AbortSignal | null
): Promise<T> {
  if (!signal) return work;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    work
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

/** All GitHub callers share credential-scoped cache, in-flight work and cooldowns.
 * A cooldown returns immediately: it never sleeps through a serverless request.
 * Other providers are passed through untouched. Tokens never enter Redis keys.
 */
export async function githubRequest(
  input: string | URL | Request,
  init: RequestInit = {}
): Promise<Response> {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  );
  if (url.origin !== "https://api.github.com") return fetch(input, init);
  const headers = new Headers(
    input instanceof Request ? input.headers : undefined
  );
  new Headers(init.headers).forEach((value, name) => headers.set(name, value));
  if (!headers.has("accept"))
    headers.set("accept", "application/vnd.github+json");
  const credential = await hash(headers.get("authorization") ?? "anonymous");
  const resource = url.pathname.startsWith("/search/")
    ? "search"
    : url.pathname === "/graphql"
      ? "graphql"
      : "core";
  const bucket = `${credential}:${resource}`;
  const cooldownKey = `github:cooldown:${bucket}`;
  const secondaryBucket = `${credential}:secondary`;
  const secondaryKey = `github:cooldown:${secondaryBucket}`;
  const method = (
    init.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  const cacheable =
    method === "GET" ||
    (url.pathname === "/graphql" &&
      method === "POST" &&
      typeof init.body === "string" &&
      !/\bmutation\b/.test(init.body));
  const key =
    "github:response:" +
    (await hash(
      `${credential}:${method}:${url.href}:${headers.get("accept")}:${headers.get("x-github-api-version") ?? ""}:${cacheable ? (init.body ?? "") : ""}`
    ));
  if (init.signal?.aborted) throw init.signal.reason;
  let cached: StoredResponse | null = null;
  if (cacheable) {
    cached = await cacheGet<StoredResponse>(key);
    if (cached && Date.now() - cached.savedAt < FRESH_MS)
      return asResponse(cached);
    const existing = flights.get(key);
    if (existing) return asResponse(await abortable(existing, init.signal));
  }
  const previous = queues.get(credential) ?? Promise.resolve();
  let release!: () => void;
  const turn = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => turn);
  queues.set(credential, chained);
  // A queued caller can expire before its predecessor finishes. Retain the
  // chain until it settles so new callers cannot bypass active work.
  void chained.then(() => {
    if (queues.get(credential) === chained) queues.delete(credential);
  });
  const startedAt = Date.now();
  const work = (async () => {
    // Serialize outbound requests per credential, as recommended by GitHub.
    // Deadline includes queue time, so busy accounts cannot occupy a request indefinitely.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        previous,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("GitHub request queue timed out")),
            REQUEST_TIMEOUT_MS
          );
        }),
      ]);
      clearTimeout(timer);
      const until = Math.max(
        cooldowns.get(bucket) ?? 0,
        cooldowns.get(secondaryBucket) ?? 0,
        (await cacheGet<number>(cooldownKey)) ?? 0,
        (await cacheGet<number>(secondaryKey)) ?? 0
      );
      if (until > Date.now()) return limited(until);
      if (cached) {
        const etag = new Headers(cached.headers).get("etag");
        if (etag) headers.set("if-none-match", etag);
      }
      const remainingTime = Math.max(
        1,
        REQUEST_TIMEOUT_MS - (Date.now() - startedAt)
      );
      const timeout = AbortSignal.timeout(remainingTime);
      const signal =
        !cacheable && init.signal
          ? AbortSignal.any([init.signal, timeout])
          : timeout;
      let target = input;
      let response: Response;
      for (let redirects = 0; ; redirects++) {
        response = await fetch(target, {
          ...init,
          headers,
          redirect: "manual",
          cache: "no-store",
          signal,
        });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get("location");
        if (!location || redirects >= 3 || !["GET", "HEAD"].includes(method))
          throw new Error("Unsupported GitHub redirect");
        const redirected = new URL(
          location,
          typeof target === "string"
            ? target
            : target instanceof URL
              ? target.href
              : target.url
        );
        if (
          redirected.origin !== "https://api.github.com" ||
          redirected.username ||
          redirected.password
        )
          throw new Error("Unsafe GitHub redirect");
        await response.body?.cancel();
        target = redirected;
      }
      if (response.status === 304 && cached) {
        const refreshed = { ...cached, savedAt: Date.now() };
        await cacheSet(key, refreshed, 86400);
        return refreshed;
      }
      const body = await response.text();
      const graphLimited =
        resource === "graphql" && /"type"\s*:\s*"RATE_LIMITED"/.test(body);
      const retry = graphLimited
        ? (retrySeconds(
            new Response(null, { status: 403, headers: response.headers }),
            body
          ) ?? 60)
        : retrySeconds(response, body);
      if (retry !== null) {
        const reset = Date.now() + retry * 1000;
        const secondary =
          (graphLimited &&
            response.headers.get("x-ratelimit-remaining") !== "0") ||
          response.status === 429 ||
          response.headers.has("retry-after") ||
          /secondary rate limit|exceeded a secondary/i.test(body);
        cooldowns.set(secondary ? secondaryBucket : bucket, reset);
        await cacheSet(secondary ? secondaryKey : cooldownKey, reset, retry);
        return limited(reset);
      }
      if (response.headers.get("x-ratelimit-remaining") === "0") {
        const reset = Number(response.headers.get("x-ratelimit-reset")) * 1000;
        if (reset > Date.now()) {
          cooldowns.set(bucket, reset);
          await cacheSet(
            cooldownKey,
            reset,
            Math.ceil((reset - Date.now()) / 1000)
          );
        }
      }
      const stored: StoredResponse = {
        body,
        status: response.status,
        headers: Array.from(response.headers.entries()),
        savedAt: Date.now(),
      };
      if (
        cacheable &&
        response.ok &&
        !(resource === "graphql" && /"errors"\s*:/.test(body)) &&
        body.length < 2 * 1024 * 1024
      )
        await cacheSet(key, stored, 86400);
      return stored;
    } finally {
      clearTimeout(timer);
      release();
      for (const [key, until] of cooldowns)
        if (until <= Date.now()) cooldowns.delete(key);
    }
  })();
  if (cacheable) {
    flights.set(key, work);
    void work
      .finally(() => {
        if (flights.get(key) === work) flights.delete(key);
      })
      .catch(() => {});
  }
  return asResponse(await abortable(work, init.signal));
}

/** Test isolation without weakening production behavior. */
export function resetGitHubRequestState() {
  flights.clear();
  queues.clear();
  cooldowns.clear();
}
