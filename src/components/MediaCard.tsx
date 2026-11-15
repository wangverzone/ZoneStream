import { useState } from 'react';
import { Film, Star } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import type { MediaCardItem } from '../types';

export function MediaCard({ item }: { item: MediaCardItem }) {
  const [imgError, setImgError] = useState(false);
  const location = useLocation();

  const epQuery = item.episodeId ? `?ep=${encodeURIComponent(item.episodeId)}` : '';
  const targetHref = `/detail/${item.type}/${encodeURIComponent(item.id)}${epQuery}`;
  const backTo = `${location.pathname}${location.search}` || '/';

  return (
    <Link
      to={targetHref}
      state={{ backTo }}
      className="group relative block rounded-xl overflow-hidden bg-slate-200 dark:bg-[#16181F] aspect-[3/4] border border-slate-200 dark:border-white/[0.05] shadow-sm dark:shadow-none transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
    >
      {!imgError && item.poster ? (
        <img
          src={item.poster}
          alt={item.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 dark:from-[#1F222C] dark:via-[#15171E] dark:to-[#0E1015] flex flex-col items-center justify-center p-3 text-center">
          <Film className="w-7 h-7 text-[#E84A18]/80 mb-2" />
          <span className="text-[11px] font-medium text-slate-700 dark:text-gray-300 line-clamp-2">
            {item.title}
          </span>
        </div>
      )}

      <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/75 via-black/30 to-transparent pointer-events-none" />

      {item.isNew && (
        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-[#E84A18] text-white text-[10px] font-bold leading-none shadow-sm">
          New
        </span>
      )}

      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-white text-[10px] font-semibold flex items-center gap-0.5 font-mono-tabular">
        <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
        <span>{item.rating || '8.0'}</span>
      </span>

      <div className="absolute inset-x-0 bottom-0 p-2.5 pt-10 bg-gradient-to-t from-black/95 via-black/70 to-transparent">
        {item.episodeLabel && (
          <p className="text-[10px] font-semibold text-[#F46B3F] mb-0.5 truncate">
            {item.episodeLabel}
          </p>
        )}
        <h3 className="text-xs font-semibold text-white line-clamp-2 leading-snug">
          {item.title}
        </h3>
      </div>
    </Link>
  );
}
