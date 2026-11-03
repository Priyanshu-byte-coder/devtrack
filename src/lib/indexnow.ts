/**
 * IndexNow: tells Bing, Yandex and other participating engines that a URL
 * changed, so it's recrawled in minutes instead of whenever. Bing's index
 * also feeds ChatGPT search, Copilot and DuckDuckGo.
 *
 * The key is public by design: engines verify it by fetching
 * /<key>.txt from this site (public/<key>.txt). It is not a secret.
 */
export const INDEXNOW_KEY = "1b2b815b5e3eac69d6ae75d613d1c904";

const ENDPOINT = "https://api.indexnow.org/indexnow";
const PRODUCTION_HOST = "devtrack.live";

/** Absolute URLs on our host, at most 10,000 per call (the protocol cap). */
export function indexNowPayload(paths: string[], host = PRODUCTION_HOST) {
  const urlList = Array.from(
    new Set(
      paths.map((p) => (p.startsWith("http") ? p : `https://${host}${p}`))
    )
  )
    .filter((u) => new URL(u).host === host)
    .slice(0, 10_000);
  return {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`,
    urlList,
  };
}

/**
 * Fire-and-forget submission. Only runs on the production deployment, never
 * throws, and resolves to whether the endpoint accepted the batch.
 */
export async function submitToIndexNow(paths: string[]): Promise<boolean> {
  if (process.env.VERCEL_ENV !== "production") return false;
  const payload = indexNowPayload(paths);
  if (payload.urlList.length === 0) return false;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    // 200 = accepted, 202 = accepted, key validation pending.
    return res.status === 200 || res.status === 202;
  } catch {
    return false;
  }
}
