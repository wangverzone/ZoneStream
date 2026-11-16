import type { MediaCardItem } from '../types';

export interface CatalogSearchItem {
  id: string;
  type: 'anime' | 'donghua';
  title: string;
  poster: string;
  rating?: string;
  episodeLabel?: string;
  episodeId?: string;
  status?: string;
  genres?: string[];
}

const SESSION_CACHE_KEY = 'zonestream_catalog_index_v1';
const RECENT_SEARCH_KEY = 'zonestream_recent_searches_v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

let memoryCatalogItems: CatalogSearchItem[] = [];
let memoryCacheTimestamp = 0;
let inFlightPreload: Promise<CatalogSearchItem[]> | null = null;
const remoteQueryCache = new Map<string, CatalogSearchItem[]>();

function itemKey(item: Pick<CatalogSearchItem, 'type' | 'id'>): string {
  return `${item.type}:${String(item.id || '').toLowerCase()}`;
}

export type RawCatalogCandidate = Partial<CatalogSearchItem> & Partial<MediaCardItem>;

export function normalizeCatalogItem(raw: RawCatalogCandidate): CatalogSearchItem | null {
  const id = String(raw?.id || '').trim();
  const title = String(raw?.title || '').trim();
  if (!id || !title) return null;
  const type: 'anime' | 'donghua' = raw.type === 'donghua' ? 'donghua' : 'anime';
  return {
    id,
    type,
    title,
    poster: String(raw.poster || ''),
    rating: raw.rating ? String(raw.rating) : undefined,
    episodeLabel: raw.episodeLabel ? String(raw.episodeLabel) : undefined,
    episodeId: raw.episodeId ? String(raw.episodeId) : undefined,
    status: raw.status ? String(raw.status) : undefined,
    genres: Array.isArray(raw.genres)
      ? raw.genres.map((g: unknown) => String(g).trim()).filter(Boolean)
      : undefined,
  };
}

export function mergeCatalogItems(
  existing: CatalogSearchItem[],
  incoming: RawCatalogCandidate[]
): CatalogSearchItem[] {
  const map = new Map<string, CatalogSearchItem>();
  for (const item of existing) {
    if (!item?.id || !item?.title) continue;
    map.set(itemKey(item), item);
  }
  for (const raw of incoming) {
    const normalized = normalizeCatalogItem(raw);
    if (!normalized) continue;
    const key = itemKey(normalized);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, normalized);
    } else {
      map.set(key, {
        ...prev,
        ...normalized,
        poster: normalized.poster || prev.poster,
        rating: normalized.rating || prev.rating,
        episodeLabel: normalized.episodeLabel || prev.episodeLabel,
        episodeId: normalized.episodeId || prev.episodeId,
        status: normalized.status || prev.status,
        genres:
          normalized.genres && normalized.genres.length > 0
            ? normalized.genres
            : prev.genres,
      });
    }
  }
  return Array.from(map.values());
}

export function getCachedCatalogSnapshot(): CatalogSearchItem[] {
  if (memoryCatalogItems.length > 0) {
    return memoryCatalogItems;
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { ts?: number; items?: CatalogSearchItem[] };
    if (
      parsed &&
      Array.isArray(parsed.items) &&
      typeof parsed.ts === 'number' &&
      Date.now() - parsed.ts < CACHE_TTL_MS
    ) {
      memoryCatalogItems = parsed.items;
      memoryCacheTimestamp = parsed.ts;
      return memoryCatalogItems;
    }
  } catch {
    // Ignore storage read errors
  }
  return [];
}

function persistSessionCache(items: CatalogSearchItem[]) {
  if (typeof window === 'undefined' || items.length === 0) return;
  try {
    sessionStorage.setItem(
      SESSION_CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        items: items.slice(0, 260),
      })
    );
  } catch {
    // Ignore quota errors
  }
}

export function seedCatalogIndex(
  incoming: RawCatalogCandidate[]
): CatalogSearchItem[] {
  const current = getCachedCatalogSnapshot();
  const merged = mergeCatalogItems(current, incoming);
  memoryCatalogItems = merged;
  if (!memoryCacheTimestamp) {
    memoryCacheTimestamp = Date.now();
  }
  persistSessionCache(merged);
  return merged;
}

