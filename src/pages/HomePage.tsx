import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  Flame,
  Globe,
  HelpCircle,
  Info,
  MessageCircle,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  Users,
  X,
  Zap,
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
import { HeaderSearch } from '../components/HeaderSearch';
import { NotificationBell } from '../components/NotificationBell';
import {
  HeroShowcaseSkeleton,
  HorizontalSectionSkeleton,
  MediaGridSkeleton,
  SkeletonBlock,
  TopClanSkeleton,
  TrendingRankRailSkeleton,
} from '../components/SkeletonLoaders';
import { seedCatalogIndex } from '../utils/catalogSearch';
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
  const [showQuickSearch, setShowQuickSearch] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [syncingFeed, setSyncingFeed] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [topClans, setTopClans] = useState<any[]>([]);
  const [latestGlobalMsg, setLatestGlobalMsg] = useState<any | null>(null);

  const history = getLocalHistory();
  const bookmarks = getLocalBookmarks();

  const loadHome = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setSyncingFeed(true);
    try {
      const homeUrl = forceRefresh ? '/api/stream/home?refresh=1' : '/api/stream/home';
      const token = localStorage.getItem('zonestream_session_token_v1') || localStorage.getItem('donghive_session_token_v1') || '';
      const [homeRes, schedRes, clanRes, globalRes] = await Promise.allSettled([
        fetch(homeUrl).then((r) => r.json()),
        fetch('/api/stream/schedule').then((r) => r.json()),
        fetch('/api/social/clans', { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then((r) => r.json()),
        fetch('/api/social/global-messages', { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then((r) => r.json()),
      ]);

      if (homeRes.status === 'fulfilled' && homeRes.value?.ok) {
        const slides = homeRes.value.heroSlides || [];
        const latest = homeRes.value.latestEpisodes || [];
        const donghua = homeRes.value.donghuaList || [];
        const anime = homeRes.value.animeList || [];
        setHeroSlides(slides);
        setLatestEpisodes(latest);
        setDonghuaList(donghua);
        setAnimeList(anime);
        seedCatalogIndex([...latest, ...donghua, ...anime, ...slides]);
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

      if (clanRes.status === 'fulfilled' && clanRes.value?.ok && Array.isArray(clanRes.value.clans)) {
        setTopClans(clanRes.value.clans);
      }

      if (
        globalRes.status === 'fulfilled' &&
        globalRes.value?.ok &&
        Array.isArray(globalRes.value.messages) &&
        globalRes.value.messages.length > 0
      ) {
        setLatestGlobalMsg(globalRes.value.messages[globalRes.value.messages.length - 1]);
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

          {/* Tablet Inline Search (lg+ uses sticky Layout HeaderSearch) + Cari User & Gacha button */}
          <div className="hidden md:flex flex-1 max-w-xl mx-2 lg:mx-4 items-center gap-2 lg:justify-end">
            <HeaderSearch
              className="flex-1 min-w-[190px] lg:hidden"
              placeholder="Cari Donghua, Anime..."
              compact
              dropdownClassName="left-0 right-0 sm:min-w-[320px]"
            />
            <Link
              to="/community"
              className="h-10 px-2.5 lg:px-3 rounded-xl bg-white dark:bg-[#13151D] hover:border-[#E84A18] border border-slate-200 dark:border-white/[0.08] text-xs font-bold text-slate-700 dark:text-gray-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              title="Pencarian User & Komunitas"
            >
              <Users className="w-3.5 h-3.5 text-[#E84A18]" />
              <span className="hidden lg:inline">Cari User</span>
            </Link>
            <button
              type="button"
              onClick={handleRandomGacha}
              className="h-10 px-2.5 lg:px-3 rounded-xl bg-white dark:bg-[#13151D] hover:border-[#E84A18] border border-slate-200 dark:border-white/[0.08] text-xs font-bold text-slate-700 dark:text-gray-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              title="Rekomendasi Gacha Acak Anime/Donghua"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#E84A18]" />
              <span className="hidden lg:inline">Gacha Acak</span>
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

            <NotificationBell compact className="lg:hidden" />

            <button
              type="button"
              onClick={() => setShowQuickSearch((s) => !s)}
              aria-label="Cari Anime atau Donghua"
              className="md:hidden h-9 w-9 sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center rounded-xl bg-white dark:bg-[#14161E] border border-slate-200 dark:border-white/[0.08] hover:border-[#E84A18]/50 transition-colors text-[#E84A18]"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </header>

        {/* Mobile Quick Search Bar */}
        {showQuickSearch && (
          <div className="md:hidden mb-4 relative">
            <HeaderSearch
              placeholder="Cari Donghua atau Anime..."
              className="w-full"
              autoFocus
            />
          </div>
        )}

        {/* Flagship Bstation / Crunchyroll Cinematic Hero Showcase */}
        <section aria-label="Unggulan" className="relative">
          {loading || !activeHero ? (
            <HeroShowcaseSkeleton />
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

        {/* GLOBAL CHAT LIVE BAR */}
        <Link
          to={user ? '/chat?global=1' : '/profile'}
          className="mt-6 rounded-2xl bg-gradient-to-r from-[#161923] via-[#1C1F2B] to-[#161923] border border-white/10 hover:border-[#E84A18]/50 p-3.5 sm:px-5 flex items-center justify-between gap-3 shadow-lg transition-all group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E84A18] to-amber-500 text-white flex items-center justify-center shrink-0 shadow">
              <Globe className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-extrabold text-white">Global Chat Komunitas</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  Live
                </span>
              </div>
              <p className="text-[11px] text-gray-300 truncate mt-0.5 flex items-center gap-1.5">
                {latestGlobalMsg ? (
                  <>
                    {latestGlobalMsg.senderPhoto && (
                      <img
                        src={latestGlobalMsg.senderPhoto}
                        alt={latestGlobalMsg.senderName}
                        referrerPolicy="no-referrer"
                        className="w-4 h-4 rounded-full object-cover inline-block shrink-0"
                      />
                    )}
                    <strong className="text-amber-300">{latestGlobalMsg.senderName}:</strong>
                    <span className="truncate">{latestGlobalMsg.text || '[Stiker / Media]'}</span>
                  </>
                ) : (
                  <span>Ngobrol langsung dengan semua member &amp; user baru login sekarang!</span>
                )}
              </p>
            </div>
          </div>
          <span className="px-3.5 py-2 rounded-xl bg-[#E84A18] group-hover:bg-[#F35B2B] text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors">
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Gabung Chat</span>
          </span>
        </Link>

        {/* TOP CLAN WIDGET */}
        <div className="mt-4 rounded-3xl bg-gradient-to-br from-[#1E1B2E] via-[#14161F] to-[#12141C] border border-amber-500/30 p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">👑</span>
              <h3 className="text-sm sm:text-base font-extrabold text-white">TOP CLAN</h3>
            </div>
            <Link to="/leaderboard" className="text-xs font-bold text-amber-400 hover:underline">
              Lihat Semua &gt;
            </Link>
          </div>
          {loading && topClans.length === 0 ? (
            <TopClanSkeleton />
          ) : topClans.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs">
              Belum ada klan. Jadilah yang pertama membuat klan di menu Peringkat!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {topClans.slice(0, 3).map((clan, idx) => (
                <div
                  key={clan.clanId || idx}
                  className={`p-4 rounded-2xl ${
                    idx === 0
                      ? 'bg-gradient-to-tr from-amber-600/30 to-amber-500/10 border border-amber-400/50'
                      : 'bg-white/5 border border-white/10'
                  } flex items-center gap-3.5 relative overflow-hidden`}
                >
                  {clan.avatarUrl || clan.leaderPhoto ? (
                    <img
                      src={clan.avatarUrl || clan.leaderPhoto}
                      alt={clan.name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-2xl object-cover border border-amber-400/40 shadow-lg shrink-0"
                    />
                  ) : (
                    <div
                      className={`w-12 h-12 rounded-2xl ${
                        idx === 0
                          ? 'bg-gradient-to-tr from-amber-400 to-rose-600'
                          : idx === 1
                          ? 'bg-gradient-to-tr from-cyan-500 to-blue-600'
                          : 'bg-gradient-to-tr from-purple-500 to-pink-600'
                      } flex items-center justify-center text-white font-extrabold text-lg shadow-lg shrink-0`}
                    >
                      {idx === 0 ? '👑' : idx + 1}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-amber-300">[{clan.tag}]</span>
                      <span className="text-xs font-bold text-white truncate">{clan.name}</span>
                    </div>
                    <p className="text-xs font-extrabold text-amber-400 mt-0.5">
                      Lv {clan.level || 1} · ♥ {clan.charisma || 0}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {clan.membersCount || (Array.isArray(clan.members) ? clan.members.length : 1)} anggota · {clan.episodesWatched || 0} eps
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
        {loading && activeGenre === 'all' ? (
          <TrendingRankRailSkeleton />
        ) : !loading && trendingTop.length > 0 && activeGenre === 'all' ? (
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
        ) : null}

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
            <MediaGridSkeleton
              count={12}
              label={
                activeGenre === 'all'
                  ? 'Memuat episode terbaru...'
                  : `Memuat katalog ${GENRE_FILTERS.find((g) => g.id === activeGenre)?.label || ''}...`
              }
            />
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-4">
              {displayedEpisodes.slice(0, 36).map((item, idx) => (
                <MediaCard key={`latest-${item.type}-${item.id}-${idx}`} item={item} />
              ))}
            </div>
          )}
        </section>

        {/* Jadwal Rilis Hari Ini */}
        {loading && activeGenre === 'all' ? (
          <HorizontalSectionSkeleton titleWidthClass="w-44" count={6} />
        ) : !loading && todaySchedule.length > 0 && activeGenre === 'all' ? (
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
        ) : null}

        {/* Curated Section: Donghua Unggulan */}
        {loading && activeGenre === 'all' ? (
          <section aria-hidden="true" className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <SkeletonBlock className="h-6 w-56 rounded-lg" />
              <SkeletonBlock className="h-4 w-24 rounded" delayMs={80} />
            </div>
            <MediaGridSkeleton count={6} label="Memuat daftar donghua unggulan..." />
          </section>
        ) : !loading && donghuaList.length > 0 && activeGenre === 'all' ? (
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
        ) : null}

        {/* Curated Section: Anime Ongoing Terbaru */}
        {loading && activeGenre === 'all' ? (
          <section aria-hidden="true" className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <SkeletonBlock className="h-6 w-52 rounded-lg" />
              <SkeletonBlock className="h-4 w-24 rounded" delayMs={80} />
            </div>
            <MediaGridSkeleton count={6} label="Memuat daftar anime ongoing..." />
          </section>
        ) : !loading && animeList.length > 0 && activeGenre === 'all' ? (
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
        ) : null}

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

        {/* Trending Tags & Popular Searches Cloud */}
        <section className="mt-12 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-[#14161F] to-slate-900 border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-[#E84A18]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-[#E84A18]" />
            <h2 className="text-sm sm:text-base font-extrabold text-white">
              Pencarian Populer &amp; Tag Teratas
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              'Battle Through The Heavens S5',
              'Soul Land 2',
              'Perfect World',
              'Apotheosis',
              'Swallowed Star',
              'Shijie Zhiwang',
              'Renegade Immortal',
              'Jujutsu Kaisen',
              'One Piece',
              'Solo Leveling',
              'Demon Slayer',
              'Watch Party Sub Indo',
              'Bot VIP Telegram',
              'Cultivation Master',
            ].map((tag) => (
              <Link
                key={tag}
                to={`/catalog?q=${encodeURIComponent(tag)}`}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-[#E84A18]/20 border border-white/10 hover:border-[#E84A18]/50 text-gray-200 hover:text-white text-xs font-semibold transition-all inline-flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3 h-3 text-[#E84A18]" />
                <span>{tag}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* VIP Perks & Premium Benefits Banner */}
        <section className="mt-10 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#E84A18]/20 via-amber-500/15 to-transparent border border-[#E84A18]/30 relative overflow-hidden shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="md:col-span-2 space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E84A18] text-white text-xs font-extrabold shadow">
                <Crown className="w-4 h-4 fill-white" />
                <span>ZoneStream VIP Member Club</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                Buka Pengalaman Streaming Tanpa Batas &amp; 2x EXP
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed">
                Nikmati akses eksklusif tanpa jeda iklan, server HD prioritas kilat, lencana Verified emas di komentar &amp; grup chat, stiker Telegram premium, serta fitur Nobar Bersama (Watch Party) tanpa batas.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700 dark:text-gray-200">
                <span className="inline-flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Bebas Iklan Selamanya</span>
                <span className="inline-flex items-center gap-1"><Zap className="w-4 h-4 text-amber-500" /> 2x EXP &amp; Leveling Cepat</span>
                <span className="inline-flex items-center gap-1"><Users className="w-4 h-4 text-[#E84A18]" /> Bot VIP Telegram Otomatis</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row md:flex-col gap-3 justify-center">
              <Link
                to="/profile"
                className="px-6 py-3 rounded-2xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-center font-extrabold text-xs sm:text-sm shadow-lg shadow-[#E84A18]/30 transition-transform hover:scale-105"
              >
                Kelola Langganan VIP
              </Link>
              <a
                href="https://t.me/ZhuuVerzon"
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 rounded-2xl bg-white hover:bg-slate-100 dark:bg-[#1C1F2B] dark:hover:bg-[#252838] text-slate-900 dark:text-white text-center font-bold text-xs sm:text-sm border border-slate-200 dark:border-white/10 transition-all"
              >
                Aktivasi via Bot Telegram
              </a>
            </div>
          </div>
        </section>

        {/* Interactive FAQ Accordion */}
        <section className="mt-12">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5 text-[#E84A18]" />
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              Pertanyaan Sering Diajukan (FAQ)
            </h2>
          </div>
          <div className="space-y-3">
            {[
              {
                q: 'Bagaimana cara mengatasi video streaming yang buffering atau macet?',
                a: 'Anda dapat mengklik tombol "Ganti Server Jika Video Macet" atau memilih server mirror cadangan HD di bawah pemutar video. ZoneStream menyediakan 3+ server alternatif (Direct MP4, HLS, dan Embed HD) untuk menjamin kelancaran tanpa error 404.',
              },
              {
                q: 'Bagaimana cara kerja fitur Watch Party (Nobar Bersama)?',
                a: 'Fitur Watch Party memungkinkan Anda membuat ruangan virtual dan mengundang teman melalui tautan atau chat. Pemutaran video (play/pause/seek) akan tersinkronisasi secara real-time antar peserta dalam satu ruangan dengan sidebar chat interaktif.',
              },
              {
                q: 'Bagaimana cara mendapatkan status VIP Premium?',
                a: 'Anda dapat mengaktifkan status VIP melalui panel langganan di menu Profil Anda, atau menggunakan Bot Telegram resmi kami dengan mengirimkan perintah /vip diikuti email atau UID Anda untuk aktivasi instan 1 tahun.',
              },
              {
                q: 'Apakah semua anime dan donghua menyediakan subtitle bahasa Indonesia?',
                a: 'Ya! Seluruh koleksi anime dan donghua di ZoneStream dilengkapi dengan dukungan subtitle 4 bahasa (Indonesia, English, Japanese, Mandarin) yang dapat diubah secara instan melalui menu pemutar video.',
              },
            ].map((faq, idx) => (
              <div
                key={faq.q}
                className="rounded-2xl bg-white dark:bg-[#14161F] border border-slate-200 dark:border-white/[0.08] overflow-hidden shadow-sm transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-4 text-left font-bold text-xs sm:text-sm text-slate-900 dark:text-white hover:text-[#E84A18] transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#E84A18] transition-transform duration-300 shrink-0 ${
                      openFaq === idx ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-4 pb-4 pt-1 text-xs text-slate-600 dark:text-gray-300 leading-relaxed border-t border-slate-100 dark:border-white/5">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Mobile App PWA Download Banner */}
        <section className="mt-12 p-6 rounded-3xl bg-gradient-to-r from-blue-600/15 via-purple-600/15 to-[#E84A18]/15 border border-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#E84A18] to-amber-500 flex items-center justify-center text-white shadow-lg shrink-0">
              <Smartphone className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                Download Aplikasi Wibuku (PWA) di Android &amp; iOS
              </h2>
              <p className="text-xs text-slate-600 dark:text-gray-300 mt-0.5">
                Install aplikasi ke layar utama perangkat Anda untuk pengalaman streaming full-screen, akses offline, dan notifikasi rilis instan.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              alert('Buka menu browser Anda (ikon titik tiga / Share) lalu pilih "Add to Home Screen" atau "Install App" untuk menginstal Wibuku!');
            }}
            className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-[#E84A18] dark:hover:bg-[#E84A18] dark:hover:text-white text-xs font-extrabold transition-colors whitespace-nowrap shadow-md"
          >
            Install Aplikasi Sekarang
          </button>
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
