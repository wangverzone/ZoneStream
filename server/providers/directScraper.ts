/**
 * Direct HTML fallback provider for ZoneStream.
 * Automatically kicks in whenever the primary Sankavollerei aggregator returns 403/429/5xx,
 * ensuring 100% live auto-updating Anime (otakudesu.blog) & Donghua (donghive.vip) playback.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const OTAKUDESU_BASE = 'https://otakudesu.blog';
const DONGHIVE_BASE = 'https://donghive.vip';

function decodeHtml(input: string): string {
  return String(input || '')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function stripTags(html: string): string {
  return decodeHtml(String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

/**
 * Extracts a real HTTP(S) image URL from an HTML snippet, ignoring lazy-load data:image placeholders.
 */
export function extractBestImageUrl(htmlChunk: string, baseOrigin = DONGHIVE_BASE): string {
  if (!htmlChunk) return '';
  const attrPatterns = [
    /data-lazy-src=["']([^"']+)["']/gi,
    /data-src=["']([^"']+)["']/gi,
    /data-original=["']([^"']+)["']/gi,
    /data-cfsrc=["']([^"']+)["']/gi,
    /property=["']og:image["']\s+content=["']([^"']+)["']/gi,
    /content=["']([^"']+)["']\s+property=["']og:image["']/gi,
    /srcset=["']([^"']+)["']/gi,
    /<img[^>]+src=["']([^"']+)["']/gi,
  ];

  for (const regex of attrPatterns) {
    for (const match of htmlChunk.matchAll(regex)) {
      let raw = decodeHtml(match[1] || '').trim();
      if (!raw) continue;
      // Handle srcset="url1 300w, url2 600w"
      if (regex.source.startsWith('srcset')) {
        const parts = raw
          .split(',')
          .map((s) => s.trim().split(/\s+/)[0])
          .filter(Boolean);
        raw = parts[parts.length - 1] || parts[0] || '';
      }
      if (
        !raw ||
        raw.startsWith('data:') ||
        raw.includes('blank.gif') ||
        raw.includes('placeholder') ||
        raw.includes('1x1')
      ) {
        continue;
      }
      if (raw.startsWith('//')) {
        raw = `https:${raw}`;
      } else if (raw.startsWith('/')) {
        raw = `${baseOrigin.replace(/\/+$/, '')}${raw}`;
      }
      if (/^https?:\/\//i.test(raw)) {
        return raw;
      }
    }
  }
  return '';
}

/**
 * Normalizes embed or direct video stream URLs extracted from HTML/base64 mirrors.
 */
export function normalizeExtractedStreamUrl(rawInput: string): string {
  let raw = decodeHtml(String(rawInput || '').trim());
  if (!raw) return '';

  // If raw contains an iframe or video source tag, extract its src
  const srcMatch =
    raw.match(/<source[^>]+src=["']([^"']+)["']/i) ||
    raw.match(/<iframe[^>]+src=["']([^"']+)["']/i) ||
    raw.match(/src=["']([^"']+)["']/i);
  if (srcMatch?.[1]) {
    raw = decodeHtml(srcMatch[1].trim());
  }

  if (raw.startsWith('//')) {
    raw = `https:${raw}`;
  }

  // Convert Pixeldrain share link to direct MP4 streaming endpoint
  const pdMatch = raw.match(/pixeldrain\.com\/(?:u|l)\/([a-zA-Z0-9_-]+)/i);
  if (pdMatch?.[1]) {
    return `https://pixeldrain.com/api/file/${pdMatch[1]}`;
  }

  // Convert Acefile download link to embed player
  const aceMatch = raw.match(/acefile\.co\/(?:f|service\/player)\/([a-zA-Z0-9_-]+)/i);
  if (aceMatch?.[1]) {
    return `https://acefile.co/player/${aceMatch[1]}`;
  }

  // Convert Krakenfiles view link to embed player
  const krakenMatch = raw.match(/krakenfiles\.com\/view\/([a-zA-Z0-9_-]+)/i);
  if (krakenMatch?.[1]) {
    return `https://krakenfiles.com/embed-video/${krakenMatch[1]}`;
  }

  // Normalize ok.ru direct link to videoembed
  const okMatch = raw.match(/ok\.ru\/video\/(\d+)/i);
  if (okMatch?.[1]) {
    return `https://ok.ru/videoembed/${okMatch[1]}`;
  }

  // Normalize dailymotion short/watch link to geo embed player
  const dmMatch =
    raw.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/i) ||
    raw.match(/dai\.ly\/([a-zA-Z0-9]+)/i);
  if (dmMatch?.[1] && !raw.includes('player.html') && !raw.includes('/embed/')) {
    return `https://geo.dailymotion.com/player.html?video=${dmMatch[1]}`;
  }

  return raw;
}

async function fetchHtml(url: string, timeoutMs = 10000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function slugFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  } catch {
    const clean = String(url || '').replace(/\/+$/, '');
    const idx = clean.lastIndexOf('/');
    return idx >= 0 ? clean.slice(idx + 1) : clean;
  }
}

function isFrameBlocked(url: string): boolean {
  const lower = String(url || '').toLowerCase();
  return (
    lower.includes('desustream.net') ||
    lower.includes('desustream.info') ||
    lower.includes('desustream.com') ||
    lower.includes('ondesuhd') ||
    lower.includes('odcdn') ||
    lower.includes('blogger.com/video.g') ||
    lower === 'about:blank'
  );
}

/**
 * Attempts to extract a direct playable .mp4 or .m3u8 media URL from an embed mirror URL
 * so the player can use the native HTML5 <video> element (which is immune to sandboxed iframe blocks).
 */
export async function resolveDirectVideoFromEmbed(rawUrl: string): Promise<string> {
  const url = normalizeExtractedStreamUrl(rawUrl);
  if (!url) return '';
  const lower = url.toLowerCase();

  if (
    /\.mp4(\?|$)/i.test(lower) ||
    /\.m3u8(\?|$)/i.test(lower) ||
    lower.includes('pixeldrain.com/api/file/') ||
    lower.includes('googlevideo.com/videoplayback')
  ) {
    return url;
  }

  // Dailymotion metadata API -> direct HLS .m3u8 or MP4 stream
  const dmMatch =
    url.match(/video=([a-zA-Z0-9]+)/i) ||
    url.match(/dailymotion\.com\/(?:embed\/)?video\/([a-zA-Z0-9]+)/i) ||
    url.match(/dai\.ly\/([a-zA-Z0-9]+)/i);
  if (dmMatch?.[1]) {
    try {
      const metaHtml = await fetchHtml(
        `https://www.dailymotion.com/player/metadata/video/${dmMatch[1]}`,
        4500
      );
      if (metaHtml) {
        const json = JSON.parse(metaHtml);
        const qualities = json?.qualities || {};
        for (const qKey of ['1080', '720', '480', '380', 'auto']) {
          const list = qualities[qKey];
          if (Array.isArray(list)) {
            const mp4Entry = list.find(
              (item: any) => item?.type?.includes('mp4') && item?.url
            );
            if (mp4Entry?.url) return String(mp4Entry.url);
            const hlsEntry = list.find(
              (item: any) =>
                (item?.type?.includes('mpegURL') || String(item?.url || '').includes('.m3u8')) &&
                item?.url
            );
            if (hlsEntry?.url) return String(hlsEntry.url);
          }
        }
      }
    } catch {
      // Ignore metadata extraction failure
    }
  }

  // Try scraping direct <source src="...mp4"> or file:"...mp4" from embed page HTML
  if (
    lower.includes('filedon') ||
    lower.includes('mp4upload') ||
    lower.includes('krakenfiles') ||
    lower.includes('acefile')
  ) {
    try {
      const html = await fetchHtml(url, 4000);
      if (html) {
        const directMatch =
          html.match(/["'](https?:\/\/[^"'\s]+\.mp4(?:\?[^"'\s]*)?)["']/i) ||
          html.match(/["'](https?:\/\/[^"'\s]+\.m3u8(?:\?[^"'\s]*)?)["']/i) ||
          html.match(/src=["'](https?:\/\/[^"'\s]*googlevideo\.com\/videoplayback[^"'\s]+)["']/i);
        if (directMatch?.[1]) {
          return decodeHtml(directMatch[1]).replace(/\\\//g, '/');
        }
      }
    } catch {
      // Ignore embed scrape failure
    }
  }

  return '';
}

/**
 * Separates series title and episode label cleanly so cards never show mismatched/garbled titles.
 */
export function parseSeriesAndEpisode(
  rawTitle: string,
  rawEpLabel?: string
): { cleanSeriesTitle: string; episodeLabel: string } {
  let title = stripTags(rawTitle || '')
    .replace(/\s*Subtitle Indonesia/gi, '')
    .replace(/\s*Sub Indo/gi, '')
    .replace(/\s*\[SVIP\]\s*/gi, '')
    .trim();

  let epNumFromTitle = '';
  const epMatch =
    title.match(/\bEpisode\s*(\d+(?:\.\d+)?)/i) ||
    title.match(/\bEp\.?\s*(\d+(?:\.\d+)?)/i);
  if (epMatch?.[1]) {
    epNumFromTitle = epMatch[1];
  }

  // Strip trailing "Episode X..." from series title
  const cleanSeriesTitle = title
    .replace(/\s*[-–—:]?\s*Episode\s*\d+.*$/i, '')
    .replace(/\s*[-–—:]?\s*Ep\.?\s*\d+.*$/i, '')
    .replace(/\s+Tamat$/i, '')
    .trim();

  let epClean = stripTags(rawEpLabel || '').trim();
  if (!epClean || epClean.toLowerCase() === 'ongoing' || epClean.toLowerCase() === 'new') {
    if (epNumFromTitle) {
      epClean = `Ep ${epNumFromTitle}`;
    } else if (!epClean) {
      epClean = 'Ongoing';
    }
  } else if (/^\d+(\.\d+)?$/.test(epClean)) {
    epClean = `Ep ${epClean}`;
  } else if (/^episode\s*(\d+)/i.test(epClean)) {
    epClean = epClean.replace(/^episode\s*/i, 'Ep ');
  }

  return {
    cleanSeriesTitle: cleanSeriesTitle || title,
    episodeLabel: epClean,
  };
}

// ==========================================
// DONGHIVE.VIP — LIVE DONGHUA SCRAPER
// ==========================================

function parseDonghiveBsCards(html: string) {
  const articles = html.match(/<article class="bs"[\s\S]*?<\/article>/gi) || [];
  const items: Array<{
    title: string;
    slug: string;
    poster: string;
    current_episode: string;
    status: string;
    type: string;
    url: string;
  }> = [];

  for (const art of articles) {
    const hrefMatch = art.match(/<a[^>]+href=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const url = hrefMatch[1];
    const slug = slugFromUrl(url);
    if (!slug) continue;

    // Prefer h2[itemprop="headline"] or .tt text over title attribute to avoid "Episode X Subtitle Indonesia" pollution
    const h2Match = art.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const ttMatch = art.match(/class="tt"[^>]*>([\s\S]*?)<\/div>/i);
    const titleAttrMatch = art.match(/title=["']([^"']+)["']/i);

    let candidateTitle = stripTags(h2Match?.[1] || '');
    if (!candidateTitle && ttMatch?.[1]) {
      // Remove inner h2 from .tt if duplicated
      const withoutH2 = ttMatch[1].replace(/<h2[\s\S]*?<\/h2>/gi, '');
      candidateTitle = stripTags(withoutH2) || stripTags(ttMatch[1]);
    }
    if (!candidateTitle) {
      candidateTitle = stripTags(titleAttrMatch?.[1] || slug.replace(/-/g, ' '));
    }

    const poster = extractBestImageUrl(art, DONGHIVE_BASE);

    const epMatch =
      art.match(/<span class="epx">([\s\S]*?)<\/span>/i) ||
      art.match(/<span class="sb[^"]*">([\s\S]*?)<\/span>/i);
    const rawEp = stripTags(epMatch?.[1] || '');

    const { cleanSeriesTitle, episodeLabel } = parseSeriesAndEpisode(candidateTitle, rawEp);

    const statusMatch = art.match(/<div class="status[^"]*">([\s\S]*?)<\/div>/i);
    const status = stripTags(
      statusMatch?.[1] ||
        (episodeLabel.toLowerCase().includes('end') || episodeLabel.toLowerCase().includes('tamat')
          ? 'Completed'
          : 'Ongoing')
    );

    const typeMatch = art.match(/<div class="typez[^"]*">([\s\S]*?)<\/div>/i);
    const type = stripTags(typeMatch?.[1] || 'ONA');

    items.push({
      title: cleanSeriesTitle,
      slug,
      poster,
      current_episode: episodeLabel,
      status,
      type,
      url,
    });
  }
  return items;
}

export async function scrapeDonghiveHome() {
  const html = await fetchHtml(`${DONGHIVE_BASE}/`);
  if (!html) return null;
  const allCards = parseDonghiveBsCards(html);
  const latest_release = allCards.slice(0, 24);
  const completed_donghua = allCards
    .filter((c) => c.status.toLowerCase().includes('comp'))
    .slice(0, 14);
  return { latest_release, completed_donghua };
}

export async function scrapeDonghiveCatalog(
  page = 1,
  status?: 'ongoing' | 'completed',
  genre?: string
) {
  const params = new URLSearchParams({
    page: String(page),
    order: 'update',
  });
  if (status) params.set('status', status);
  if (genre) params.set('genre[]', genre);
  const url = `${DONGHIVE_BASE}/anime/?${params.toString()}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  return parseDonghiveBsCards(html);
}

const ENG_TO_IND_DAY: Record<string, string> = {
  monday: 'Senin',
  tuesday: 'Selasa',
  wednesday: 'Rabu',
  thursday: 'Kamis',
  friday: 'Jumat',
  saturday: 'Sabtu',
  sunday: 'Minggu',
};

export async function scrapeDonghiveSchedule() {
  const html = await fetchHtml(`${DONGHIVE_BASE}/schedule/`);
  if (!html) return [];

  const sections = html.split(/<div class="bixbox schedulepage/i).slice(1);
  const results: Array<{
    day: string;
    donghua_list: Array<{ slug: string; title: string; poster: string; episodeLabel: string }>;
  }> = [];

  for (const sec of sections) {
    const dayRaw = stripTags(sec.match(/<h3>\s*<span>([\s\S]*?)<\/span>\s*<\/h3>/i)?.[1] || '');
    const day = ENG_TO_IND_DAY[dayRaw.toLowerCase()] || '';
    if (!day) continue;

    const cardChunks = sec.split(/<div class="bsx">/i).slice(1);
    const donghua_list: Array<{ slug: string; title: string; poster: string; episodeLabel: string }> = [];

    for (const chunk of cardChunks) {
      const href = chunk.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1] || '';
      const slug = slugFromUrl(href);
      if (!slug) continue;

      const rawTitle = stripTags(
        chunk.match(/<div class="tt">([\s\S]*?)<\/div>/i)?.[1] ||
          chunk.match(/title=["']([^"']+)["']/i)?.[1] ||
          slug.replace(/-/g, ' ')
      );
      const poster = extractBestImageUrl(chunk, DONGHIVE_BASE);
      const timeRaw = stripTags(chunk.match(/<span class=['"]epx[^'"]*['"][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const epRaw = stripTags(chunk.match(/<span class="sb[^"]*">([\s\S]*?)<\/span>/i)?.[1] || '');
      const rawLabel =
        epRaw && epRaw !== '??' ? `Ep ${epRaw.replace(/^Ep\s*/i, '')}` : timeRaw ? `Rilis ${timeRaw}` : 'Donghua';

      const { cleanSeriesTitle, episodeLabel } = parseSeriesAndEpisode(rawTitle, rawLabel);
      donghua_list.push({ slug, title: cleanSeriesTitle, poster, episodeLabel });
    }

    if (donghua_list.length > 0) {
      results.push({ day, donghua_list });
    }
  }

  return results;
}

export async function scrapeDonghiveSearch(query: string) {
  const normalized = query.replace(/\bs(\d+)\b/gi, 'season $1').trim();
  const html = await fetchHtml(`${DONGHIVE_BASE}/?s=${encodeURIComponent(normalized)}`);
  if (!html) return [];
  const bs = parseDonghiveBsCards(html);
  if (bs.length > 0) return bs;

  const links = [
    ...html.matchAll(
      /<a[^>]+href=["'](https:\/\/donghive\.vip\/[^"']+)["'][^>]*title=["']([^"']+)["']/gi
    ),
  ];
  return links
    .filter((m) => !m[1].includes('/genres/') && !m[1].includes('/wp-'))
    .slice(0, 12)
    .map((m) => {
      const { cleanSeriesTitle, episodeLabel } = parseSeriesAndEpisode(m[2], 'Donghua');
      return {
        title: cleanSeriesTitle,
        slug: slugFromUrl(m[1]),
        poster: '',
        current_episode: episodeLabel,
        status: 'Ongoing',
        type: 'ONA',
        url: m[1],
      };
    });
}

export async function scrapeDonghiveDetail(rawId: string, epHint?: string) {
  const baseId = rawId
    .replace(/-episode-\d+.*$/i, '')
    .replace(/-subtitle-indonesia$/i, '')
    .replace(/-sub-indo$/i, '')
    .replace(/-s(\d+)$/i, '-season-$1');
  const candidateSlugs = Array.from(
    new Set(
      [
        rawId,
        rawId.replace(/-s(\d+)$/i, '-season-$1'),
        baseId,
        rawId.replace(/-episode-\d+.*$/i, '').replace(/-subtitle-indonesia$/i, ''),
      ].filter(Boolean)
    )
  );

  let html: string | null = null;
  let resolvedSlug = rawId;

  for (const cand of candidateSlugs) {
    for (const pathUrl of [
      `${DONGHIVE_BASE}/anime/${encodeURIComponent(cand)}/`,
      `${DONGHIVE_BASE}/${encodeURIComponent(cand)}/`,
    ]) {
      const h = await fetchHtml(pathUrl);
      if (h && h.includes('eplister')) {
        html = h;
        resolvedSlug = cand;
        break;
      }
    }
    if (html) break;
  }

  if (!html && epHint) {
    const epHtml = await fetchHtml(`${DONGHIVE_BASE}/${encodeURIComponent(epHint)}/`);
    const seriesHref =
      epHtml?.match(
        /class=["']allc["'][^>]*>[\s\S]*?<a[^>]+href=["'](https:\/\/donghive\.vip\/[^"']+)["']/i
      )?.[1] || epHtml?.match(/href=["'](https:\/\/donghive\.vip\/anime\/[^"']+)["']/i)?.[1];
    if (seriesHref) {
      resolvedSlug = slugFromUrl(seriesHref);
      const h = await fetchHtml(seriesHref);
      if (h && h.includes('eplister')) html = h;
    }
  }

  if (!html) {
    const query = rawId
      .replace(/-episode-\d+.*$/i, '')
      .replace(/-s(\d+)$/i, ' season $1')
      .replace(/-/g, ' ')
      .trim();
    if (query.length >= 2) {
      const results = await scrapeDonghiveSearch(query);
      for (const r of results.slice(0, 3)) {
        if (!r?.url) continue;
        const sSlug = slugFromUrl(r.url);
        const h = await fetchHtml(r.url);
        if (h && h.includes('eplister')) {
          html = h;
          resolvedSlug = sSlug;
          break;
        }
      }
    }
  }

  if (!html) return null;

  const rawTitle = stripTags(
    html.match(/<h1 class="entry-title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
      resolvedSlug.replace(/-/g, ' ')
  );
  const { cleanSeriesTitle: title } = parseSeriesAndEpisode(rawTitle);
  const alter_title = stripTags(html.match(/<span class="alter">([\s\S]*?)<\/span>/i)?.[1] || '');

  const thumbBlock = html.match(/<div class="thumb"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
  const poster =
    extractBestImageUrl(thumbBlock, DONGHIVE_BASE) || extractBestImageUrl(html, DONGHIVE_BASE);

  const ratingMatch = html.match(/<div class="rating">[\s\S]*?<strong>([\s\S]*?)<\/strong>/i);
  const rating = stripTags(ratingMatch?.[1] || '').replace(/[^0-9.]/g, '') || '';

  const speBlock = html.match(/<div class="spe">([\s\S]*?)<\/div>/i)?.[1] || '';
  const extractSpe = (label: string) => {
    const m = speBlock.match(
      new RegExp(`<b>\\s*${label}\\s*:?\\s*<\\/b>([\\s\\S]*?)<\\/span>`, 'i')
    );
    return stripTags(m?.[1] || '');
  };

  const status = extractSpe('Status') || 'Ongoing';
  const studio = extractSpe('Studio') || extractSpe('Network') || 'Donghua Studio';
  const duration = extractSpe('Duration') || '20 min per ep';
  const released = extractSpe('Released') || '';

  const genxedBlock = html.match(/<div class="genxed">([\s\S]*?)<\/div>/i)?.[1] || '';
  const genres = [...genxedBlock.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean);

  const synopMatch =
    html.match(/<div class="entry-content"[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/<div class="synp"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/i);
  const synopsis = stripTags(synopMatch?.[1] || '');

  const eplisterBlock =
    html.match(/<div class="eplister"[\s\S]*?<ul>([\s\S]*?)<\/ul>/i)?.[1] || '';
  const epLis = eplisterBlock.match(/<li[\s\S]*?<\/li>/gi) || [];
  const episodes_list = epLis
    .map((li) => {
      const href = li.match(/href=["']([^"']+)["']/i)?.[1] || '';
      const epSlug = slugFromUrl(href);
      if (!epSlug) return null;
      const num = stripTags(li.match(/class="epl-num"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '');
      const epTitle = stripTags(
        li.match(/class="epl-title"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || epSlug
      );
      const releaseDate = stripTags(
        li.match(/class="epl-date"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || ''
      );
      return {
        slug: epSlug,
        episode: epTitle,
        episode_number: num || epSlug.match(/episode-(\d+)/i)?.[1] || '',
        release_date: releaseDate,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return {
    slug: resolvedSlug,
    title,
    alter_title,
    poster,
    cover: poster,
    rating,
    status,
    studio,
    duration,
    released,
    synopsis,
    genres,
    episodes_list,
  };
}

export async function scrapeDonghiveEpisode(episodeId: string) {
  const candidates = [episodeId];
  const numMatch = episodeId.match(/^(.*?)-episode-0*(\d+)(.*)$/i);
  if (numMatch) {
    const base = numMatch[1];
    const num = numMatch[2];
    candidates.push(`${base}-episode-${num}-subtitle-indonesia`);
    candidates.push(`${base}-episode-${num}`);
    if (num.length === 1) {
      candidates.push(`${base}-episode-0${num}-subtitle-indonesia`);
    }
  }

  let html: string | null = null;
  for (const cand of Array.from(new Set(candidates))) {
    const h = await fetchHtml(`${DONGHIVE_BASE}/${encodeURIComponent(cand)}/`);
    if (
      h &&
      (h.includes('mirror') ||
        h.includes('video-content') ||
        h.includes('<option') ||
        h.includes('embed_holder'))
    ) {
      html = h;
      break;
    }
  }

  if (!html && numMatch) {
    const detail = await scrapeDonghiveDetail(numMatch[1]);
    const matched = detail?.episodes_list.find(
      (e) => Number(e.episode_number) === Number(numMatch[2])
    );
    if (matched?.slug) {
      html = await fetchHtml(`${DONGHIVE_BASE}/${encodeURIComponent(matched.slug)}/`);
    }
  }

  if (!html) return null;

  const epTitle = stripTags(
    html.match(/<h1 class="entry-title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || episodeId
  );
  const seriesHref =
    html.match(
      /class=["']allc["'][^>]*>[\s\S]*?<a[^>]+href=["'](https:\/\/donghive\.vip\/[^"']+)["']/i
    )?.[1] ||
    html.match(/href=["'](https:\/\/donghive\.vip\/anime\/[^"']+)["']/i)?.[1] ||
    '';
  const seriesSlug = seriesHref
    ? slugFromUrl(seriesHref)
    : episodeId.replace(/-episode-\d+.*$/i, '');

  const rawOptions = [
    ...html.matchAll(/<option[^>]+value=["']([A-Za-z0-9+/=]{16,})["'][^>]*>([\s\S]*?)<\/option>/gi),
  ];
  const servers: Array<{ name: string; url: string }> = [];
  const seenUrls = new Set<string>();

  for (const m of rawOptions) {
    const label = stripTags(m[2]);
    if (!label || label.toLowerCase().includes('select video')) continue;
    try {
      const decoded = Buffer.from(m[1], 'base64').toString('utf8');
      const cleanUrl = normalizeExtractedStreamUrl(decoded);
      if (cleanUrl && !isFrameBlocked(cleanUrl) && !seenUrls.has(cleanUrl)) {
        seenUrls.add(cleanUrl);
        servers.push({ name: label, url: cleanUrl });
      }
    } catch {
      // Ignore malformed base64 mirror
    }
  }

  // Check direct iframe or video inside embed_holder / player_embed
  const embedBlock =
    html.match(/<div[^>]+id=["']embed_holder["'][\s\S]*?<\/div>\s*<\/div>/i)?.[0] ||
    html.match(/<div[^>]+class=["'][^"']*player-embed[^"']*["'][\s\S]*?<\/div>/i)?.[0] ||
    html;

  const directSrcMatch =
    embedBlock.match(/<source[^>]+src=["']([^"']+)["']/i) ||
    embedBlock.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (directSrcMatch?.[1]) {
    const cleanUrl = normalizeExtractedStreamUrl(directSrcMatch[1]);
    if (cleanUrl && !isFrameBlocked(cleanUrl) && !seenUrls.has(cleanUrl)) {
      seenUrls.add(cleanUrl);
      servers.unshift({ name: 'Server Utama HD', url: cleanUrl });
    }
  }

  const prevHref =
    html.match(/<a[^>]+href=["']([^"']+)["'][^>]*rel="prev"/i)?.[1] ||
    html.match(/<div class="nvs"[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>[^<]*Prev/i)?.[1];
  const nextHref =
    html.match(/<a[^>]+href=["']([^"']+)["'][^>]*rel="next"/i)?.[1] ||
    html.match(/<div class="nvs rght"[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1];

  const singleInfoThumb =
    html.match(/<div class="tb"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
    html.match(/<div class="thumb"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
    '';
  const poster =
    extractBestImageUrl(singleInfoThumb, DONGHIVE_BASE) || extractBestImageUrl(html, DONGHIVE_BASE);
  const { cleanSeriesTitle } = parseSeriesAndEpisode(epTitle);

  return {
    episode: epTitle,
    streaming: {
      main_url: servers[0] || { name: '', url: '' },
      servers,
    },
    donghua_details: {
      slug: seriesSlug,
      title: cleanSeriesTitle,
      poster,
    },
    navigation: {
      previous_episode:
        prevHref && !prevHref.includes('#') ? { slug: slugFromUrl(prevHref) } : null,
      next_episode: nextHref && !nextHref.includes('#') ? { slug: slugFromUrl(nextHref) } : null,
    },
    episodes_list: [],
  };
}

// ==========================================
// OTAKUDESU.BLOG — LIVE ANIME SCRAPER
// ==========================================

function parseOtakudesuCards(html: string) {
  const lis = html.match(/<li>\s*<div class=['"]detpost['"][\s\S]*?<\/li>/gi) || [];
  const items: Array<{
    animeId: string;
    title: string;
    poster: string;
    episodes: string;
    score?: string;
    latestReleaseDate?: string;
    releaseDay?: string;
  }> = [];

  for (const li of lis) {
    const href = li.match(/<div class=['"]thumb['"]>[\s\S]*?href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const animeId = slugFromUrl(href);
    if (!animeId) continue;

    const rawTitle = stripTags(
      li.match(/<h2 class=['"]jdlflm['"]>([\s\S]*?)<\/h2>/i)?.[1] || animeId.replace(/-/g, ' ')
    );
    const poster = extractBestImageUrl(li, OTAKUDESU_BASE);
    const epRaw = stripTags(li.match(/<div class=['"]epz['"]>([\s\S]*?)<\/div>/i)?.[1] || '');
    const tipRaw = stripTags(li.match(/<div class=['"]epztipe['"]>([\s\S]*?)<\/div>/i)?.[1] || '');
    const dateRaw = stripTags(li.match(/<div class="newnime">([\s\S]*?)<\/div>/i)?.[1] || '');

    const { cleanSeriesTitle } = parseSeriesAndEpisode(rawTitle);

    items.push({
      animeId,
      title: cleanSeriesTitle,
      poster,
      episodes: epRaw.replace(/Episode\s*/i, '').trim() || 'New',
      score: /^\d+(\.\d+)?$/.test(tipRaw) ? tipRaw : undefined,
      releaseDay: !/^\d+(\.\d+)?$/.test(tipRaw) ? tipRaw : undefined,
      latestReleaseDate: dateRaw,
    });
  }
  return items;
}

export async function scrapeOtakudesuHome() {
  const html = await fetchHtml(`${OTAKUDESU_BASE}/`);
  if (!html) return null;

  const venzBlocks = html.match(/<div class="venz">[\s\S]*?<\/ul>\s*<\/div>/gi) || [];
  const ongoingList = venzBlocks[0] ? parseOtakudesuCards(venzBlocks[0]) : [];
  const completedList = venzBlocks[1] ? parseOtakudesuCards(venzBlocks[1]) : [];

  return {
    ongoing: { animeList: ongoingList },
    completed: { animeList: completedList },
  };
}

export async function scrapeOtakudesuCompleteCatalog(page = 1) {
  const html = await fetchHtml(`${OTAKUDESU_BASE}/complete-anime/page/${page}/`);
  if (!html) return [];
  return parseOtakudesuCards(html);
}

export async function scrapeOtakudesuCatalog(page = 1, genre?: string) {
  const url = genre
    ? `${OTAKUDESU_BASE}/genres/${encodeURIComponent(genre)}/page/${page}/`
    : `${OTAKUDESU_BASE}/ongoing-anime/page/${page}/`;
  const html = await fetchHtml(url);
  if (!html) return [];

  if (genre) {
    const cards =
      html.match(/<div class="col-anime">[\s\S]*?<div class="col-anime-trailer"/gi) || [];
    return cards
      .map((card) => {
        const href = card.match(
          /<div class="col-anime-title">\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i
        );
        if (!href) return null;
        const animeId = slugFromUrl(href[1]);
        const { cleanSeriesTitle: title } = parseSeriesAndEpisode(href[2]);
        const poster = extractBestImageUrl(card, OTAKUDESU_BASE);
        const score = stripTags(
          card.match(/<div class="col-anime-rating">([\s\S]*?)<\/div>/i)?.[1] || ''
        );
        const episodes = stripTags(
          card.match(/<div class="col-anime-eps">([\s\S]*?)<\/div>/i)?.[1] || ''
        );
        return { animeId, title, poster, score, episodes };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }

  return parseOtakudesuCards(html);
}

export async function scrapeOtakudesuSearch(query: string) {
  const html = await fetchHtml(
    `${OTAKUDESU_BASE}/?s=${encodeURIComponent(query)}&post_type=anime`
  );
  if (!html) return [];

  const lis = html.match(/<li[^>]+style="list-style:none;">[\s\S]*?<\/li>/gi) || [];
  return lis
    .map((li) => {
      const linkMatch = li.match(/<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) return null;
      const animeId = slugFromUrl(linkMatch[1]);
      const { cleanSeriesTitle: title } = parseSeriesAndEpisode(linkMatch[2]);
      const poster = extractBestImageUrl(li, OTAKUDESU_BASE);
      const status = stripTags(li.match(/<b>Status<\/b>\s*:\s*([^<]+)/i)?.[1] || 'Ongoing');
      const score = stripTags(li.match(/<b>Rating<\/b>\s*:\s*([^<]+)/i)?.[1] || '');
      return { animeId, title, poster, status, score };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
}

export async function scrapeOtakudesuSchedule() {
  const html = await fetchHtml(`${OTAKUDESU_BASE}/jadwal-rilis/`);
  if (!html) return [];

  const blocks = html.match(/<div class="kglist321">[\s\S]*?<\/ul>\s*<\/div>/gi) || [];
  return blocks
    .map((blk) => {
      const day = stripTags(blk.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || '');
      const links = [...blk.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
      const anime_list = links.map((m) => {
        const { cleanSeriesTitle } = parseSeriesAndEpisode(m[2]);
        return {
          slug: slugFromUrl(m[1]),
          anime_name: cleanSeriesTitle,
        };
      });
      return { day, anime_list };
    })
    .filter((d) => d.day && d.anime_list.length > 0);
}

export async function scrapeOtakudesuDetail(rawId: string) {
  let id = rawId;
  let html = await fetchHtml(`${OTAKUDESU_BASE}/anime/${encodeURIComponent(id)}/`);

  if (!html || !html.includes('episodelist')) {
    const query = rawId
      .replace(/-sub-indo$/i, '')
      .replace(/-subtitle-indonesia$/i, '')
      .replace(/-/g, ' ')
      .trim();
    const results = await scrapeOtakudesuSearch(query);
    if (results[0]?.animeId) {
      id = results[0].animeId;
      html = await fetchHtml(`${OTAKUDESU_BASE}/anime/${encodeURIComponent(id)}/`);
    }
  }

  if (!html || !html.includes('episodelist')) return null;

  const infoBlock = html.match(/<div class="infozingle">([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] || '';
  const getInfo = (label: string) => {
    const m = infoBlock.match(
      new RegExp(`<span><b>\\s*${label}\\s*<\\/b>\\s*:([\\s\\S]*?)<\\/span>`, 'i')
    );
    return stripTags(m?.[1] || '');
  };

  const rawTitle =
    getInfo('Judul') ||
    stripTags(html.match(/<div class="jdlrx">[\s\S]*?<h1>([\s\S]*?)<\/h1>/i)?.[1] || id);
  const { cleanSeriesTitle: title } = parseSeriesAndEpisode(rawTitle);
  const japanese = getInfo('Japanese');
  const score = getInfo('Skor');
  const status = getInfo('Status') || 'Ongoing';
  const duration = getInfo('Durasi') || '24 min per ep';
  const aired = getInfo('Tanggal Rilis');
  const studios = getInfo('Studio') || 'Anime Studio';

  const genreSpan = infoBlock.match(/<span><b>\s*Genre\s*<\/b>\s*:([\s\S]*?)<\/span>/i)?.[1] || '';
  const genreList = [...genreSpan.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({
    title: stripTags(m[1]),
  }));

  const fotoBlock = html.match(/<div class="fotoanime">([\s\S]*?)<\/div>/i)?.[1] || '';
  const poster =
    extractBestImageUrl(fotoBlock, OTAKUDESU_BASE) || extractBestImageUrl(html, OTAKUDESU_BASE);

  const sinopc = html.match(/<div class="sinopc">([\s\S]*?)<\/div>/i)?.[1] || '';
  const paragraphs = [...sinopc.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean);

  const epLists = html.match(/<div class="episodelist">[\s\S]*?<\/ul>/gi) || [];
  const mainEpBlock =
    epLists.find((blk) => blk.includes('/episode/')) || epLists[1] || epLists[0] || '';
  const epLis = mainEpBlock.match(/<li>[\s\S]*?<\/li>/gi) || [];
  const episodeList = epLis
    .map((li) => {
      const aMatch = li.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (!aMatch) return null;
      const episodeId = slugFromUrl(aMatch[1]);
      const epTitle = stripTags(aMatch[2]);
      const date = stripTags(li.match(/class=['"]zeebr['"][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const epsMatch = epTitle.match(/Episode\s*(\d+)/i);
      return {
        episodeId,
        title: epTitle,
        eps: epsMatch ? epsMatch[1] : '',
        date,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return {
    animeId: id,
    title,
    japanese,
    poster,
    score,
    status,
    studios,
    duration,
    aired,
    synopsis: { paragraphs },
    genreList,
    episodeList,
  };
}

let cachedOtakuNonce: { nonce: string; action: string; expiresAt: number } | null = null;

async function getOtakuAjaxConfig(
  html?: string
): Promise<{ nonce: string; mirrorAction: string } | null> {
  const actions = html
    ? [...html.matchAll(/action\s*:\s*["']([a-f0-9]{16,})["']/gi)].map((m) => m[1])
    : [];
  const mirrorAction = actions[0] || '2a3505c93b0035d3f455df82bf976b84';
  const nonceAction = actions[1] || 'aa1208d27f29ca340c92c66d1926f13f';

  if (cachedOtakuNonce && cachedOtakuNonce.expiresAt > Date.now()) {
    return { nonce: cachedOtakuNonce.nonce, mirrorAction: cachedOtakuNonce.action };
  }

  try {
    const resp = await fetch(`${OTAKUDESU_BASE}/wp-admin/admin-ajax.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': UA,
      },
      body: new URLSearchParams({ action: nonceAction }),
    });
    const json = (await resp.json()) as any;
    if (json?.data) {
      cachedOtakuNonce = {
        nonce: String(json.data),
        action: mirrorAction,
        expiresAt: Date.now() + 15 * 60 * 1000,
      };
      return { nonce: cachedOtakuNonce.nonce, mirrorAction };
    }
  } catch {
    // Non-fatal
  }
  return null;
}

