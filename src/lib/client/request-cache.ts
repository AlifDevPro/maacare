type CacheEntry<T> = {
  at: number;
  ttlMs: number;
  value: T;
};

const cache = new Map<string, CacheEntry<unknown>>();

function now() {
  return Date.now();
}

export function getCached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (now() - hit.at > hit.ttlMs) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number) {
  cache.set(key, { at: now(), ttlMs, value });
}

export function invalidateCached(key: string) {
  cache.delete(key);
}

export function invalidateByPrefix(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export async function fetchJsonCached<T>(
  key: string,
  input: string,
  init: RequestInit,
  ttlMs: number,
): Promise<{ data: T; fromCache: boolean }> {
  const cached = getCached<T>(key);
  if (cached != null) return { data: cached, fromCache: true };

  const res = await fetch(input, init);
  const j = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) {
    throw new Error((j as { message?: string }).message ?? "Request failed");
  }
  setCached(key, j as T, ttlMs);
  return { data: j as T, fromCache: false };
}

