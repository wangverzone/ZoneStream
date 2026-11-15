import React, { useEffect, useState } from 'react';
import { ChevronDown, Search, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { MediaCard } from '../components/MediaCard';
import type { MediaCardItem } from '../types';

const TYPE_TABS = [
  { id: 'all', label: 'Semua' },
  { id: 'donghua', label: 'Donghua' },
  { id: 'anime', label: 'Anime' },
  { id: 'completed', label: 'Tamat' },
  { id: 'movie', label: 'Movie' },
];

const GENRE_CHIPS = [
  'action',
  'adventure',
  'fantasy',
  'martial-arts',
  'comedy',
  'romance',
  'sci-fi',
  'drama',
  'supernatural',
  'isekai',
  'mystery',
  'magic',
  'historical',
  'school',
  'horror',
  'sports',
];

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const initialType = searchParams.get('type') || 'all';
  const initialGenre = searchParams.get('genre') || '';

  const [query, setQuery] = useState(initialQ);
  const [type, setType] = useState(initialType);
  const [genre, setGenre] = useState(initialGenre);
  const [items, setItems] = useState<MediaCardItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const qParam = searchParams.get('q') || '';
    const typeParam = searchParams.get('type') || 'all';
    const genreParam = searchParams.get('genre') || '';
    setQuery(qParam);
    setType(typeParam);
    setGenre(genreParam);
  }, [searchParams]);

  // Live debounced search so typing "one pice" or any Anime/Donghua title updates results automatically
  useEffect(() => {
    const currentUrlQ = searchParams.get('q') || '';
    if (query.trim() === currentUrlQ.trim()) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (query.trim()) next.set('q', query.trim());
      else next.delete('q');
      setSearchParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchParams, setSearchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPage(1);
    const params = new URLSearchParams();
    const activeQ = searchParams.get('q') || '';
    if (activeQ.trim()) params.set('q', activeQ.trim());
    if (type !== 'all') params.set('type', type);
    if (genre) params.set('genre', genre);
    params.set('page', '1');

    fetch(`/api/stream/catalog?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (!active) return;
        setItems(json.items || []);
        setHasMore(Boolean(json.hasMore));
      })
      .catch(() => {
        if (active) {
          setItems([]);
          setHasMore(false);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [type, genre, searchParams]);

  const handleLoadMore = async () => {
    if (loadingMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      const activeQ = searchParams.get('q') || '';
      if (activeQ.trim()) params.set('q', activeQ.trim());
      if (type !== 'all') params.set('type', type);
      if (genre) params.set('genre', genre);
      params.set('page', String(nextPage));

      const res = await fetch(`/api/stream/catalog?${params.toString()}`);
      const json = await res.json();
      const nextItems: MediaCardItem[] = json.items || [];
      setItems((prev) => {
        const seen = new Set(prev.map((x) => `${x.type}:${x.id}`));
        const merged = [...prev];
        for (const item of nextItems) {
          const k = `${item.type}:${item.id}`;
          if (!seen.has(k)) {
            seen.add(k);
            merged.push(item);
          }
        }
        return merged;
      });
      setPage(nextPage);
      setHasMore(Boolean(json.hasMore) && nextItems.length > 0);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (query.trim()) next.set('q', query.trim());
    else next.delete('q');
    setSearchParams(next);
  };

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 pt-5 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Katalog Anime &amp; Donghua Global
            </h1>
            {!loading && items.length > 0 && (
              <span className="text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] font-mono-tabular">
                {items.length} Judul
              </span>
            )}
          </div>
          <Link
            to="/community"
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#15171F] hover:border-[#E84A18] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-200 inline-flex items-center gap-1.5 transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-[#E84A18]" />
            <span>Cari User &amp; Teman</span>
          </Link>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 dark:text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari semua Anime & Donghua dunia (contoh: One Piece, Naruto, BTTH, JJK)..."
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-white dark:bg-[#15171F] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#E84A18]"
            />
          </div>
          <button
            type="submit"
            className="px-5 h-11 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold transition-colors"
          >
            Cari
          </button>
        </form>

        {/* Type Filter */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mb-3">
          {TYPE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setType(t.id);
                setGenre('');
              }}
              className={`min-h-[38px] px-4 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                type === t.id && !genre
                  ? 'bg-[#E84A18] text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 dark:bg-[#15171F] dark:text-gray-300 dark:hover:bg-[#1E212B] dark:border-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Genre Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-5">
          {GENRE_CHIPS.map((g) => {
            const active = genre === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setGenre(active ? '' : g)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-[#E84A18]/15 text-[#E84A18] border border-[#E84A18]/50'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 dark:bg-[#13151B] dark:text-[#9CA3AF] dark:hover:text-white dark:border-white/5'
                }`}
              >
                {g.replace('-', ' ')}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-4">
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-xl bg-slate-200 dark:bg-[#16181F] animate-pulse"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/5 p-8 text-center">
            <p className="text-sm text-slate-500 dark:text-gray-400">
              Judul tidak ditemukan. Coba kata kunci atau filter lain.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-4">
              {items.map((item, idx) => (
                <MediaCard key={`${item.type}-${item.id}-${idx}`} item={item} />
              ))}
            </div>

            {hasMore && (
              <div className="mt-7 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={handleLoadMore}
                  className="min-h-[44px] px-6 rounded-xl bg-white hover:bg-slate-100 dark:bg-[#15171F] dark:hover:bg-[#1E212C] border border-slate-200 dark:border-white/10 text-xs sm:text-sm font-bold text-slate-800 dark:text-white inline-flex items-center gap-2 transition-colors shadow-sm dark:shadow-none disabled:opacity-60"
                >
                  <ChevronDown className="w-4 h-4 text-[#E84A18]" />
                  <span>{loadingMore ? 'Memuat Judul Lainnya...' : 'Muat Lebih Banyak'}</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
