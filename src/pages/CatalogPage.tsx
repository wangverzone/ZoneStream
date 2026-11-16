import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Filter,
  RotateCcw,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { MediaCard } from '../components/MediaCard';
import { seedCatalogIndex } from '../utils/catalogSearch';
import type { MediaCardItem } from '../types';

const TYPE_TABS = [
  { id: 'all', label: 'Semua Konten' },
  { id: 'anime', label: 'Anime' },
  { id: 'donghua', label: 'Donghua' },
  { id: 'completed', label: 'Tamat' },
  { id: 'movie', label: 'Movie' },
];

export interface GenreOption {
  id: string;
  label: string;
  subLabel: string;
  keywords: string[];
}

const GENRE_OPTIONS: GenreOption[] = [
  { id: 'action', label: 'Action', subLabel: 'Aksi & Pertarungan', keywords: ['action', 'aksi'] },
  {
    id: 'adventure',
    label: 'Adventure',
    subLabel: 'Petualangan',
    keywords: ['adventure', 'petualangan'],
  },
  { id: 'fantasy', label: 'Fantasy', subLabel: 'Dunia Fantasi', keywords: ['fantasy', 'fantasi'] },
  { id: 'isekai', label: 'Isekai', subLabel: 'Dunia Lain', keywords: ['isekai', 'reincarnation'] },
  {
    id: 'martial-arts',
    label: 'Martial Arts',
    subLabel: 'Bela Diri',
    keywords: ['martial arts', 'martial-arts', 'action'],
  },
  {
    id: 'cultivation',
    label: 'Cultivation',
    subLabel: 'Kultivasi Abadi',
    keywords: ['cultivation', 'xianxia', 'fantasy'],
  },
  { id: 'romance', label: 'Romance', subLabel: 'Romantis', keywords: ['romance', 'romantis'] },
  { id: 'comedy', label: 'Comedy', subLabel: 'Komedi', keywords: ['comedy', 'komedi'] },
  { id: 'sci-fi', label: 'Sci-Fi', subLabel: 'Fiksi Ilmiah', keywords: ['sci-fi', 'scifi'] },
  { id: 'mecha', label: 'Mecha', subLabel: 'Robot & Mecha', keywords: ['mecha', 'sci-fi'] },
  {
    id: 'slice-of-life',
    label: 'Slice of Life',
    subLabel: 'Keseharian',
    keywords: ['slice of life', 'slice-of-life'],
  },
  { id: 'school', label: 'School', subLabel: 'Sekolah', keywords: ['school', 'slice of life'] },
  {
    id: 'supernatural',
    label: 'Supernatural',
    subLabel: 'Supranatural',
    keywords: ['supernatural'],
  },
  { id: 'mystery', label: 'Mystery', subLabel: 'Misteri', keywords: ['mystery', 'misteri'] },
  {
    id: 'psychological',
    label: 'Psychological',
    subLabel: 'Psikologis',
    keywords: ['psychological'],
  },
  { id: 'thriller', label: 'Thriller', subLabel: 'Ketegangan', keywords: ['thriller', 'suspense'] },
  { id: 'magic', label: 'Magic', subLabel: 'Sihir', keywords: ['magic', 'fantasy'] },
  {
    id: 'historical',
    label: 'Historical',
    subLabel: 'Sejarah & Kerajaan',
    keywords: ['historical', 'drama'],
  },
  { id: 'drama', label: 'Drama', subLabel: 'Cerita Emosional', keywords: ['drama'] },
  { id: 'horror', label: 'Horror', subLabel: 'Horor & Gelap', keywords: ['horror', 'horor'] },
  { id: 'sports', label: 'Sports', subLabel: 'Olahraga', keywords: ['sports', 'olahraga'] },
  { id: 'music', label: 'Music', subLabel: 'Musik & Idol', keywords: ['music', 'musik'] },
];

const GENRE_MAP = new Map(GENRE_OPTIONS.map((g) => [g.id, g]));

type SortMode = 'popular' | 'rating' | 'title';

