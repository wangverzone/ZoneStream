import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Clock,
  Crown,
  Flame,
  Gift,
  Heart,
  MessageCircle,
  Play,
  RefreshCw,
  Star,
  Trophy,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { MediaCard, resolveFallbackPosterUrl } from '../components/MediaCard';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { AvatarDecoration } from '../components/AvatarDecoration';
import { StatusEmojiBadge } from '../components/VipEmojis';
import { HeaderSearch } from '../components/HeaderSearch';
import { NotificationBell } from '../components/NotificationBell';
import {
  OPEN_DAILY_REWARD_EVENT,
  computeClientDailyRewardState,
} from '../components/DailyRewardModal';
import { MediaGridSkeleton } from '../components/SkeletonLoaders';
import { useAuth } from '../context/AuthContext';
import { seedCatalogIndex } from '../utils/catalogSearch';
import type { HeroSlide, MediaCardItem, ScheduleDay, WatchHistoryItem } from '../types';
import heroFallbackImg from '../assets/images/donghua_hero_fallback_1794755348232.jpg';

const GENRE_FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: 'anime', label: 'Anime' },
  { id: 'donghua', label: 'Donghua' },
  { id: 'action', label: 'Action' },
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'adventure', label: 'Adventure' },
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

function formatDotNumber(val: number): string {
  return Math.max(0, Math.floor(Number(val) || 0)).toLocaleString('id-ID');
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

  const resolved = resolveFallbackPosterUrl(src, stage, alt) || fallbackSrc;

  return (
    <img
      src={resolved}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (stage < 2) setStage((prev) => prev + 1);
      }}
      className={className}
    />
  );
}

