import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Flame,
  Info,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AdsterraBanner728x90 } from '../components/AdsterraAds';
import { AvatarDecoration } from '../components/AvatarDecoration';
import { MediaCard, resolveFallbackPosterUrl } from '../components/MediaCard';
import { TelegramCsButton } from '../components/TelegramCsButton';
import { ThemeToggle } from '../components/ThemeToggle';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { StatusEmojiBadge } from '../components/VipEmojis';
import { CountryFlagBadge } from '../components/CountryFlag';
import { useAuth } from '../context/AuthContext';
import { PredictiveSearchDropdown } from '../components/PredictiveSearchDropdown';
import type {
  HeroSlide,
  MediaCardItem,
  ScheduleDay,
  WatchHistoryItem,
} from '../types';
import heroFallbackImg from '../assets/images/donghua_hero_fallback_1794755348232.jpg';

const GENRE_FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: 'donghua', label: 'Donghua' },
  { id: 'anime', label: 'Anime' },
  { id: 'movie', label: 'Movie' },
  { id: 'action', label: 'Action' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'romance', label: 'Romance' },
];

function getTodayIndonesianDay(): string {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return days[new Date().getDay()] || 'Senin';
}

function normalizeLookupKey(raw?: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/\b(season|part|cour|episode|ep|sub|indo|subtitle|indonesia)\b/gi, '')
    .replace(/[^a-z0-9]/g, '');
}

function ResilientPosterImage({
  src,
  alt,
  className,
  fallbackSrc = heroFallbackImg,
}: {
  src?: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
}) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    setStage(0);
  }, [src]);

  const resolved = resolveFallbackPosterUrl(src, stage) || fallbackSrc;

  return (
    <img
      src={resolved}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        if (stage < 3) setStage((prev) => prev + 1);
      }}
      className={className}
    />
  );
}

