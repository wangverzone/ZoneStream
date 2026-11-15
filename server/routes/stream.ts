import { Router } from 'express';
import {
  resolveOtakudesuServer,
  scrapeDonghiveCatalog,
  scrapeDonghiveDetail,
  scrapeDonghiveEpisode,
  scrapeDonghiveHome,
  scrapeDonghiveSchedule,
  scrapeDonghiveSearch,
  scrapeOtakudesuCatalog,
  scrapeOtakudesuCompleteCatalog,
  scrapeOtakudesuDetail,
  scrapeOtakudesuEpisode,
  scrapeOtakudesuHome,
  scrapeOtakudesuSchedule,
  scrapeOtakudesuSearch,
} from '../providers/directScraper.ts';

const router = Router();
const BASE = 'https://www.sankavollerei.web.id/anime';
let sankaBlockedUntil = 0;

interface CacheEntry {
  expiresAt: number;
  data: unknown;
}

const cache = new Map<string, CacheEntry>();
const inFlightJsonRequests = new Map<string, Promise<unknown>>();
const imageCache = new Map<string, { expiresAt: number; contentType: string; buf: Buffer }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

let activeUpstreamCount = 0;
let lastUpstreamDispatchMs = 0;
const upstreamQueue: Array<() => void> = [];

function pumpUpstreamQueue() {
  while (activeUpstreamCount < 2 && upstreamQueue.length > 0) {
    const waitMs = Math.max(0, 120 - (Date.now() - lastUpstreamDispatchMs));
    if (waitMs > 0) {
      setTimeout(pumpUpstreamQueue, waitMs);
      return;
    }
    const next = upstreamQueue.shift();
    if (next) {
      activeUpstreamCount += 1;
      lastUpstreamDispatchMs = Date.now();
      next();
    }
  }
}

function enqueueUpstream<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activeUpstreamCount = Math.max(0, activeUpstreamCount - 1);
          pumpUpstreamQueue();
        });
    };
    upstreamQueue.push(run);
    pumpUpstreamQueue();
  });
}

