import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Clock,
  CornerDownLeft,
  Film,
  Loader2,
  Search,
  Tag,
  X,
} from 'lucide-react';
import { resolveFallbackPosterUrl } from './MediaCard';
import {
  extractMatchingGenres,
  searchCatalogLocal,
  type CatalogSearchItem,
} from '../utils/catalogSearch';

export interface PredictiveSearchDropdownProps {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  items: CatalogSearchItem[];
  activeIndex?: number;
  onHoverIndex?: (idx: number) => void;
  isLoadingRemote?: boolean;
  recentSearches?: string[];
  onSelectRecentSearch?: (term: string) => void;
  onRemoveRecentSearch?: (term: string) => void;
  onSelectItem?: (item: CatalogSearchItem) => void;
  listboxId?: string;
  dropdownClassName?: string;
}

function HighlightedTitle({ title, query }: { title: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{title}</>;

  const lowerTitle = title.toLowerCase();
  const lowerQ = q.toLowerCase();
  const idx = lowerTitle.indexOf(lowerQ);

  if (idx === -1) return <>{title}</>;

  const before = title.slice(0, idx);
  const match = title.slice(idx, idx + q.length);
  const after = title.slice(idx + q.length);

  return (
    <>
      {before}
      <mark className="bg-[#E84A18]/20 text-[#E84A18] dark:text-[#FF6B3D] rounded-[3px] px-0.5 font-extrabold">
        {match}
      </mark>
      {after}
    </>
  );
}

function ResilientSearchThumb({
  poster,
  title,
}: {
  poster?: string;
  title: string;
}) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    setStage(0);
  }, [poster, title]);

  const src = resolveFallbackPosterUrl(poster, stage, title);

  if (!src) {
    return (
      <div className="w-10 h-13 rounded-lg bg-gradient-to-br from-[#1C1F2B] to-[#101219] border border-white/10 flex items-center justify-center shrink-0">
        <Film className="w-4 h-4 text-[#E84A18]" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={title}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        if (stage < 2) setStage((s) => s + 1);
      }}
      className="w-10 h-13 rounded-lg object-cover bg-slate-200 dark:bg-[#1F222C] shrink-0"
    />
  );
}