export function HomePage() {
  const { user, isPremium, getLocalHistory, getLocalBookmarks, toggleBookmark } = useAuth();
  const navigate = useNavigate();

  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [latestEpisodes, setLatestEpisodes] = useState<MediaCardItem[]>([]);
  const [donghuaList, setDonghuaList] = useState<MediaCardItem[]>([]);
  const [animeList, setAnimeList] = useState<MediaCardItem[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<MediaCardItem[]>([]);
  const [filteredEpisodes, setFilteredEpisodes] = useState<MediaCardItem[] | null>(null);
  const [activeGenre, setActiveGenre] = useState<string>('all');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [genreLoading, setGenreLoading] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [seenNotifIds, setSeenNotifIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('zonestream_seen_stream_notifs_v3');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [showQuickSearch, setShowQuickSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [syncingFeed, setSyncingFeed] = useState(false);

  const history = getLocalHistory();
  const bookmarks = getLocalBookmarks();

  const loadHome = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setSyncingFeed(true);
    try {
      const homeUrl = forceRefresh ? '/api/stream/home?refresh=1' : '/api/stream/home';
      const [homeRes, schedRes] = await Promise.allSettled([
        fetch(homeUrl).then((r) => r.json()),
        fetch('/api/stream/schedule').then((r) => r.json()),
      ]);

      if (homeRes.status === 'fulfilled' && homeRes.value?.ok) {
        setHeroSlides(homeRes.value.heroSlides || []);
        setLatestEpisodes(homeRes.value.latestEpisodes || []);
        setDonghuaList(homeRes.value.donghuaList || []);
        setAnimeList(homeRes.value.animeList || []);
        if (homeRes.value.lastUpdated) {
          setLastUpdated(homeRes.value.lastUpdated);
        }
      }

      if (schedRes.status === 'fulfilled' && schedRes.value?.ok) {
        const days: ScheduleDay[] = schedRes.value.schedule || [];
        const todayName = getTodayIndonesianDay();
        const matched =
          days.find((d) => d.day.toLowerCase() === todayName.toLowerCase()) || days[0];
        if (matched?.items) {
          setTodaySchedule(matched.items.slice(0, 10));
        }
      }
    } catch (err) {
      console.error('Failed loading home stream:', err);
    } finally {
      setLoading(false);
      setSyncingFeed(false);
    }
  }, []);

  useEffect(() => {
    loadHome(false);
    const autoRefresh = setInterval(() => loadHome(true), 60 * 1000);
    return () => {
      clearInterval(autoRefresh);
    };
  }, [loadHome]);

  const streamNotifItems = useMemo(() => {
    return latestEpisodes.slice(0, 12).map((ep) => ({
      ...ep,
      notifKey: `${ep.type}:${ep.id}:${ep.episodeId || ep.episodeLabel || 'latest'}`,
    }));
  }, [latestEpisodes]);

  // Initialize seen notifications so only the newest releases show as unread initially, and update dynamically on new stream updates
  useEffect(() => {
    if (streamNotifItems.length === 0) return;
    try {
      const initialized = localStorage.getItem('zonestream_seen_stream_init_v3');
      if (!initialized) {
        const olderKeys = streamNotifItems.slice(2).map((x) => x.notifKey);
        localStorage.setItem('zonestream_seen_stream_init_v3', '1');
        localStorage.setItem('zonestream_seen_stream_notifs_v3', JSON.stringify(olderKeys));
        setSeenNotifIds(olderKeys);
      }
    } catch {
      // ignore storage quota errors
    }
  }, [streamNotifItems]);

  const unreadNotifCount = useMemo(() => {
    const seenSet = new Set(seenNotifIds);
    return streamNotifItems.filter((item) => !seenSet.has(item.notifKey)).length;
  }, [streamNotifItems, seenNotifIds]);

  const markNotificationsAsRead = useCallback(
    (keysToMark?: string[]) => {
      const targetKeys = keysToMark || streamNotifItems.map((x) => x.notifKey);
      setSeenNotifIds((prev) => {
        const merged = Array.from(new Set([...prev, ...targetKeys])).slice(-200);
        try {
          localStorage.setItem('zonestream_seen_stream_notifs_v3', JSON.stringify(merged));
        } catch {
          // ignore
        }
        return merged;
      });
    },
    [streamNotifItems]
  );

  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6800);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  // Build a fast poster lookup index from all loaded feeds so history items with missing posters get their real poster
  const posterLookupMap = useMemo(() => {
    const map = new Map<string, string>();
    const allSources = [
      ...heroSlides,
      ...latestEpisodes,
      ...donghuaList,
      ...animeList,
      ...todaySchedule,
    ];
    for (const item of allSources) {
      if (!item?.poster) continue;
      if (item.id) map.set(item.id.toLowerCase(), item.poster);
      const normId = normalizeLookupKey(item.id);
      if (normId.length >= 3) map.set(normId, item.poster);
      const normTitle = normalizeLookupKey(item.title);
      if (normTitle.length >= 3) map.set(normTitle, item.poster);
    }
    return map;
  }, [heroSlides, latestEpisodes, donghuaList, animeList, todaySchedule]);

  const resolveHistoryItemPoster = useCallback(
    (item: WatchHistoryItem): string => {
      if (item.poster && !item.poster.includes('donghua_hero_fallback')) {
        return item.poster;
      }
      const byId = posterLookupMap.get(String(item.id || '').toLowerCase());
      if (byId) return byId;
      const byNormId = posterLookupMap.get(normalizeLookupKey(item.id));
      if (byNormId) return byNormId;
      const byNormTitle = posterLookupMap.get(normalizeLookupKey(item.title));
      if (byNormTitle) return byNormTitle;
      return item.poster || heroFallbackImg;
    },
    [posterLookupMap]
  );

  const handleGenreSelect = async (genreId: string) => {
    setActiveGenre(genreId);
    if (genreId === 'all') {
      setFilteredEpisodes(null);
      return;
    }

    setGenreLoading(true);
    try {
      const res = await fetch(`/api/stream/catalog?genre=${encodeURIComponent(genreId)}`);
      const json = await res.json();
      if (json.ok && Array.isArray(json.items)) {
        setFilteredEpisodes(json.items);
      }
    } catch {
      setFilteredEpisodes(
        latestEpisodes.filter((x) =>
          genreId === 'donghua' || genreId === 'anime' ? x.type === genreId : true
        )
      );
    } finally {
      setGenreLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/catalog?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleRandomGacha = () => {
    const allPool = [...latestEpisodes, ...donghuaList, ...animeList];
    if (allPool.length === 0) return;
    const randomItem = allPool[Math.floor(Math.random() * allPool.length)];
    if (randomItem?.id) {
      navigate(`/detail/${randomItem.type}/${encodeURIComponent(randomItem.id)}`);
    }
  };

  const activeHero = heroSlides[currentSlide];
  const isHeroBookmarked = activeHero
    ? bookmarks.some((b) => b.id === activeHero.id && b.type === activeHero.type)
    : false;
  const displayedEpisodes = filteredEpisodes ?? latestEpisodes;
  const trendingTop = latestEpisodes.slice(0, 10);
  const hasVipBadge = Boolean(user && (user.isVerified || isPremium || user.role === 'founder'));

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 pt-3 sm:pt-5">
        {/* Top Greeting Header + Inline Search */}
        <header className="flex items-center justify-between gap-2 sm:gap-3 mb-4">
          <Link to="/profile" className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 group">
            <AvatarDecoration
              src={user?.photoUrl || '/assets/aistudio/sara_seo_pfp_6f6b2a74.jfif'}
              alt={user?.name || 'ZoneStream'}
              decorationId={user?.activeBorder}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-[#9CA3AF] leading-tight truncate">
                {user ? 'Selamat datang kembali,' : 'Selamat datang,'}
              </p>
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <h1 className="text-[13px] sm:text-base font-extrabold text-slate-900 dark:text-white truncate max-w-[135px] xs:max-w-[175px] sm:max-w-none">
                  {user?.name || 'Masuk Akun'}
                </h1>
                {hasVipBadge && (
                  <VerifiedBadge
                    size="sm"
                    isFounder={user?.role === 'founder'}
                    badgeLabel={user?.activeBadge}
                  />
                )}
                {user && <CountryFlagBadge countryCode={user.countryCode} size="xs" />}
                {hasVipBadge && user?.statusEmoji && (
                  <StatusEmojiBadge statusEmoji={user.statusEmoji} size="xs" />
                )}
                {hasVipBadge && (
                  <span
                    className={`hidden sm:inline-block px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                      user?.role === 'founder'
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                        : 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30'
                    }`}
                  >
                    {user?.role === 'founder' ? 'FOUNDER' : 'VIP'}
                  </span>
                )}
              </div>
            </div>
          </Link>

          {/* Desktop/Tablet Inline Search (Anime & Donghua) + Dedicated Cari User & Gacha button */}
          <div className="hidden md:flex flex-1 max-w-xl mx-4 items-center gap-2">
            <form onSubmit={handleSearchSubmit} className="flex-1 relative">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 dark:text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  placeholder="Cari Donghua, Anime, Movie..."
                  className="w-full h-10 pl-10 pr-4 rounded-xl bg-white dark:bg-[#13151D] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#E84A18]"
                />
                <PredictiveSearchDropdown
                  query={searchQuery}
                  isOpen={isSearchFocused}
                  onClose={() => setIsSearchFocused(false)}
                  items={[...latestEpisodes, ...donghuaList, ...animeList]}
                />
              </div>
            </form>
            <Link
              to="/community"
              className="h-10 px-3 rounded-xl bg-white dark:bg-[#13151D] hover:border-[#E84A18] border border-slate-200 dark:border-white/[0.08] text-xs font-bold text-slate-700 dark:text-gray-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              title="Pencarian User & Komunitas"
            >
              <Users className="w-3.5 h-3.5 text-[#E84A18]" />
              <span>Cari User</span>
            </Link>
            <button
              type="button"
              onClick={handleRandomGacha}
              className="h-10 px-3 rounded-xl bg-white dark:bg-[#13151D] hover:border-[#E84A18] border border-slate-200 dark:border-white/[0.08] text-xs font-bold text-slate-700 dark:text-gray-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              title="Rekomendasi Gacha Acak Anime/Donghua"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#E84A18]" />
              <span>Gacha Acak</span>
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 relative shrink-0">
            <div className="lg:hidden flex items-center gap-1 sm:gap-1.5">
              <TelegramCsButton />
              <ThemeToggle compact />
            </div>

            {!isPremium && (
              <Link
                to="/profile"
                className="hidden sm:inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-gradient-to-r from-[#E84A18]/15 to-amber-500/15 border border-[#E84A18]/35 text-amber-700 dark:text-amber-300 text-xs font-bold hover:border-[#E84A18] transition-colors whitespace-nowrap shrink-0"
              >
                <Crown className="w-3.5 h-3.5 text-[#E84A18]" />
                <span>VIP</span>
              </Link>
            )}

            <button
              type="button"
              onClick={() => {
                const nextOpen = !showNotif;
                setShowNotif(nextOpen);
                if (nextOpen && unreadNotifCount > 0) {
                  markNotificationsAsRead();
                }
              }}
              aria-label="Notifikasi rilis baru"
              className="relative h-9 w-9 sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center rounded-xl bg-white dark:bg-[#14161E] border border-slate-200 dark:border-white/[0.08] hover:border-[#E84A18]/50 transition-colors text-[#E84A18]"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5 fill-[#E84A18]/20" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#E84A18] text-white text-[10px] font-bold flex items-center justify-center font-mono-tabular shadow animate-pulse">
                  {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowQuickSearch((s) => !s)}
              aria-label="Cari Anime atau Donghua"
              className="md:hidden h-9 w-9 sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center rounded-xl bg-white dark:bg-[#14161E] border border-slate-200 dark:border-white/[0.08] hover:border-[#E84A18]/50 transition-colors text-[#E84A18]"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Live Streaming Notifications Dropdown */}
            {showNotif && (
              <div className="absolute right-0 top-12 z-50 w-76 sm:w-84 rounded-2xl bg-white dark:bg-[#14161F] border border-slate-200 dark:border-white/10 p-3 shadow-2xl">
                <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-white/5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                        Rilis Terbaru Hari Ini (Live Stream)
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">
                      Update otomatis setiap ada episode baru rilis
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => loadHome(true)}
                      disabled={syncingFeed}
                      title="Sinkronkan rilis terbaru sekarang"
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-[#E84A18] transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncingFeed ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNotif(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                  {streamNotifItems.map((ep, idx) => (
                    <Link
                      key={`notif-${ep.type}-${ep.id}-${idx}`}
                      to={`/detail/${ep.type}/${encodeURIComponent(ep.id)}${
                        ep.episodeId ? `?ep=${encodeURIComponent(ep.episodeId)}` : ''
                      }`}
                      state={{ backTo: '/', poster: ep.poster, seriesTitle: ep.title }}
                      onClick={() => {
                        markNotificationsAsRead([ep.notifKey]);
                        setShowNotif(false);
                      }}
                      className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <ResilientPosterImage
                        src={ep.poster}
                        alt={ep.title}
                        className="w-10 h-12 rounded-lg object-cover shrink-0 bg-slate-200 dark:bg-[#1F222C]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {ep.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-[#E84A18] font-bold">
                            {ep.episodeLabel} · {ep.type === 'donghua' ? 'Donghua' : 'Anime'}
                          </span>
                          {idx < 3 && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 text-[9px] font-extrabold uppercase">
                              LIVE
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Mobile Quick Search Bar */}
        {showQuickSearch && (
          <form onSubmit={handleSearchSubmit} className="md:hidden mb-4 relative">
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  placeholder="Cari Donghua atau Anime..."
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-white dark:bg-[#14161E] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#E84A18]"
                />
                <PredictiveSearchDropdown
                  query={searchQuery}
                  isOpen={isSearchFocused}
                  onClose={() => setIsSearchFocused(false)}
                  items={[...latestEpisodes, ...donghuaList, ...animeList]}
                />
              </div>
              <button
                type="submit"
                className="px-4 h-11 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold whitespace-nowrap transition-colors"
              >
                Cari
              </button>
            </div>
          </form>
        )}

        {/* Flagship Bstation / Crunchyroll Cinematic Hero Showcase */}
        <section aria-label="Unggulan" className="relative">
          {loading || !activeHero ? (
            <div className="w-full h-[370px] sm:h-[430px] lg:h-[490px] rounded-3xl bg-slate-200 dark:bg-[#15171F] animate-pulse" />
          ) : (
            <div className="relative w-full h-[370px] sm:h-[430px] lg:h-[490px] rounded-3xl overflow-hidden bg-[#0B0D14] border border-slate-200 dark:border-white/[0.1] shadow-[0_24px_60px_rgba(0,0,0,0.55)] group">
              {/* Layer 1: Full-Bleed Atmospheric Cinema Backdrop (Sharp HD on mobile, ambient cinema backdrop on desktop) */}
              <ResilientPosterImage
                src={activeHero.backdrop || activeHero.poster}
                alt={activeHero.title}
                className={`w-full h-full object-cover object-center contrast-[1.06] saturate-[1.08] transition-transform duration-700 group-hover:scale-[1.03] ${
                  activeHero.hasWideBanner
                    ? 'opacity-95'
                    : 'opacity-90 sm:scale-105 sm:blur-sm sm:opacity-75'
                }`}
              />

              {/* Layer 2: Ambient Cinema Spotlight Glow on Left + Multi-Stop Scrims */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_35%,rgba(232,74,24,0.22),transparent_55%)] z-[1] pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#090A0E] via-[#090A0E]/50 to-black/15 z-[2] pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#090A0E]/90 via-[#090A0E]/55 sm:via-[#090A0E]/45 to-transparent z-[2] pointer-events-none" />

              {/* Layer 3: Sharp Framed 3D Key-Art Poster Card */}
              <div className="hidden sm:block absolute right-6 lg:right-[268px] top-7 bottom-9 aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.85)] ring-1 ring-white/25 z-[3] pointer-events-none bg-[#141722]">
                <ResilientPosterImage
                  src={activeHero.poster || activeHero.backdrop}
                  alt={activeHero.title}
                  className="w-full h-full object-cover contrast-[1.05] saturate-[1.08]"
                />
              </div>

              {/* Top Editorial Status Bar */}
              <div className="absolute top-4 left-4 sm:top-6 sm:left-8 flex items-center flex-wrap gap-2.5 z-10">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E84A18] text-white text-[11px] font-bold shadow-lg shadow-[#E84A18]/35 whitespace-nowrap">
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  <span>Unggulan #{currentSlide + 1}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/55 backdrop-blur-md border border-white/10 text-[11px] font-bold tracking-wide text-emerald-400 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{activeHero.status || 'ONGOING'}</span>
                </span>
                {activeHero.episodeLabel && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-bold text-amber-300">
                    {activeHero.episodeLabel}
                  </span>
                )}
              </div>

              {/* Right Thumbnail Switcher Rail (Desktop lg:) */}
              {heroSlides.length > 1 && (
                <div className="hidden lg:flex flex-col gap-2 absolute right-5 top-1/2 -translate-y-1/2 z-10">
                  {heroSlides.slice(0, 5).map((slide, idx) => {
                    const active = idx === currentSlide;
                    return (
                      <button
                        key={`thumb-${slide.id}-${idx}`}
                        type="button"
                        onClick={() => setCurrentSlide(idx)}
                        className={`flex items-center gap-2.5 p-1.5 rounded-xl backdrop-blur-md border transition-all text-left w-56 ${
                          active
                            ? 'bg-[#E84A18]/25 border-[#E84A18] shadow-lg'
                            : 'bg-black/60 border-white/10 hover:bg-black/80'
                        }`}
                      >
                        <ResilientPosterImage
                          src={slide.poster}
                          alt={slide.title}
                          className="w-9 h-12 rounded-lg object-cover shrink-0 bg-[#1A1C24]"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-white line-clamp-1">
                            {slide.title}
                          </p>
                          <p className="text-[10px] text-amber-400 font-mono-tabular flex items-center gap-1 mt-0.5">
                            <Star className="w-2.5 h-2.5 fill-current shrink-0" />
                            <span>{slide.rating}</span>
                            <span className="text-gray-400">·</span>
                            <span className="text-gray-300 capitalize">
                              {slide.episodeLabel || slide.type}
                            </span>
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Bottom Hero Typography & Single-Line Action Bar */}
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-7 lg:p-9 max-w-xl lg:max-w-2xl z-10">
                <h2 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight line-clamp-2 mb-1.5 drop-shadow">
                  {activeHero.title}
                </h2>

                <p className="text-xs sm:text-sm text-gray-200 flex items-center flex-wrap gap-x-2 gap-y-1 mb-2.5">
                  <span className="inline-flex items-center gap-1 font-bold text-amber-400 font-mono-tabular">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {activeHero.rating || '8.50'}
                  </span>
                  <span className="text-gray-500">·</span>
                  <span className="font-semibold text-white uppercase text-xs tracking-wider">
                    {activeHero.type === 'donghua' ? 'Donghua' : 'Anime'}
                  </span>
                  {activeHero.genres
                    ?.filter(Boolean)
                    .slice(0, 3)
                    .map((g, idx) => (
                      <span
                        key={`${g}-${idx}`}
                        className="inline-flex items-center gap-2 text-gray-300"
                      >
                        <span className="text-gray-500">·</span>
                        <span>{g}</span>
                      </span>
                    ))}
                </p>

                <p className="text-xs sm:text-sm text-gray-300 line-clamp-2 leading-relaxed mb-4 max-w-lg">
                  {activeHero.description}
                </p>

                {/* Single-Row Responsive Action Bar */}
                <div className="flex items-center flex-nowrap gap-2 sm:gap-2.5">
                  <Link
                    to={
                      activeHero.episodeId
                        ? `/watch/${activeHero.type}/${encodeURIComponent(activeHero.episodeId)}`
                        : `/detail/${activeHero.type}/${encodeURIComponent(activeHero.id)}`
                    }
                    state={{
                      backTo: '/',
                      adUnlocked: isPremium,
                      poster: activeHero.poster,
                      seriesTitle: activeHero.title,
                    }}
                    className="flex-1 sm:flex-none min-h-[44px] px-4 sm:px-6 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-lg shadow-[#E84A18]/35 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Play className="w-4 h-4 fill-current shrink-0" />
                    <span>Tonton Sekarang</span>
                  </Link>

                  <Link
                    to={`/detail/${activeHero.type}/${encodeURIComponent(activeHero.id)}`}
                    state={{
                      backTo: '/',
                      poster: activeHero.poster,
                      seriesTitle: activeHero.title,
                    }}
                    className="min-h-[44px] px-3.5 sm:px-5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Info className="w-4 h-4 shrink-0" />
                    <span>Detail</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() =>
                      toggleBookmark({
                        id: activeHero.id,
                        type: activeHero.type,
                        title: activeHero.title,
                        poster: activeHero.poster,
                        rating: activeHero.rating,
                        status: activeHero.status,
                      })
                    }
                    aria-label={
                      isHeroBookmarked ? 'Hapus dari Watchlist' : 'Simpan ke Watchlist'
                    }
                    className={`min-h-[44px] min-w-[44px] sm:px-4 rounded-xl backdrop-blur-md border text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                      isHeroBookmarked
                        ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-300'
                        : 'bg-black/55 border-white/20 text-white hover:bg-white/20'
                    }`}
                  >
                    {isHeroBookmarked ? (
                      <Check className="w-4 h-4 shrink-0" />
                    ) : (
                      <Plus className="w-4 h-4 shrink-0" />
                    )}
                    <span className="hidden sm:inline">
                      {isHeroBookmarked ? 'Disimpan' : 'Watchlist'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Tablet Slider Arrows */}
              {heroSlides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentSlide((p) => (p - 1 + heroSlides.length) % heroSlides.length)
                    }
                    aria-label="Slide sebelumnya"
                    className="hidden sm:flex lg:hidden absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-[#E84A18] text-white items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentSlide((p) => (p + 1) % heroSlides.length)}
                    aria-label="Slide berikutnya"
                    className="hidden sm:flex lg:hidden absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-[#E84A18] text-white items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Hero Carousel Dots */}
          {heroSlides.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {heroSlides.map((slide, idx) => (
                <button
                  key={slide.id + idx}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  aria-label={`Pilih slide ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentSlide
                      ? 'w-7 bg-[#E84A18]'
                      : 'w-1.5 bg-slate-300 dark:bg-white/25 hover:bg-slate-400 dark:hover:bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}
        </section>

        {/* Adsterra Banner 728x90 — Dibawah Hero Slider (Hanya untuk user gratis) */}
        {!isPremium && <AdsterraBanner728x90 />}

        {/* Kategori Genre */}
        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              Jelajahi Genre
            </h2>
            <Link
              to="/catalog"
              className="text-xs text-slate-500 dark:text-[#9CA3AF] hover:text-[#E84A18] font-medium whitespace-nowrap"
            >
              Filter Lengkap →
            </Link>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {GENRE_FILTERS.map((g) => {
              const selected = activeGenre === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleGenreSelect(g.id)}
                  className={`min-h-[40px] px-4 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all ${
                    selected
                      ? 'bg-[#E84A18] text-white shadow-lg shadow-[#E84A18]/25'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-[#14161E] dark:hover:bg-[#1D202C] dark:text-gray-200 dark:border-white/[0.06]'
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Lanjutkan Nonton */}
        <section className="mt-7">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              Lanjutkan Nonton
            </h2>
            <Link
              to="/library?tab=history"
              className="text-xs text-slate-500 dark:text-[#9CA3AF] hover:text-[#E84A18] flex items-center gap-0.5 font-medium transition-colors whitespace-nowrap"
            >
              <span>Lihat History</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {history.length > 0 ? (
            <div className="flex gap-3.5 overflow-x-auto no-scrollbar pb-1">
              {history.slice(0, 10).map((item, idx) => {
                const resolvedPoster = resolveHistoryItemPoster(item);
                return (
                  <Link
                    key={`hist-${item.episodeId}-${idx}`}
                    to={`/watch/${item.type}/${encodeURIComponent(item.episodeId)}`}
                    state={{
                      backTo: '/',
                      adUnlocked: isPremium,
                      poster: resolvedPoster,
                      seriesTitle: item.title,
                    }}
                    className="group relative w-60 sm:w-68 aspect-video rounded-2xl overflow-hidden bg-slate-900 dark:bg-[#16181F] border border-slate-200 dark:border-white/[0.08] shrink-0 shadow-sm hover:border-[#E84A18]/50 transition-all"
                  >
                    <ResilientPosterImage
                      src={resolvedPoster}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="w-11 h-11 rounded-full bg-[#E84A18] text-white flex items-center justify-center shadow-xl">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </span>
                    </div>
                    <div className="absolute top-2.5 left-2.5">
                      <span className="px-2 py-0.5 rounded bg-black/70 backdrop-blur-md border border-white/10 text-[9px] font-bold uppercase tracking-wider text-gray-200">
                        {item.type === 'donghua' ? 'Donghua' : 'Anime'}
                      </span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3 pb-3.5">
                      <p className="text-[11px] text-[#FF7A4D] font-bold">
                        Episode {item.episodeNumber}
                      </p>
                      <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                        {item.title}
                      </h3>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                      <div
                        className="h-full bg-[#E84A18]"
                        style={{ width: `${item.progress || 45}%` }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-gradient-to-r dark:from-[#14161E] dark:via-[#171A24] dark:to-[#1D1518] border border-slate-200 dark:border-white/[0.07] p-4 flex items-center justify-between gap-4 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-[#E84A18]/15 text-[#E84A18] flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    Mulai Misi Nonton Harian
                  </p>
                  <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-0.5 line-clamp-2">
                    Tonton episode setiap hari untuk kumpulkan EXP bonus harian &amp; naik level!
                  </p>
                </div>
              </div>
              <Link
                to="/catalog"
                className="px-4 py-2.5 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
              >
                Jelajahi
              </Link>
            </div>
          )}
        </section>

        {/* Top 10 Trending Minggu Ini */}
        {!loading && trendingTop.length > 0 && activeGenre === 'all' && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#E84A18]" />
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Top 10 Populer Minggu Ini
                </h2>
              </div>
              <Link
                to="/catalog"
                className="text-xs text-slate-500 dark:text-[#9CA3AF] hover:text-[#E84A18] flex items-center gap-0.5 font-medium whitespace-nowrap"
              >
                <span>Semua</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="flex gap-3.5 overflow-x-auto no-scrollbar pb-2">
              {trendingTop.map((item, idx) => (
                <Link
                  key={`top-${item.type}-${item.id}-${idx}`}
                  to={`/detail/${item.type}/${encodeURIComponent(item.id)}${
                    item.episodeId ? `?ep=${encodeURIComponent(item.episodeId)}` : ''
                  }`}
                  state={{ backTo: '/', poster: item.poster, seriesTitle: item.title }}
                  className="group relative flex items-end shrink-0 w-36 sm:w-44"
                >
                  <span
                    aria-hidden="true"
                    className="text-6xl sm:text-7xl font-black leading-none text-[#E84A18]/20 dark:text-transparent bg-clip-text dark:bg-gradient-to-b dark:from-white/40 dark:to-white/5 select-none -mr-4 z-10 font-mono-tabular"
                    style={{ WebkitTextStroke: '1.5px rgba(232,74,24,0.75)' }}
                  >
                    {idx + 1}
                  </span>
                  <div className="relative flex-1 aspect-[3/4] rounded-xl overflow-hidden bg-slate-900 dark:bg-[#16181F] border border-slate-200 dark:border-white/[0.07] shadow-sm">
                    <ResilientPosterImage
                      src={item.poster}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-amber-400 text-[10px] font-bold flex items-center gap-0.5 font-mono-tabular">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      {item.rating}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-2.5">
                      {item.episodeLabel && (
                        <p className="text-[10px] font-bold text-[#FF7A4D] truncate mb-0.5">
                          {item.episodeLabel}
                        </p>
                      )}
                      <p className="text-[11px] font-bold text-white line-clamp-2 leading-snug">
                        {item.title}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Episode Terbaru (Auto-Update Real-time) */}
        <section className="mt-8">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                {activeGenre === 'all'
                  ? 'Episode Terbaru'
                  : `Katalog ${GENRE_FILTERS.find((g) => g.id === activeGenre)?.label || ''}`}
              </h2>
              {activeGenre === 'all' && (
                <button
                  type="button"
                  onClick={() => loadHome(true)}
                  title={
                    lastUpdated
                      ? `Sync terakhir: ${new Date(lastUpdated).toLocaleTimeString('id-ID')}`
                      : 'Perbarui Rilis Harian'
                  }
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 transition-colors shrink-0"
                >
                  <RefreshCw className={`w-3 h-3 ${syncingFeed ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">
                    {syncingFeed ? 'Memperbarui...' : 'Auto-Update Harian'}
                  </span>
                </button>
              )}
            </div>
            <Link
              to="/catalog"
              className="text-xs text-slate-500 dark:text-[#9CA3AF] hover:text-[#E84A18] flex items-center gap-0.5 font-medium transition-colors shrink-0 whitespace-nowrap"
            >
              <span>Lihat Semua</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {loading || genreLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] rounded-xl bg-slate-200 dark:bg-[#16181F] animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-4">
              {displayedEpisodes.slice(0, 36).map((item, idx) => (
                <MediaCard key={`latest-${item.type}-${item.id}-${idx}`} item={item} />
              ))}
            </div>
          )}
        </section>

        {/* Jadwal Rilis Hari Ini */}
        {!loading && todaySchedule.length > 0 && activeGenre === 'all' && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-[#E84A18]" />
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Rilis Hari {getTodayIndonesianDay()}
                </h2>
              </div>
              <Link
                to="/schedule"
                className="text-xs text-slate-500 dark:text-[#9CA3AF] hover:text-[#E84A18] flex items-center gap-0.5 font-medium whitespace-nowrap"
              >
                <span>Jadwal Lengkap</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {todaySchedule.map((item, idx) => (
                <div
                  key={`sched-${item.type}-${item.id}-${idx}`}
                  className="w-32 sm:w-40 shrink-0"
                >
                  <MediaCard item={item} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Curated Section: Donghua Unggulan */}
        {!loading && donghuaList.length > 0 && activeGenre === 'all' && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Donghua Kultivasi &amp; Ongoing Lengkap
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-[#E84A18]/15 text-[#E84A18] text-[10px] font-bold font-mono-tabular">
                  {donghuaList.length}+ Judul
                </span>
              </div>
              <Link
                to="/catalog?type=donghua"
                className="text-xs text-slate-500 dark:text-[#9CA3AF] hover:text-[#E84A18] flex items-center gap-0.5 font-medium whitespace-nowrap"
              >
                <span>Semua Donghua</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-4">
              {donghuaList.slice(0, 36).map((item, idx) => (
                <MediaCard key={`dh-${item.id}-${idx}`} item={item} />
              ))}
            </div>
          </section>
        )}

        {/* Curated Section: Anime Ongoing Terbaru */}
        {!loading && animeList.length > 0 && activeGenre === 'all' && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Anime Ongoing &amp; Tamat Lengkap
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-500 text-[10px] font-bold font-mono-tabular">
                  {animeList.length}+ Judul
                </span>
              </div>
              <Link
                to="/catalog?type=anime"
                className="text-xs text-slate-500 dark:text-[#9CA3AF] hover:text-[#E84A18] flex items-center gap-0.5 font-medium whitespace-nowrap"
              >
                <span>Semua Anime</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-4">
              {animeList.slice(0, 36).map((item, idx) => (
                <MediaCard key={`an-${item.id}-${idx}`} item={item} />
              ))}
            </div>
          </section>
        )}

        {/* VIP Promo Banner for Free Users */}
        {!isPremium && (
          <section className="mt-9">
            <div className="rounded-3xl bg-white dark:bg-gradient-to-r dark:from-[#1A1416] dark:via-[#161822] dark:to-[#13151C] border border-[#E84A18]/25 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-3.5">
                <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E84A18] to-amber-500 text-white flex items-center justify-center shadow-lg shadow-[#E84A18]/30 shrink-0">
                  <Crown className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Nonton Tanpa Iklan, 2x EXP, Dekorasi Avatar Discord &amp; Emoji VIP
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-0.5">
                    Upgrade ke ZoneStream Premium untuk menghapus iklan, gandakan EXP harian, buka dekorasi avatar SVG eksklusif, dan kirim stiker VIP di komentar.
                  </p>
                </div>
              </div>
              <Link
                to="/profile"
                className="px-5 py-3 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold whitespace-nowrap shadow-lg shadow-[#E84A18]/25 transition-colors shrink-0"
              >
                Upgrade VIP Sekarang
              </Link>
            </div>
          </section>
        )}

        {/* Genre Explorer Quick Grid */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              Jelajahi Genre Populer
            </h2>
            <Link
              to="/catalog"
              className="text-xs text-slate-500 dark:text-[#9CA3AF] hover:text-[#E84A18] flex items-center gap-0.5 font-medium"
            >
              <span>Semua Genre</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {[
              { name: 'Action', desc: 'Pertarungan epik & jurus sakti', count: '420+ Judul' },
              { name: 'Cultivation', desc: 'Kultivasi menuju keabadian', count: '310+ Judul' },
              { name: 'Fantasy', desc: 'Dunia sihir & mitologi', count: '550+ Judul' },
              { name: 'Romance', desc: 'Kisah cinta menyentuh hati', count: '180+ Judul' },
              { name: 'Adventure', desc: 'Petualangan tanpa batas', count: '390+ Judul' },
              { name: 'Martial Arts', desc: 'Pencak silat & bela diri', count: '280+ Judul' },
              { name: 'Sci-Fi', desc: 'Teknologi masa depan', count: '140+ Judul' },
              { name: 'Isekai', desc: 'Reinkarnasi di dunia lain', count: '210+ Judul' },
              { name: 'Comedy', desc: 'Humor segar menghibur', count: '300+ Judul' },
              { name: 'Supernatural', desc: 'Kekuatan mistis & gaib', count: '250+ Judul' },
            ].map((g) => (
              <Link
                key={g.name}
                to={`/catalog?genre=${encodeURIComponent(g.name.toLowerCase())}`}
                className="group p-3.5 rounded-2xl bg-white hover:bg-slate-50 dark:bg-[#14161D] dark:hover:bg-[#1C1F2B] border border-slate-200 dark:border-white/5 transition-all shadow-sm dark:shadow-none flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-[#E84A18] transition-colors">
                    {g.name}
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-[#9CA3AF] mt-0.5 line-clamp-1">
                    {g.desc}
                  </p>
                </div>
                <span className="text-[10px] text-[#E84A18] font-bold mt-2">
                  {g.count} →
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Professional Multi-Column Footer */}
        <footer className="mt-12 pt-8 pb-6 border-t border-slate-200 dark:border-white/[0.08] text-xs text-slate-500 dark:text-[#7A808D]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="space-y-3 md:col-span-1">
              <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-extrabold text-sm">
                <img
                  src="/assets/aistudio/sara_seo_pfp_6f6b2a74.jfif"
                  alt="ZoneStream Logo"
                  className="w-8 h-8 rounded-xl object-cover ring-2 ring-[#E84A18]/60 shadow-md"
                />
                <span>ZoneStream &amp; Donghive</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] leading-relaxed">
                Platform streaming anime &amp; donghua sub Indo terlengkap dengan update otomatis setiap hari, multi-server HD anti-error, Watch Party, &amp; komunitas aktif.
              </p>
            </div>

            <div>
              <h4 className="font-extrabold text-slate-900 dark:text-white mb-3 text-xs uppercase tracking-wider">
                Navigasi Utama
              </h4>
              <ul className="space-y-2 text-[11px]">
                <li><Link to="/" className="hover:text-[#E84A18] transition-colors">Beranda Utama</Link></li>
                <li><Link to="/catalog" className="hover:text-[#E84A18] transition-colors">Katalog Lengkap</Link></li>
                <li><Link to="/schedule" className="hover:text-[#E84A18] transition-colors">Jadwal Rilis Harian</Link></li>
                <li><Link to="/library" className="hover:text-[#E84A18] transition-colors">Library &amp; Watchlist</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-extrabold text-slate-900 dark:text-white mb-3 text-xs uppercase tracking-wider">
                Komunitas &amp; Sosial
              </h4>
              <ul className="space-y-2 text-[11px]">
                <li><Link to="/community" className="hover:text-[#E84A18] transition-colors">Komunitas &amp; Cari Teman</Link></li>
                <li><Link to="/chat" className="hover:text-[#E84A18] transition-colors">Grup Chat &amp; Watch Party</Link></li>
                <li><a href="https://t.me/ZhuuVerzon" target="_blank" rel="noreferrer" className="hover:text-[#E84A18] transition-colors">Bot VIP Telegram</a></li>
                <li><Link to="/profile" className="hover:text-[#E84A18] transition-colors">Akun &amp; Langganan VIP</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-extrabold text-slate-900 dark:text-white mb-3 text-xs uppercase tracking-wider">
                Dukungan &amp; Bantuan
              </h4>
              <div className="space-y-2.5">
                <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                  Butuh bantuan atau kendala pemutaran video? Hubungi Customer Service resmi kami.
                </p>
                <TelegramCsButton />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 dark:border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
            <p>&copy; {new Date().getFullYear()} ZoneStream &amp; Donghive Official. All rights reserved.</p>
            <div className="flex items-center gap-4 text-slate-400">
              <span>Server HD Stabil</span>
              <span>•</span>
              <span>Sub Indo / English / Japan / Mandarin</span>
              <span>•</span>
              <span>Zero Error</span>
            </div>
          </div>
        </footer>
      </div>
    </Layout>
  );
}