function proxyPoster(raw?: string): string {
  const url = String(raw || '').trim();
  if (!url) return '';
  if (url.startsWith('/') || url.startsWith('data:')) return url;
  if (/^https?:\/\//i.test(url)) {
    return `/api/stream/img?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// GET /api/stream/img?url=... — Bypass hotlink 403 (e.g., anichin.moe) & cache posters at edge
router.get('/img', async (req, res) => {
  try {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
      return res.status(400).send('Invalid URL');
    }

    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('172.')
    ) {
      return res.status(403).send('Forbidden host');
    }

    const now = Date.now();
    const cached = imageCache.get(rawUrl);
    if (cached && cached.expiresAt > now) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
      return res.send(cached.buf);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const resp = await fetch(rawUrl, {
        signal: controller.signal,
        headers: {
          Referer: `${parsed.origin}/`,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });
      if (!resp.ok) {
        return res.status(resp.status).send('Upstream image error');
      }
      const contentType = resp.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        return res.status(415).send('Not an image');
      }
      const arr = await resp.arrayBuffer();
      const buf = Buffer.from(arr);

      if (imageCache.size > 150) {
        const firstKey = imageCache.keys().next().value;
        if (firstKey) imageCache.delete(firstKey);
      }
      imageCache.set(rawUrl, {
        expiresAt: now + 60 * 60 * 1000,
        contentType,
        buf,
      });

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
      return res.send(buf);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return res.status(502).send('Image proxy error');
  }
});

const slugPosterMap = new Map<string, string>();
const hdArtworkCache = new Map<
  string,
  { expiresAt: number; bannerImage: string; coverExtraLarge: string }
>();

function stripSeasonSuffix(title: string): string {
  return title
    .replace(/\s*(Season|Part|Cour|Stage|Arc)\s*\d+/gi, '')
    .replace(/\s*S\d+\b/gi, '')
    .replace(/\s+\d+(st|nd|rd|th)\s+Season/gi, '')
    .trim();
}

function normalizeWords(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

function isConfidentTitleMatch(query: string, candidateTitles: Array<string | null | undefined>): boolean {
  const qWords = normalizeWords(query);
  if (qWords.length === 0) return false;
  for (const cand of candidateTitles) {
    if (!cand) continue;
    const cWords = normalizeWords(cand);
    if (cWords.length === 0) continue;
    const overlap = qWords.filter((w) => cWords.includes(w)).length;
    if (overlap >= Math.min(2, qWords.length) || overlap / qWords.length >= 0.5) {
      return true;
    }
  }
  return false;
}

async function fetchHdArtwork(
  title: string,
  altTitle?: string
): Promise<{ bannerImage: string; coverExtraLarge: string }> {
  const cleanMain = cleanTitle(title || '');
  const stripped = stripSeasonSuffix(cleanMain);
  const candidates = Array.from(
    new Set([cleanMain, stripped, altTitle?.split(',')[0]?.trim() || ''].filter((s) => s.length >= 2))
  );
  if (candidates.length === 0) {
    return { bannerImage: '', coverExtraLarge: '' };
  }

  const cacheKey = candidates[0].toLowerCase();
  const cached = hdArtworkCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { bannerImage: cached.bannerImage, coverExtraLarge: cached.coverExtraLarge };
  }

  let bestBanner = '';
  let bestCover = '';

  for (const query of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2800);
    try {
      const resp = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'ZoneStream-Streaming/1.0',
        },
        body: JSON.stringify({
          query:
            'query ($search: String) { Page(page: 1, perPage: 3) { media(search: $search, type: ANIME, isAdult: false, sort: POPULARITY_DESC) { title { romaji english native } synonyms bannerImage coverImage { extraLarge large } } } }',
          variables: { search: query },
        }),
      });
      if (!resp.ok) continue;
      const json = (await resp.json()) as any;
      const list = json?.data?.Page?.media || [];
      const matched =
        list.find((m: any) =>
          isConfidentTitleMatch(query, [
            m?.title?.english,
            m?.title?.romaji,
            m?.title?.native,
            ...(Array.isArray(m?.synonyms) ? m.synonyms : []),
          ])
        ) || list[0];

      if (matched) {
        if (!bestBanner && matched.bannerImage) bestBanner = matched.bannerImage;
        if (!bestCover && (matched.coverImage?.extraLarge || matched.coverImage?.large)) {
          bestCover = matched.coverImage.extraLarge || matched.coverImage.large || '';
        }
        if (bestBanner && bestCover) break;
      }
    } catch {
      // Non-fatal HD enrichment timeout
    } finally {
      clearTimeout(timer);
    }
  }

  hdArtworkCache.set(cacheKey, {
    expiresAt: Date.now() + 6 * 60 * 60 * 1000,
    bannerImage: bestBanner,
    coverExtraLarge: bestCover,
  });

  return { bannerImage: bestBanner, coverExtraLarge: bestCover };
}

async function fetchJsonWithCache<T = any>(
  url: string,
  ttlMs = CACHE_TTL_MS,
  forceRefresh = false
): Promise<T> {
  const now = Date.now();
  const cached = cache.get(url);
  if (!forceRefresh && cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  const existingInFlight = inFlightJsonRequests.get(url);
  if (!forceRefresh && existingInFlight) {
    return existingInFlight as Promise<T>;
  }

  const promise = (async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const json = await enqueueUpstream(async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 11000);
          try {
            const resp = await fetch(url, {
              signal: controller.signal,
              headers: {
                'User-Agent': 'ZoneStream-Streaming/1.0',
                Accept: 'application/json',
              },
            });
            if (resp.status === 403) {
              sankaBlockedUntil = Date.now() + 5 * 60 * 1000;
              const err = new Error('Upstream HTTP 403');
              (err as any).status = 403;
              throw err;
            }
            if (resp.status === 429) {
              const err = new Error('Upstream HTTP 429');
              (err as any).status = 429;
              throw err;
            }
            if (!resp.ok) {
              throw new Error(`Upstream HTTP ${resp.status}`);
            }
            return (await resp.json()) as T;
          } finally {
            clearTimeout(timeout);
          }
        });
        cache.set(url, { expiresAt: Date.now() + ttlMs, data: json });
        return json;
      } catch (err: any) {
        lastError = err;
        if (err?.status === 403) break;
        if (attempt === 0) {
          const delay = err?.status === 429 ? 1600 : 400;
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    // Stale cache fallback so transient upstream rate limits never empty a page
    if (cached?.data) {
      return cached.data as T;
    }
    throw lastError;
  })();

  inFlightJsonRequests.set(url, promise);
  try {
    return await promise;
  } finally {
    inFlightJsonRequests.delete(url);
  }
}

async function fetchSankaOrNull<T = any>(
  path: string,
  ttlMs = CACHE_TTL_MS,
  forceRefresh = false
): Promise<T | null> {
  const fullUrl = `${BASE}${path}`;
  const cached = cache.get(fullUrl);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }
  if (Date.now() < sankaBlockedUntil) {
    return (cached?.data as T) || null;
  }
  try {
    return await fetchJsonWithCache<T>(fullUrl, ttlMs, forceRefresh);
  } catch {
    return (cached?.data as T) || null;
  }
}

async function getDonghuaHomeData(forceRefresh = false) {
  const sanka = await fetchSankaOrNull<any>('/donghua/home', 90 * 1000, forceRefresh);
  if (sanka?.latest_release?.length) return sanka;
  const fallback = await scrapeDonghiveHome();
  if (fallback?.latest_release?.length) return fallback;
  return sanka || { latest_release: [], completed_donghua: [] };
}

async function getAnimeHomeData(forceRefresh = false) {
  const sanka = await fetchSankaOrNull<any>('/home', 90 * 1000, forceRefresh);
  if (sanka?.data?.ongoing?.animeList?.length) return sanka;
  const scraped = await scrapeOtakudesuHome();
  if (scraped?.ongoing?.animeList?.length) return { data: scraped };
  return sanka || { data: { ongoing: { animeList: [] }, completed: { animeList: [] } } };
}

async function getDonghuaDetailData(id: string, epHint = ''): Promise<{ id: string; data: any } | null> {
  let resolvedId = id;
  let d = await fetchSankaOrNull<any>(`/donghua/detail/${encodeURIComponent(resolvedId)}`, 20 * 60 * 1000);
  if (d?.title) return { id: resolvedId, data: d };

  if (epHint) {
    const epInfo = await fetchSankaOrNull<any>(`/donghua/episode/${encodeURIComponent(epHint)}`, 20 * 60 * 1000);
    if (epInfo?.donghua_details?.slug) {
      resolvedId = epInfo.donghua_details.slug;
      const resolved = await fetchSankaOrNull<any>(`/donghua/detail/${encodeURIComponent(resolvedId)}`, 20 * 60 * 1000);
      if (resolved?.title) return { id: resolvedId, data: resolved };
    }
  }

  // Fallback directly to live Donghive HTML scraper
  const direct = await scrapeDonghiveDetail(id, epHint);
  if (direct?.title) {
    return { id: direct.slug || id, data: direct };
  }
  return null;
}

async function getAnimeDetailData(id: string): Promise<{ id: string; data: any } | null> {
  const sanka = await fetchSankaOrNull<any>(`/anime/${encodeURIComponent(id)}`, 20 * 60 * 1000);
  if (sanka?.data?.title) return { id, data: sanka.data };

  const direct = await scrapeOtakudesuDetail(id);
  if (direct?.title) {
    return { id: direct.animeId || id, data: direct };
  }
  return null;
}

async function getDonghuaEpisodeData(episodeId: string): Promise<any | null> {
  const sanka = await fetchSankaOrNull<any>(`/donghua/episode/${encodeURIComponent(episodeId)}`, 30 * 60 * 1000);
  if (sanka?.streaming?.servers?.length || sanka?.streaming?.main_url?.url) {
    return sanka;
  }
  return await scrapeDonghiveEpisode(episodeId);
}

async function getAnimeEpisodeData(episodeId: string): Promise<any | null> {
  const sanka = await fetchSankaOrNull<any>(`/episode/${encodeURIComponent(episodeId)}`, 30 * 60 * 1000);
  if (sanka?.data?.title || sanka?.data?.server?.qualities?.length) {
    return sanka.data;
  }
  return await scrapeOtakudesuEpisode(episodeId);
}

function cleanDonghuaSeriesSlug(episodeSlug: string): string {
  return episodeSlug
    .replace(/-episode-\d+.*$/i, '')
    .replace(/-subtitle-indonesia$/i, '')
    .replace(/-tamat$/i, '');
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*Subtitle Indonesia/i, '')
    .replace(/\s*Sub Indo/i, '')
    .replace(/\s*\[SVIP\]\s*/i, '')
    .trim();
}

function cleanGenreList(list: unknown[], fallback: string[]): string[] {
  const cleaned = list
    .map((g: any) => (typeof g === 'string' ? g : g?.name || g?.title || ''))
    .map((s: string) => s.trim())
    .filter(Boolean);
  return cleaned.length > 0 ? Array.from(new Set(cleaned)) : fallback;
}

function deterministicScore(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) % 1000;
  }
  const score = 7.2 + (h % 210) / 100;
  return score.toFixed(2);
}

function normalizePosterKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(season|part|cour|sub|indo|subtitle|indonesia)\b/gi, ' ')
    .replace(/[^a-z0-9]/g, '');
}

function rememberPoster(key: string, poster?: string) {
  if (key && poster && /^https?:\/\//i.test(poster)) {
    slugPosterMap.set(key.toLowerCase(), poster);
    const norm = normalizePosterKey(key);
    if (norm.length >= 3) slugPosterMap.set(`norm:${norm}`, poster);
  }
}

function lookupPoster(slug?: string, title?: string): string {
  if (slug) {
    const bySlug = slugPosterMap.get(slug.toLowerCase());
    if (bySlug) return bySlug;
    const byNormSlug = slugPosterMap.get(`norm:${normalizePosterKey(slug)}`);
    if (byNormSlug) return byNormSlug;
  }
  if (title) {
    const byTitle = slugPosterMap.get(title.toLowerCase());
    if (byTitle) return byTitle;
    const byNormTitle = slugPosterMap.get(`norm:${normalizePosterKey(title)}`);
    if (byNormTitle) return byNormTitle;
  }
  return '';
}

async function enrichMissingPosters(items: any[]): Promise<any[]> {
  for (const item of items) {
    if (!item.poster) {
      const found = lookupPoster(item.id, item.title);
      if (found) item.poster = proxyPoster(found);
    }
  }
  const missing = items.filter((x) => !x.poster && x.title);
  const BATCH_SIZE = 10;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (m) => {
        try {
          const hd = await fetchHdArtwork(m.title);
          if (hd.coverExtraLarge) {
            m.poster = proxyPoster(hd.coverExtraLarge);
            rememberPoster(m.id, hd.coverExtraLarge);
            rememberPoster(m.title, hd.coverExtraLarge);
            return;
          }
          if (m.type === 'donghua') {
            const d = (await getDonghuaDetailData(m.id))?.data;
            if (d?.poster) {
              m.poster = proxyPoster(d.poster);
              rememberPoster(m.id, d.poster);
              rememberPoster(m.title, d.poster);
            }
          } else {
            const a = (await getAnimeDetailData(m.id))?.data;
            if (a?.poster) {
              m.poster = proxyPoster(a.poster);
              rememberPoster(m.id, a.poster);
              rememberPoster(m.title, a.poster);
            }
          }
        } catch {
          // Ignore individual timeout
        }
      })
    );
  }
  return items;
}

function isFrameBlockedHost(url?: string): boolean {
  const u = String(url || '').toLowerCase();
  return (
    u.includes('desustream.net') ||
    u.includes('desustream.com') ||
    u.includes('ondesuhd') ||
    u.includes('odcdn')
  );
}

// GET /api/stream/home
router.get('/home', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === '1';
    const [animeRes, donghuaRes] = await Promise.allSettled([
      getAnimeHomeData(forceRefresh),
      getDonghuaHomeData(forceRefresh),
    ]);

    const animeOngoing =
      animeRes.status === 'fulfilled' ? animeRes.value?.data?.ongoing?.animeList || [] : [];
    const animeCompleted =
      animeRes.status === 'fulfilled' ? animeRes.value?.data?.completed?.animeList || [] : [];
    const donghuaLatest =
      donghuaRes.status === 'fulfilled' ? donghuaRes.value?.latest_release || [] : [];
    const donghuaCompleted =
      donghuaRes.status === 'fulfilled' ? donghuaRes.value?.completed_donghua || [] : [];

    // Resolve real series slugs for top donghua latest episodes so zero cards lead to empty details
    const normalizedDonghuaLatest = await Promise.all(
      donghuaLatest.map(async (item: any, idx: number) => {
        let seriesSlug = cleanDonghuaSeriesSlug(item.slug || '');
        const title = cleanTitle(item.title || '').replace(/\s*Episode\s*\d+.*$/i, '').trim();
        rememberPoster(seriesSlug, item.poster);
        rememberPoster(title, item.poster);

        if (idx < 8 && item.slug) {
          try {
            const epInfo = await getDonghuaEpisodeData(item.slug);
            if (epInfo?.donghua_details?.slug) {
              seriesSlug = epInfo.donghua_details.slug;
              rememberPoster(seriesSlug, epInfo.donghua_details.poster || item.poster);
            }
          } catch {
            // Keep cleanDonghuaSeriesSlug fallback
          }
        }

        return {
          id: seriesSlug,
          episodeId: item.slug,
          type: 'donghua' as const,
          title: title || cleanTitle(item.title || ''),
          episodeLabel: item.current_episode || 'Ep Baru',
          poster: proxyPoster(item.poster),
          status: item.status || 'Ongoing',
          rating: deterministicScore(seriesSlug || item.title || 'dh'),
          isNew: true,
          releaseDate: 'Hari ini',
        };
      })
    );

    const normalizedAnimeOngoing = animeOngoing.map((item: any) => {
      rememberPoster(item.animeId, item.poster);
      rememberPoster(cleanTitle(item.title || ''), item.poster);
      return {
        id: item.animeId,
        episodeId: '',
        type: 'anime' as const,
        title: cleanTitle(item.title || ''),
        episodeLabel: item.episodes ? `Ep ${item.episodes}` : 'Ongoing',
        poster: proxyPoster(item.poster),
        status: 'Ongoing',
        rating: deterministicScore(item.animeId || item.title || 'an'),
        isNew: true,
        releaseDate: item.latestReleaseDate || item.releaseDay || 'Terbaru',
      };
    });

    const normalizedAnimeCompleted = animeCompleted.map((item: any) => {
      rememberPoster(item.animeId, item.poster);
      return {
        id: item.animeId,
        episodeId: '',
        type: 'anime' as const,
        title: cleanTitle(item.title || ''),
        episodeLabel: item.episodes ? `${item.episodes} Eps` : 'Tamat',
        poster: proxyPoster(item.poster),
        status: 'Completed',
        rating: item.score || deterministicScore(item.animeId || 'cmp'),
        isNew: false,
        releaseDate: item.lastReleaseDate || 'Completed',
      };
    });

    const normalizedDonghuaCompleted = donghuaCompleted.map((item: any) => {
      rememberPoster(item.slug, item.poster);
      return {
        id: item.slug,
        episodeId: '',
        type: 'donghua' as const,
        title: cleanTitle(item.title || ''),
        episodeLabel: item.type || 'Donghua',
        poster: proxyPoster(item.poster),
        status: item.status || 'Completed',
        rating: deterministicScore(item.slug || 'dhc'),
        isNew: false,
        releaseDate: 'Completed',
      };
    });

    const latestEpisodes: any[] = [];
    const maxLen = Math.max(normalizedDonghuaLatest.length, normalizedAnimeOngoing.length);
    for (let i = 0; i < maxLen; i++) {
      if (normalizedDonghuaLatest[i]) latestEpisodes.push(normalizedDonghuaLatest[i]);
      if (normalizedAnimeOngoing[i]) latestEpisodes.push(normalizedAnimeOngoing[i]);
    }

    const heroCandidates = [
      ...normalizedDonghuaLatest.slice(0, 4),
      ...normalizedAnimeOngoing.slice(0, 3),
    ];

    const heroDetails = await Promise.allSettled(
      heroCandidates.map(async (c) => {
        if (c.type === 'donghua') {
          const resolved = await getDonghuaDetailData(c.id, c.episodeId || '');
          const d = resolved?.data;
          if (!d?.title) throw new Error('Empty donghua detail');
          const resolvedId = resolved?.id || c.id;
          const cleanName = cleanTitle(d.title || c.title);
          const hd = await fetchHdArtwork(cleanName, d.alter_title);
          const hdPoster = proxyPoster(hd.coverExtraLarge || d.poster) || c.poster;
          const hdBackdrop = hd.bannerImage
            ? proxyPoster(hd.bannerImage)
            : proxyPoster(hd.coverExtraLarge || d.cover || d.poster) || c.poster;
          return {
            id: resolvedId,
            episodeId: d.latest_episode?.slug || d.episodes_list?.[0]?.slug || c.episodeId,
            type: 'donghua' as const,
            title: cleanName,
            poster: hdPoster,
            backdrop: hdBackdrop,
            hasWideBanner: Boolean(hd.bannerImage),
            rating: d.rating || c.rating,
            status: (d.status || 'ONGOING').toUpperCase(),
            description:
              d.synopsis ||
              'Kisah kultivasi penuh aksi dan pertarungan epik menuju puncak keabadian.',
            genres: cleanGenreList(Array.isArray(d.genres) ? d.genres : [], ['Action', 'Fantasy']),
          };
        }
        const resolved = await getAnimeDetailData(c.id);
        const data = resolved?.data || {};
        if (!data.title) throw new Error('Empty anime detail');
        const resolvedId = resolved?.id || c.id;
        const cleanName = cleanTitle(data.title || c.title);
        const hd = await fetchHdArtwork(cleanName, data.japanese);
        const hdPoster = proxyPoster(hd.coverExtraLarge || data.poster) || c.poster;
        const hdBackdrop = hd.bannerImage
          ? proxyPoster(hd.bannerImage)
          : proxyPoster(hd.coverExtraLarge || data.poster) || c.poster;
        const synopsisText =
          Array.isArray(data.synopsis?.paragraphs) && data.synopsis.paragraphs.length > 0
            ? data.synopsis.paragraphs.join(' ')
            : `Tonton ${cleanName} subtitle Indonesia kualitas HD hanya di ZoneStream.`;
        return {
          id: resolvedId,
          episodeId: data.episodeList?.[0]?.episodeId || '',
          type: 'anime' as const,
          title: cleanName,
          poster: hdPoster,
          backdrop: hdBackdrop,
          hasWideBanner: Boolean(hd.bannerImage),
          rating: data.score || c.rating,
          status: (data.status || 'ONGOING').toUpperCase(),
          description: synopsisText,
          genres: cleanGenreList(Array.isArray(data.genreList) ? data.genreList : [], [
            'Anime',
            'Action',
          ]),
        };
      })
    );

    const rawHeroSlides = heroDetails
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((h) => h && h.title);

    // Put widescreen HD banner slides first so slide #1 renders razor-sharp edge-to-edge
    const heroSlides = [...rawHeroSlides].sort(
      (a, b) => Number(Boolean(b.hasWideBanner)) - Number(Boolean(a.hasWideBanner))
    );

    const uniqueLatestEpisodes = dedupeCatalogItems(latestEpisodes);
    const uniqueDonghuaList = dedupeCatalogItems([
      ...normalizedDonghuaLatest,
      ...normalizedDonghuaCompleted,
    ]);
    const uniqueAnimeList = dedupeCatalogItems([
      ...normalizedAnimeOngoing,
      ...normalizedAnimeCompleted,
    ]);

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=60');
    return res.json({
      ok: true,
      lastUpdated: new Date().toISOString(),
      heroSlides:
        heroSlides.length > 0
          ? heroSlides
          : heroCandidates.map((c) => ({
              ...c,
              backdrop: c.poster,
              hasWideBanner: false,
              description: `Saksikan episode terbaru ${c.title} secara real-time di ZoneStream.`,
              genres: [c.type === 'donghua' ? 'Donghua' : 'Anime'],
            })),
      latestEpisodes: uniqueLatestEpisodes,
      donghuaList: uniqueDonghuaList,
      animeList: uniqueAnimeList,
    });
  } catch (err) {
    console.error('[Stream Home Error]', err);
    return res.status(502).json({ error: 'Gagal memuat data streaming terbaru' });
  }
});

function dedupeCatalogItems(items: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const item of items) {
    if (!item?.id) continue;
    const key = `${item.type}:${String(item.id).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function mapDonghuaCatalogCard(d: any, fallbackLabel = 'Donghua') {
  const t = cleanTitle(d.title || '');
  rememberPoster(d.slug, d.poster);
  rememberPoster(t, d.poster);
  const resolvedPoster = d.poster || lookupPoster(d.slug, t);
  return {
    id: d.slug,
    type: 'donghua' as const,
    title: t,
    poster: proxyPoster(resolvedPoster),
    status: d.status || 'Ongoing',
    rating: deterministicScore(d.slug || d.title || 'dh'),
    episodeLabel: d.current_episode || d.type || fallbackLabel,
    isNew: !String(d.status || '').toLowerCase().includes('comp'),
  };
}

function mapAnimeCatalogCard(a: any, defaultStatus = 'Ongoing') {
  const t = cleanTitle(a.title || '');
  rememberPoster(a.animeId, a.poster);
  rememberPoster(t, a.poster);
  const resolvedPoster = a.poster || lookupPoster(a.animeId, t);
  const status = a.status || defaultStatus;
  const isCompleted = String(status).toLowerCase().includes('comp') || Boolean(a.score);
  return {
    id: a.animeId,
    type: 'anime' as const,
    title: t,
    poster: proxyPoster(resolvedPoster),
    status,
    rating: a.score || deterministicScore(a.animeId || a.title || 'an'),
    episodeLabel: a.episodes
      ? isCompleted && defaultStatus === 'Completed'
        ? `${a.episodes} Eps`
        : `Ep ${a.episodes}`
      : status,
    isNew: !isCompleted,
  };
}

// GET /api/stream/catalog
router.get('/catalog', async (req, res) => {
  try {
    const type = String(req.query.type || 'all').toLowerCase();
    const genre = String(req.query.genre || '').toLowerCase().trim();
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);

    if (q) {
      const [animeSearch, donghuaSearch] = await Promise.allSettled([
        type === 'donghua'
          ? Promise.resolve(null)
          : (async () => {
              const s = await fetchSankaOrNull<any>(`/search/${encodeURIComponent(q)}`);
              if (s?.data?.animeList?.length) return s;
              const direct = await scrapeOtakudesuSearch(q);
              return { data: { animeList: direct } };
            })(),
        type === 'anime'
          ? Promise.resolve(null)
          : (async () => {
              const s = await fetchSankaOrNull<any>(`/donghua/search/${encodeURIComponent(q)}`);
              if (s?.data?.length) return s;
              const direct = await scrapeDonghiveSearch(q);
              return { data: direct };
            })(),
      ]);

      const results: any[] = [];
      if (donghuaSearch.status === 'fulfilled' && Array.isArray(donghuaSearch.value?.data)) {
        for (const d of donghuaSearch.value.data) {
          if (!d.slug) continue;
          results.push(mapDonghuaCatalogCard(d));
        }
      }
      if (animeSearch.status === 'fulfilled' && animeSearch.value?.data?.animeList) {
        for (const a of animeSearch.value.data.animeList) {
          if (!a.animeId) continue;
          results.push(mapAnimeCatalogCard(a, a.status || 'Ongoing'));
        }
      }
      const unique = await enrichMissingPosters(dedupeCatalogItems(results));
      return res.json({ ok: true, items: unique, hasMore: false });
    }

    if (
      genre &&
      genre !== 'all' &&
      genre !== 'donghua' &&
      genre !== 'anime' &&
      genre !== 'movie' &&
      genre !== 'completed'
    ) {
      const [animeGenre, donghuaGenre] = await Promise.allSettled([
        (async () => {
          const s = await fetchSankaOrNull<any>(`/genre/${encodeURIComponent(genre)}?page=${page}`);
          if (s?.data?.animeList?.length) return s;
          const direct = await scrapeOtakudesuCatalog(page, genre);
          return { data: { animeList: direct } };
        })(),
        (async () => {
          const s = await fetchSankaOrNull<any>(`/donghua/genres/${encodeURIComponent(genre)}/${page}`);
          if (s?.data?.length) return s;
          const direct = await scrapeDonghiveCatalog(page, undefined, genre);
          return { data: direct };
        })(),
      ]);

      const dItems =
        donghuaGenre.status === 'fulfilled' && Array.isArray(donghuaGenre.value?.data)
          ? donghuaGenre.value.data.filter((d: any) => d.slug).map((d: any) => mapDonghuaCatalogCard(d))
          : [];
      const aItems =
        animeGenre.status === 'fulfilled' && animeGenre.value?.data?.animeList
          ? animeGenre.value.data.animeList
              .filter((a: any) => a.animeId)
              .map((a: any) => mapAnimeCatalogCard(a, 'Anime'))
          : [];

      const items: any[] = [];
      const maxLen = Math.max(dItems.length, aItems.length);
      for (let i = 0; i < maxLen; i++) {
        if (dItems[i]) items.push(dItems[i]);
        if (aItems[i]) items.push(aItems[i]);
      }
      const unique = await enrichMissingPosters(dedupeCatalogItems(items));
      return res.json({ ok: true, items: unique, hasMore: unique.length >= 12 });
    }

    const effectiveType =
      genre === 'donghua' || genre === 'anime' || genre === 'movie' || genre === 'completed'
        ? genre
        : type;

    if (effectiveType === 'donghua') {
      const [ongoingRes, completedRes] = await Promise.allSettled([
        (async () => {
          const dRes = await fetchSankaOrNull<any>(`/donghua/ongoing/${page}`);
          const list = dRes?.ongoing_donghua || dRes?.data || [];
          return list.length ? list : await scrapeDonghiveCatalog(page);
        })(),
        scrapeDonghiveCatalog(page, 'completed'),
      ]);

      const items: any[] = [];
      if (ongoingRes.status === 'fulfilled') {
        for (const d of ongoingRes.value || []) {
          if (d.slug) items.push(mapDonghuaCatalogCard(d));
        }
      }
      if (completedRes.status === 'fulfilled') {
        for (const d of completedRes.value || []) {
          if (d.slug) items.push(mapDonghuaCatalogCard(d));
        }
      }
      const unique = await enrichMissingPosters(dedupeCatalogItems(items));
      return res.json({ ok: true, items: unique, hasMore: unique.length >= 12 });
    }

    if (effectiveType === 'anime') {
      const [ongoingRes, completedRes] = await Promise.allSettled([
        (async () => {
          const aRes = await fetchSankaOrNull<any>(`/ongoing-anime?page=${page}`);
          const list = aRes?.data?.animeList || [];
          return list.length ? list : await scrapeOtakudesuCatalog(page);
        })(),
        scrapeOtakudesuCompleteCatalog(page),
      ]);

      const items: any[] = [];
      if (ongoingRes.status === 'fulfilled') {
        for (const a of ongoingRes.value || []) {
          if (a.animeId) items.push(mapAnimeCatalogCard(a, 'Ongoing'));
        }
      }
      if (completedRes.status === 'fulfilled') {
        for (const a of completedRes.value || []) {
          if (a.animeId) items.push(mapAnimeCatalogCard(a, 'Completed'));
        }
      }
      const unique = await enrichMissingPosters(dedupeCatalogItems(items));
      return res.json({ ok: true, items: unique, hasMore: unique.length >= 12 });
    }

    if (effectiveType === 'completed') {
      const [dComp, aComp] = await Promise.allSettled([
        scrapeDonghiveCatalog(page, 'completed'),
        scrapeOtakudesuCompleteCatalog(page),
      ]);

      const dItems =
        dComp.status === 'fulfilled'
          ? dComp.value.filter((d: any) => d.slug).map((d: any) => mapDonghuaCatalogCard({ ...d, status: 'Completed' }, 'Tamat'))
          : [];
      const aItems =
        aComp.status === 'fulfilled'
          ? aComp.value.filter((a: any) => a.animeId).map((a: any) => mapAnimeCatalogCard(a, 'Completed'))
          : [];

      const items: any[] = [];
      const maxLen = Math.max(dItems.length, aItems.length);
      for (let i = 0; i < maxLen; i++) {
        if (dItems[i]) items.push(dItems[i]);
        if (aItems[i]) items.push(aItems[i]);
      }
      const unique = await enrichMissingPosters(dedupeCatalogItems(items));
      return res.json({ ok: true, items: unique, hasMore: unique.length >= 12 });
    }

    if (effectiveType === 'movie') {
      const [mRes, aRes] = await Promise.allSettled([
        (async () => {
          const s = await fetchSankaOrNull<any>(`/donghua/search/movie`);
          if (s?.data?.length) return s;
          return { data: await scrapeDonghiveSearch('movie') };
        })(),
        (async () => {
          const s = await fetchSankaOrNull<any>(`/search/movie`);
          if (s?.data?.animeList?.length) return s;
          return { data: { animeList: await scrapeOtakudesuSearch('movie') } };
        })(),
      ]);
      const items: any[] = [];
      if (mRes.status === 'fulfilled') {
        for (const d of mRes.value?.data || []) {
          if (!d.slug) continue;
          const card = mapDonghuaCatalogCard(d, 'Movie');
          items.push({ ...card, status: d.status || 'Movie', episodeLabel: 'Movie', isNew: false });
        }
      }
      if (aRes.status === 'fulfilled') {
        for (const a of aRes.value?.data?.animeList || []) {
          if (!a.animeId) continue;
          const card = mapAnimeCatalogCard(a, 'Movie');
          items.push({ ...card, status: a.status || 'Movie', episodeLabel: 'Movie', isNew: false });
        }
      }
      const unique = await enrichMissingPosters(dedupeCatalogItems(items));
      return res.json({ ok: true, items: unique, hasMore: false });
    }

    // Default: "all" — fetch both Ongoing AND Completed for both Anime & Donghua for a rich, full catalog
    const [aOngoing, dOngoing, aComp, dComp] = await Promise.allSettled([
      (async () => {
        const s = await fetchSankaOrNull<any>(`/ongoing-anime?page=${page}`);
        if (s?.data?.animeList?.length) return s.data.animeList;
        return await scrapeOtakudesuCatalog(page);
      })(),
      (async () => {
        const s = await fetchSankaOrNull<any>(`/donghua/ongoing/${page}`);
        const list = s?.ongoing_donghua || s?.data || [];
        if (list.length) return list;
        return await scrapeDonghiveCatalog(page);
      })(),
      scrapeOtakudesuCompleteCatalog(page),
      scrapeDonghiveCatalog(page, 'completed'),
    ]);

    const dAll = [
      ...(dOngoing.status === 'fulfilled' ? dOngoing.value || [] : []).map((d: any) =>
        mapDonghuaCatalogCard(d)
      ),
      ...(dComp.status === 'fulfilled' ? dComp.value || [] : []).map((d: any) =>
        mapDonghuaCatalogCard(d)
      ),
    ].filter((x) => x.id);

    const aAll = [
      ...(aOngoing.status === 'fulfilled' ? aOngoing.value || [] : []).map((a: any) =>
        mapAnimeCatalogCard(a, 'Ongoing')
      ),
      ...(aComp.status === 'fulfilled' ? aComp.value || [] : []).map((a: any) =>
        mapAnimeCatalogCard(a, 'Completed')
      ),
    ].filter((x) => x.id);

    const interleaved: any[] = [];
    const maxLen = Math.max(dAll.length, aAll.length);
    for (let i = 0; i < maxLen; i++) {
      if (dAll[i]) interleaved.push(dAll[i]);
      if (aAll[i]) interleaved.push(aAll[i]);
    }
      const unique = await enrichMissingPosters(dedupeCatalogItems(interleaved));
    return res.json({ ok: true, items: unique, hasMore: unique.length >= 20 });
  } catch (err) {
    console.error('[Stream Catalog Error]', err);
    return res.status(502).json({ error: 'Gagal memuat katalog' });
  }
});

// GET /api/stream/schedule
router.get('/schedule', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === '1';
    const fullScheduleCacheKey = '__full_enriched_schedule_v2__';
    const cachedFull = cache.get(fullScheduleCacheKey);
    if (!forceRefresh && cachedFull && cachedFull.expiresAt > Date.now()) {
      return res.json({ ok: true, schedule: cachedFull.data });
    }

    const [
      animeSch,
      donghuaSch,
      donghuaOngoing,
      donghuaCat2,
      animeHome,
      animeCat1,
      animeCat2,
      animeCat3,
      animeComp1,
    ] = await Promise.allSettled([
      (async () => {
        const s = await fetchSankaOrNull<any>(`/schedule`, 15 * 60 * 1000);
        if (s?.data?.length) return s;
        return { data: await scrapeOtakudesuSchedule() };
      })(),
      (async () => {
        const s = await fetchSankaOrNull<any>(`/donghua/schedule`, 15 * 60 * 1000);
        if (s?.schedule?.length) return s;
        return { schedule: await scrapeDonghiveSchedule() };
      })(),
      (async () => {
        const s = await fetchSankaOrNull<any>(`/donghua/ongoing/1`, 15 * 60 * 1000);
        if (s?.ongoing_donghua?.length || s?.data?.length) return s;
        return { ongoing_donghua: await scrapeDonghiveCatalog(1) };
      })(),
      scrapeDonghiveCatalog(2),
      getAnimeHomeData(false),
      scrapeOtakudesuCatalog(1),
      scrapeOtakudesuCatalog(2),
      scrapeOtakudesuCatalog(3),
      scrapeOtakudesuCompleteCatalog(1),
    ]);

    if (donghuaOngoing.status === 'fulfilled') {
      for (const d of donghuaOngoing.value?.ongoing_donghua || donghuaOngoing.value?.data || []) {
        rememberPoster(d.slug, d.poster);
        rememberPoster(cleanTitle(d.title || ''), d.poster);
      }
    }
    if (donghuaCat2.status === 'fulfilled') {
      for (const d of donghuaCat2.value || []) {
        rememberPoster(d.slug, d.poster);
        rememberPoster(cleanTitle(d.title || ''), d.poster);
      }
    }
    if (animeHome.status === 'fulfilled') {
      const ongoing = animeHome.value?.data?.ongoing?.animeList || [];
      const completed = animeHome.value?.data?.completed?.animeList || [];
      for (const a of [...ongoing, ...completed]) {
        rememberPoster(a.animeId, a.poster);
        rememberPoster(cleanTitle(a.title || ''), a.poster);
      }
    }
    for (const catRes of [animeCat1, animeCat2, animeCat3, animeComp1]) {
      if (catRes.status === 'fulfilled') {
        for (const a of catRes.value || []) {
          rememberPoster(a.animeId, a.poster);
          rememberPoster(cleanTitle(a.title || ''), a.poster);
        }
      }
    }

    const daysOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu', 'Random'];
    const map = new Map<string, any[]>();
    for (const d of daysOrder) map.set(d, []);

    if (donghuaSch.status === 'fulfilled' && Array.isArray(donghuaSch.value?.schedule)) {
      for (const entry of donghuaSch.value.schedule) {
        const day = entry.day || 'Random';
        const list = map.get(day) || [];
        for (const item of entry.donghua_list || []) {
          const t = cleanTitle(item.title || '');
          const poster = item.poster || lookupPoster(item.slug, t);
          rememberPoster(item.slug, poster);
          rememberPoster(t, poster);
          list.push({
            id: item.slug,
            type: 'donghua',
            title: t,
            poster,
            episodeLabel: item.episodeLabel || 'Donghua',
            rating: deterministicScore(item.slug || 'schd'),
          });
        }
        map.set(day, list);
      }
    }

    if (animeSch.status === 'fulfilled' && Array.isArray(animeSch.value?.data)) {
      for (const entry of animeSch.value.data) {
        const day = entry.day || 'Random';
        const list = map.get(day) || [];
        for (const item of entry.anime_list || []) {
          const t = cleanTitle(item.anime_name || item.title || '');
          const poster = item.poster || lookupPoster(item.slug, t);
          rememberPoster(item.slug, poster);
          rememberPoster(t, poster);
          list.push({
            id: item.slug,
            type: 'anime',
            title: t,
            poster,
            episodeLabel: 'Anime',
            rating: deterministicScore(item.slug || 'scha'),
          });
        }
        map.set(day, list);
      }
    }

    // Enrich ALL remaining schedule items missing posters (via AniList HD cover + detail fallback)
    const allItems = Array.from(map.values()).flat();
    const missing = allItems.filter((x) => !x.poster);
    const BATCH_SIZE = 10;
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (m) => {
          try {
            const hd = await fetchHdArtwork(m.title);
            if (hd.coverExtraLarge) {
              m.poster = hd.coverExtraLarge;
              rememberPoster(m.id, hd.coverExtraLarge);
              rememberPoster(m.title, hd.coverExtraLarge);
              return;
            }
            if (m.type === 'donghua') {
              const d = (await getDonghuaDetailData(m.id))?.data;
              if (d?.poster) {
                m.poster = d.poster;
                rememberPoster(m.id, d.poster);
                rememberPoster(m.title, d.poster);
              }
            } else {
              const a = (await getAnimeDetailData(m.id))?.data;
              if (a?.poster) {
                m.poster = a.poster;
                rememberPoster(m.id, a.poster);
                rememberPoster(m.title, a.poster);
              }
            }
          } catch {
            // Ignore individual enrich timeout
          }
        })
      );
    }

    const schedule = Array.from(map.entries())
      .filter(([, items]) => items.length > 0)
      .map(([day, items]) => ({
        day,
        items: dedupeCatalogItems(items).map((x) => ({
          ...x,
          poster: proxyPoster(x.poster || lookupPoster(x.id, x.title)),
        })),
      }));

    cache.set(fullScheduleCacheKey, {
      expiresAt: Date.now() + 20 * 60 * 1000,
      data: schedule,
    });

    return res.json({ ok: true, schedule });
  } catch (err) {
    console.error('[Stream Schedule Error]', err);
    return res.status(502).json({ error: 'Gagal memuat jadwal rilis' });
  }
});

