import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Flame,
  Info,
  MessageCircle,
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
import { MediaCard } from '../components/MediaCard';
import { TelegramCsButton } from '../components/TelegramCsButton';
import { ThemeToggle } from '../components/ThemeToggle';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { StatusEmojiBadge } from '../components/VipEmojis';
import { useAuth, AVATAR_BORDER_STYLES } from '../context/AuthContext';
import type { HeroSlide, MediaCardItem, PublicCommunityUser, ScheduleDay } from '../types';
import defaultAvatarImg from '../assets/images/default_avatar_ink_1794755346613.jpg';
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
  const [showQuickSearch, setShowQuickSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [syncingFeed, setSyncingFeed] = useState(false);
  const [communitySpotlight, setCommunitySpotlight] = useState<PublicCommunityUser[]>([]);

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

      fetch('/api/social/users?limit=8')
        .then((r) => r.json())
        .then((j) => {
          if (j?.ok && Array.isArray(j.users)) {
            setCommunitySpotlight(j.users);
          }
        })
        .catch(() => {});
    } catch (err) {
      console.error('Failed loading home stream:', err);
    } finally {
      setLoading(false);
      setSyncingFeed(false);
    }
  }, []);

  useEffect(() => {
    loadHome(false);
    const autoRefresh = setInterval(() => loadHome(true), 2 * 60 * 1000);
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

  const activeHero = heroSlides[currentSlide];
  const isHeroBookmarked = activeHero
    ? bookmarks.some((b) => b.id === activeHero.id && b.type === activeHero.type)
    : false;
  const displayedEpisodes = filteredEpisodes ?? latestEpisodes;
  const trendingTop = latestEpisodes.slice(0, 10);
  const borderStyle =
    AVATAR_BORDER_STYLES[user?.activeBorder || 'classic']?.ringClass ||
    AVATAR_BORDER_STYLES.classic.ringClass;
  const hasVipBadge = Boolean(user && (user.isVerified || isPremium || user.role === 'founder'));

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 pt-3 sm:pt-5">
        {/* Top Greeting Header + Inline Search */}
        <header className="flex items-center justify-between gap-3 mb-4">
          <Link to="/profile" className="flex items-center gap-2.5 sm:gap-3 min-w-0 group">
            <img
              src={user?.photoUrl || '/assets/aistudio/sara_seo_pfp_6f6b2a74.jfif'}
              alt={user?.name || 'ZoneStream'}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = defaultAvatarImg;
              }}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover shrink-0 transition-transform group-hover:scale-105 ${borderStyle}`}
            />
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] leading-tight">
                {user ? 'Selamat datang kembali,' : 'Selamat datang,'}
              </p>
              <div className="flex items-center gap-1.5 min-w-0">
                <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                  {user?.name || 'Masuk Akun'}
                </h1>
                {hasVipBadge && (
                  <VerifiedBadge
                    size="sm"
                    isFounder={user?.role === 'founder'}
                    badgeLabel={user?.activeBadge}
                  />
                )}
                {hasVipBadge && user?.statusEmoji && (
                  <StatusEmojiBadge statusEmoji={user.statusEmoji} size="xs" />
                )}
                {hasVipBadge && (
                  <span
                    className={`hidden sm:inline-block px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                      user?.role === 'founder'
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                        : 'bg-sky-500/15 text-sky-600 dark:text-sky-300'
                    }`}
                  >
                    {user?.role === 'founder' ? 'FOUNDER' : 'VIP'}
                  </span>
                )}
              </div>
            </div>
          </Link>

          {/* Desktop/Tablet Inline Search (Anime & Donghua) + Dedicated Cari User button */}
          <div className="hidden md:flex flex-1 max-w-lg mx-4 items-center gap-2">
            <form onSubmit={handleSearchSubmit} className="flex-1">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 dark:text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari Donghua, Anime, Movie..."
                  className="w-full h-10 pl-10 pr-4 rounded-xl bg-white dark:bg-[#13151D] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#E84A18]"
                />
              </div>
            </form>
            <Link
              to="/community"
              className="h-10 px-3 rounded-xl bg-white dark:bg-[#13151D] hover:border-[#E84A18] border border-slate-200 dark:border-white/[0.08] text-xs font-bold text-slate-700 dark:text-gray-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              title="Pencarian User & Komunitas (terpisah dari Anime/Donghua)"
            >
              <Users className="w-3.5 h-3.5 text-[#E84A18]" />
              <span>Cari User</span>
            </Link>
          </div>

          <div className="flex items-center gap-1.5 relative shrink-0">
            <div className="lg:hidden">
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
              onClick={() => setShowNotif((s) => !s)}
              aria-label="Notifikasi rilis baru"
              className="relative min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-white dark:bg-[#14161E] border border-slate-200 dark:border-white/[0.08] hover:border-[#E84A18]/50 transition-colors text-[#E84A18]"
            >
              <Bell className="w-5 h-5 fill-[#E84A18]/20" />
              {latestEpisodes.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E84A18] text-white text-[10px] font-bold flex items-center justify-center font-mono-tabular shadow">
                  {Math.min(9, latestEpisodes.length)}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowQuickSearch((s) => !s)}
              aria-label="Cari Anime atau Donghua"
              className="md:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-white dark:bg-[#14161E] border border-slate-200 dark:border-white/[0.08] hover:border-[#E84A18]/50 transition-colors text-[#E84A18]"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Notifications Dropdown */}
            {showNotif && (
              <div className="absolute right-0 top-12 z-50 w-72 sm:w-80 rounded-2xl bg-white dark:bg-[#14161F] border border-slate-200 dark:border-white/10 p-3 shadow-2xl">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100 dark:border-white/5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Rilis Terbaru Hari Ini
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNotif(false)}
                    className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {latestEpisodes.slice(0, 6).map((ep, idx) => (
                    <Link
                      key={`notif-${ep.type}-${ep.id}-${idx}`}
                      to={`/detail/${ep.type}/${encodeURIComponent(ep.id)}${
                        ep.episodeId ? `?ep=${encodeURIComponent(ep.episodeId)}` : ''
                      }`}
                      state={{ backTo: '/' }}
                      onClick={() => setShowNotif(false)}
                      className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <img
                        src={ep.poster || heroFallbackImg}
                        alt={ep.title}
                        referrerPolicy="no-referrer"
                        className="w-10 h-12 rounded-lg object-cover shrink-0 bg-slate-200 dark:bg-[#1F222C]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {ep.title}
                        </p>
                        <p className="text-[11px] text-[#E84A18] font-medium">
                          {ep.episodeLabel} · {ep.type === 'donghua' ? 'Donghua' : 'Anime'}
                        </p>
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
          <form onSubmit={handleSearchSubmit} className="md:hidden mb-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari Donghua atau Anime..."
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-white dark:bg-[#14161E] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#E84A18]"
              />
            </div>
            <button
              type="submit"
              className="px-4 h-11 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold whitespace-nowrap transition-colors"
            >
              Cari
            </button>
          </form>
        )}

        {/* Flagship Cinematic Hero Showcase (HD Wide Banner + Crisp Key-Art Framing) */}
        <section aria-label="Unggulan" className="relative">
          {loading || !activeHero ? (
            <div className="w-full h-[360px] sm:h-[420px] lg:h-[480px] rounded-3xl bg-slate-200 dark:bg-[#15171F] animate-pulse" />
          ) : (
            <div className="relative w-full h-[360px] sm:h-[420px] lg:h-[480px] rounded-3xl overflow-hidden bg-[#0D0F15] border border-slate-200 dark:border-white/[0.08] shadow-2xl group">
              {/* Background Canvas: Razor-sharp edge-to-edge for true HD wide banners, or atmospheric stage + sharp framed key art when slide uses portrait artwork */}
              {activeHero.hasWideBanner ? (
                <img
                  src={activeHero.backdrop || heroFallbackImg}
                  alt={activeHero.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.src = heroFallbackImg;
                  }}
                  className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.03]"
                />
              ) : (
                <>
                  <img
                    src={activeHero.backdrop || activeHero.poster || heroFallbackImg}
                    alt=""
                    aria-hidden="true"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.src = heroFallbackImg;
                    }}
                    className="w-full h-full object-cover object-center scale-110 blur-xl opacity-55"
                  />
                  {/* Framed Razor-Sharp HD Key Art Poster so portrait art never blurs */}
                  <div className="absolute right-4 sm:right-8 lg:right-[260px] top-10 sm:top-8 bottom-24 sm:bottom-10 aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.75)] ring-1 ring-white/20 z-[2] pointer-events-none">
                    <img
                      src={activeHero.poster || activeHero.backdrop || heroFallbackImg}
                      alt={activeHero.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = heroFallbackImg;
                      }}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </>
              )}

              {/* Cinema Multi-Stop Scrims for >= 7:1 Text Legibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#090A0E] via-[#090A0E]/65 to-black/25 z-[3]" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#090A0E]/95 via-[#090A0E]/75 sm:via-[#090A0E]/60 to-transparent z-[3]" />

              {/* Top Editorial Status Bar (Zero Pill Clutter) */}
              <div className="absolute top-4 left-4 sm:top-6 sm:left-8 flex items-center gap-3 z-10">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E84A18] text-white text-[11px] font-bold shadow-lg shadow-[#E84A18]/35 whitespace-nowrap">
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  <span>Unggulan #{currentSlide + 1}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-emerald-400 uppercase drop-shadow">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{activeHero.status || 'ONGOING'}</span>
                </span>
              </div>

              {/* Right Thumbnail Switcher Rail (Desktop lg:) */}
              {heroSlides.length > 1 && (
                <div className="hidden lg:flex flex-col gap-2 absolute right-6 top-1/2 -translate-y-1/2 z-10">
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
                            : 'bg-black/55 border-white/10 hover:bg-black/80'
                        }`}
                      >
                        <img
                          src={slide.poster || heroFallbackImg}
                          alt={slide.title}
                          referrerPolicy="no-referrer"
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
                            <span className="text-gray-300 capitalize">{slide.type}</span>
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Bottom Hero Typography & Single-Line Action Bar */}
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-7 lg:p-9 max-w-2xl z-10">
                <h2 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight line-clamp-2 mb-1.5 drop-shadow">
                  {activeHero.title}
                </h2>

                {/* Clean Unboxed Typographic Metadata Line (Zero Genre Pills) */}
                <p className="text-xs sm:text-sm text-gray-200 flex items-center flex-wrap gap-x-2 gap-y-1 mb-2.5">
                  <span className="inline-flex items-center gap-1 font-bold text-amber-400 font-mono-tabular">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {activeHero.rating || '8.50'}
                  </span>
                  <span className="text-gray-500">·</span>
                  <span className="font-semibold text-white capitalize">{activeHero.type}</span>
                  {activeHero.genres?.filter(Boolean).slice(0, 3).map((g, idx) => (
                    <span key={`${g}-${idx}`} className="inline-flex items-center gap-2 text-gray-300">
                      <span className="text-gray-500">·</span>
                      <span>{g}</span>
                    </span>
                  ))}
                </p>

                <p className="text-xs sm:text-sm text-gray-300 line-clamp-2 leading-relaxed mb-4 max-w-xl">
                  {activeHero.description}
                </p>

                {/* Single-Row Responsive Action Bar (Zero Wrapping on 375px Mobile) */}
                <div className="flex items-center flex-nowrap gap-2 sm:gap-2.5">
                  <Link
                    to={
                      activeHero.episodeId
                        ? `/watch/${activeHero.type}/${encodeURIComponent(activeHero.episodeId)}`
                        : `/detail/${activeHero.type}/${encodeURIComponent(activeHero.id)}`
                    }
                    state={{ backTo: '/', adUnlocked: isPremium }}
                    className="flex-1 sm:flex-none min-h-[44px] px-4 sm:px-6 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-lg shadow-[#E84A18]/35 transition-all active:scale-[0.98] whitespace-nowrap shrink-0"
                  >
                    <Play className="w-4 h-4 fill-current shrink-0" />
                    <span>Tonton Sekarang</span>
                  </Link>

                  <Link
                    to={`/detail/${activeHero.type}/${encodeURIComponent(activeHero.id)}`}
                    state={{ backTo: '/' }}
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
                    aria-label={isHeroBookmarked ? 'Hapus dari Watchlist' : 'Simpan ke Watchlist'}
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

        {/* Adsterra Banner 728x90 — Dibawah Hero Slider (Hanya untuk user gratis: !user.isPremium) */}
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
              {history.slice(0, 10).map((item, idx) => (
                <Link
                  key={`hist-${item.episodeId}-${idx}`}
                  to={`/watch/${item.type}/${encodeURIComponent(item.episodeId)}`}
                  state={{ backTo: '/', adUnlocked: isPremium }}
                  className="group relative w-56 sm:w-64 aspect-video rounded-2xl overflow-hidden bg-slate-200 dark:bg-[#16181F] border border-slate-200 dark:border-white/[0.06] shrink-0"
                >
                  <img
                    src={item.poster || heroFallbackImg}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="w-11 h-11 rounded-full bg-[#E84A18] text-white flex items-center justify-center shadow-xl">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-3 pb-3.5">
                    <p className="text-[11px] text-[#F46B3F] font-semibold">
                      Episode {item.episodeNumber}
                    </p>
                    <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                      {item.title}
                    </h3>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                    <div
                      className="h-full bg-[#E84A18]"
                      style={{ width: `${item.progress || 40}%` }}
                    />
                  </div>
                </Link>
              ))}
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
                  state={{ backTo: '/' }}
                  className="group relative flex items-end shrink-0 w-36 sm:w-44"
                >
                  <span
                    aria-hidden="true"
                    className="text-6xl sm:text-7xl font-black leading-none text-[#E84A18]/20 dark:text-transparent bg-clip-text dark:bg-gradient-to-b dark:from-white/40 dark:to-white/5 select-none -mr-4 z-10 font-mono-tabular"
                    style={{ WebkitTextStroke: '1.5px rgba(232,74,24,0.75)' }}
                  >
                    {idx + 1}
                  </span>
                  <div className="relative flex-1 aspect-[3/4] rounded-xl overflow-hidden bg-slate-200 dark:bg-[#16181F] border border-slate-200 dark:border-white/[0.06] shadow-sm dark:shadow-none">
                    <img
                      src={item.poster || heroFallbackImg}
                      alt={item.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/75 text-amber-400 text-[10px] font-bold flex items-center gap-0.5 font-mono-tabular">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      {item.rating}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-2">
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
              {displayedEpisodes.slice(0, 18).map((item, idx) => (
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
                <div key={`sched-${item.type}-${item.id}-${idx}`} className="w-32 sm:w-40 shrink-0">
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
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                Donghua Kultivasi Unggulan
              </h2>
              <Link
                to="/catalog?type=donghua"
                className="text-xs text-slate-500 dark:text-[#9CA3AF] hover:text-[#E84A18] flex items-center gap-0.5 font-medium whitespace-nowrap"
              >
                <span>Semua Donghua</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-4">
              {donghuaList.slice(0, 12).map((item, idx) => (
                <MediaCard key={`dh-${item.id}-${idx}`} item={item} />
              ))}
            </div>
          </section>
        )}

        {/* Curated Section: Anime Ongoing Terbaru */}
        {!loading && animeList.length > 0 && activeGenre === 'all' && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                Anime Ongoing Terbaru
              </h2>
              <Link
                to="/catalog?type=anime"
                className="text-xs text-slate-500 dark:text-[#9CA3AF] hover:text-[#E84A18] flex items-center gap-0.5 font-medium whitespace-nowrap"
              >
                <span>Semua Anime</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-4">
              {animeList.slice(0, 12).map((item, idx) => (
                <MediaCard key={`an-${item.id}-${idx}`} item={item} />
              ))}
            </div>
          </section>
        )}

        {/* Komunitas & Member Aktif Spotlight (Clickable ke Profil Publik & Chat WA) */}
        {communitySpotlight.length > 0 && (
          <section className="mt-9">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#E84A18]/15 text-[#E84A18] flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                    Komunitas &amp; Member Aktif
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                    Klik member untuk lihat profil publik, tambah teman, atau chat gaya WA
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/chat"
                  className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#00A884]/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-[#00A884]/25 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Chat WA</span>
                </Link>
                <Link
                  to="/community"
                  className="text-xs text-slate-500 dark:text-[#9CA3AF] hover:text-[#E84A18] flex items-center gap-0.5 font-medium whitespace-nowrap"
                >
                  <span>Cari User</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar pb-2">
              {communitySpotlight.map((member) => {
                const isF = member.role === 'founder';
                const hasVip = Boolean(member.isPremium || isF);
                const mBorder =
                  AVATAR_BORDER_STYLES[member.activeBorder || 'classic']?.ringClass ||
                  AVATAR_BORDER_STYLES.classic.ringClass;
                return (
                  <Link
                    key={member.uid}
                    to={`/u/${member.uid}`}
                    className="w-44 shrink-0 rounded-2xl bg-white dark:bg-[#13151C] border border-slate-200 dark:border-white/[0.08] hover:border-[#E84A18]/60 p-3.5 shadow-sm hover:shadow-lg transition-all flex flex-col items-center text-center group"
                  >
                    <div className="relative">
                      <img
                        src={member.photoUrl || defaultAvatarImg}
                        alt={member.name}
                        referrerPolicy="no-referrer"
                        className={`w-14 h-14 rounded-full object-cover group-hover:scale-105 transition-transform ${mBorder}`}
                      />
                      {member.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#13151C]" />
                      )}
                    </div>
                    <div className="mt-2.5 flex items-center justify-center gap-1 max-w-full">
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                        {member.name}
                      </span>
                      {hasVip && (
                        <VerifiedBadge
                          size="sm"
                          isFounder={isF}
                          badgeLabel={member.activeBadge}
                        />
                      )}
                      {hasVip && member.statusEmoji && (
                        <StatusEmojiBadge statusEmoji={member.statusEmoji} size="xs" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-gray-400 font-mono-tabular mt-0.5">
                      {isF ? 'Lv. ∞' : `Lv. ${member.level}`} · UID {member.uid}
                    </p>
                  </Link>
                );
              })}
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
                    Nonton Tanpa Iklan, 2x EXP, Lencana VIP &amp; Emoji Eksklusif
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-0.5">
                    Upgrade ke ZoneStream Premium untuk menghapus iklan 10 detik, gandakan EXP nonton harian, buka edit avatar/banner, dan kirim stiker VIP di komentar.
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

        {/* Clean Platform Footer */}
        <footer className="mt-10 pt-6 pb-4 border-t border-slate-200 dark:border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-[#7A808D]">
          <div className="flex items-center gap-2.5 text-slate-800 dark:text-gray-300 font-bold">
            <img
              src="/assets/aistudio/sara_seo_pfp_6f6b2a74.jfif"
              alt="ZoneStream Logo"
              className="w-7 h-7 rounded-lg object-cover ring-1 ring-[#E84A18]/60"
            />
            <span>ZoneStream Streaming</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/schedule" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Jadwal Rilis
            </Link>
            <Link to="/catalog" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Katalog
            </Link>
            <Link to="/library" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Watchlist
            </Link>
            <Link to="/profile" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Akun
            </Link>
            <TelegramCsButton />
          </div>
        </footer>
      </div>
    </Layout>
  );
}