export const PredictiveSearchDropdown: React.FC<PredictiveSearchDropdownProps> = ({
  query,
  isOpen,
  onClose,
  items,
  activeIndex = -1,
  onHoverIndex,
  isLoadingRemote = false,
  recentSearches = [],
  onSelectRecentSearch,
  onRemoveRecentSearch,
  onSelectItem,
  listboxId = 'header-search-autocomplete-listbox',
  dropdownClassName = 'left-0 right-0',
}) => {
  const optionRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const trimmed = query.trim();

  const results = useMemo(() => {
    if (!trimmed) return [];
    return searchCatalogLocal(trimmed, items, 7);
  }, [trimmed, items]);

  const popularFallback = useMemo(() => {
    if (trimmed) return [];
    return items.slice(0, 4);
  }, [trimmed, items]);

  const matchingGenres = useMemo(() => {
    if (trimmed.length < 2) return [];
    return extractMatchingGenres(trimmed, items, 4);
  }, [trimmed, items]);

  useEffect(() => {
    if (activeIndex >= 0 && optionRefs.current[activeIndex]) {
      optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  // Empty query state: show recent searches + quick catalog picks if available
  if (!trimmed) {
    if (recentSearches.length === 0 && popularFallback.length === 0) return null;
    return (
      <div
        id={listboxId}
        role="listbox"
        aria-label="Saran pencarian cepat"
        className={`absolute top-[calc(100%+8px)] z-50 rounded-2xl bg-white dark:bg-[#14161F] border border-slate-200 dark:border-white/10 p-3 shadow-2xl backdrop-blur-xl ${dropdownClassName}`}
      >
        {recentSearches.length > 0 && (
          <div className={popularFallback.length > 0 ? 'mb-3 pb-2.5 border-b border-slate-100 dark:border-white/[0.06]' : ''}>
            <div className="flex items-center justify-between px-1 mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-gray-400">
                Pencarian Terakhir
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recentSearches.map((term) => (
                <div
                  key={term}
                  className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.06] text-xs text-slate-700 dark:text-gray-200"
                >
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onSelectRecentSearch?.(term)}
                    className="pl-2.5 pr-1.5 py-1.5 inline-flex items-center gap-1.5 hover:text-[#E84A18] transition-colors font-medium"
                  >
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span className="max-w-[140px] truncate">{term}</span>
                  </button>
                  {onRemoveRecentSearch && (
                    <button
                      type="button"
                      aria-label={`Hapus riwayat ${term}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onRemoveRecentSearch(term)}
                      className="pr-2 pl-0.5 py-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {popularFallback.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-1 mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-gray-400">
                Rekomendasi Katalog
              </span>
              <Link
                to="/catalog"
                onClick={onClose}
                className="text-[11px] font-semibold text-[#E84A18] hover:underline"
              >
                Buka Katalog
              </Link>
            </div>
            <div className="space-y-1">
              {popularFallback.map((item, idx) => {
                const isSelected = idx === activeIndex;
                return (
                  <Link
                    key={`quick-${item.type}-${item.id}`}
                    ref={(el) => {
                      optionRefs.current[idx] = el;
                    }}
                    role="option"
                    aria-selected={isSelected}
                    to={`/detail/${item.type}/${encodeURIComponent(item.id)}`}
                    onMouseEnter={() => onHoverIndex?.(idx)}
                    onClick={() => {
                      onSelectItem?.(item);
                      onClose();
                    }}
                    className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${
                      isSelected
                        ? 'bg-[#E84A18]/12 ring-1 ring-[#E84A18]/40'
                        : 'hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    <ResilientSearchThumb poster={item.poster} title={item.title} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5 truncate">
                        <span className="font-semibold text-slate-700 dark:text-gray-300 capitalize">
                          {item.type}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#E84A18] font-semibold">
                          {item.episodeLabel || item.status || 'Ongoing'}
                        </span>
                        {item.rating && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-500 font-semibold font-mono-tabular">
                              ★ {item.rating}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      id={listboxId}
      role="listbox"
      aria-label="Saran judul anime dan donghua"
      className={`absolute top-[calc(100%+8px)] z-50 rounded-2xl bg-white dark:bg-[#14161F] border border-slate-200 dark:border-white/10 p-3 shadow-2xl backdrop-blur-xl ${dropdownClassName}`}
    >
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-white/[0.06] px-1">
        <span className="text-[11px] font-bold text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
          {isLoadingRemote ? (
            <Loader2 className="w-3.5 h-3.5 text-[#E84A18] animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5 text-[#E84A18]" />
          )}
          <span>Saran Judul</span>
        </span>
        <span className="text-[11px] text-slate-400 dark:text-gray-500 font-mono-tabular">
          {results.length} hasil
        </span>
      </div>

      {matchingGenres.length > 0 && (
        <div className="mb-2.5 pb-2 border-b border-slate-100 dark:border-white/[0.06] flex items-center gap-1.5 flex-wrap px-1">
          <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 mr-0.5">
            <Tag className="w-3 h-3 text-[#E84A18]" />
            Genre:
          </span>
          {matchingGenres.map((g) => (
            <Link
              key={g}
              to={`/catalog?genre=${encodeURIComponent(g)}`}
              onClick={onClose}
              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-[#E84A18] text-slate-700 hover:text-white dark:bg-white/[0.06] dark:text-gray-200 dark:hover:bg-[#E84A18] text-[11px] font-semibold transition-colors"
            >
              {g}
            </Link>
          ))}
        </div>
      )}

      {results.length > 0 ? (
        <div className="space-y-1 max-h-[50dvh] sm:max-h-80 overflow-y-auto overscroll-contain pr-0.5">
          {results.map((item, idx) => {
            const isSelected = idx === activeIndex;
            const epQuery = item.episodeId ? `?ep=${encodeURIComponent(item.episodeId)}` : '';
            return (
              <Link
                key={`predictive-${item.type}-${item.id}`}
                ref={(el) => {
                  optionRefs.current[idx] = el;
                }}
                id={`${listboxId}-option-${idx}`}
                role="option"
                aria-selected={isSelected}
                to={`/detail/${item.type}/${encodeURIComponent(item.id)}${epQuery}`}
                onMouseEnter={() => onHoverIndex?.(idx)}
                onClick={() => {
                  onSelectItem?.(item);
                  onClose();
                }}
                className={`flex items-center gap-3 p-2 min-h-[48px] rounded-xl transition-colors group ${
                  isSelected
                    ? 'bg-[#E84A18]/12 ring-1 ring-[#E84A18]/45'
                    : 'hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                }`}
              >
                <ResilientSearchThumb poster={item.poster} title={item.title} />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-xs font-bold truncate transition-colors ${
                      isSelected
                        ? 'text-[#E84A18]'
                        : 'text-slate-900 dark:text-white group-hover:text-[#E84A18]'
                    }`}
                  >
                    <HighlightedTitle title={item.title} query={trimmed} />
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5 truncate">
                    <span className="font-semibold text-slate-700 dark:text-gray-300 capitalize">
                      {item.type}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#E84A18] font-semibold truncate">
                      {item.episodeLabel || item.status || 'Ongoing'}
                    </span>
                    {item.rating && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-500 font-semibold font-mono-tabular shrink-0">
                          ★ {item.rating}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                {isSelected ? (
                  <CornerDownLeft className="w-3.5 h-3.5 text-[#E84A18] shrink-0" />
                ) : (
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="py-5 px-3 text-center">
          {isLoadingRemote ? (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 text-[#E84A18] animate-spin" />
              <span>Mencari "{trimmed}" di katalog...</span>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Belum ada kecocokan langsung untuk <span className="font-semibold text-slate-800 dark:text-gray-200">"{trimmed}"</span>.
            </p>
          )}
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-2 px-1">
        <span className="hidden sm:inline text-[10px] text-slate-400 dark:text-gray-500">
          ↑↓ pilih · Enter buka
        </span>
        <Link
          to={`/catalog?q=${encodeURIComponent(trimmed)}`}
          onClick={onClose}
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-[#E84A18] hover:underline"
        >
          <span>Lihat semua hasil "{trimmed}"</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
