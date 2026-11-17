import { useEffect, useState } from 'react';
import { Film, Play, Star } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { resolveApiUrl } from '../utils/apiBase';
import type { MediaCardItem } from '../types';

export function extractUnderlyingImageUrl(raw?: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.includes('/api/stream/img')) {
    try {
      const u = new URL(s, 'http://localhost');
      const inner = u.searchParams.get('url');
      if (inner && /^https?:\/\//i.test(inner)) {
        return inner;
      }
    } catch {
      // Regex extraction fallback
      const m = s.match(/[?&]url=([^&]+)/);
      if (m?.[1]) {
        try {
          const dec = decodeURIComponent(m[1]);
          if (/^https?:\/\//i.test(dec)) return dec;
        } catch {
          // ignore
        }
      }
    }
  }
  return s;
}

export function resolveFallbackPosterUrl(
  poster?: string,
  retryStage = 0,
  title?: string,
  id?: string
): string {
  const raw = String(poster || '').trim();
  if (!raw) return '';

  if (retryStage === 0) {
    if (raw.startsWith('/api/stream/img') || /^https?:\/\//i.test(raw)) {
      return resolveApiUrl(raw);
    }
    const params = new URLSearchParams();
    params.set('url', raw);
    if (title) params.set('title', title);
    if (id) params.set('id', id);
    return resolveApiUrl(`/api/stream/img?${params.toString()}`);
  }

  const innerUrl = extractUnderlyingImageUrl(raw);

  // Stage 1: Retry with explicit title and id to server proxy to trigger server-side AniList artwork resolution
  if (retryStage === 1) {
    const params = new URLSearchParams();
    params.set('url', innerUrl || raw);
    params.set('retry', '1');
    if (title) params.set('title', title);
    if (id) params.set('id', id);
    return resolveApiUrl(`/api/stream/img?${params.toString()}`);
  }

  // Stage 2: Direct unblocked global CDN if available
  if (retryStage === 2 && /^https?:\/\//i.test(innerUrl)) {
    try {
      const host = new URL(innerUrl).hostname.toLowerCase();
      if (host.endsWith('anilist.co') || host.endsWith('myanimelist.net')) {
        return innerUrl;
      }
    } catch {
      // ignore
    }
  }

  return '';
}

export function MediaCard({ item }: { item: MediaCardItem }) {
  const [retryStage, setRetryStage] = useState(0);
  const location = useLocation();

  useEffect(() => {
    setRetryStage(0);
  }, [item.poster, item.id]);

  const currentSrc = resolveFallbackPosterUrl(item.poster, retryStage, item.title, item.id);
  const epQuery = item.episodeId ? `?ep=${encodeURIComponent(item.episodeId)}` : '';
  const targetHref = `/detail/${item.type}/${encodeURIComponent(item.id)}${epQuery}`;
  const backTo = `${location.pathname}${location.search}` || '/';

  return (
    <Link
      to={targetHref}
      state={{ backTo, poster: item.poster, seriesTitle: item.title }}
      className="group relative block rounded-2xl overflow-hidden bg-slate-200 dark:bg-[#161820] skeleton-shimmer aspect-[3/4] border border-slate-200/80 dark:border-white/[0.07] shadow-sm transition-transform duration-200 active:scale-[0.98] lg:hover:-translate-y-1 hover:border-[#2E90FA]/50"
    >
      {currentSrc ? (
        <img
          src={currentSrc}
          alt={item.title}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            if (retryStage < 2) setRetryStage((prev) => prev + 1);
          }}
          className="relative z-[1] w-full h-full object-cover lg:transition-transform lg:duration-500 lg:group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#1C1F2B] via-[#13151E] to-[#0B0C10] flex flex-col items-center justify-center p-3 text-center">
          <div className="w-10 h-10 rounded-xl bg-[#2E90FA]/15 border border-[#2E90FA]/30 flex items-center justify-center mb-2">
            <Film className="w-5 h-5 text-[#2E90FA]" />
          </div>
          <span className="text-[11px] font-bold text-gray-200 line-clamp-2 leading-snug">
            {item.title}
          </span>
        </div>
      )}

      {/* Subtle Top Scrim */}
      <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/75 via-black/25 to-transparent pointer-events-none z-[2]" />

      {/* Top Left "New" Sky-Blue Badge */}
      <div className="absolute top-2 left-2 z-[2]">
        <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-[#2E90FA] text-white text-[10px] sm:text-[11px] font-extrabold leading-none shadow-md shadow-[#2E90FA]/30">
          {item.isNew === false && item.episodeLabel
            ? item.episodeLabel.replace(/Episode\s*/i, 'Ep ')
            : 'New'}
        </span>
      </div>

      {/* Top Right Star Rating */}
      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-lg bg-black/65 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-extrabold flex items-center gap-0.5 font-mono-tabular z-[2]">
        <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />
        <span>{item.rating || '7.48'}</span>
      </span>

      {/* Desktop Hover Play Overlay */}
      <div className="hidden lg:flex absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-200 items-center justify-center pointer-events-none z-[2]">
        <div className="w-11 h-11 rounded-full bg-[#2E90FA] text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-200">
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </div>
      </div>

      {/* Clean Bottom Title & Episode Scrim */}
      <div className="absolute inset-x-0 bottom-0 p-2.5 pt-10 bg-gradient-to-t from-black/95 via-black/70 to-transparent z-[2]">
        {item.episodeLabel && (
          <p className="text-[10px] font-bold text-sky-300 truncate mb-0.5">
            {item.episodeLabel}
          </p>
        )}
        <h3 className="text-[11px] sm:text-xs font-bold text-white line-clamp-2 leading-snug">
          {item.title}
        </h3>
      </div>
    </Link>
  );
}
