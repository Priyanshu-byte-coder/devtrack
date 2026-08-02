const CACHE_PREFIX = "devtrack_cache_";

interface CachedSnapshot<T> {
  data: T;
  timestamp: number;
}

export function saveSnapshot<T>(key: string, data: T): void {
  try {
    const payload: CachedSnapshot<T> = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(payload));
  } catch (err) {
    // localStorage full, disabled, or unavailable (SSR) — fail silently
    console.warn(`[localCache] Could not save snapshot for "${key}"`, err);
  }
}

export function getSnapshot<T>(key: string): CachedSnapshot<T> | null {
  try {
    if (typeof window === "undefined") return null; // SSR guard
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedSnapshot<T>;
  } catch (err) {
    console.warn(`[localCache] Could not read snapshot for "${key}"`, err);
    return null;
  }
}

export function clearSnapshot(key: string): void {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch {
    // ignore
  }
}