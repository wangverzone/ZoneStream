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
  return lower.includes('desustream.net') || lower.includes('desustream.info');
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

    const titleMatch =
      art.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) ||
      art.match(/class="tt"[^>]*>([\s\S]*?)<\/div>/i) ||
      art.match(/title=["']([^"']+)["']/i);
    const rawTitle = stripTags(titleMatch?.[1] || slug.replace(/-/g, ' '));

    const imgMatch =
      art.match(/data-src=["']([^"']+)["']/i) ||
      art.match(/data-lazy-src=["']([^"']+)["']/i) ||
      art.match(/<img[^>]+src=["']([^"']+)["']/i);
    const poster = decodeHtml(imgMatch?.[1] || '');

    const epMatch = art.match(/<span class="epx">([\s\S]*?)<\/span>/i);
    const current_episode = stripTags(epMatch?.[1] || 'Ongoing');

    const statusMatch = art.match(/<div class="status[^"]*">([\s\S]*?)<\/div>/i);
    const status = stripTags(statusMatch?.[1] || (current_episode.toLowerCase().includes('end') ? 'Completed' : 'Ongoing'));

    const typeMatch = art.match(/<div class="typez[^"]*">([\s\S]*?)<\/div>/i);
    const type = stripTags(typeMatch?.[1] || 'ONA');

    items.push({
      title: rawTitle,
      slug,
      poster,
      current_episode,
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
  const latest_release = allCards.slice(0, 20);
  const completed_donghua = allCards.filter((c) => c.status.toLowerCase().includes('comp')).slice(0, 12);
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

      const title = stripTags(
        chunk.match(/<div class="tt">([\s\S]*?)<\/div>/i)?.[1] ||
          chunk.match(/title=["']([^"']+)["']/i)?.[1] ||
          slug.replace(/-/g, ' ')
      );
      const poster = decodeHtml(
        chunk.match(/<img[^>]+(?:data-src|data-lazy-src|src)=["']([^"']+)["']/i)?.[1] || ''
      );
      const timeRaw = stripTags(chunk.match(/<span class=['"]epx[^'"]*['"][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const epRaw = stripTags(chunk.match(/<span class="sb[^"]*">([\s\S]*?)<\/span>/i)?.[1] || '');
      const episodeLabel =
        epRaw && epRaw !== '??' ? `Ep ${epRaw}` : timeRaw ? `Rilis ${timeRaw}` : 'Donghua';

      donghua_list.push({ slug, title, poster, episodeLabel });
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

  // Fallback: match series cards in search/sidebar if .bs block empty
  const links = [...html.matchAll(/<a[^>]+href=["'](https:\/\/donghive\.vip\/[^"']+)["'][^>]*title=["']([^"']+)["']/gi)];
  return links
    .filter((m) => !m[1].includes('/genres/') && !m[1].includes('/wp-'))
    .slice(0, 12)
    .map((m) => ({
      title: stripTags(m[2]),
      slug: slugFromUrl(m[1]),
      poster: '',
      current_episode: 'Donghua',
      status: 'Ongoing',
      type: 'ONA',
      url: m[1],
    }));
}

export async function scrapeDonghiveDetail(rawId: string, epHint?: string) {
  const baseId = rawId
    .replace(/-episode-\d+.*$/i, '')
    .replace(/-subtitle-indonesia$/i, '')
    .replace(/-s(\d+)$/i, '-season-$1');
  const candidateSlugs = Array.from(
    new Set([
      rawId,
      rawId.replace(/-s(\d+)$/i, '-season-$1'),
      baseId,
      rawId.replace(/-episode-\d+.*$/i, '').replace(/-subtitle-indonesia$/i, ''),
    ].filter(Boolean))
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

  // Try resolving from episode page breadcrumb/.allc series link if episode hint exists
  if (!html && epHint) {
    const epHtml = await fetchHtml(`${DONGHIVE_BASE}/${encodeURIComponent(epHint)}/`);
    const seriesHref =
      epHtml?.match(/class=["']allc["'][^>]*>[\s\S]*?<a[^>]+href=["'](https:\/\/donghive\.vip\/[^"']+)["']/i)?.[1] ||
      epHtml?.match(/href=["'](https:\/\/donghive\.vip\/anime\/[^"']+)["']/i)?.[1];
    if (seriesHref) {
      resolvedSlug = slugFromUrl(seriesHref);
      const h = await fetchHtml(seriesHref);
      if (h && h.includes('eplister')) html = h;
    }
  }

  // Fallback search by title derived from slug
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

  const title = stripTags(html.match(/<h1 class="entry-title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || resolvedSlug.replace(/-/g, ' '));
  const alter_title = stripTags(html.match(/<span class="alter">([\s\S]*?)<\/span>/i)?.[1] || '');
  const posterMatch =
    html.match(/<div class="thumb"[^>]*>[\s\S]*?<img[^>]+(?:data-src|src)=["']([^"']+)["']/i) ||
    html.match(/property="og:image"\s+content=["']([^"']+)["']/i);
  const poster = decodeHtml(posterMatch?.[1] || '');

  const ratingMatch = html.match(/<div class="rating">[\s\S]*?<strong>([\s\S]*?)<\/strong>/i);
  const rating = stripTags(ratingMatch?.[1] || '').replace(/[^0-9.]/g, '') || '';

  const speBlock = html.match(/<div class="spe">([\s\S]*?)<\/div>/i)?.[1] || '';
  const extractSpe = (label: string) => {
    const m = speBlock.match(new RegExp(`<b>\\s*${label}\\s*:?\\s*<\\/b>([\\s\\S]*?)<\\/span>`, 'i'));
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

  const eplisterBlock = html.match(/<div class="eplister"[\s\S]*?<ul>([\s\S]*?)<\/ul>/i)?.[1] || '';
  const epLis = eplisterBlock.match(/<li[\s\S]*?<\/li>/gi) || [];
  const episodes_list = epLis
    .map((li) => {
      const href = li.match(/href=["']([^"']+)["']/i)?.[1] || '';
      const epSlug = slugFromUrl(href);
      if (!epSlug) return null;
      const num = stripTags(li.match(/class="epl-num"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '');
      const epTitle = stripTags(li.match(/class="epl-title"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || epSlug);
      const releaseDate = stripTags(li.match(/class="epl-date"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '');
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
  // Handle leading-zero / suffix mismatch (e.g. -episode-01-subtitle-indonesia -> -episode-1-)
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
    if (h && (h.includes('mirror') || h.includes('video-content') || h.includes('<option'))) {
      html = h;
      break;
    }
  }

  // Last fallback: look up series detail and match by episode number
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

  const epTitle = stripTags(html.match(/<h1 class="entry-title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || episodeId);
  const seriesHref =
    html.match(/class=["']allc["'][^>]*>[\s\S]*?<a[^>]+href=["'](https:\/\/donghive\.vip\/[^"']+)["']/i)?.[1] ||
    html.match(/href=["'](https:\/\/donghive\.vip\/anime\/[^"']+)["']/i)?.[1] ||
    '';
  const seriesSlug = seriesHref ? slugFromUrl(seriesHref) : episodeId.replace(/-episode-\d+.*$/i, '');

  const rawOptions = [...html.matchAll(/<option[^>]+value=["']([A-Za-z0-9+/=]{16,})["'][^>]*>([\s\S]*?)<\/option>/gi)];
  const servers: Array<{ name: string; url: string }> = [];
  for (const m of rawOptions) {
    const label = stripTags(m[2]);
    if (!label || label.toLowerCase().includes('select video')) continue;
    try {
      const decoded = Buffer.from(m[1], 'base64').toString('utf8');
      const srcMatch = decoded.match(/src=["']([^"']+)["']/i);
      if (srcMatch?.[1]) {
        const cleanUrl = decodeHtml(srcMatch[1]).replace(/^\/\//, 'https://');
        if (!isFrameBlocked(cleanUrl)) {
          servers.push({ name: label, url: cleanUrl });
        }
      }
    } catch {
      // Ignore malformed base64 mirror
    }
  }

  // Fallback: direct iframe inside video-content if no select options exist
  if (servers.length === 0) {
    const directIframe = html.match(/<div[^>]+id="embed_holder"[\s\S]*?<iframe[^>]+src=["']([^"']+)["']/i);
    if (directIframe?.[1]) {
      const cleanUrl = decodeHtml(directIframe[1]).replace(/^\/\//, 'https://');
      if (!isFrameBlocked(cleanUrl)) {
        servers.push({ name: 'Default Player', url: cleanUrl });
      }
    }
  }

  const prevHref = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*rel="prev"/i)?.[1] ||
    html.match(/<div class="nvs"[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>[^<]*Prev/i)?.[1];
  const nextHref = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*rel="next"/i)?.[1] ||
    html.match(/<div class="nvs rght"[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1];

  const poster = decodeHtml(
    html.match(/property="og:image"\s+content=["']([^"']+)["']/i)?.[1] || ''
  );

  return {
    episode: epTitle,
    streaming: {
      main_url: servers[0] || { name: '', url: '' },
      servers,
    },
    donghua_details: {
      slug: seriesSlug,
      title: epTitle.replace(/\s*Episode\s*\d+.*$/i, '').trim(),
      poster,
    },
    navigation: {
      previous_episode: prevHref && !prevHref.includes('#') ? { slug: slugFromUrl(prevHref) } : null,
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

    const title = stripTags(li.match(/<h2 class=['"]jdlflm['"]>([\s\S]*?)<\/h2>/i)?.[1] || animeId.replace(/-/g, ' '));
    const poster = decodeHtml(li.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || '');
    const epRaw = stripTags(li.match(/<div class=['"]epz['"]>([\s\S]*?)<\/div>/i)?.[1] || '');
    const tipRaw = stripTags(li.match(/<div class=['"]epztipe['"]>([\s\S]*?)<\/div>/i)?.[1] || '');
    const dateRaw = stripTags(li.match(/<div class="newnime">([\s\S]*?)<\/div>/i)?.[1] || '');

    items.push({
      animeId,
      title,
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
    const cards = html.match(/<div class="col-anime">[\s\S]*?<div class="col-anime-trailer"/gi) || [];
    return cards
      .map((card) => {
        const href = card.match(/<div class="col-anime-title">\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
        if (!href) return null;
        const animeId = slugFromUrl(href[1]);
        const title = stripTags(href[2]);
        const poster = decodeHtml(card.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || '');
        const score = stripTags(card.match(/<div class="col-anime-rating">([\s\S]*?)<\/div>/i)?.[1] || '');
        const episodes = stripTags(card.match(/<div class="col-anime-eps">([\s\S]*?)<\/div>/i)?.[1] || '');
        return { animeId, title, poster, score, episodes };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }

  return parseOtakudesuCards(html);
}

export async function scrapeOtakudesuSearch(query: string) {
  const html = await fetchHtml(`${OTAKUDESU_BASE}/?s=${encodeURIComponent(query)}&post_type=anime`);
  if (!html) return [];

  const lis = html.match(/<li[^>]+style="list-style:none;">[\s\S]*?<\/li>/gi) || [];
  return lis
    .map((li) => {
      const linkMatch = li.match(/<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) return null;
      const animeId = slugFromUrl(linkMatch[1]);
      const title = stripTags(linkMatch[2]);
      const poster = decodeHtml(li.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || '');
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
      const anime_list = links.map((m) => ({
        slug: slugFromUrl(m[1]),
        anime_name: stripTags(m[2]),
      }));
      return { day, anime_list };
    })
    .filter((d) => d.day && d.anime_list.length > 0);
}

export async function scrapeOtakudesuDetail(rawId: string) {
  let id = rawId;
  let html = await fetchHtml(`${OTAKUDESU_BASE}/anime/${encodeURIComponent(id)}/`);

  if (!html || !html.includes('episodelist')) {
    const query = rawId.replace(/-sub-indo$/i, '').replace(/-/g, ' ').trim();
    const results = await scrapeOtakudesuSearch(query);
    if (results[0]?.animeId) {
      id = results[0].animeId;
      html = await fetchHtml(`${OTAKUDESU_BASE}/anime/${encodeURIComponent(id)}/`);
    }
  }

  if (!html || !html.includes('episodelist')) return null;

  const infoBlock = html.match(/<div class="infozingle">([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] || '';
  const getInfo = (label: string) => {
    const m = infoBlock.match(new RegExp(`<span><b>\\s*${label}\\s*<\\/b>\\s*:([\\s\\S]*?)<\\/span>`, 'i'));
    return stripTags(m?.[1] || '');
  };

  const title = getInfo('Judul') || stripTags(html.match(/<div class="jdlrx">[\s\S]*?<h1>([\s\S]*?)<\/h1>/i)?.[1] || id).replace(/\s*Subtitle Indonesia$/i, '');
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

  const poster = decodeHtml(
    html.match(/<div class="fotoanime">[\s\S]*?<img[^>]+src=["']([^"']+)["']/i)?.[1] || ''
  );

  const sinopc = html.match(/<div class="sinopc">([\s\S]*?)<\/div>/i)?.[1] || '';
  const paragraphs = [...sinopc.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean);

  // Otakudesu has 3 .episodelist blocks: [0]=Batch, [1]=Episode List, [2]=Completed/Extras. Pick the one with /episode/ links.
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

async function getOtakuAjaxConfig(html?: string): Promise<{ nonce: string; mirrorAction: string } | null> {
  const actions = html ? [...html.matchAll(/action\s*:\s*["']([a-f0-9]{16,})["']/gi)].map((m) => m[1]) : [];
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
    const rawB64 = encodedServerId.startsWith('otk:') ? encodedServerId.slice(4) : encodedServerId;
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
      const src = htmlFragment.match(/src=["']([^"']+)["']/i)?.[1] || '';
      return decodeHtml(src);
    }
  } catch {
    // Ignore
  }
  return '';
}

export async function scrapeOtakudesuEpisode(episodeId: string) {
  const html = await fetchHtml(`${OTAKUDESU_BASE}/episode/${encodeURIComponent(episodeId)}/`);
  if (!html) return null;

  const epTitle = stripTags(html.match(/<h1 class="posttl">([\s\S]*?)<\/h1>/i)?.[1] || episodeId);
  const animeHref = html.match(/href=["'](https:\/\/otakudesu\.(?:blog|best)\/anime\/[^"']+)["']/i)?.[1] || '';
  const animeId = animeHref ? slugFromUrl(animeHref) : '';

  const prevHref = html.match(/<a[^>]+href=["']([^"']+\/episode\/[^"']+)["'][^>]*>(?:Previous|Prev)/i)?.[1] || '';
  const nextHref = html.match(/<a[^>]+href=["']([^"']+\/episode\/[^"']+)["'][^>]*>(?:Next)/i)?.[1] || '';

  const mirrorBlocks = html.match(/<ul class=["']m\d+p["']>[\s\S]*?<\/ul>/gi) || [];
  const qualities: Array<{ title: string; serverList: Array<{ title: string; serverId: string }> }> = [];

  for (const blk of mirrorBlocks) {
    const qMatch = blk.match(/class=["']m(\d+p)["']/i);
    const qTitle = qMatch ? qMatch[1] : '720p';
    const links = [...blk.matchAll(/<a[^>]+data-content=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    const serverList = links.map((m) => ({
      title: stripTags(m[2]),
      serverId: `otk:${m[1]}`,
    }));
    if (serverList.length > 0) {
      qualities.push({ title: qTitle, serverList });
    }
  }

  // Fallback parse any data-content links even if ul class changed
  if (qualities.length === 0) {
    const links = [...html.matchAll(/<a[^>]+data-content=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    const serverList = links.map((m) => ({
      title: stripTags(m[2]),
      serverId: `otk:${m[1]}`,
    }));
    if (serverList.length > 0) {
      qualities.push({ title: '720p', serverList });
    }
  }

  const defaultIframe = html.match(/<div class="responsive-embed-stream">[\s\S]*?<iframe[^>]+src=["']([^"']+)["']/i)?.[1] || '';
  await getOtakuAjaxConfig(html);

  return {
    title: epTitle,
    animeId,
    defaultStreamingUrl: decodeHtml(defaultIframe),
    prevEpisode: prevHref ? { episodeId: slugFromUrl(prevHref) } : null,
    nextEpisode: nextHref ? { episodeId: slugFromUrl(nextHref) } : null,
    server: { qualities },
  };
}