// GET /api/stream/detail/:type/:id
router.get('/detail/:type/:id', async (req, res) => {
  try {
    const type = req.params.type === 'donghua' ? 'donghua' : 'anime';
    let id = req.params.id;
    const epHint = String(req.query.ep || '').trim();

    if (type === 'donghua') {
      const resolved = await getDonghuaDetailData(id, epHint);
      if (resolved?.id) id = resolved.id;
      const d = resolved?.data;

      if (!d || !d.title) {
        return res.status(404).json({ error: 'Detail donghua tidak ditemukan' });
      }

      const episodes = Array.isArray(d.episodes_list)
        ? d.episodes_list.map((ep: any) => ({
            episodeId: ep.slug,
            title: cleanTitle(ep.episode || ''),
            episodeNumber: String(ep.episode_number || ''),
            releaseDate: ep.release_date || '',
          }))
        : [];

      const cleanName = cleanTitle(d.title || id);
      const hd = await fetchHdArtwork(cleanName, d.alter_title);

      return res.json({
        ok: true,
        detail: {
          id,
          type: 'donghua',
          title: cleanName,
          altTitle: d.alter_title || '',
          poster: proxyPoster(hd.coverExtraLarge || d.poster),
          backdrop: hd.bannerImage
            ? proxyPoster(hd.bannerImage)
            : proxyPoster(hd.coverExtraLarge || d.cover || d.poster),
          hasWideBanner: Boolean(hd.bannerImage),
          rating: d.rating || deterministicScore(id),
          status: d.status || 'Ongoing',
          studio: d.studio || d.network || 'Donghua Studio',
          duration: d.duration || '20 min per ep',
          released: d.released || d.released_on || '',
          synopsis:
            d.synopsis ||
            `Tonton ${cleanName} subtitle Indonesia lengkap hanya di ZoneStream.`,
          genres: cleanGenreList(Array.isArray(d.genres) ? d.genres : [], ['Donghua', 'Action']),
          episodes,
        },
      });
    }

    // Anime detail + multi-provider fallback
    const resolved = await getAnimeDetailData(id);
    if (resolved?.id) id = resolved.id;
    const data = resolved?.data || null;

    if (!data || !data.title) {
      return res.status(404).json({ error: 'Detail anime tidak ditemukan' });
    }

    const episodes = Array.isArray(data.episodeList)
      ? data.episodeList.map((ep: any) => ({
          episodeId: ep.episodeId,
          title: cleanTitle(ep.title || ''),
          episodeNumber: String(ep.eps || ''),
          releaseDate: ep.date || '',
        }))
      : [];

    const cleanName = cleanTitle(data.title || id);
    const hd = await fetchHdArtwork(cleanName, data.japanese);

    const synopsisText =
      Array.isArray(data.synopsis?.paragraphs) && data.synopsis.paragraphs.length > 0
        ? data.synopsis.paragraphs.join('\n\n')
        : `Saksikan ${cleanName} subtitle Indonesia lengkap dengan berbagai resolusi.`;

    return res.json({
      ok: true,
      detail: {
        id,
        type: 'anime',
        title: cleanName,
        altTitle: data.japanese || '',
        poster: proxyPoster(hd.coverExtraLarge || data.poster),
        backdrop: hd.bannerImage
          ? proxyPoster(hd.bannerImage)
          : proxyPoster(hd.coverExtraLarge || data.poster),
        hasWideBanner: Boolean(hd.bannerImage),
        rating: data.score || deterministicScore(id),
        status: data.status || 'Ongoing',
        studio: data.studios || 'Anime Studio',
        duration: data.duration || '24 min per ep',
        released: data.aired || '',
        synopsis: synopsisText,
        genres: cleanGenreList(Array.isArray(data.genreList) ? data.genreList : [], ['Anime']),
        episodes,
      },
    });
  } catch (err) {
    console.error('[Stream Detail Error]', err);
    return res.status(502).json({ error: 'Gagal memuat detail judul' });
  }
});

