import { useEffect, useState } from 'react';
import { Film, Play, Star } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import type { MediaCardItem } from '../types';

export function resolveFallbackPosterUrl(poster?: string, retryStage = 0): string {
  const raw = String(poster || '').trim();
  if (!raw) return '';
  if (retryStage === 0) return raw;

  // Stage 1: If proxied via /api/stream/img?url=..., try direct original URL with no-referrer
  // If raw was already a direct https:// URL, try proxying via /api/stream/img?url=...
  if (retryStage === 1) {
    if (raw.startsWith('/api/stream/img')) {
      try {
        const u = new URL(raw, 'http://localhost');
        const inner = u.searchParams.get('url');
        if (inner) return inner;
      } catch {
        // Ignore
      }
    } else if (/^https?:\/\//i.test(raw)) {
      return `/api/stream/img?url=${encodeURIComponent(raw)}`;
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

  const currentSrc = resolveFallbackPosterUrl(item.poster, retryStage);
  const epQuery = item.episodeId ? `?ep=${encodeURIComponent(item.episodeId)}` : '';
  const targetHref = `/detail/${item.type}/${encodeURIComponent(item.id)}${epQuery}`;
  const backTo = `${location.pathname}${location.search}` || '/';

  return (
    <Link
      to={targetHref}
      state={{ backTo, poster: item.poster, seriesTitle: item.title }}
      className="group relative block rounded-xl overflow-hidden bg-slate-200 dark:bg-[#14161D] skeleton-shimmer aspect-[3/4] border border-slate-200/80 dark:border-white/[0.07] shadow-sm transition-colors duration-200 lg:hover:-translate-y-1 hover:border-[#E84A18]/50 hover:shadow-[0_12px_28px_-8px_rgba(232,74,24,0.28)]"
    >
      {currentSrc ? (
        <img
          src={currentSrc}
          alt={item.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setRetryStage((prev) => prev + 1)}
          className="relative z-[1] w-full h-full object-cover lg:transition-transform lg:duration-500 lg:group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#1C1F2B] via-[#13151E] to-[#0B0C10] flex flex-col items-center justify-center p-3 text-center">
          <div className="w-10 h-10 rounded-xl bg-[#E84A18]/15 border border-[#E84A18]/30 flex items-center justify-center mb-2">
            <Film className="w-5 h-5 text-[#F46B3F]" />
          </div>
          <span className="text-[11px] font-bold text-gray-200 line-clamp-2 leading-snug">
            {item.title}
          </span>
          <span className="mt-1 text-[9px] uppercase tracking-wider text-[#F46B3F] font-semibold">
            {item.type === 'donghua' ? 'Donghua' : 'Anime'}
          </span>
        </div>
      )}

      {/* Top Scrim */}
      <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none z-[2]" />

      {/* Top Left Type / New Indicator */}
      <div className="absolute top-2 left-2 flex items-center gap-1 z-[2]">
        {item.isNew ? (
          <span className="px-1.5 py-0.5 rounded bg-[#E84A18] text-white text-[9px] font-extrabold uppercase tracking-wider leading-none shadow-sm">
            UP
          </span>
        ) : null}
        <span className="px-1.5 py-0.5 rounded bg-black/65 backdrop-blur-md border border-white/10 text-gray-200 text-[9px] font-bold uppercase tracking-wider leading-none">
          {item.type === 'donghua' ? 'Donghua' : 'Anime'}
        </span>
      </div>

      {/* Top Right Score */}
      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold flex items-center gap-0.5 font-mono-tabular z-[2]">
        <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
        <span>{item.rating || '8.2'}</span>
      </span>

      {/* Hover Play Button Overlay (Bstation / Crunchyroll style) */}
      <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none z-[2]">
        <div className="w-11 h-11 rounded-full bg-[#E84A18] text-white flex items-center justify-center shadow-lg shadow-[#E84A18]/40 transform scale-90 group-hover:scale-100 transition-transform duration-200">
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </div>
      </div>

      {/* Bottom Title, Episode & Genre Bar */}
      <div className="absolute inset-x-0 bottom-0 p-2.5 pt-12 bg-gradient-to-t from-[#090A0F] via-[#090A0F]/85 to-transparent z-[2]">
        <div className="flex items-center flex-wrap gap-1 mb-1">
          {item.episodeLabel && (
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#E84A18]/20 border border-[#E84A18]/35 text-[#FF7A4D] text-[10px] font-bold max-w-full truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35] shrink-0" />
              <span className="truncate">{item.episodeLabel}</span>
            </div>
          )}
          {Array.isArray(item.genres) && item.genres.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-white/10 backdrop-blur-sm border border-white/10 text-gray-200 text-[9px] font-semibold truncate max-w-[110px]">
              {item.genres.slice(0, 2).join(' · ')}
            </span>
          )}
        </div>
        <h3 className="text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-[#FF8559] transition-colors">
          {item.title}
        </h3>
      </div>
    </Link>
  );
}