export async function resolveOtakudesuServer(encodedServerId: string): Promise<string> {
  try {
    const rawB64 = encodedServerId.startsWith('otk:')
      ? encodedServerId.slice(4)
      : encodedServerId;
    const payload = JSON.parse(Buffer.from(rawB64, 'base64').toString('utf8'));
    const cfg = await getOtakuAjaxConfig();
    if (!cfg) return '';

    const resp = await fetch(`${OTAKUDESU_BASE}/wp-admin/admin-ajax.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': UA,
      },
      body: new URLSearchParams({
        id: String(payload.id),
        i: String(payload.i),
        q: String(payload.q),
        nonce: cfg.nonce,
        action: cfg.mirrorAction,
      }),
    });
    const json = (await resp.json()) as any;
    if (json?.data) {
      const htmlFragment = Buffer.from(String(json.data), 'base64').toString('utf8');
      return normalizeExtractedStreamUrl(htmlFragment);
    }
  } catch {
    // Ignore
  }
  return '';
}

export async function scrapeOtakudesuEpisode(episodeId: string) {
  let html = await fetchHtml(`${OTAKUDESU_BASE}/episode/${encodeURIComponent(episodeId)}/`);
  if (!html) {
    html = await fetchHtml(`${OTAKUDESU_BASE}/${encodeURIComponent(episodeId)}/`);
  }
  if (!html) return null;

  const epTitle = stripTags(html.match(/<h1 class="posttl">([\s\S]*?)<\/h1>/i)?.[1] || episodeId);
  const animeHref =
    html.match(/href=["'](https:\/\/otakudesu\.(?:blog|best|cloud)\/anime\/[^"']+)["']/i)?.[1] ||
    '';
  const animeId = animeHref ? slugFromUrl(animeHref) : '';

  const prevHref =
    html.match(/<a[^>]+href=["']([^"']+\/episode\/[^"']+)["'][^>]*>(?:Previous|Prev)/i)?.[1] || '';
  const nextHref =
    html.match(/<a[^>]+href=["']([^"']+\/episode\/[^"']+)["'][^>]*>(?:Next)/i)?.[1] || '';

  const mirrorBlocks = html.match(/<ul class=["']m\d+p["']>[\s\S]*?<\/ul>/gi) || [];
  const qualities: Array<{
    title: string;
    serverList: Array<{ title: string; serverId: string }>;
  }> = [];

  for (const blk of mirrorBlocks) {
    const qMatch = blk.match(/class=["']m(\d+p)["']/i);
    const qTitle = qMatch ? qMatch[1] : '720p';
    const links = [
      ...blk.matchAll(/<a[^>]+data-content=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
    ];
    const serverList = links.map((m) => ({
      title: stripTags(m[2]),
      serverId: `otk:${m[1]}`,
    }));
    if (serverList.length > 0) {
      qualities.push({ title: qTitle, serverList });
    }
  }

  if (qualities.length === 0) {
    const links = [
      ...html.matchAll(/<a[^>]+data-content=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
    ];
    const serverList = links.map((m) => ({
      title: stripTags(m[2]),
      serverId: `otk:${m[1]}`,
    }));
    if (serverList.length > 0) {
      qualities.push({ title: '720p', serverList });
    }
  }

  const defaultIframe =
    html.match(/<div class="responsive-embed-stream">[\s\S]*?<iframe[^>]+src=["']([^"']+)["']/i)?.[1] ||
    '';
  await getOtakuAjaxConfig(html);

  const poster = extractBestImageUrl(html, OTAKUDESU_BASE);

  return {
    title: epTitle,
    animeId,
    poster,
    defaultStreamingUrl: normalizeExtractedStreamUrl(defaultIframe),
    prevEpisode: prevHref ? { episodeId: slugFromUrl(prevHref) } : null,
    nextEpisode: nextHref ? { episodeId: slugFromUrl(nextHref) } : null,
    server: { qualities },
  };
}

// ==========================================
// GLOBAL ANIME & DONGHUA LIVE ENGINE (ANILIST GRAPHQL)
// Covers all Anime, Donghua (CN), Movies, & Seasons worldwide + typo tolerance
// ==========================================

const TYPO_AND_ALIAS_MAP: Array<[RegExp, string]> = [
  [/\bone\s*p+i*c+e+\b/gi, 'One Piece'],
  [/\bone\s*pe+i+c+e+\b/gi, 'One Piece'],
  [/\bonepiece\b/gi, 'One Piece'],
  [/^op$/i, 'One Piece'],
  [/\bnaruto\s*ship+u+d+e+n\b/gi, 'Naruto Shippuden'],
  [/\bjjk\b/gi, 'Jujutsu Kaisen'],
  [/\bjujutsu\s*kaisen\b/gi, 'Jujutsu Kaisen'],
  [/\baot\b|\bsnk\b/gi, 'Attack on Titan'],
  [/\bkny\b|\bkimetsu\b/gi, 'Demon Slayer Kimetsu no Yaiba'],
  [/\bbtth\b/gi, 'Battle Through the Heavens'],
  [/\bsolo\s*lev+l*i+n+g\b/gi, 'Solo Leveling'],
  [/\bdbz\b|\bdbs\b|\bdragonball\b/gi, 'Dragon Ball'],
  [/\bhxh\b|\bhunterxhunter\b/gi, 'Hunter x Hunter'],
  [/\bble+c+h\b/gi, 'Bleach'],
  [/\bbnha\b|\bmha\b/gi, 'My Hero Academia'],
  [/\bsao\b/gi, 'Sword Art Online'],
  [/\bcsm\b/gi, 'Chainsaw Man'],
  [/\btokrev\b/gi, 'Tokyo Revengers'],
  [/\bdouluo\s*dalu\b/gi, 'Soul Land'],
];

export function normalizeSearchQuery(rawQuery: string): string {
  let q = String(rawQuery || '').trim();
  if (!q) return '';
  for (const [pattern, replacement] of TYPO_AND_ALIAS_MAP) {
    q = q.replace(pattern, replacement);
  }
  return q.replace(/\s+/g, ' ').trim();
}

function slugifyTitle(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

const ANILIST_GENRE_MAP: Record<string, string> = {
  action: 'Action',
  adventure: 'Adventure',
  fantasy: 'Fantasy',
  'martial-arts': 'Action',
  cultivation: 'Fantasy',
  comedy: 'Comedy',
  romance: 'Romance',
  'sci-fi': 'Sci-Fi',
  mecha: 'Mecha',
  drama: 'Drama',
  'slice-of-life': 'Slice of Life',
  supernatural: 'Supernatural',
  isekai: 'Fantasy',
  mystery: 'Mystery',
  psychological: 'Psychological',
  thriller: 'Thriller',
  magic: 'Fantasy',
  historical: 'Drama',
  school: 'Slice of Life',
  horror: 'Horror',
  sports: 'Sports',
  music: 'Music',
};

const ANILIST_TAG_MAP: Record<string, string> = {
  isekai: 'Isekai',
  'martial-arts': 'Martial Arts',
  cultivation: 'Cultivation',
  magic: 'Magic',
  school: 'School',
  historical: 'Historical',
  reincarnation: 'Reincarnation',
};

function mapAniListMediaToCard(media: any) {
  if (!media?.id) return null;
  const isDonghua = media.countryOfOrigin === 'CN';
  const type: 'donghua' | 'anime' = isDonghua ? 'donghua' : 'anime';
  const rawTitle =
    media.title?.english || media.title?.romaji || media.title?.native || `Anime ${media.id}`;
  const { cleanSeriesTitle: title } = parseSeriesAndEpisode(rawTitle);
  const slug = `al-${media.id}-${slugifyTitle(title) || media.id}`;
  const poster = media.coverImage?.extraLarge || media.coverImage?.large || '';

  const airedEps =
    media.nextAiringEpisode?.episode && media.nextAiringEpisode.episode > 1
      ? media.nextAiringEpisode.episode - 1
      : media.episodes || (title.toLowerCase() === 'one piece' ? 1122 : 12);

  const isCompleted = media.status === 'FINISHED';
  const isMovie = media.format === 'MOVIE';
  const status = isMovie ? 'Movie' : isCompleted ? 'Completed' : 'Ongoing';
  const episodeLabel = isMovie
    ? 'Movie'
    : isCompleted
    ? `${airedEps} Eps`
    : `Ep ${airedEps}`;
  const rating = media.averageScore ? (media.averageScore / 10).toFixed(2) : '8.45';

  const baseGenres = Array.isArray(media.genres)
    ? media.genres.filter((g: unknown): g is string => typeof g === 'string' && g.trim().length > 0)
    : [];
  const tagNames = Array.isArray(media.tags)
    ? media.tags
        .map((t: any) => (typeof t?.name === 'string' ? t.name.trim() : ''))
        .filter((n: string) =>
          ['Isekai', 'Martial Arts', 'Cultivation', 'Magic', 'School', 'Historical', 'Reincarnation'].includes(n)
        )
    : [];
  const genres = Array.from(new Set([...baseGenres, ...tagNames]));

  return {
    id: slug,
    anilistId: Number(media.id),
    type,
    title,
    altTitle: media.title?.romaji || media.title?.native || '',
    poster,
    backdrop: media.bannerImage || poster,
    status,
    rating,
    episodeLabel,
    totalEpisodes: airedEps,
    isNew: !isCompleted,
    genres,
  };
}

export async function searchGlobalAniList(
  rawQuery: string,
  filterType: string = 'all'
): Promise<Array<NonNullable<ReturnType<typeof mapAniListMediaToCard>>>> {
  const normalized = normalizeSearchQuery(rawQuery);
  const queries = Array.from(new Set([normalized, rawQuery.trim()].filter(Boolean)));
  if (queries.length === 0) return [];

  const results: Array<NonNullable<ReturnType<typeof mapAniListMediaToCard>>> = [];
  const seenIds = new Set<number>();

  for (const q of queries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
    try {
      const resp = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'ZoneStream-Global/2.0',
        },
        body: JSON.stringify({
          query: `
            query ($search: String) {
              Page(page: 1, perPage: 36) {
                media(search: $search, type: ANIME, isAdult: false, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
                  id
                  countryOfOrigin
                  format
                  status
                  episodes
                  averageScore
                  bannerImage
                  genres
                  tags { name }
                  nextAiringEpisode { episode }
                  title { english romaji native }
                  coverImage { extraLarge large }
                }
              }
            }
          `,
          variables: { search: q },
        }),
      });
      if (!resp.ok) continue;
      const json = (await resp.json()) as any;
      const list = json?.data?.Page?.media || [];
      for (const m of list) {
        const mapped = mapAniListMediaToCard(m);
        if (!mapped || seenIds.has(mapped.anilistId)) continue;
        if (filterType === 'donghua' && mapped.type !== 'donghua') continue;
        if (filterType === 'anime' && mapped.type !== 'anime') continue;
        if (filterType === 'movie' && mapped.status !== 'Movie') continue;
        if (filterType === 'completed' && mapped.status !== 'Completed') continue;
        seenIds.add(mapped.anilistId);
        results.push(mapped);
      }
      if (results.length >= 18) break;
    } catch {
      // Ignore network timeout
    } finally {
      clearTimeout(timer);
    }
  }

  return results;
}

export async function browseGlobalAniList(
  page = 1,
  filterType: string = 'all',
  genre?: string
): Promise<Array<NonNullable<ReturnType<typeof mapAniListMediaToCard>>>> {
  const rawGenreSlugs = String(genre || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const mappedGenres = Array.from(
    new Set(rawGenreSlugs.map((g) => ANILIST_GENRE_MAP[g]).filter(Boolean))
  );
  const mappedTags = Array.from(
    new Set(rawGenreSlugs.map((g) => ANILIST_TAG_MAP[g]).filter(Boolean))
  );

  const genreFilterVars: Record<string, any> = {};
  if (mappedGenres.length === 1 && mappedTags.length === 0) {
    genreFilterVars.genre = mappedGenres[0];
  } else if (mappedGenres.length > 0) {
    genreFilterVars.genre_in = mappedGenres;
  }
  if (mappedTags.length > 0) {
    genreFilterVars.tag_in = mappedTags;
  }

  const fetchBatch = async (variables: Record<string, any>) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
    try {
      const resp = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'ZoneStream-Global/2.0',
        },
        body: JSON.stringify({
          query: `
            query ($page: Int, $perPage: Int, $countryOfOrigin: CountryCode, $format: MediaFormat, $status: MediaStatus, $genre: String, $genre_in: [String], $tag_in: [String]) {
              Page(page: $page, perPage: $perPage) {
                media(
                  type: ANIME
                  isAdult: false
                  countryOfOrigin: $countryOfOrigin
                  format: $format
                  status: $status
                  genre: $genre
                  genre_in: $genre_in
                  tag_in: $tag_in
                  sort: [TRENDING_DESC, POPULARITY_DESC]
                ) {
                  id
                  countryOfOrigin
                  format
                  status
                  episodes
                  averageScore
                  bannerImage
                  genres
                  tags { name }
                  nextAiringEpisode { episode }
                  title { english romaji native }
                  coverImage { extraLarge large }
                }
              }
            }
          `,
          variables,
        }),
      });
      if (!resp.ok) return [];
      const json = (await resp.json()) as any;
      return (json?.data?.Page?.media || [])
        .map(mapAniListMediaToCard)
        .filter((x: any): x is NonNullable<ReturnType<typeof mapAniListMediaToCard>> => Boolean(x));
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  };

  if (filterType === 'donghua') {
    return await fetchBatch({
      page,
      perPage: 28,
      countryOfOrigin: 'CN',
      ...genreFilterVars,
    });
  }

  if (filterType === 'anime') {
    return await fetchBatch({
      page,
      perPage: 28,
      countryOfOrigin: 'JP',
      ...genreFilterVars,
    });
  }

  if (filterType === 'movie') {
    const [jpMovies, cnMovies] = await Promise.all([
      fetchBatch({ page, perPage: 18, format: 'MOVIE', countryOfOrigin: 'JP', ...genreFilterVars }),
      fetchBatch({ page, perPage: 10, format: 'MOVIE', countryOfOrigin: 'CN', ...genreFilterVars }),
    ]);
    return [...jpMovies, ...cnMovies];
  }

  if (filterType === 'completed') {
    const [jpDone, cnDone] = await Promise.all([
      fetchBatch({
        page,
        perPage: 18,
        status: 'FINISHED',
        countryOfOrigin: 'JP',
        ...genreFilterVars,
      }),
      fetchBatch({
        page,
        perPage: 14,
        status: 'FINISHED',
        countryOfOrigin: 'CN',
        ...genreFilterVars,
      }),
    ]);
    return [...cnDone, ...jpDone];
  }

  const [jpList, cnList] = await Promise.all([
    fetchBatch({ page, perPage: 18, countryOfOrigin: 'JP', ...genreFilterVars }),
    fetchBatch({ page, perPage: 18, countryOfOrigin: 'CN', ...genreFilterVars }),
  ]);

  const interleaved: Array<NonNullable<ReturnType<typeof mapAniListMediaToCard>>> = [];
  const maxLen = Math.max(jpList.length, cnList.length);
  for (let i = 0; i < maxLen; i++) {
    if (cnList[i]) interleaved.push(cnList[i]);
    if (jpList[i]) interleaved.push(jpList[i]);
  }
  return interleaved;
}

export async function fetchGlobalMediaDetail(
  rawIdOrSlug: string,
  expectedType: 'donghua' | 'anime'
) {
  const alMatch = rawIdOrSlug.match(/^al-(\d+)/i);
  const anilistId = alMatch ? Number(alMatch[1]) : null;
  const searchQuery = normalizeSearchQuery(
    rawIdOrSlug
      .replace(/^al-\d+-?/i, '')
      .replace(/-episode-\d+.*$/i, '')
      .replace(/-subtitle-indonesia$/i, '')
      .replace(/-sub-indo$/i, '')
      .replace(/-/g, ' ')
      .trim()
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const resp = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'ZoneStream-Global/2.0',
      },
      body: JSON.stringify({
        query: anilistId
          ? `
            query ($id: Int) {
              Media(id: $id, type: ANIME) {
                id
                countryOfOrigin
                format
                status
                episodes
                duration
                seasonYear
                averageScore
                bannerImage
                description(asHtml: false)
                genres
                nextAiringEpisode { episode }
                title { english romaji native }
                coverImage { extraLarge large }
                studios(isMain: true) { nodes { name } }
                relations {
                  edges {
                    relationType
                    node {
                      id
                      type
                      countryOfOrigin
                      format
                      status
                      episodes
                      averageScore
                      nextAiringEpisode { episode }
                      title { english romaji native }
                      coverImage { extraLarge large }
                    }
                  }
                }
              }
            }
          `
          : `
            query ($search: String) {
              Media(search: $search, type: ANIME, isAdult: false, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
                id
                countryOfOrigin
                format
                status
                episodes
                duration
                seasonYear
                averageScore
                bannerImage
                description(asHtml: false)
                genres
                nextAiringEpisode { episode }
                title { english romaji native }
                coverImage { extraLarge large }
                studios(isMain: true) { nodes { name } }
                relations {
                  edges {
                    relationType
                    node {
                      id
                      type
                      countryOfOrigin
                      format
                      status
                      episodes
                      averageScore
                      nextAiringEpisode { episode }
                      title { english romaji native }
                      coverImage { extraLarge large }
                    }
                  }
                }
              }
            }
          `,
        variables: anilistId ? { id: anilistId } : { search: searchQuery },
      }),
    });

    if (!resp.ok) return null;
    const json = (await resp.json()) as any;
    const m = json?.data?.Media;
    if (!m?.id) return null;

    const rawTitle =
      m.title?.english || m.title?.romaji || m.title?.native || searchQuery || 'Series';
    const { cleanSeriesTitle: title } = parseSeriesAndEpisode(rawTitle);
    const id = `al-${m.id}-${slugifyTitle(title) || m.id}`;
    const type: 'donghua' | 'anime' =
      m.countryOfOrigin === 'CN' ? 'donghua' : expectedType || 'anime';
    const poster = m.coverImage?.extraLarge || m.coverImage?.large || '';
    const backdrop = m.bannerImage || poster;

    const totalEps =
      m.nextAiringEpisode?.episode && m.nextAiringEpisode.episode > 1
        ? m.nextAiringEpisode.episode - 1
        : m.episodes || (title.toLowerCase() === 'one piece' ? 1122 : 12);

    const suffix = type === 'donghua' ? '-subtitle-indonesia' : '-sub-indo';
    const episodes = [];
    for (let n = totalEps; n >= 1; n--) {
      episodes.push({
        episodeId: `${id}-episode-${n}${suffix}`,
        title: `${title} Episode ${n}`,
        episodeNumber: String(n),
        releaseDate: m.seasonYear ? String(m.seasonYear) : 'HD',
      });
    }

    const relatedSeasons = (m.relations?.edges || [])
      .filter((edge: any) => edge?.node?.type === 'ANIME')
      .map((edge: any) => mapAniListMediaToCard(edge.node))
      .filter((x: any): x is NonNullable<ReturnType<typeof mapAniListMediaToCard>> => Boolean(x));

    return {
      id,
      anilistId: Number(m.id),
      type,
      title,
      altTitle: m.title?.romaji || m.title?.native || '',
      poster,
      backdrop,
      hasWideBanner: Boolean(m.bannerImage),
      rating: m.averageScore ? (m.averageScore / 10).toFixed(2) : '8.50',
      status: m.status === 'FINISHED' ? 'Completed' : 'Ongoing',
      studio: m.studios?.nodes?.[0]?.name || (type === 'donghua' ? 'Donghua Studio' : 'Anime Studio'),
      duration: m.duration ? `${m.duration} min per ep` : '24 min per ep',
      released: m.seasonYear ? String(m.seasonYear) : 'Terbaru',
      synopsis:
        stripTags(m.description || '') ||
        `Saksikan ${title} subtitle Indonesia full episode kualitas HD di ZoneStream.`,
      genres: Array.isArray(m.genres) && m.genres.length > 0 ? m.genres : ['Action', 'Fantasy'],
      episodes,
      seasons: relatedSeasons,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

