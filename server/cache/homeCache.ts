export type CacheStatus = 'HIT' | 'STALE' | 'MISS';
export type CacheLayer = 'memory' | 'redis' | 'origin';

interface MemoryCacheRecord<T> {
  value: T;
  createdAt: number;
  freshUntil: number;
  staleUntil: number;
}

export interface CacheLookupResult<T> {
  status: CacheStatus;
  layer: CacheLayer;
  value: T | null;
  ageMs: number;
}

const DEFAULT_FRESH_TTL_MS = 90 * 1000; // 90 seconds fresh
const DEFAULT_STALE_TTL_MS = 10 * 60 * 1000; // 10 minutes stale-while-revalidate / outage shield

class SimpleMemoryCache<T = unknown> {
  private readonly store = new Map<string, MemoryCacheRecord<T>>();
  private readonly maxEntries: number;

  constructor(maxEntries = 32) {
    this.maxEntries = maxEntries;
  }

  get(key: string): CacheLookupResult<T> {
    const record = this.store.get(key);
    if (!record) {
      return { status: 'MISS', layer: 'memory', value: null, ageMs: 0 };
    }

    const now = Date.now();
    const ageMs = Math.max(0, now - record.createdAt);

    if (now <= record.freshUntil) {
      // Refresh LRU insertion order
      this.store.delete(key);
      this.store.set(key, record);
      return { status: 'HIT', layer: 'memory', value: record.value, ageMs };
    }

    if (now <= record.staleUntil) {
      return { status: 'STALE', layer: 'memory', value: record.value, ageMs };
    }

    return { status: 'MISS', layer: 'memory', value: record.value, ageMs };
  }

  getFallback(key: string): T | null {
    return this.store.get(key)?.value ?? null;
  }

  set(
    key: string,
    value: T,
    freshTtlMs = DEFAULT_FRESH_TTL_MS,
    staleTtlMs = DEFAULT_STALE_TTL_MS
  ): void {
    const now = Date.now();
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      value,
      createdAt: now,
      freshUntil: now + freshTtlMs,
      staleUntil: now + Math.max(freshTtlMs, staleTtlMs),
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}

async function readUpstashRedis<T>(key: string): Promise<T | null> {
  const url = String(process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/\/+$/, '');
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (!url || !token) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string | null };
    if (!json?.result) return null;
    return JSON.parse(json.result) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function writeUpstashRedis<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const url = String(process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/\/+$/, '');
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (!url || !token) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    await fetch(`${url}/set/${encodeURIComponent(key)}?EX=${Math.max(10, Math.round(ttlSeconds))}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(JSON.stringify(value)),
      signal: controller.signal,
    });
  } catch {
    // Non-fatal: in-memory L1 cache remains active
  } finally {
    clearTimeout(timer);
  }
}

const homeMemoryCache = new SimpleMemoryCache<any>(8);
const inFlightBuilds = new Map<string, Promise<any>>();

export interface ResolveHomeCacheOptions<T> {
  cacheKey?: string;
  forceRefresh?: boolean;
  freshTtlMs?: number;
  staleTtlMs?: number;
  builder: () => Promise<T>;
}

export interface ResolveHomeCacheResponse<T> {
  payload: T;
  cacheStatus: CacheStatus;
  cacheLayer: CacheLayer;
  ageMs: number;
}

/**
 * Resolves cached /api/stream/home payload using:
 * 1. L1 in-memory cache with Fresh TTL + Stale-While-Revalidate window
 * 2. Optional L2 Redis (Upstash REST) when configured via env vars
 * 3. Single-flight request coalescing so concurrent refreshes only execute one upstream/DB build
 */
export async function resolveCachedHomePayload<T>(
  options: ResolveHomeCacheOptions<T>
): Promise<ResolveHomeCacheResponse<T>> {
  const cacheKey = options.cacheKey || 'zonestream:stream:home:v1';
  const freshTtlMs = options.freshTtlMs ?? DEFAULT_FRESH_TTL_MS;
  const staleTtlMs = options.staleTtlMs ?? DEFAULT_STALE_TTL_MS;
  const forceRefresh = Boolean(options.forceRefresh);

  const runSingleFlightBuild = async (): Promise<T> => {
    const existing = inFlightBuilds.get(cacheKey);
    if (existing) {
      return existing as Promise<T>;
    }

    const buildPromise = (async () => {
      const built = await options.builder();
      homeMemoryCache.set(cacheKey, built, freshTtlMs, staleTtlMs);
      void writeUpstashRedis(cacheKey, built, Math.round(staleTtlMs / 1000));
      return built;
    })();

    inFlightBuilds.set(cacheKey, buildPromise);
    try {
      return await buildPromise;
    } finally {
      inFlightBuilds.delete(cacheKey);
    }
  };

  if (!forceRefresh) {
    const l1 = homeMemoryCache.get(cacheKey);
    if (l1.status === 'HIT' && l1.value) {
      return {
        payload: l1.value as T,
        cacheStatus: 'HIT',
        cacheLayer: 'memory',
        ageMs: l1.ageMs,
      };
    }

    if (l1.status === 'STALE' && l1.value) {
      // Serve stale instantly while refreshing once in the background
      void runSingleFlightBuild().catch(() => {});
      return {
        payload: l1.value as T,
        cacheStatus: 'STALE',
        cacheLayer: 'memory',
        ageMs: l1.ageMs,
      };
    }

    // Check L2 Redis (if configured) before hitting origin scrapers/DB
    const redisHit = await readUpstashRedis<T>(cacheKey);
    if (redisHit) {
      homeMemoryCache.set(cacheKey, redisHit, freshTtlMs, staleTtlMs);
      return {
        payload: redisHit,
        cacheStatus: 'HIT',
        cacheLayer: 'redis',
        ageMs: 0,
      };
    }
  }

  try {
    const freshPayload = await runSingleFlightBuild();
    return {
      payload: freshPayload,
      cacheStatus: 'MISS',
      cacheLayer: 'origin',
      ageMs: 0,
    };
  } catch (err) {
    const emergencyFallback = homeMemoryCache.getFallback(cacheKey) as T | null;
    if (emergencyFallback) {
      return {
        payload: emergencyFallback,
        cacheStatus: 'STALE',
        cacheLayer: 'memory',
        ageMs: staleTtlMs,
      };
    }
    throw err;
  }
}

export function invalidateHomeCache(cacheKey = 'zonestream:stream:home:v1'): void {
  homeMemoryCache.delete(cacheKey);
}