export function HomePage() {
  const { user, isPremium, getLocalHistory, applyUserSnapshot } = useAuth();

  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [latestEpisodes, setLatestEpisodes] = useState<MediaCardItem[]>([]);
  const [donghuaList, setDonghuaList] = useState<MediaCardItem[]>([]);
  const [animeList, setAnimeList] = useState<MediaCardItem[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<MediaCardItem[]>([]);
  const [filteredEpisodes, setFilteredEpisodes] = useState<MediaCardItem[] | null>(null);
  const [activeGenre, setActiveGenre] = useState<string>('all');

  // 5-Slide Real-Time Top & Spotlight Carousel:
  // Slide 0: TOP CHARISMA (ALL / 30D / 7D)
  // Slide 1: TOP LEVEL KOMUNITAS
  // Slide 2: TOP PENONTON AKTIF
  // Slide 3: TOP CLAN KOMUNITAS
  // Slide 4: SOROTAN ANIME / DONGHUA
  const [widgetSlide, setWidgetSlide] = useState<number>(0);
  const [charismaPeriod, setCharismaPeriod] = useState<'ALL' | '30D' | '7D'>('ALL');
  const [leaderboardUsers, setLeaderboardUsers] = useState<any[]>([]);
  const [topClans, setTopClans] = useState<any[]>([]);
  const [latestGlobalMsg, setLatestGlobalMsg] = useState<any | null>(null);
  const [globalMsgCount, setGlobalMsgCount] = useState<number>(1);

  const [loading, setLoading] = useState(true);
  const [genreLoading, setGenreLoading] = useState(false);
  const [syncingFeed, setSyncingFeed] = useState(false);

  const history = getLocalHistory();

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token =
      localStorage.getItem('zonestream_session_token_v1') ||
      localStorage.getItem('donghive_session_token_v1') ||
      '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const syncRealtimeSocial = useCallback(async () => {
    try {
      const authHeaders = getAuthHeaders();
      const [lbRes, clanRes, globalRes] = await Promise.allSettled([
        fetch('/api/social/leaderboard', { headers: authHeaders }).then((r) => r.json()),
        fetch('/api/social/clans', { headers: authHeaders }).then((r) => r.json()),
        fetch('/api/social/global-messages', { headers: authHeaders }).then((r) => r.json()),
      ]);

      if (lbRes.status === 'fulfilled' && lbRes.value?.ok && Array.isArray(lbRes.value.users)) {
        setLeaderboardUsers(lbRes.value.users);
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
        const msgs = globalRes.value.messages;
        setLatestGlobalMsg(msgs[msgs.length - 1]);
        setGlobalMsgCount(Math.min(99, Math.max(1, msgs.length)));
      }
    } catch {
      // Non-fatal background poll
    }
  }, [getAuthHeaders]);

  const loadHome = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) setSyncingFeed(true);
      try {
        const homeUrl = forceRefresh ? '/api/stream/home?refresh=1' : '/api/stream/home';
        const [homeRes, schedRes] = await Promise.allSettled([
          fetch(homeUrl).then((r) => r.json()),
          fetch('/api/stream/schedule').then((r) => r.json()),
          syncRealtimeSocial(),
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
    },
    [syncRealtimeSocial]
  );

  useEffect(() => {
    void loadHome(false);
    // Lightweight polling intervals: only run when tab is visible to eliminate mobile phone lag
    const socialTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void syncRealtimeSocial();
      }
    }, 30_000);
    const streamTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadHome(false);
      }
    }, 300_000);
    const onCharismaUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ uid?: string; charisma?: number }>).detail;
      if (detail?.uid && typeof detail.charisma === 'number') {
        setLeaderboardUsers((prev) =>
          prev.map((u) => (u.uid === detail.uid ? { ...u, charisma: detail.charisma } : u))
        );
      }
      void syncRealtimeSocial();
    };
    window.addEventListener('zonestream:charisma-updated', onCharismaUpdated);
    return () => {
      clearInterval(socialTimer);
      clearInterval(streamTimer);
      window.removeEventListener('zonestream:charisma-updated', onCharismaUpdated);
    };
  }, [loadHome, syncRealtimeSocial]);

  // Keep AuthContext local user cache synced with the actual database charisma from leaderboardUsers
  useEffect(() => {
    if (!user || leaderboardUsers.length === 0) return;
    const dbSelf = leaderboardUsers.find((u) => u.uid === user.uid);
    if (!dbSelf || typeof dbSelf.charisma !== 'number') return;
    const dbCharisma = Math.max(0, Math.floor(Number(dbSelf.charisma) || 0));
    if (Number(user.charisma ?? -1) !== dbCharisma) {
      applyUserSnapshot({ ...user, charisma: dbCharisma });
    }
  }, [leaderboardUsers, user, applyUserSnapshot]);

  // Merge logged-in user's real-time avatar, border, statusEmoji & level while preserving database charisma
  const syncedUsers = useMemo(() => {
    const list = leaderboardUsers.map((u) => {
      const isFounderUser = u.role === 'founder' || u.uid === '00000';
      const rawCharisma = isFounderUser
        ? Math.max(9999, Math.floor(Number(u.charisma) || 9999))
        : Math.max(0, Math.floor(Number(u.charisma) || 0));
      if (user && u.uid === user.uid) {
        const myFounder =
          user.role === 'founder' ||
          user.uid === '00000' ||
          user.email === 'wanglin72kk@gmail.com';
        return {
          ...u,
          name: user.name || u.name,
          photoUrl: user.photoUrl || u.photoUrl,
          activeBorder: user.activeBorder || u.activeBorder || 'classic',
          profileBgColor: user.profileBgColor || u.profileBgColor || '',
          statusEmoji: user.statusEmoji || u.statusEmoji || '',
          activeBadge: user.activeBadge || u.activeBadge,
          isPremium: Boolean(user.isPremium || u.isPremium || myFounder),
          isVerified: Boolean(user.isVerified || u.isVerified || myFounder),
          level: myFounder ? 999999 : user.level || u.level || 1,
          exp: user.exp ?? u.exp ?? 0,
          // Always use the actual database count (rawCharisma) from /api/social/leaderboard
          charisma: rawCharisma,
          isOnline: true,
        };
      }
      return {
        ...u,
        charisma: rawCharisma,
      };
    });

    if (user && !list.some((u) => u.uid === user.uid)) {
      const myFounder =
        user.role === 'founder' ||
        user.uid === '00000' ||
        user.email === 'wanglin72kk@gmail.com';
      list.push({
        uid: user.uid,
        username: user.username,
        name: user.name || user.username,
        photoUrl: user.photoUrl || '',
        activeBorder: user.activeBorder || 'classic',
        profileBgColor: user.profileBgColor || '',
        statusEmoji: user.statusEmoji || '',
        activeBadge: user.activeBadge || (myFounder ? 'Verified Founder' : 'Member'),
        role: myFounder ? 'founder' : 'member',
        isPremium: Boolean(user.isPremium || myFounder),
        isVerified: Boolean(user.isVerified || myFounder),
        level: myFounder ? 999999 : user.level || 1,
        exp: user.exp || 0,
        charisma: myFounder ? Math.max(9999, Number(user.charisma || 9999)) : Number(user.charisma || 0),
        totalEpisodesWatched: user.totalEpisodesWatched || 0,
        isOnline: true,
      });
    }

    return list;
  }, [leaderboardUsers, user]);

  // Poster lookup map for Watch History items
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

  // Top 5 Charisma Users (Founder keeps 9999+, regular unliked users stay at 0)
  const topCharismaUsers = useMemo(() => {
    const sorted = [...syncedUsers].sort((a, b) => {
      const ca = Math.max(0, Math.floor(Number(a.charisma) || 0));
      const cb = Math.max(0, Math.floor(Number(b.charisma) || 0));
      if (cb !== ca) return cb - ca;
      if ((Number(b.level) || 1) !== (Number(a.level) || 1)) {
        return (Number(b.level) || 1) - (Number(a.level) || 1);
      }
      return (Number(b.exp) || 0) - (Number(a.exp) || 0);
    });
    return sorted.slice(0, 5).map((u) => ({
      ...u,
      displayCharisma: Math.max(0, Math.floor(Number(u.charisma) || 0)),
    }));
  }, [syncedUsers, charismaPeriod]);

  // Top 5 Level Users
  const topLevelUsers = useMemo(() => {
    const sorted = [...syncedUsers].sort((a, b) => {
      const la = a.role === 'founder' ? 999999 : Number(a.level) || 1;
      const lb = b.role === 'founder' ? 999999 : Number(b.level) || 1;
      if (lb !== la) return lb - la;
      return (Number(b.exp) || 0) - (Number(a.exp) || 0);
    });
    return sorted.slice(0, 5);
  }, [syncedUsers]);

  // Top 5 Watchtime Users
  const topWatchUsers = useMemo(() => {
    const sorted = [...syncedUsers].sort((a, b) => {
      const wa = Number(a.totalEpisodesWatched) || 0;
      const wb = Number(b.totalEpisodesWatched) || 0;
      if (wb !== wa) return wb - wa;
      const la = a.role === 'founder' ? 999999 : Number(a.level) || 1;
      const lb = b.role === 'founder' ? 999999 : Number(b.level) || 1;
      return lb - la;
    });
    return sorted.slice(0, 5);
  }, [syncedUsers]);

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

  // User Level & EXP progress math
  const userLevel = user?.level ?? 1;
  const isFounder =
    user?.role === 'founder' ||
    user?.uid === '00000' ||
    user?.email === 'wanglin72kk@gmail.com';
  const currentExp = user?.exp ?? 0;
  const nextLevelExp = Math.max(500, userLevel * 750);
  const expProgressPct = isFounder
    ? 100
    : Math.min(100, Math.max(6, Math.round((currentExp / nextLevelExp) * 100)));
  const hasVipBadge = Boolean(user && (user.isVerified || isPremium || isFounder));

  // Continue watching items
  const continueWatchingItems: WatchHistoryItem[] = useMemo(() => {
    if (history.length > 0) return history.slice(0, 8);
    return latestEpisodes.slice(0, 4).map((ep, idx) => ({
      id: ep.id,
      type: ep.type,
      title: ep.title,
      poster: ep.poster,
      episodeId: ep.episodeId || ep.id,
      episodeTitle: ep.episodeLabel || `Episode ${idx + 1}`,
      episodeNumber: String(Number(String(ep.episodeLabel || '').replace(/\D+/g, '')) || idx + 1),
      updatedAt: new Date().toISOString(),
      progress: idx === 0 ? 78 : idx === 1 ? 52 : 35,
    }));
  }, [history, latestEpisodes]);

  const displayedEpisodes = filteredEpisodes ?? latestEpisodes;

  // Reusable Bento Grid renderer for Top 5 Users with synced 3D AvatarDecoration frames
  const renderTop5BentoGrid = (
    items: any[],
    mode: 'charisma' | 'level' | 'watchtime',
    tabQuery: string
  ) => {
    const r1 = items[0];
    const r2 = items[1];
    const r3 = items[2];
    const r4 = items[3];
    const r5 = items[4];

    const renderMetricBadge = (u: any, compact = false) => {
      if (!u) return null;
      if (mode === 'charisma') {
        return (
          <span
            className={`inline-flex items-center gap-1 font-extrabold text-white font-mono-tabular ${
              compact ? 'text-[11px]' : 'text-xs sm:text-sm mt-1'
            }`}
          >
            <Heart
              className={`${
                compact ? 'w-3 h-3' : 'w-3.5 h-3.5'
              } text-[#FF3B5C] fill-[#FF3B5C] shrink-0`}
            />
            <span>{formatDotNumber(u.displayCharisma ?? u.charisma ?? 0)}</span>
          </span>
        );
      }
      if (mode === 'level') {
        const isF = u.role === 'founder' || u.uid === '00000';
        return (
          <span
            className={`inline-flex items-center gap-1 font-extrabold text-amber-300 font-mono-tabular ${
              compact ? 'text-[11px]' : 'text-xs sm:text-sm mt-1'
            }`}
          >
            <Zap className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} fill-current shrink-0`} />
            <span>{isF ? 'Lv. ∞' : `Lv. ${u.level || 1}`}</span>
          </span>
        );
      }
      const eps = Number(u.totalEpisodesWatched || 0);
      return (
        <span
          className={`inline-flex items-center gap-1 font-extrabold text-cyan-300 font-mono-tabular ${
            compact ? 'text-[11px]' : 'text-xs sm:text-sm mt-1'
          }`}
        >
          <Clock className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} shrink-0`} />
          <span>{eps} Ep</span>
        </span>
      );
    };

    return (
      <div className="mt-3 grid grid-cols-12 gap-2.5 items-stretch">
        {/* Rank #1 Card */}
        <Link
          to={r1?.uid ? `/user/${encodeURIComponent(r1.uid)}` : `/leaderboard${tabQuery}`}
          className="col-span-5 rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/20 p-2.5 flex flex-col items-center justify-center text-center transition-colors relative overflow-hidden"
        >
          <div className="relative my-1">
            <AvatarDecoration
              src={r1?.photoUrl}
              alt={r1?.name || 'Top 1'}
              decorationId={r1?.activeBorder}
              bgColor={r1?.profileBgColor}
              level={r1?.level}
              isFounder={r1?.role === 'founder' || r1?.uid === '00000'}
              size="lg"
            >
              {r1?.isOnline && (
                <span
                  title="Online"
                  className="absolute top-0 right-0 z-30 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#2B1220]"
                />
              )}
              <span className="absolute -bottom-1 -right-1 z-30 w-5 h-5 rounded-full bg-amber-400 text-[#1A1205] text-[11px] font-black flex items-center justify-center border border-[#2B1220] shadow">
                1
              </span>
            </AvatarDecoration>
          </div>
          <div className="flex items-center justify-center gap-1 max-w-full mt-2 px-1">
            <p className="text-xs sm:text-sm font-extrabold text-white truncate">
              {r1?.name || 'Belum Ada'}
            </p>
            {(r1?.isPremium || r1?.isVerified || r1?.role === 'founder') && (
              <VerifiedBadge
                size="sm"
                isFounder={r1?.role === 'founder'}
                badgeLabel={r1?.activeBadge}
              />
            )}
            {r1?.statusEmoji && <StatusEmojiBadge statusEmoji={r1.statusEmoji} size="xs" />}
          </div>
          {renderMetricBadge(r1, false)}
        </Link>

        {/* Right Column: Rank #2, #3 Cards + Rank #4, #5 Rows */}
        <div className="col-span-7 flex flex-col justify-between gap-2 min-w-0">
          <div className="grid grid-cols-2 gap-2">
            {/* Rank #2 */}
            <Link
              to={r2?.uid ? `/user/${encodeURIComponent(r2.uid)}` : `/leaderboard${tabQuery}`}
              className="rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/20 p-2.5 transition-colors min-w-0"
            >
              <div className="flex items-center justify-between gap-1">
                <AvatarDecoration
                  src={r2?.photoUrl}
                  alt={r2?.name || 'Top 2'}
                  decorationId={r2?.activeBorder}
                  bgColor={r2?.profileBgColor}
                  level={r2?.level}
                  isFounder={r2?.role === 'founder' || r2?.uid === '00000'}
                  size="sm"
                >
                  {r2?.isOnline && (
                    <span className="absolute -top-0.5 -right-0.5 z-30 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#2B1220]" />
                  )}
                  <span className="absolute -bottom-1 -right-1 z-30 w-4 h-4 rounded-full bg-emerald-200 text-[#111827] text-[10px] font-black flex items-center justify-center border border-[#2B1220]">
                    2
                  </span>
                </AvatarDecoration>
                {renderMetricBadge(r2, true)}
              </div>
              <div className="flex items-center gap-1 mt-2 min-w-0">
                <p className="text-[11px] sm:text-xs font-extrabold text-white truncate">
                  {r2?.name || '-'}
                </p>
                {(r2?.isPremium || r2?.isVerified || r2?.role === 'founder') && (
                  <VerifiedBadge
                    size="sm"
                    isFounder={r2?.role === 'founder'}
                    badgeLabel={r2?.activeBadge}
                  />
                )}
              </div>
            </Link>

            {/* Rank #3 */}
            <Link
              to={r3?.uid ? `/user/${encodeURIComponent(r3.uid)}` : `/leaderboard${tabQuery}`}
              className="rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/20 p-2.5 transition-colors min-w-0"
            >
              <div className="flex items-center justify-between gap-1">
                <AvatarDecoration
                  src={r3?.photoUrl}
                  alt={r3?.name || 'Top 3'}
                  decorationId={r3?.activeBorder}
                  bgColor={r3?.profileBgColor}
                  level={r3?.level}
                  isFounder={r3?.role === 'founder' || r3?.uid === '00000'}
                  size="sm"
                >
                  {r3?.isOnline && (
                    <span className="absolute -top-0.5 -right-0.5 z-30 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#2B1220]" />
                  )}
                  <span className="absolute -bottom-1 -right-1 z-30 w-4 h-4 rounded-full bg-amber-500 text-[#111827] text-[10px] font-black flex items-center justify-center border border-[#2B1220]">
                    3
                  </span>
                </AvatarDecoration>
                {renderMetricBadge(r3, true)}
              </div>
              <div className="flex items-center gap-1 mt-2 min-w-0">
                <p className="text-[11px] sm:text-xs font-extrabold text-white truncate">
                  {r3?.name || '-'}
                </p>
                {(r3?.isPremium || r3?.isVerified || r3?.role === 'founder') && (
                  <VerifiedBadge
                    size="sm"
                    isFounder={r3?.role === 'founder'}
                    badgeLabel={r3?.activeBadge}
                  />
                )}
              </div>
            </Link>
          </div>

          {/* Rank #4 & #5 Compact List Rows with Synced Decorated Avatars */}
          <div className="space-y-2 px-1 pt-0.5">
            {[
              { rank: 4, data: r4 },
              { rank: 5, data: r5 },
            ].map(({ rank, data }) => (
              <Link
                key={rank}
                to={data?.uid ? `/user/${encodeURIComponent(data.uid)}` : `/leaderboard${tabQuery}`}
                className="flex items-center justify-between gap-2 text-xs hover:opacity-95"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="w-3.5 text-[11px] font-extrabold text-pink-200/80 font-mono-tabular shrink-0">
                    {rank}
                  </span>
                  <AvatarDecoration
                    src={data?.photoUrl}
                    alt={data?.name || `Rank ${rank}`}
                    decorationId={data?.activeBorder}
                    bgColor={data?.profileBgColor}
                    level={data?.level}
                    isFounder={data?.role === 'founder' || data?.uid === '00000'}
                    size="xs"
                  >
                    {data?.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 z-30 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-[#2B1220]" />
                    )}
                  </AvatarDecoration>
                  <span className="text-xs font-bold text-white truncate">
                    {data?.name || '-'}
                  </span>
                  {(data?.isPremium || data?.isVerified || data?.role === 'founder') && (
                    <VerifiedBadge
                      size="sm"
                      isFounder={data?.role === 'founder'}
                      badgeLabel={data?.activeBadge}
                    />
                  )}
                </div>
                {renderMetricBadge(data, true)}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="px-3.5 sm:px-6 lg:px-8 pt-3 sm:pt-5 max-w-5xl mx-auto">
        {/* 1. TOP USER PROFILE & EXP CARD (Synced 3D Avatar & Real-Time Status) */}
        <section
          aria-label="Profil & Progres EXP"
          className="rounded-[22px] bg-[#181A20] border border-white/[0.08] p-3.5 sm:p-4 shadow-lg"
        >
          <div className="flex items-center justify-between gap-3">
            <Link to="/profile" className="flex items-center gap-3.5 min-w-0 flex-1 group">
              <AvatarDecoration
                src={user?.photoUrl}
                alt={user?.name || 'ZoneStream'}
                decorationId={user?.activeBorder}
                bgColor={user?.profileBgColor}
                level={user?.level}
                isFounder={isFounder}
                size="md"
              >
                {user && (
                  <span
                    title="Online"
                    className="absolute bottom-0 right-0 z-30 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#181A20]"
                  />
                )}
              </AvatarDecoration>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h1 className="text-[15px] sm:text-base font-extrabold text-white truncate">
                    {user?.name || 'Masuk Akun'}
                  </h1>
                  {hasVipBadge && (
                    <VerifiedBadge
                      size="sm"
                      isFounder={isFounder}
                      badgeLabel={user?.activeBadge}
                    />
                  )}
                  {user?.statusEmoji && (
                    <StatusEmojiBadge statusEmoji={user.statusEmoji} size="xs" />
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#242731] border border-white/[0.06] text-[11px] font-extrabold text-gray-200">
                    <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span>Lvl. {isFounder ? '∞' : userLevel}</span>
                  </div>
                  {user && (() => {
                    const dr = computeClientDailyRewardState(user, Date.now());
                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          window.dispatchEvent(new CustomEvent(OPEN_DAILY_REWARD_EVENT));
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold transition-all ${
                          dr.canClaim
                            ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-sm animate-pulse'
                            : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                        }`}
                      >
                        {dr.canClaim ? (
                          <>
                            <Gift className="w-3 h-3" />
                            <span>Klaim Hadiah 24j!</span>
                          </>
                        ) : (
                          <>
                            <Flame className="w-3 h-3 text-orange-400 fill-orange-400" />
                            <span>Streak {dr.activeStreak} Hari</span>
                          </>
                        )}
                      </button>
                    );
                  })()}
                </div>
              </div>
            </Link>

            <NotificationBell compact />
          </div>

          {/* EXP Progress Row */}
          <div className="mt-3.5 flex items-center gap-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#9CA3AF] shrink-0">
              EXP
            </span>
            <div className="flex-1 h-2 rounded-full bg-[#252833] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#E5E7EB] transition-all duration-500"
                style={{ width: `${expProgressPct}%` }}
              />
            </div>
            <span className="text-[11px] font-extrabold text-gray-200 font-mono-tabular shrink-0">
              {isFounder
                ? `${formatDotNumber(currentExp)} / MAX`
                : `${formatDotNumber(currentExp)} / ${formatDotNumber(nextLevelExp)}`}
            </span>
          </div>
        </section>

        {/* 2. FULL-WIDTH SEARCH BAR (Clean without Minigame button) */}
        <section className="mt-3">
          <HeaderSearch
            className="w-full"
            placeholder="Cari Anime Di Sini"
            dropdownClassName="left-0 right-0"
          />
        </section>



        {/* 3. FEATURED 5-SLIDE REAL-TIME TOP RANKING & SPOTLIGHT CAROUSEL */}
        <section aria-label="Peringkat & Sorotan Real-Time" className="mt-3.5">
          {widgetSlide === 0 && (
            <div className="rounded-[24px] bg-gradient-to-br from-[#611F3A] via-[#3E1629] to-[#23101B] border border-pink-300/25 p-3.5 sm:p-4 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <Link
                  to="/leaderboard"
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold tracking-wider text-pink-100 uppercase hover:text-white"
                >
                  <Heart className="w-4 h-4 text-[#FF6B8B] fill-[#FF6B8B]" />
                  <span>TOP CHARISMA</span>
                  <ChevronRight className="w-4 h-4 text-pink-200/80" />
                </Link>

                <div className="inline-flex items-center gap-1 bg-black/25 p-0.5 rounded-full border border-white/10">
                  {(['ALL', '30D', '7D'] as const).map((period) => {
                    const active = charismaPeriod === period;
                    return (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setCharismaPeriod(period)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold transition-colors ${
                          active
                            ? 'bg-[#FF7597] text-[#220D17] shadow-sm'
                            : 'text-pink-100/80 hover:text-white'
                        }`}
                      >
                        {period}
                      </button>
                    );
                  })}
                </div>
              </div>

              {renderTop5BentoGrid(topCharismaUsers, 'charisma', '')}
            </div>
          )}

          {widgetSlide === 1 && (
            <div className="rounded-[24px] bg-gradient-to-br from-[#4A2511] via-[#2F180D] to-[#1A100B] border border-amber-400/25 p-3.5 sm:p-4 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <Link
                  to="/leaderboard?tab=levels"
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold tracking-wider text-amber-200 uppercase hover:text-white"
                >
                  <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span>TOP LEVEL KOMUNITAS</span>
                  <ChevronRight className="w-4 h-4 text-amber-200/80" />
                </Link>
                <Link
                  to="/leaderboard?tab=levels"
                  className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-extrabold"
                >
                  Real-Time
                </Link>
              </div>

              {renderTop5BentoGrid(topLevelUsers, 'level', '?tab=levels')}
            </div>
          )}

          {widgetSlide === 2 && (
            <div className="rounded-[24px] bg-gradient-to-br from-[#13334C] via-[#0F2336] to-[#0B1622] border border-cyan-400/25 p-3.5 sm:p-4 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <Link
                  to="/leaderboard?tab=watchtime"
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold tracking-wider text-cyan-200 uppercase hover:text-white"
                >
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>TOP PENONTON AKTIF</span>
                  <ChevronRight className="w-4 h-4 text-cyan-200/80" />
                </Link>
                <Link
                  to="/leaderboard?tab=watchtime"
                  className="px-2.5 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 text-[11px] font-extrabold"
                >
                  Lihat Semua
                </Link>
              </div>

              {renderTop5BentoGrid(topWatchUsers, 'watchtime', '?tab=watchtime')}
            </div>
          )}

          {widgetSlide === 3 && (
            <div className="rounded-[24px] bg-gradient-to-br from-[#2E1E4F] via-[#1E1636] to-[#131022] border border-amber-400/25 p-3.5 sm:p-4 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between gap-2 mb-3">
                <Link
                  to="/leaderboard?tab=clans"
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold tracking-wider text-amber-300 uppercase hover:text-white"
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>TOP CLAN KOMUNITAS</span>
                  <ChevronRight className="w-4 h-4 text-amber-200/80" />
                </Link>
                <Link
                  to="/leaderboard?tab=clans"
                  className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-extrabold"
                >
                  Semua Klan
                </Link>
              </div>

              {topClans.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-300">
                  Belum ada klan aktif. Ketuk untuk membuat atau bergabung ke klan!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {topClans.slice(0, 3).map((clan, idx) => {
                    const leaderUser = syncedUsers.find((u) => u.uid === clan.leaderUid);
                    return (
                      <Link
                        key={clan.clanId || idx}
                        to="/leaderboard?tab=clans"
                        className="rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/15 p-3 flex items-center gap-3 transition-colors"
                      >
                        <AvatarDecoration
                          src={clan.avatarUrl || clan.leaderPhoto || leaderUser?.photoUrl}
                          alt={clan.name}
                          decorationId={leaderUser?.activeBorder || 'dragon-crown'}
                          level={leaderUser?.level || clan.level || 1}
                          isFounder={leaderUser?.role === 'founder'}
                          size="sm"
                        >
                          <span className="absolute -bottom-1 -right-1 z-30 w-4 h-4 rounded-full bg-amber-400 text-black text-[10px] font-black flex items-center justify-center">
                            {idx + 1}
                          </span>
                        </AvatarDecoration>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-extrabold text-white truncate">
                            [{clan.tag}] {clan.name}
                          </p>
                          <p className="text-[11px] font-bold text-amber-300 mt-0.5">
                            Lv.{clan.level || 1} · ♥ {formatDotNumber(clan.charisma || 0)}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {widgetSlide === 4 && (
            (() => {
              const slideItem = heroSlides[0] || latestEpisodes[0];
              if (!slideItem) {
                return (
                  <div className="h-[196px] rounded-[24px] bg-[#181A20] border border-white/[0.08] flex items-center justify-center text-xs text-gray-400">
                    Memuat sorotan anime...
                  </div>
                );
              }
              return (
                <Link
                  to={`/detail/${slideItem.type}/${encodeURIComponent(slideItem.id)}`}
                  className="block relative h-[196px] sm:h-[220px] rounded-[24px] overflow-hidden bg-[#181A20] border border-white/15 shadow-xl group"
                >
                  <ResilientPosterImage
                    src={(slideItem as HeroSlide).backdrop || slideItem.poster}
                    alt={slideItem.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/15" />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-[#2E90FA] text-white text-[11px] font-extrabold">
                      Sorotan Utama
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-black/65 text-amber-400 text-[11px] font-extrabold inline-flex items-center gap-1 font-mono-tabular">
                      <Star className="w-3 h-3 fill-current" />
                      {slideItem.rating || '8.5'}
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-sky-300 uppercase">
                        {slideItem.type === 'donghua' ? 'Donghua' : 'Anime'} ·{' '}
                        {slideItem.episodeLabel || 'Episode Baru'}
                      </p>
                      <h3 className="text-sm sm:text-base font-extrabold text-white truncate mt-0.5">
                        {slideItem.title}
                      </h3>
                    </div>
                    <span className="px-3.5 py-2 rounded-xl bg-[#2E90FA] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0">
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Tonton</span>
                    </span>
                  </div>
                </Link>
              );
            })()
          )}

          {/* 5 Carousel Pagination Dots */}
          <div className="flex items-center justify-center gap-2 mt-2.5">
            {[0, 1, 2, 3, 4].map((idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setWidgetSlide(idx)}
                aria-label={`Slide ${idx + 1}`}
                className={`w-2 h-2 rounded-full transition-all ${
                  widgetSlide === idx ? 'bg-[#2E90FA] scale-110' : 'bg-[#4B5563]/60 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        </section>

        {/* 4. SLEEK SINGLE-ROW PREMIUM BANNER */}
        <Link
          to="/profile"
          className="mt-3 rounded-2xl bg-gradient-to-r from-[#162032] via-[#1B2B44] to-[#1F3454] border border-sky-400/20 p-2.5 sm:p-3 flex items-center justify-between gap-3 shadow-md hover:border-sky-400/40 transition-all"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="px-3 py-1.5 rounded-xl bg-[#2E90FA] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 shadow">
              <Crown className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span>Premium</span>
            </span>
            <span className="text-xs sm:text-sm font-semibold text-gray-100 truncate">
              {isPremium
                ? 'Status VIP Aktif — Bebas iklan & 2x EXP'
                : 'Mulai Rp12.000, tanpa iklan'}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
        </Link>

        {/* 5. TERAKHIR DITONTON */}
        <section className="mt-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-base sm:text-lg font-extrabold text-white">
              Terakhir Ditonton
            </h2>
            <Link
              to="/library?tab=history"
              className="px-3.5 py-1.5 rounded-full bg-[#181A20] hover:bg-[#22252F] border border-white/[0.09] text-xs font-semibold text-gray-300 inline-flex items-center gap-1 transition-colors shrink-0"
            >
              <span>Lihat Lainnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {continueWatchingItems.map((item, idx) => {
              const resolvedPoster = resolveHistoryItemPoster(item);
              const targetUrl = item.episodeId
                ? `/watch/${item.type}/${encodeURIComponent(item.episodeId)}`
                : `/detail/${item.type}/${encodeURIComponent(item.id)}`;
              return (
                <Link
                  key={`cw-${item.id}-${idx}`}
                  to={targetUrl}
                  state={{
                    backTo: '/',
                    adUnlocked: isPremium,
                    poster: resolvedPoster,
                    seriesTitle: item.title,
                  }}
                  className="group w-36 sm:w-44 shrink-0 block"
                >
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-[#181A20] border border-white/[0.08]">
                    <ResilientPosterImage
                      src={resolvedPoster}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                    <span className="absolute bottom-2 left-2.5 text-xs font-extrabold text-white drop-shadow">
                      Eps {item.episodeNumber || 1}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/20">
                      <div
                        className="h-full bg-rose-600"
                        style={{ width: `${item.progress || 65}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs font-medium text-gray-300 truncate mt-1.5 group-hover:text-white transition-colors">
                    {item.title}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 6. COMPACT SINGLE-LINE GLOBAL CHAT BAR (Synced Sender Avatar & Border) */}
        <Link
          to={user ? '/chat?global=1' : '/profile'}
          className="mt-4 rounded-2xl bg-[#181A20] hover:bg-[#1E2129] border border-white/[0.08] p-2.5 flex items-center justify-between gap-2.5 transition-colors"
        >
          <span className="px-2.5 py-1 rounded-xl bg-[#1E293B] text-sky-400 text-xs font-bold inline-flex items-center gap-1.5 shrink-0">
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Global</span>
          </span>

          <div className="flex items-center gap-2 min-w-0 flex-1">
            {(() => {
              const senderUser = syncedUsers.find((u) => u.uid === latestGlobalMsg?.senderUid);
              return (
                <AvatarDecoration
                  src={latestGlobalMsg?.senderPhoto || senderUser?.photoUrl}
                  alt={latestGlobalMsg?.senderName || 'Global'}
                  decorationId={latestGlobalMsg?.senderBorder || senderUser?.activeBorder}
                  level={latestGlobalMsg?.senderLevel || senderUser?.level || 1}
                  isFounder={
                    latestGlobalMsg?.senderRole === 'founder' || senderUser?.role === 'founder'
                  }
                  size="xs"
                />
              );
            })()}
            <p className="text-xs text-gray-200 truncate">
              <strong className="font-bold text-white">
                {latestGlobalMsg?.senderName || 'Komunitas ZoneStream'}:
              </strong>{' '}
              <span>
                {latestGlobalMsg?.text || 'Ngobrol & mabar bareng member lainnya di sini...'}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center font-mono-tabular">
              {globalMsgCount}
            </span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
        </Link>

        {/* 7. NEW UPDATE ANIME & DONGHUA */}
        <section className="mt-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-white truncate">
                New Update Anime
              </h2>
              <button
                type="button"
                onClick={() => void loadHome(true)}
                title="Perbarui Episode"
                className="w-7 h-7 rounded-full bg-[#181A20] hover:bg-[#22252F] border border-white/[0.08] text-gray-300 flex items-center justify-center shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingFeed ? 'animate-spin text-[#2E90FA]' : ''}`} />
              </button>
            </div>
            <Link
              to="/schedule"
              className="px-3.5 py-1.5 rounded-full bg-[#181A20] hover:bg-[#22252F] border border-white/[0.09] text-xs font-semibold text-gray-300 inline-flex items-center gap-1 transition-colors shrink-0"
            >
              <span>Lihat Jadwal</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Clean Compact Genre Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3">
            {GENRE_FILTERS.map((g) => {
              const selected = activeGenre === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => void handleGenreSelect(g.id)}
                  className={`h-8 px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                    selected
                      ? 'bg-[#2E90FA] text-white shadow-sm'
                      : 'bg-[#181A20] hover:bg-[#22252F] text-gray-300 border border-white/[0.08]'
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>

          {loading || genreLoading ? (
            <MediaGridSkeleton count={12} label="Memuat update terbaru..." />
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
              {displayedEpisodes.slice(0, 24).map((item, idx) => (
                <MediaCard key={`latest-${item.type}-${item.id}-${idx}`} item={item} />
              ))}
            </div>
          )}
        </section>

        {/* 8. DONGHUA & ANIME POPULER SECTION */}
        {!loading && donghuaList.length > 0 && activeGenre === 'all' && (
          <section className="mt-7">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                Donghua Populer
              </h2>
              <Link
                to="/catalog?type=donghua"
                className="px-3.5 py-1.5 rounded-full bg-[#181A20] hover:bg-[#22252F] border border-white/[0.09] text-xs font-semibold text-gray-300 inline-flex items-center gap-1 transition-colors shrink-0"
              >
                <span>Lihat Lainnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
              {donghuaList.slice(0, 12).map((item, idx) => (
                <MediaCard key={`dh-${item.id}-${idx}`} item={item} />
              ))}
            </div>
          </section>
        )}

        {!loading && animeList.length > 0 && activeGenre === 'all' && (
          <section className="mt-7 mb-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                Koleksi Anime Pilihan
              </h2>
              <Link
                to="/catalog?type=anime"
                className="px-3.5 py-1.5 rounded-full bg-[#181A20] hover:bg-[#22252F] border border-white/[0.09] text-xs font-semibold text-gray-300 inline-flex items-center gap-1 transition-colors shrink-0"
              >
                <span>Lihat Lainnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
              {animeList.slice(0, 12).map((item, idx) => (
                <MediaCard key={`an-${item.id}-${idx}`} item={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