// GET /api/stream/episode/:type/:episodeId
router.get('/episode/:type/:episodeId', async (req, res) => {
  try {
    const type = req.params.type === 'donghua' ? 'donghua' : 'anime';
    const episodeId = req.params.episodeId;

    if (type === 'donghua') {
      const ep = await getDonghuaEpisodeData(episodeId);
      if (!ep) {
        return res.status(404).json({ error: 'Episode donghua tidak ditemukan' });
      }
      const rawServers = Array.isArray(ep.streaming?.servers)
        ? ep.streaming.servers
            .filter((s: any) => s.url)
            .map((s: any) => ({
              name: String(s.name || 'Server').trim(),
              url: String(s.url),
              quality: 'HD',
            }))
        : [];

      const donghuaScore = (srv: { name: string; url: string }) => {
        const n = srv.name.toLowerCase();
        const u = srv.url.toLowerCase();
        if (isFrameBlockedHost(u)) return -10;
        if (u.includes('odysee.com') || n.includes('odysee') || n.includes('oddsey')) return 95;
        if (u.includes('ok.ru') || n.includes('ok.ru') || n.includes('okru')) return 90;
        if (u.includes('dailymotion.com') || n.includes('dailymotion')) return 88;
        if (u.includes('play.d.tube') || n.includes('d-tube') || n.includes('dtube')) return 85;
        if (u.includes('filedon') || u.includes('vidhide') || u.includes('mega.nz')) return 82;
        if (n.includes('rumble') || u.includes('rumble.com')) return 40;
        return 70;
      };

      const servers = [...rawServers].sort((a, b) => donghuaScore(b) - donghuaScore(a));
      const mainUrl = String(ep.streaming?.main_url?.url || '');
      const defaultUrl =
        mainUrl && !isFrameBlockedHost(mainUrl) && !mainUrl.toLowerCase().includes('rumble.com')
          ? mainUrl
          : servers[0]?.url || mainUrl || '';
      const seriesId = ep.donghua_details?.slug || cleanDonghuaSeriesSlug(episodeId);

      const prevEpisode: any = ep.navigation?.previous_episode?.slug
        ? { episodeId: ep.navigation.previous_episode.slug, title: 'Prev' }
        : null;
      const nextEpisode: any = ep.navigation?.next_episode?.slug
        ? { episodeId: ep.navigation.next_episode.slug, title: 'Next' }
        : null;

      let episodesList: any[] = Array.isArray(ep.episodes_list)
        ? ep.episodes_list.map((x: any) => ({
            episodeId: x.slug,
            title: cleanTitle(x.episode || ''),
            episodeNumber: String(x.episode_number || ''),
          }))
        : [];

      let seriesTitle = cleanTitle(ep.donghua_details?.title || ep.episode || '')
        .replace(/\s*Episode\s*\d+.*$/i, '')
        .trim();
      let poster = ep.donghua_details?.poster || '';

      try {
        const detail = (await getDonghuaDetailData(seriesId))?.data;
        if (detail?.title) {
          seriesTitle = cleanTitle(detail.title);
          poster = detail.poster || poster;
          const list = detail.episodes_list || [];
          if (list.length > 0) {
            episodesList = list.map((x: any) => ({
              episodeId: x.slug,
              title: cleanTitle(x.episode || ''),
              episodeNumber: String(x.episode_number || ''),
            }));
          }
        }
      } catch {
        // Optional enrichment
      }

      const matchEpNum = episodeId.match(/episode-(\d+)/i);
      return res.json({
        ok: true,
        episode: {
          episodeId,
          seriesId,
          seriesTitle,
          poster: proxyPoster(poster),
          type: 'donghua',
          title: cleanTitle(ep.episode || episodeId),
          episodeNumber: matchEpNum ? matchEpNum[1] : '1',
          defaultStreamingUrl: defaultUrl,
          servers,
          prevEpisode,
          nextEpisode,
          episodesList,
        },
      });
    }

    const data = await getAnimeEpisodeData(episodeId);
    if (!data) {
      return res.status(404).json({ error: 'Episode anime tidak ditemukan' });
    }
    const rawQualities = Array.isArray(data.server?.qualities) ? data.server.qualities : [];

    const candidateEntries: Array<{
      title: string;
      quality: string;
      serverId: string;
      priority: number;
    }> = [];

    for (const q of rawQualities) {
      const qLabel = String(q.title || '').trim();
      const qScore = qLabel.includes('1080')
        ? 40
        : qLabel.includes('720')
        ? 30
        : qLabel.includes('480')
        ? 20
        : 10;

      for (const s of q.serverList || []) {
        const sTitle = String(s.title || '').trim();
        const lower = sTitle.toLowerCase();
        let hostScore = 0;
        if (lower.includes('filedon')) hostScore = 100;
        else if (lower.includes('vidhide')) hostScore = 90;
        else if (lower.includes('pixeldrain')) hostScore = 85;
        else if (lower.includes('kraken')) hostScore = 80;
        else if (lower.includes('mp4upload')) hostScore = 75;
        else if (lower.includes('mega')) hostScore = 65;
        else if (lower.includes('odcdn') || lower.includes('odstream') || lower.includes('ondesu')) {
          hostScore = -50;
        } else {
          hostScore = 30;
        }

        candidateEntries.push({
          title: `${sTitle} (${qLabel})`,
          quality: qLabel,
          serverId: s.serverId,
          priority: hostScore + qScore,
        });
      }
    }

    candidateEntries.sort((a, b) => b.priority - a.priority);

    // Pre-resolve top 3 non-desustream mirrors cleanly across Otakudesu/Sankavollerei
    const toResolve = candidateEntries.filter((c) => c.priority > 0).slice(0, 3);
    const resolvedMap = new Map<string, string>();
    for (const c of toResolve) {
      try {
        let url = '';
        if (c.serverId.startsWith('otk:')) {
          url = await resolveOtakudesuServer(c.serverId);
        } else {
          const srv = await fetchSankaOrNull<any>(
            `/server/${encodeURIComponent(c.serverId)}`,
            30 * 60 * 1000
          );
          url = String(srv?.data?.url || '').trim();
        }
        if (url && !isFrameBlockedHost(url)) {
          resolvedMap.set(c.serverId, url);
        }
      } catch {
        // Ignore failed individual server lookup
      }
    }

    const servers: any[] = [];
    for (const c of candidateEntries) {
      const resolvedUrl = resolvedMap.get(c.serverId);
      if (resolvedUrl) {
        servers.push({
          name: c.title,
          url: resolvedUrl,
          serverId: c.serverId,
          quality: c.quality,
        });
      } else if (c.priority > 0) {
        servers.push({
          name: c.title,
          serverId: c.serverId,
          quality: c.quality,
        });
      }
    }

    const upstreamDefault = String(data.defaultStreamingUrl || '').trim();
    if (upstreamDefault) {
      if (!isFrameBlockedHost(upstreamDefault)) {
        servers.unshift({
          name: 'Default HD',
          url: upstreamDefault,
          quality: 'Auto',
        });
      } else {
        servers.push({
          name: 'Mirror Cadangan (Tab Baru)',
          url: upstreamDefault,
          quality: 'External',
        });
      }
    }

    const firstEmbeddable = servers.find((s) => s.url && !isFrameBlockedHost(s.url))?.url || '';
    const defaultStreamingUrl = firstEmbeddable || upstreamDefault;

    let seriesTitle = cleanTitle(data.title || '')
      .replace(/\s*Episode\s*\d+.*$/i, '')
      .trim();
    let poster = '';
    let episodesList: any[] = [];
    if (data.animeId) {
      try {
        const detail = (await getAnimeDetailData(data.animeId))?.data;
        if (detail) {
          seriesTitle = cleanTitle(detail.title || seriesTitle);
          poster = detail.poster || '';
          episodesList = (detail.episodeList || []).map((x: any) => ({
            episodeId: x.episodeId,
            title: cleanTitle(x.title || ''),
            episodeNumber: String(x.eps || ''),
          }));
        }
      } catch {
        // Optional enrichment
      }
    }

    const matchEpNum = episodeId.match(/episode-(\d+)/i);
    return res.json({
      ok: true,
      episode: {
        episodeId,
        seriesId: data.animeId || '',
        seriesTitle,
        poster: proxyPoster(poster),
        type: 'anime',
        title: cleanTitle(data.title || episodeId),
        episodeNumber: matchEpNum ? matchEpNum[1] : '1',
        defaultStreamingUrl,
        servers,
        prevEpisode: data.prevEpisode
          ? { episodeId: data.prevEpisode.episodeId, title: 'Prev' }
          : null,
        nextEpisode: data.nextEpisode
          ? { episodeId: data.nextEpisode.episodeId, title: 'Next' }
          : null,
        episodesList,
      },
    });
  } catch (err) {
    console.error('[Stream Episode Error]', err);
    return res.status(502).json({ error: 'Gagal memuat video streaming episode' });
  }
});

// GET /api/stream/server/:serverId
router.get('/server/:serverId', async (req, res) => {
  try {
    const serverId = req.params.serverId;
    if (serverId.startsWith('otk:')) {
      const url = await resolveOtakudesuServer(serverId);
      return res.json({ ok: true, url });
    }
    const data = await fetchSankaOrNull<any>(
      `/server/${encodeURIComponent(serverId)}`,
      10 * 60 * 1000
    );
    return res.json({ ok: true, url: data?.data?.url || '' });
  } catch (err) {
    console.error('[Stream Server Resolve Error]', err);
    return res.status(502).json({ error: 'Gagal memuat server streaming' });
  }
});

export default router;
