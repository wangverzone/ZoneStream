import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Crown,
  ExternalLink,
  Flame,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AdsterraBanner300x250 } from '../components/AdsterraAds';
import { WatchAdsModal } from '../components/WatchAdsModal';
import { CommentSection } from '../components/CommentSection';
import { useAuth } from '../context/AuthContext';
import type { EpisodeStreamData, StreamServer, WatchHistoryReward } from '../types';

const MIDROLL_INTERVAL_SECONDS = 120; // Iklan muncul setiap 2 menit untuk user gratis

function isFrameBlockedHost(url?: string): boolean {
  const u = String(url || '').toLowerCase();
  return (
    u.includes('desustream.net') ||
    u.includes('desustream.com') ||
    u.includes('ondesuhd') ||
    u.includes('odcdn')
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
  const { isPremium, recordWatchHistory } = useAuth();

  const navState = (location.state as { adUnlocked?: boolean; backTo?: string } | null) || null;
  const alreadyUnlockedByNav = Boolean(navState?.adUnlocked);
  const safeBackTo =
    navState?.backTo && !navState.backTo.startsWith('/watch') ? navState.backTo : '/';

  const [stream, setStream] = useState<EpisodeStreamData | null>(null);
  const [activeUrl, setActiveUrl] = useState('');
  const [activeServerName, setActiveServerName] = useState('');
  const [switchingMirror, setSwitchingMirror] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adUnlocked, setAdUnlocked] = useState(isPremium || alreadyUnlockedByNav);
  const [nextAdSeconds, setNextAdSeconds] = useState(MIDROLL_INTERVAL_SECONDS);
  const [popupShield, setPopupShield] = useState(true);
  const [reward, setReward] = useState<WatchHistoryReward | null>(null);

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
    if (isPremium || !adUnlocked || loading) return;
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
  }, [isPremium, adUnlocked, loading]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/stream/episode/${type}/${encodeURIComponent(episodeId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!active) return;
        if (json.ok && json.episode) {
          const ep: EpisodeStreamData = json.episode;
          setStream(ep);
          const safeServer = ep.servers?.find((s) => s.url && !isFrameBlockedHost(s.url));
          const candidateUrl =
            ep.defaultStreamingUrl && !isFrameBlockedHost(ep.defaultStreamingUrl)
              ? ep.defaultStreamingUrl
              : safeServer?.url || ep.defaultStreamingUrl || ep.servers?.[0]?.url || '';
          setActiveUrl(candidateUrl);
          const matchedServer = ep.servers?.find((s) => s.url && s.url === candidateUrl);
          setActiveServerName(matchedServer?.name || ep.servers?.[0]?.name || 'Default Player');
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
    recordWatchHistory({
      id: stream.seriesId || episodeId,
      type: stream.type,
      title: stream.seriesTitle || stream.title,
      poster: stream.poster,
      episodeId: stream.episodeId,
      episodeTitle: stream.title,
      episodeNumber: stream.episodeNumber || '1',
      progress: 45,
    }).then((res) => {
      if (res.expGained > 0) setReward(res);
    });
  }, [adUnlocked, stream?.episodeId]);

  const handleBack = () => {
    if (stream?.seriesId) {
      navigate(
        `/detail/${type}/${encodeURIComponent(stream.seriesId)}?ep=${encodeURIComponent(episodeId)}`,
        {
          replace: true,
          state: { backTo: safeBackTo },
        }
      );
    } else {
      navigate(safeBackTo, { replace: true });
    }
  };

  const handleSwitchEpisode = (targetEpisodeId: string) => {
    navigate(`/watch/${type}/${encodeURIComponent(targetEpisodeId)}`, {
      replace: true,
      state: { adUnlocked: isPremium, backTo: safeBackTo },
    });
  };

  const handleSelectServer = async (srv: StreamServer) => {
    setActiveServerName(srv.name);
    if (srv.url) {
      setActiveUrl(srv.url);
      return;
    }
    if (srv.serverId) {
      setSwitchingMirror(true);
      try {
        const res = await fetch(`/api/stream/server/${encodeURIComponent(srv.serverId)}`);
        const json = await res.json();
        if (json.ok && json.url) {
          setActiveUrl(json.url);
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

  return (
    <Layout hideBottomNav>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-10">
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            type="button"
            onClick={handleBack}
            className="min-h-[40px] px-3 rounded-xl bg-white hover:bg-slate-100 dark:bg-[#15171F] dark:hover:bg-[#1E212B] text-slate-900 dark:text-white text-xs font-semibold flex items-center gap-2 border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-none"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>

          {isPremium ? (
            <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" />
              <span>Bebas Iklan VIP · 2x EXP</span>
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
                <span>Hapus Iklan</span>
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
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold font-mono-tabular">
              <Flame className="w-3.5 h-3.5" />
              Streak {reward.streak} Hari
            </span>
          </div>
        )}

        {/* Video Player Container */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-slate-200 dark:border-white/10 shadow-2xl">
              {loading || switchingMirror ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                  {switchingMirror ? 'Mengganti mirror server...' : 'Memuat video player...'}
                </div>
              ) : !adUnlocked && !isPremium ? (
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
                    Mirror aktif memblokir pemutaran di dalam frame. Pilih mirror lain atau buka langsung di tab baru:
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    {stream && stream.servers.length > 1 && (
                      <button
                        type="button"
                        onClick={handleCycleMirror}
                        className="px-4 py-2 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Coba Mirror Lain</span>
                      </button>
                    )}
                    <a
                      href={activeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka Mirror di Tab Baru</span>
                    </a>
                  </div>
                </div>
              ) : activeUrl ? (
                <iframe
                  key={`${activeUrl}-${popupShield ? 'shield' : 'raw'}`}
                  src={activeUrl}
                  title={stream?.title || 'ZoneStream Player'}
                  sandbox={
                    popupShield
                      ? 'allow-scripts allow-same-origin allow-forms allow-presentation'
                      : undefined
                  }
                  allowFullScreen
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  referrerPolicy="no-referrer"
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-xs text-gray-400 p-4 text-center">
                  <p>Server default tidak tersedia. Silakan coba ganti mirror atau server lain di bawah.</p>
                  {stream && stream.servers.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCycleMirror}
                      className="px-4 py-2 rounded-xl bg-[#E84A18] text-white font-bold inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Coba Mirror Lain</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick Mirror & Anti-Popup Shield Bar */}
            {adUnlocked && !loading && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/[0.07] text-xs shadow-sm">
                <button
                  type="button"
                  onClick={() => setPopupShield((s) => !s)}
                  className={`px-3 py-1.5 rounded-xl font-bold inline-flex items-center gap-1.5 transition-colors border ${
                    popupShield
                      ? 'bg-emerald-500/12 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/12 border-amber-500/30 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>
                    {popupShield
                      ? 'Perisai Anti-Popup Video: Aktif'
                      : 'Perisai Anti-Popup: Nonaktif'}
                  </span>
                </button>
                <div className="flex items-center flex-wrap gap-2">
                  {stream && stream.servers.length > 1 && (
                    <button
                      type="button"
                      disabled={switchingMirror}
                      onClick={handleCycleMirror}
                      className="px-3 py-1.5 rounded-xl bg-[#E84A18]/15 hover:bg-[#E84A18] text-[#E84A18] hover:text-white font-bold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${switchingMirror ? 'animate-spin' : ''}`} />
                      <span>Ganti Mirror Cepat</span>
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
                      <span>Tab Baru</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Episode Title & Prev/Next */}
            <div className="rounded-2xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm dark:shadow-none">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#E84A18] uppercase">
                  {type} · Episode {stream?.episodeNumber || '1'}
                </p>
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                  {stream?.title || episodeId}
                </h1>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={!stream?.prevEpisode}
                  onClick={() =>
                    stream?.prevEpisode && handleSwitchEpisode(stream.prevEpisode.episodeId)
                  }
                  className="min-h-[40px] px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1D202A] dark:hover:bg-[#272B38] disabled:opacity-40 text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Prev</span>
                </button>
                <button
                  type="button"
                  disabled={!stream?.nextEpisode}
                  onClick={() =>
                    stream?.nextEpisode && handleSwitchEpisode(stream.nextEpisode.episodeId)
                  }
                  className="min-h-[40px] px-3.5 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] disabled:opacity-40 text-xs font-bold text-white flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Server Switcher */}
            {stream && stream.servers.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/5 p-4 shadow-sm dark:shadow-none">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white mb-3">
                  <Server className="w-4 h-4 text-[#E84A18]" />
                  <span>Pilih Server &amp; Kualitas ({activeServerName})</span>
                </div>
                <div className="flex items-center flex-wrap gap-2">
                  {stream.servers.map((srv, idx) => {
                    const active = activeServerName === srv.name;
                    return (
                      <button
                        key={`${srv.name}-${idx}`}
                        type="button"
                        onClick={() => handleSelectServer(srv)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-[#E84A18] text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#1B1E26] dark:hover:bg-[#232732] dark:text-gray-300'
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
                  Episode Lainnya
                </h2>
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
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
        </div>
      </div>

      {/* Watch Ads Modal (10s timer + Clean 300x250) on initial start and every 2 minutes for free users */}
      <WatchAdsModal
        open={!adUnlocked && !isPremium}
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
