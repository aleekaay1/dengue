/**
 * Simple TTL cache backed by in-memory Map, with optional localStorage
 * persistence when running in a browser context.
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  fetchedAt: number;
}

const memory = new Map<string, CacheEntry<unknown>>();

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function getCached<T>(key: string): CacheEntry<T> | null {
  const mem = memory.get(key) as CacheEntry<T> | undefined;
  if (mem && Date.now() < mem.expiresAt) {
    return mem;
  }

  if (storageAvailable()) {
    try {
      const raw = localStorage.getItem(`dengue-cache:${key}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CacheEntry<T>;
      if (Date.now() < parsed.expiresAt) {
        memory.set(key, parsed);
        return parsed;
      }
      localStorage.removeItem(`dengue-cache:${key}`);
    } catch {
      // ignore corrupt cache
    }
  }

  return null;
}

export function setCache<T>(key: string, value: T, ttlMs: number): CacheEntry<T> {
  const entry: CacheEntry<T> = {
    value,
    fetchedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  };
  memory.set(key, entry);

  if (storageAvailable()) {
    try {
      localStorage.setItem(`dengue-cache:${key}`, JSON.stringify(entry));
    } catch {
      // quota / private mode — memory cache still works
    }
  }

  return entry;
}

export function clearCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    memory.clear();
    return;
  }
  for (const key of memory.keys()) {
    if (key.startsWith(keyPrefix)) memory.delete(key);
  }
}

/** Common TTLs */
export const CACHE_TTL = {
  WEATHER_HOURS: 4 * 60 * 60 * 1000,
  VEGETATION_WEEK: 7 * 24 * 60 * 60 * 1000,
  DENGUE_DAY: 24 * 60 * 60 * 1000,
} as const;