export async function ensureCatalogLoaded(force = false): Promise<CatalogSearchItem[]> {
  const cached = getCachedCatalogSnapshot();
  const isFresh =
    !force && cached.length >= 20 && Date.now() - memoryCacheTimestamp < CACHE_TTL_MS;
  if (isFresh) return cached;

  if (inFlightPreload) return inFlightPreload;

  inFlightPreload = (async () => {
    try {
      const [homeRes, catalogRes] = await Promise.allSettled([
        fetch('/api/stream/home').then((r) => r.json()),
        fetch('/api/stream/catalog?page=1').then((r) => r.json()),
      ]);

      const collected: Array<Partial<MediaCardItem>> = [];
      if (homeRes.status === 'fulfilled' && homeRes.value?.ok) {
        const h = homeRes.value;
        if (Array.isArray(h.latestEpisodes)) collected.push(...h.latestEpisodes);
        if (Array.isArray(h.donghuaList)) collected.push(...h.donghuaList);
        if (Array.isArray(h.animeList)) collected.push(...h.animeList);
        if (Array.isArray(h.heroSlides)) collected.push(...h.heroSlides);
      }
      if (catalogRes.status === 'fulfilled' && catalogRes.value?.ok && Array.isArray(catalogRes.value.items)) {
        collected.push(...catalogRes.value.items);
      }

      if (collected.length > 0) {
        memoryCacheTimestamp = Date.now();
        return seedCatalogIndex(collected);
      }
      return getCachedCatalogSnapshot();
    } catch {
      return getCachedCatalogSnapshot();
    } finally {
      inFlightPreload = null;
    }
  })();

  return inFlightPreload;
}

export function searchCatalogLocal(
  query: string,
  items: CatalogSearchItem[],
  limit = 8
): CatalogSearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const tokens = q.split(/\s+/).filter(Boolean);
  const scored: Array<{ item: CatalogSearchItem; score: number }> = [];

  for (const item of items) {
    const titleLower = item.title.toLowerCase();
    const genreMatch = item.genres?.some((g) => g.toLowerCase().includes(q)) ?? false;

    let score = 0;
    if (titleLower === q) {
      score = 120;
    } else if (titleLower.startsWith(q)) {
      score = 95;
    } else if (
      titleLower.split(/[\s:\-–—/]+/).some((word) => word.startsWith(q))
    ) {
      score = 75;
    } else if (titleLower.includes(q)) {
      score = 55;
    } else if (tokens.length > 1 && tokens.every((tk) => titleLower.includes(tk))) {
      score = 40;
    } else if (genreMatch) {
      score = 20;
    }

    if (score > 0) {
      const ratingBoost = Math.min(5, (parseFloat(item.rating || '0') || 0) * 0.4);
      scored.push({ item, score: score + ratingBoost });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.item.title.localeCompare(b.item.title);
  });

  return scored.slice(0, limit).map((entry) => entry.item);
}

export function extractMatchingGenres(
  query: string,
  items: CatalogSearchItem[],
  limit = 4
): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const genres = new Set<string>();
  for (const item of items) {
    if (!item.genres) continue;
    for (const g of item.genres) {
      if (g.toLowerCase().includes(q)) {
        genres.add(g);
        if (genres.size >= limit) return Array.from(genres);
      }
    }
  }
  return Array.from(genres);
}

export async function fetchCatalogSuggestions(
  query: string,
  signal?: AbortSignal
): Promise<CatalogSearchItem[]> {
  const q = query.trim();
  const key = q.toLowerCase();
  if (q.length < 2) return [];

  if (remoteQueryCache.has(key)) {
    return remoteQueryCache.get(key) || [];
  }

  const res = await fetch(`/api/stream/catalog?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) return [];
  const json = await res.json();
  if (!json?.ok || !Array.isArray(json.items)) return [];

  const normalized = (json.items as Partial<MediaCardItem>[])
    .map((item) => normalizeCatalogItem(item))
    .filter((item): item is CatalogSearchItem => Boolean(item));

  if (normalized.length > 0) {
    seedCatalogIndex(normalized);
  }
  remoteQueryCache.set(key, normalized);
  return normalized;
}

export function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((x) => String(x).trim()).filter(Boolean).slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(term: string): string[] {
  const clean = term.trim();
  if (!clean || typeof window === 'undefined') return getRecentSearches();
  const prev = getRecentSearches().filter((x) => x.toLowerCase() !== clean.toLowerCase());
  const next = [clean, ...prev].slice(0, 5);
  try {
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
  return next;
}

export function removeRecentSearch(term: string): string[] {
  if (typeof window === 'undefined') return [];
  const next = getRecentSearches().filter((x) => x.toLowerCase() !== term.toLowerCase());
  try {
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
  return next;
}