function parseGenreParam(raw: string | null): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => GENRE_MAP.has(s))
    )
  );
}

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const initialType = searchParams.get('type') || 'all';
  const initialGenres = parseGenreParam(searchParams.get('genre'));
  const initialSort = (searchParams.get('sort') as SortMode) || 'popular';

  const [query, setQuery] = useState(initialQ);
  const [type, setType] = useState(initialType);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(initialGenres);
  const [sortBy, setSortBy] = useState<SortMode>(
    initialSort === 'rating' || initialSort === 'title' ? initialSort : 'popular'
  );
  const [showGenreGrid, setShowGenreGrid] = useState(false);
  const [genreSearch, setGenreSearch] = useState('');

  const [items, setItems] = useState<MediaCardItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const genreParamKey = selectedGenres.join(',');

  useEffect(() => {
    const qParam = searchParams.get('q') || '';
    const typeParam = searchParams.get('type') || 'all';
    const genreList = parseGenreParam(searchParams.get('genre'));
    const sortParam = searchParams.get('sort') as SortMode;
    setQuery(qParam);
    setType(typeParam);
    setSelectedGenres(genreList);
    if (sortParam === 'rating' || sortParam === 'title' || sortParam === 'popular') {
      setSortBy(sortParam);
    }
  }, [searchParams]);

  const syncUrlParams = (nextState: {
    q?: string;
    type?: string;
    genres?: string[];
    sort?: SortMode;
  }) => {
    const next = new URLSearchParams(searchParams);
    const nextQ = nextState.q !== undefined ? nextState.q : query;
    const nextType = nextState.type !== undefined ? nextState.type : type;
    const nextGenres = nextState.genres !== undefined ? nextState.genres : selectedGenres;
    const nextSort = nextState.sort !== undefined ? nextState.sort : sortBy;

    if (nextQ.trim()) next.set('q', nextQ.trim());
    else next.delete('q');

    if (nextType && nextType !== 'all') next.set('type', nextType);
    else next.delete('type');

    if (nextGenres.length > 0) next.set('genre', nextGenres.join(','));
    else next.delete('genre');

    if (nextSort && nextSort !== 'popular') next.set('sort', nextSort);
    else next.delete('sort');

    setSearchParams(next, { replace: true });
  };

  // Live debounced search so typing any Anime/Donghua title updates results automatically
  useEffect(() => {
    const currentUrlQ = searchParams.get('q') || '';
    if (query.trim() === currentUrlQ.trim()) return;
    const timer = setTimeout(() => {
      syncUrlParams({ q: query });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPage(1);
    const params = new URLSearchParams();
    const activeQ = searchParams.get('q') || '';
    if (activeQ.trim()) params.set('q', activeQ.trim());
    if (type !== 'all') params.set('type', type);
    if (genreParamKey) params.set('genre', genreParamKey);
    params.set('page', '1');

    fetch(`/api/stream/catalog?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (!active) return;
        const loaded = json.items || [];
        setItems(loaded);
        setHasMore(Boolean(json.hasMore));
        if (loaded.length > 0) seedCatalogIndex(loaded);
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
  }, [type, genreParamKey, searchParams]);

  const handleLoadMore = async () => {
    if (loadingMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      const activeQ = searchParams.get('q') || '';
      if (activeQ.trim()) params.set('q', activeQ.trim());
      if (type !== 'all') params.set('type', type);
      if (genreParamKey) params.set('genre', genreParamKey);
      params.set('page', String(nextPage));

      const res = await fetch(`/api/stream/catalog?${params.toString()}`);
      const json = await res.json();
      const nextItems: MediaCardItem[] = json.items || [];
      if (nextItems.length > 0) seedCatalogIndex(nextItems);
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
    syncUrlParams({ q: query });
  };

  const handleToggleGenre = (genreId: string) => {
    const exists = selectedGenres.includes(genreId);
    const nextGenres = exists
      ? selectedGenres.filter((g) => g !== genreId)
      : [...selectedGenres, genreId];
    setSelectedGenres(nextGenres);
    syncUrlParams({ genres: nextGenres });
  };

  const handleSelectSingleGenre = (genreId: string) => {
    const nextGenres =
      selectedGenres.length === 1 && selectedGenres[0] === genreId ? [] : [genreId];
    setSelectedGenres(nextGenres);
    syncUrlParams({ genres: nextGenres });
  };

  const handleClearFilters = () => {
    setQuery('');
    setType('all');
    setSelectedGenres([]);
    setSortBy('popular');
    setSearchParams({}, { replace: true });
  };

  const filteredGenreOptions = useMemo(() => {
    const clean = genreSearch.trim().toLowerCase();
    if (!clean) return GENRE_OPTIONS;
    return GENRE_OPTIONS.filter(
      (g) =>
        g.label.toLowerCase().includes(clean) ||
        g.subLabel.toLowerCase().includes(clean) ||
        g.keywords.some((k) => k.includes(clean))
    );
  }, [genreSearch]);

  const displayedItems = useMemo(() => {
    const copy = [...items];
    if (sortBy === 'rating') {
      copy.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
    } else if (sortBy === 'title') {
      copy.sort((a, b) => a.title.localeCompare(b.title));
    }
    return copy;
  }, [items, sortBy]);

  const hasActiveFilters = Boolean(
    query.trim() || type !== 'all' || selectedGenres.length > 0 || sortBy !== 'popular'
  );

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 pt-5 pb-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
              Katalog Anime &amp; Donghua Global
            </h1>
            {!loading && displayedItems.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#E84A18]/15 text-[#E84A18] text-xs font-extrabold font-mono-tabular">
                {displayedItems.length} Judul
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

        {/* Type Filter Row + Sort & Genre Grid Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {TYPE_TABS.map((t) => {
              const active = type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setType(t.id);
                    syncUrlParams({ type: t.id });
                  }}
                  className={`min-h-[38px] px-4 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-[#E84A18] text-white shadow-sm shadow-[#E84A18]/25'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 dark:bg-[#15171F] dark:text-gray-300 dark:hover:bg-[#1E212B] dark:border-white/5'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Sort Selector */}
            <div className="relative inline-flex items-center">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#E84A18] absolute left-3 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => {
                  const nextSort = e.target.value as SortMode;
                  setSortBy(nextSort);
                  syncUrlParams({ sort: nextSort });
                }}
                aria-label="Urutkan Katalog"
                className="h-[38px] pl-8 pr-3 rounded-xl bg-white dark:bg-[#15171F] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-200 focus:outline-none focus:border-[#E84A18]"
              >
                <option value="popular">Urutkan: Terpopuler</option>
                <option value="rating">Urutkan: Rating Tertinggi</option>
                <option value="title">Urutkan: Judul A–Z</option>
              </select>
            </div>

            {/* Expand All Genres Button */}
            <button
              type="button"
              onClick={() => setShowGenreGrid((prev) => !prev)}
              className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border transition-colors ${
                showGenreGrid || selectedGenres.length > 0
                  ? 'bg-[#E84A18]/15 text-[#E84A18] border-[#E84A18]/50'
                  : 'bg-white dark:bg-[#15171F] text-slate-700 dark:text-gray-200 border-slate-200 dark:border-white/10 hover:border-[#E84A18]/40'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter Genre</span>
              {selectedGenres.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#E84A18] text-white text-[10px] font-extrabold">
                  {selectedGenres.length}
                </span>
              )}
              {showGenreGrid ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Quick Horizontal Genre Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2.5 mb-3">
          <button
            type="button"
            onClick={() => {
              setSelectedGenres([]);
              syncUrlParams({ genres: [] });
            }}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors ${
              selectedGenres.length === 0
                ? 'bg-[#E84A18] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 dark:bg-[#13151B] dark:text-[#9CA3AF] dark:hover:text-white dark:border-white/5'
            }`}
          >
            Semua Genre
          </button>

          {GENRE_OPTIONS.map((g) => {
            const active = selectedGenres.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => handleToggleGenre(g.id)}
                title={`${g.label} (${g.subLabel})`}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all inline-flex items-center gap-1.5 ${
                  active
                    ? 'bg-[#E84A18]/15 text-[#E84A18] border border-[#E84A18]/60 font-bold shadow-sm'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 dark:bg-[#13151B] dark:text-[#9CA3AF] dark:hover:text-white dark:border-white/5'
                }`}
              >
                <span>{g.label}</span>
                <span className="text-[10px] opacity-70 hidden sm:inline">· {g.subLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Expandable Full Genre Filter Drawer / Grid */}
        {showGenreGrid && (
          <div className="mb-5 rounded-2xl bg-white dark:bg-[#141720] border border-slate-200 dark:border-white/10 p-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100 dark:border-white/5">
              <div>
                <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#E84A18]" />
                  <span>Pilih Genre Anime &amp; Donghua ({GENRE_OPTIONS.length} Genre)</span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                  Klik satu atau beberapa genre sekaligus untuk menyaring konten yang kamu sukai.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-52">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={genreSearch}
                    onChange={(e) => setGenreSearch(e.target.value)}
                    placeholder="Cari nama genre..."
                    className="w-full h-9 pl-8 pr-3 rounded-xl bg-slate-50 dark:bg-[#1B1F2B] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#E84A18]"
                  />
                </div>
                {selectedGenres.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGenres([]);
                      syncUrlParams({ genres: [] });
                    }}
                    className="h-9 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 text-xs font-bold inline-flex items-center gap-1 shrink-0 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {filteredGenreOptions.map((g) => {
                const active = selectedGenres.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleToggleGenre(g.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                      active
                        ? 'bg-[#E84A18]/15 border-[#E84A18] text-slate-900 dark:text-white shadow-sm'
                        : 'bg-slate-50/80 hover:bg-slate-100 dark:bg-[#1A1D27] dark:hover:bg-[#222634] border-slate-200/80 dark:border-white/5 text-slate-700 dark:text-gray-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-extrabold truncate ${
                          active ? 'text-[#E84A18]' : ''
                        }`}
                      >
                        {g.label}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate">
                        {g.subLabel}
                      </p>
                    </div>
                    <span
                      className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                        active
                          ? 'bg-[#E84A18] text-white'
                          : 'bg-slate-200 dark:bg-white/10 text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Filter Summary Bar */}
        {hasActiveFilters && (
          <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-slate-100/90 dark:bg-[#141720] border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center flex-wrap gap-1.5 text-xs">
              <span className="font-bold text-slate-600 dark:text-gray-400 mr-1">
                Filter Aktif:
              </span>
              {type !== 'all' && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white font-bold inline-flex items-center gap-1">
                  <span>Tipe: {TYPE_TABS.find((t) => t.id === type)?.label || type}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setType('all');
                      syncUrlParams({ type: 'all' });
                    }}
                    className="hover:text-[#E84A18]"
                    aria-label="Hapus filter tipe"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedGenres.map((gid) => {
                const info = GENRE_MAP.get(gid);
                return (
                  <span
                    key={gid}
                    className="px-2.5 py-1 rounded-lg bg-[#E84A18]/15 border border-[#E84A18]/40 text-[#E84A18] font-bold inline-flex items-center gap-1"
                  >
                    <span>
                      {info ? `${info.label} (${info.subLabel})` : gid}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleGenre(gid)}
                      className="hover:text-rose-500"
                      aria-label={`Hapus genre ${gid}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
              {query.trim() && (
                <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400 font-bold inline-flex items-center gap-1">
                  <span>Kata Kunci: &ldquo;{query.trim()}&rdquo;</span>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      syncUrlParams({ q: '' });
                    }}
                    className="hover:text-rose-500"
                    aria-label="Hapus pencarian"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-extrabold text-rose-500 hover:underline inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Semua</span>
            </button>
          </div>
        )}

        {/* Catalog Grid */}
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-4">
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-xl bg-slate-200 dark:bg-[#16181F] animate-pulse"
              />
            ))}
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/5 p-8 text-center">
            <p className="text-sm font-bold text-slate-700 dark:text-gray-200 mb-1">
              Konten dengan filter tersebut belum ditemukan.
            </p>
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-4">
              Coba pilih kombinasi genre lain atau reset filter pencarian.
            </p>
            <div className="flex items-center justify-center flex-wrap gap-2">
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 rounded-xl bg-[#E84A18] text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filter Katalog</span>
              </button>
              {GENRE_OPTIONS.slice(0, 4).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleSelectSingleGenre(g.id)}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1C1F2B] text-slate-700 dark:text-gray-200 text-xs font-bold hover:border-[#E84A18] border border-transparent"
                >
                  Coba Genre {g.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-4">
              {displayedItems.map((item, idx) => (
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
