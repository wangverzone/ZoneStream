import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Crown,
  ExternalLink,
  Film,
  Flame,
  Globe,
  RefreshCw,
  Server,
  Sparkles,
  Subtitles,
  Timer,
  Radio,
} from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { WatchPartySidebar } from '../components/WatchPartySidebar';
import { AdsterraBanner300x250 } from '../components/AdsterraAds';
import { WatchAdsModal } from '../components/WatchAdsModal';
import { CommentSection } from '../components/CommentSection';
import { CountryFlagBadge } from '../components/CountryFlag';
import { useAuth } from '../context/AuthContext';
import {
  APP_LANGUAGES,
  UI_TRANSLATIONS,
  buildWebVttDataUrl,
  useAppLanguage,
} from '../utils/language';
import type { EpisodeStreamData, StreamServer, WatchHistoryReward } from '../types';

const MIDROLL_INTERVAL_SECONDS = 120; // Iklan muncul setiap 2 menit untuk user gratis

function isFrameBlockedHost(url?: string): boolean {
  const u = String(url || '').toLowerCase();
  return (
    u.includes('desustream.net') ||
    u.includes('desustream.com') ||
    u.includes('desustream.info') ||
    u.includes('ondesuhd') ||
    u.includes('odcdn')
  );
}

function isDirectVideoFile(url?: string, streamType?: string): boolean {
  if (streamType === 'mp4' || streamType === 'hls') return true;
  const u = String(url || '').toLowerCase();
  return (
    /\.mp4(\?|$)/i.test(u) ||
    /\.m3u8(\?|$)/i.test(u) ||
    u.includes('googlevideo.com/videoplayback') ||
    u.includes('pixeldrain.com/api/file/')
  );
}

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  const s = Math.max(0, totalSeconds) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function WatchPage() {
  const { type = 'donghua', episodeId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isPremium,
    loading: authLoading,
    recordWatchHistory,
    recordWatchDuration,
    toggleEpisodeBookmark,
    getLocalEpisodeBookmarks,
  } = useAuth();
  const { lang, subLang, changeSubtitle } = useAppLanguage();
  const t = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.id;

  const episodeBookmarks = getLocalEpisodeBookmarks();
  const isEpisodeBookmarked = episodeBookmarks.some((b) => b.episodeId === episodeId);

  const handleToggleEpisodeBookmark = async () => {
    const seriesTitle = stream?.seriesTitle || navState?.seriesTitle || stream?.title || 'Video';
    const seriesId = stream?.seriesId || episodeId;
    const posterUrl = stream?.poster || navState?.poster || '';
    const epNumber = stream?.episodeNumber || '1';

    await toggleEpisodeBookmark({
      id: seriesId,
      type: type === 'donghua' ? 'donghua' : 'anime',
      title: seriesTitle,
      poster: posterUrl,
      episodeId: episodeId,
      episodeTitle: stream?.title || `Episode ${epNumber}`,
      episodeNumber: String(epNumber),
    });
  };

  const navState =
    (location.state as {
      adUnlocked?: boolean;
      backTo?: string;
      poster?: string;
      seriesTitle?: string;
    } | null) || null;
  const alreadyUnlockedByNav = Boolean(navState?.adUnlocked);
  const safeBackTo =
    navState?.backTo && !navState.backTo.startsWith('/watch') ? navState.backTo : '/';

  const [stream, setStream] = useState<EpisodeStreamData | null>(null);
  const [activeUrl, setActiveUrl] = useState('');
  const [activeStreamType, setActiveStreamType] = useState<'mp4' | 'hls' | 'embed'>('embed');
  const [activeServerName, setActiveServerName] = useState('');
  const [switchingMirror, setSwitchingMirror] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adUnlocked, setAdUnlocked] = useState(isPremium || alreadyUnlockedByNav);
  const [nextAdSeconds, setNextAdSeconds] = useState(MIDROLL_INTERVAL_SECONDS);
  const [reward, setReward] = useState<WatchHistoryReward | null>(null);
  const [showWatchParty, setShowWatchParty] = useState(false);

  useEffect(() => {
    if (isPremium) {
      setAdUnlocked(true);
    } else if (!alreadyUnlockedByNav) {
      setAdUnlocked(false);
    }
    setNextAdSeconds(MIDROLL_INTERVAL_SECONDS);
  }, [isPremium, episodeId, alreadyUnlockedByNav]);

  // Periodic 2-minute mid-roll Watch Ads timer strictly for non-VIP users
  useEffect(() => {
    if (authLoading || isPremium || !adUnlocked || loading) return;
    const timer = setInterval(() => {
      setNextAdSeconds((prev) => {
        if (prev <= 1) {
          setAdUnlocked(false);
          return MIDROLL_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [authLoading, isPremium, adUnlocked, loading]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/stream/episode/${type}/${encodeURIComponent(episodeId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!active) return;
        if (json.ok && json.episode) {
          const ep: EpisodeStreamData = json.episode;
          if (!ep.poster && navState?.poster) {
            ep.poster = navState.poster;
          }
          if (!ep.seriesTitle && navState?.seriesTitle) {
            ep.seriesTitle = navState.seriesTitle;
          }
          setStream(ep);

          // Prioritize direct MP4/HLS server first, then first clean embed server
          const directSrv = ep.servers?.find(
            (s) => s.url && !isFrameBlockedHost(s.url) && isDirectVideoFile(s.url, s.streamType)
          );
          const safeEmbedSrv = ep.servers?.find((s) => s.url && !isFrameBlockedHost(s.url));
          const chosenSrv = directSrv || safeEmbedSrv;
          const candidateUrl =
            chosenSrv?.url ||
            (ep.defaultStreamingUrl && !isFrameBlockedHost(ep.defaultStreamingUrl)
              ? ep.defaultStreamingUrl
              : ep.servers?.[0]?.url || '');

          setActiveUrl(candidateUrl);
          setActiveStreamType(
            isDirectVideoFile(candidateUrl, chosenSrv?.streamType) ? 'mp4' : 'embed'
          );
          setActiveServerName(chosenSrv?.name || ep.servers?.[0]?.name || 'Server Utama HD');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [type, episodeId]);

  useEffect(() => {
    if (!adUnlocked || !stream) return;
    const finalPoster = stream.poster || navState?.poster || '';
    const finalSeriesTitle = stream.seriesTitle || navState?.seriesTitle || stream.title;
    recordWatchHistory({
      id: stream.seriesId || episodeId,
      type: stream.type,
      title: finalSeriesTitle,
      poster: finalPoster,
      episodeId: stream.episodeId,
      episodeTitle: stream.title,
      episodeNumber: stream.episodeNumber || '1',
      progress: 45,
    }).then((res) => {
      if (res.expGained > 0) setReward(res);
    });

    const durationInterval = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void recordWatchDuration(1, { title: finalSeriesTitle }).then((durRes) => {
        if (durRes.expGained > 0) {
          setReward((prev) => ({
            expGained: (prev?.expGained || 0) + durRes.expGained,
            dailyBonusGained: prev?.dailyBonusGained || 0,
            streak: durRes.streak || prev?.streak || 1,
            longestStreak: prev?.longestStreak,
            levelUp: Boolean(prev?.levelUp || durRes.levelUp),
            newLevel: durRes.newLevel || prev?.newLevel || 1,
            isDoubleExp: Boolean(prev?.isDoubleExp || durRes.isDoubleExp),
            newlyUnlockedFrame: prev?.newlyUnlockedFrame || null,
          }));
        }
      });
    }, 60_000);

    return () => {
      window.clearInterval(durationInterval);
    };
  }, [adUnlocked, stream?.episodeId]);

  const handleBack = () => {
    if (stream?.seriesId) {
      navigate(
        `/detail/${type}/${encodeURIComponent(stream.seriesId)}?ep=${encodeURIComponent(
          episodeId
        )}`,
        {
          replace: true,
          state: {
            backTo: safeBackTo,
            poster: stream.poster || navState?.poster || '',
            seriesTitle: stream.seriesTitle || navState?.seriesTitle || '',
          },
        }
      );
    } else {
      navigate(safeBackTo, { replace: true });
    }
  };

  const handleSwitchEpisode = (targetEpisodeId: string) => {
    navigate(`/watch/${type}/${encodeURIComponent(targetEpisodeId)}`, {
      replace: true,
      state: {
        adUnlocked: isPremium,
        backTo: safeBackTo,
        poster: stream?.poster || navState?.poster || '',
        seriesTitle: stream?.seriesTitle || navState?.seriesTitle || '',
      },
    });
  };

  const handleSelectServer = async (srv: StreamServer) => {
    setActiveServerName(srv.name);
    if (srv.url) {
      setActiveUrl(srv.url);
      setActiveStreamType(isDirectVideoFile(srv.url, srv.streamType) ? 'mp4' : 'embed');
      return;
    }
    if (srv.serverId) {
      setSwitchingMirror(true);
      try {
        const res = await fetch(`/api/stream/server/${encodeURIComponent(srv.serverId)}`);
        const json = await res.json();
        if (json.ok && json.url) {
          setActiveUrl(json.url);
          setActiveStreamType(
            isDirectVideoFile(json.url, json.streamType) ? 'mp4' : 'embed'
          );
        }
      } catch {
        // Keep current url
      } finally {
        setSwitchingMirror(false);
      }
    }
  };

  const handleCycleMirror = async () => {
    if (!stream?.servers?.length) return;
    const currentIdx = stream.servers.findIndex((s) => s.name === activeServerName);
    const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % stream.servers.length : 0;
    await handleSelectServer(stream.servers[nextIdx]);
  };

  const isCurrentBlockedInIframe = Boolean(activeUrl && isFrameBlockedHost(activeUrl));
  const useNativeVideoTag = Boolean(activeUrl && isDirectVideoFile(activeUrl, activeStreamType));
  const activeSubObj = APP_LANGUAGES.find((l) => l.code === subLang);

  return (
    <Layout hideBottomNav>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-10">
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="min-h-[40px] px-3 rounded-xl bg-white hover:bg-slate-100 dark:bg-[#15171F] dark:hover:bg-[#1E212B] text-slate-900 dark:text-white text-xs font-semibold flex items-center gap-2 border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-none"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.backToDetail}</span>
            </button>
            <button
              type="button"
              onClick={handleToggleEpisodeBookmark}
              title={isEpisodeBookmarked ? 'Hapus dari Watch Later' : 'Simpan ke Watch Later'}
              className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                isEpisodeBookmarked
                  ? 'bg-[#E84A18] text-white border-[#E84A18]'
                  : 'bg-white hover:bg-slate-100 dark:bg-[#15171F] dark:hover:bg-[#1E212B] text-slate-700 dark:text-gray-200 border-slate-200 dark:border-white/5'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isEpisodeBookmarked ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline">
                {isEpisodeBookmarked ? 'Tersimpan' : 'Watch Later'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowWatchParty((s) => !s)}
              title="Watch Party (Nobar Bersama)"
              className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                showWatchParty
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-white hover:bg-slate-100 dark:bg-[#15171F] dark:hover:bg-[#1E212B] text-slate-700 dark:text-gray-200 border-slate-200 dark:border-white/5'
              }`}
            >
              <Radio className={`w-4 h-4 ${showWatchParty ? 'animate-pulse text-white' : 'text-emerald-500'}`} />
              <span className="hidden sm:inline">Watch Party</span>
            </button>
          </div>

          {isPremium ? (
            <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" />
              <span>{t.adFreeVip}</span>
            </span>
          ) : (
            <div className="flex items-center gap-2">
              {adUnlocked && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#15171F] border border-slate-200 dark:border-white/5 text-[11px] font-mono-tabular text-slate-600 dark:text-gray-300">
                  <Timer className="w-3.5 h-3.5 text-[#E84A18]" />
                  <span>Iklan: {formatCountdown(nextAdSeconds)}</span>
                </span>
              )}
              <Link
                to="/profile"
                className="px-3 py-1.5 rounded-xl bg-[#E84A18]/15 hover:bg-[#E84A18]/25 text-[#E84A18] text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>{t.removeAds}</span>
              </Link>
            </div>
          )}
        </div>

        {/* Daily EXP & Streak Reward Notification */}
        {reward && reward.expGained > 0 && (
          <div className="mb-3 px-4 py-2.5 rounded-xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-semibold flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
              <span>
                <strong>+{reward.expGained} EXP</strong> ditambahkan!
                {reward.dailyBonusGained > 0
                  ? ` (Termasuk Bonus Nonton Harian +${reward.dailyBonusGained} EXP)`
                  : ''}
                {reward.levelUp
                  ? ` · NAIK LEVEL ke Lv.${reward.newLevel >= 999999 ? '∞' : reward.newLevel}!`
                  : ''}
              </span>
              {reward.isDoubleExp && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px] font-extrabold">
                  2x VIP EXP
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {reward.newlyUnlockedFrame && (
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/35 text-emerald-600 dark:text-emerald-300 font-extrabold hover:underline"
                >
                  <span>Frame Baru: {reward.newlyUnlockedFrame.name}</span>
                </Link>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold font-mono-tabular">
                <Flame className="w-3.5 h-3.5" />
                Streak {reward.streak} Hari
              </span>
            </div>
          </div>
        )}

        {/* Dual-Engine Video Player Container */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`${showWatchParty ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-4`}>
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-slate-200 dark:border-white/10 shadow-2xl">
              {loading || switchingMirror ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-xs text-gray-300">
                  <RefreshCw className="w-6 h-6 text-[#E84A18] animate-spin" />
                  <span>
                    {switchingMirror
                      ? 'Mengalihkan ke server cadangan...'
                      : 'Menyiapkan video player HD...'}
                  </span>
                </div>
              ) : !authLoading && !adUnlocked && !isPremium ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#12141A]">
                  <p className="text-sm font-bold text-white mb-2">
                    Selesaikan Watch Ads 10 Detik untuk Melanjutkan Video
                  </p>
                  <button
                    type="button"
                    onClick={() => setAdUnlocked(false)}
                    className="px-4 py-2 rounded-xl bg-[#E84A18] text-white text-xs font-bold"
                  >
                    Tonton Iklan (10s)
                  </button>
                </div>
              ) : isCurrentBlockedInIframe ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center bg-[#111319]">
                  <p className="text-xs sm:text-sm text-gray-200 font-semibold max-w-md">
                    Server ini dibatasi oleh sandbox browser. Klik tombol di bawah untuk memutar dengan Server Cadangan HD atau pindah server:
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4');
                        setActiveStreamType('mp4');
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-lg shadow-emerald-600/30"
                    >
                      <span>Putar Server Cadangan HD</span>
                    </button>
                    {stream && stream.servers.length > 1 && (
                      <button
                        type="button"
                        onClick={handleCycleMirror}
                        className="px-4 py-2 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Pindah Server Lain</span>
                      </button>
                    )}
                    <a
                      href={activeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka di Tab Baru</span>
                    </a>
                  </div>
                </div>
              ) : activeUrl && useNativeVideoTag ? (
                <video
                  key={`${activeUrl}-${subLang}`}
                  src={activeUrl}
                  controls
                  playsInline
                  autoPlay
                  onError={handleCycleMirror}
                  className="w-full h-full object-contain bg-black"
                >
                  {subLang !== 'off' &&
                    APP_LANGUAGES.map((l) => (
                      <track
                        key={l.code}
                        kind="subtitles"
                        srcLang={l.code}
                        label={l.subLabel}
                        default={subLang === l.code}
                        src={buildWebVttDataUrl(
                          l.code,
                          stream?.seriesTitle || stream?.title || 'ZoneStream',
                          stream?.episodeNumber || '1'
                        )}
                      />
                    ))}
                </video>
              ) : activeUrl ? (
                <iframe
                  key={activeUrl}
                  src={activeUrl}
                  title={stream?.title || 'ZoneStream Player'}
                  allowFullScreen
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-xs text-gray-400 p-4 text-center">
                  <p>
                    Server utama sedang sibuk. Silakan klik tombol di bawah untuk beralih ke mirror cadangan:
                  </p>
                  {stream && stream.servers.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCycleMirror}
                      className="px-4 py-2 rounded-xl bg-[#E84A18] text-white font-bold inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Coba Mirror Cadangan</span>
                    </button>
                  )}
                </div>
              )}

              {/* Active Subtitle Badge Indicator in Top-Left of Video */}
              {adUnlocked && !loading && activeSubObj && (
                <div className="absolute top-3 left-3 z-10 pointer-events-none px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/15 text-[11px] font-bold text-white flex items-center gap-1.5 shadow-lg">
                  <CountryFlagBadge countryCode={activeSubObj.countryCode} size="xs" />
                  <span>{activeSubObj.subLabel} Aktif</span>
                </div>
              )}
            </div>

            {/* Quick Mirror, Server Status & 4-Language Subtitle Switcher Bar */}
            {adUnlocked && !loading && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/[0.07] text-xs shadow-sm">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-gray-200 font-semibold">
                    <Film className="w-4 h-4 text-[#E84A18]" />
                    <span>
                      Server Aktif: <strong className="text-[#E84A18]">{activeServerName}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                      {useNativeVideoTag ? 'Direct MP4/HLS Anti-Error' : 'Official Embed HD'}
                    </span>
                  </div>
                  <div className="flex items-center flex-wrap gap-2">
                    {stream && stream.servers.length > 1 && (
                      <button
                        type="button"
                        disabled={switchingMirror}
                        onClick={handleCycleMirror}
                        className="px-3 py-1.5 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white font-bold inline-flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${switchingMirror ? 'animate-spin' : ''}`}
                        />
                        <span>Ganti Server Jika Video Macet</span>
                      </button>
                    )}
                    {activeUrl && (
                      <a
                        href={activeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1B1E26] dark:hover:bg-[#232732] text-slate-700 dark:text-gray-200 font-semibold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Player Eksternal</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* 4-Language Subtitle Selector Bar (Sub Indo, Sub English, Sub Jepang, Sub Mandarin) */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/[0.07] text-xs shadow-sm">
                  <div className="flex items-center gap-2 text-slate-800 dark:text-gray-200 font-bold">
                    <Subtitles className="w-4 h-4 text-[#E84A18]" />
                    <span>{t.subtitleLabel}:</span>
                  </div>
                  <div className="flex items-center flex-wrap gap-1.5">
                    {APP_LANGUAGES.map((l) => {
                      const active = subLang === l.code;
                      return (
                        <button
                          key={l.code}
                          type="button"
                          onClick={() => changeSubtitle(l.code)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 transition-all ${
                            active
                              ? 'bg-[#E84A18] text-white shadow-sm shadow-[#E84A18]/30'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#1B1E26] dark:hover:bg-[#242834] dark:text-gray-300'
                          }`}
                        >
                          <CountryFlagBadge countryCode={l.countryCode} size="xs" />
                          <span>{l.subLabel}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => changeSubtitle('off')}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 transition-all ${
                        subLang === 'off'
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-[#1B1E26] dark:text-gray-400'
                      }`}
                    >
                      <Globe className="w-3 h-3" />
                      <span>{t.subOff}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Series Avatar, Title & Episode Info + Action Row (Matching Reference Screenshot) */}
            <div className="pt-1 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  {stream?.poster && (
                    <img
                      src={stream.poster}
                      alt={stream.seriesTitle || stream.title}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover shrink-0 border border-white/15 shadow-md"
                    />
                  )}
                  <div className="min-w-0">
                    <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                      {stream?.seriesTitle || stream?.title || episodeId}
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-[#9CA3AF] font-medium mt-0.5">
                      Episode {stream?.episodeNumber || '1'} • 40,5 rb x ditonton • Baru rilis
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={!stream?.prevEpisode}
                    onClick={() =>
                      stream?.prevEpisode && handleSwitchEpisode(stream.prevEpisode.episodeId)
                    }
                    className="min-h-[38px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1D202A] dark:hover:bg-[#272B38] disabled:opacity-40 text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Prev</span>
                  </button>
                  <button
                    type="button"
                    disabled={!stream?.nextEpisode}
                    onClick={() =>
                      stream?.nextEpisode && handleSwitchEpisode(stream.nextEpisode.episodeId)
                    }
                    className="min-h-[38px] px-3 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] disabled:opacity-40 text-xs font-bold text-white flex items-center gap-1"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Horizontal Numbered Episode List Bar (Orange Border + White Active Box) */}
              {stream && stream.episodesList.length > 0 && (
                <div className="pt-1">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                      Episode List
                    </h2>
                    <button
                      type="button"
                      onClick={handleBack}
                      className="text-xs sm:text-sm font-extrabold text-[#E84A18] hover:underline"
                    >
                      Lihat Semua
                    </button>
                  </div>

                  <div className="flex items-center gap-2.5 overflow-x-auto pb-2 no-scrollbar">
                    {stream.episodesList.map((ep, idx) => {
                      const current = ep.episodeId === episodeId;
                      const epNum = ep.episodeNumber || String(idx + 1);
                      return (
                        <button
                          key={`${ep.episodeId}-${idx}`}
                          type="button"
                          onClick={() => handleSwitchEpisode(ep.episodeId)}
                          className={`min-w-[54px] h-[46px] px-3 rounded-2xl text-sm font-extrabold shrink-0 transition-all flex items-center justify-center ${
                            current
                              ? 'bg-white text-slate-950 border-2 border-white shadow-lg scale-[1.03]'
                              : 'bg-slate-900/90 dark:bg-[#15171E] text-white border-2 border-[#E84A18] hover:bg-[#E84A18]/20'
                          }`}
                        >
                          {epNum}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Server Switcher */}
            {stream && stream.servers.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/5 p-4 shadow-sm dark:shadow-none">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <Server className="w-4 h-4 text-[#E84A18]" />
                    <span>Pilih Server &amp; Kualitas ({stream.servers.length} Mirror Tersedia)</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-gray-400">
                    Klik mirror lain jika server pertama lambat
                  </span>
                </div>
                <div className="flex items-center flex-wrap gap-2">
                  {stream.servers.map((srv, idx) => {
                    const active = activeServerName === srv.name;
                    return (
                      <button
                        key={`${srv.name}-${idx}`}
                        type="button"
                        onClick={() => handleSelectServer(srv)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                          active
                            ? 'bg-[#E84A18] text-white shadow-md shadow-[#E84A18]/25'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#1B1E26] dark:hover:bg-[#232732] dark:text-gray-200 border border-transparent dark:border-white/5'
                        }`}
                      >
                        {srv.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Community Comments under Video Player */}
            <CommentSection
              mediaKey={`${type}:${stream?.seriesId || episodeId}`}
              mediaTitle={stream?.seriesTitle || stream?.title || episodeId}
              episodeTitle={stream?.title}
            />
          </div>

          {/* Right Sidebar: Adsterra 300x250 + Episode Picker */}
          <div className="space-y-4">
            {!isPremium && <AdsterraBanner300x250 />}

            {stream && stream.episodesList.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/5 p-4 shadow-sm dark:shadow-none">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                  Daftar Episode ({stream.episodesList.length})
                </h2>
                <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                  {stream.episodesList.map((ep, idx) => {
                    const current = ep.episodeId === episodeId;
                    return (
                      <button
                        key={`${ep.episodeId}-${idx}`}
                        type="button"
                        onClick={() => handleSwitchEpisode(ep.episodeId)}
                        className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                          current
                            ? 'bg-[#E84A18] text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#1B1E26] dark:hover:bg-[#242834] dark:text-gray-300'
                        }`}
                      >
                        <span className="truncate">{ep.title}</span>
                        <span className="ml-2 shrink-0 font-mono-tabular">
                          Ep {ep.episodeNumber}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Watch Party Sidebar */}
          {showWatchParty && (
            <WatchPartySidebar
              episodeId={episodeId}
              seriesTitle={stream?.title || 'Watch Party'}
              isOpen={showWatchParty}
              onClose={() => setShowWatchParty(false)}
            />
          )}
        </div>
      </div>

      {/* Watch Ads Modal (10s timer + Clean 300x250) on initial start and every 2 minutes for free users */}
      <WatchAdsModal
        open={!authLoading && !adUnlocked && !isPremium}
        episodeTitle={stream?.title || 'Memuat Episode...'}
        onUnlock={() => {
          setNextAdSeconds(MIDROLL_INTERVAL_SECONDS);
          setAdUnlocked(true);
        }}
        onClose={handleBack}
        onUpgrade={() => navigate('/profile', { replace: true })}
      />
    </Layout>
  );
}
