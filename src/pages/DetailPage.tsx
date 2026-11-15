import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  Bookmark,
  Clock,
  Film,
  Play,
  Star,
} from 'lucide-react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AdsterraBanner300x250 } from '../components/AdsterraAds';
import { WatchAdsModal } from '../components/WatchAdsModal';
import { CommentSection } from '../components/CommentSection';
import { useAuth } from '../context/AuthContext';
import type { EpisodeItem, MediaDetail } from '../types';
import heroFallbackImg from '../assets/images/donghua_hero_fallback_1794755348232.jpg';

export function DetailPage() {
  const { type = 'donghua', id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const epHint = searchParams.get('ep') || '';
  const navigate = useNavigate();
  const location = useLocation();
  const { isPremium, getLocalBookmarks, toggleBookmark } = useAuth();

  const rawBackTo = (location.state as any)?.backTo as string | undefined;
  const safeBackTo =
    rawBackTo && !rawBackTo.startsWith('/watch') && !rawBackTo.startsWith('/detail')
      ? rawBackTo
      : '/';

  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(false);
  const [pendingEpisode, setPendingEpisode] = useState<EpisodeItem | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const epQuery = epHint ? `?ep=${encodeURIComponent(epHint)}` : '';
    fetch(`/api/stream/detail/${type}/${encodeURIComponent(id)}${epQuery}`)
      .then((r) => r.json())
      .then((json) => {
        if (!active) return;
        if (json.ok && json.detail) {
          setDetail(json.detail);
        } else {
          setDetail(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [type, id, epHint]);

  const bookmarks = getLocalBookmarks();
  const isBookmarked = bookmarks.some((b) => b.id === id && b.type === type);

  const handleBack = () => {
    navigate(safeBackTo, { replace: true });
  };

  const handleEpisodeClick = (ep: EpisodeItem) => {
    if (isPremium) {
      navigate(`/watch/${type}/${encodeURIComponent(ep.episodeId)}`, {
        state: { adUnlocked: true, backTo: safeBackTo },
      });
    } else {
      setPendingEpisode(ep);
    }
  };

  const episodes = detail?.episodes
    ? sortAsc
      ? [...detail.episodes].reverse()
      : detail.episodes
    : [];

  return (
    <Layout>
      {loading ? (
        <div className="p-4 sm:p-8 space-y-4">
          <div className="h-64 rounded-2xl bg-slate-200 dark:bg-[#16181F] animate-pulse" />
          <div className="h-8 w-2/3 rounded-xl bg-slate-200 dark:bg-[#16181F] animate-pulse" />
          <div className="h-32 rounded-2xl bg-slate-200 dark:bg-[#16181F] animate-pulse" />
        </div>
      ) : !detail ? (
        <div className="p-8 text-center">
          <p className="text-slate-500 dark:text-gray-400 mb-4">Detail judul tidak ditemukan.</p>
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 rounded-xl bg-[#E84A18] text-white text-xs font-bold"
          >
            Kembali
          </button>
        </div>
      ) : (
        <div className="pb-10">
          {/* Backdrop Banner */}
          <div className="relative h-56 sm:h-72 lg:h-80 w-full overflow-hidden bg-slate-900 dark:bg-[#14161D]">
            <img
              src={detail.backdrop || detail.poster || heroFallbackImg}
              alt={detail.title}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = heroFallbackImg;
              }}
              className={`w-full h-full object-cover ${
                detail.hasWideBanner ? 'opacity-90' : 'blur-[2px] scale-105 opacity-70'
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#F5F7FB] dark:from-[#090A0E] via-black/45 to-black/30" />

            <button
              type="button"
              onClick={handleBack}
              aria-label="Kembali"
              className="absolute top-4 left-4 min-h-[42px] min-w-[42px] rounded-xl bg-black/50 hover:bg-black/75 backdrop-blur-md text-white flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Info Section */}
          <div className="px-4 sm:px-6 lg:px-8 -mt-24 relative z-10">
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              <img
                src={detail.poster || heroFallbackImg}
                alt={detail.title}
                referrerPolicy="no-referrer"
                className="w-32 sm:w-44 aspect-[3/4] rounded-2xl object-cover shadow-2xl border border-white/20 dark:border-white/10 shrink-0 bg-slate-200 dark:bg-[#16181F]"
              />

              <div className="flex-1 min-w-0 pt-2">
                <div className="flex items-center flex-wrap gap-2 text-xs mb-2">
                  <span className="px-2 py-0.5 rounded-md bg-[#E84A18] text-white font-bold uppercase text-[10px]">
                    {detail.type}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">
                    {detail.status}
                  </span>
                  <span className="flex items-center gap-1 text-amber-500 dark:text-amber-400 font-bold font-mono-tabular">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {detail.rating}
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
                  {detail.title}
                </h1>
                {detail.altTitle && (
                  <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1">{detail.altTitle}</p>
                )}

                <div className="flex items-center flex-wrap gap-4 text-xs text-slate-600 dark:text-gray-300 mt-3">
                  <span className="flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-[#E84A18]" />
                    {detail.studio}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#E84A18]" />
                    {detail.duration}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center flex-wrap gap-2.5 mt-4">
                  {detail.episodes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleEpisodeClick(detail.episodes[0])}
                      className="min-h-[44px] px-5 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-[#E84A18]/25 transition-all"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Tonton Episode Terbaru</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      toggleBookmark({
                        id: detail.id,
                        type: detail.type,
                        title: detail.title,
                        poster: detail.poster,
                        rating: detail.rating,
                        status: detail.status,
                      })
                    }
                    className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 border transition-colors ${
                      isBookmarked
                        ? 'bg-[#E84A18]/15 border-[#E84A18] text-[#E84A18]'
                        : 'bg-white dark:bg-[#16181F] border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-[#1E212B]'
                    }`}
                  >
                    <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
                    <span>{isBookmarked ? 'Tersimpan' : 'Simpan'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Genres & Synopsis */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Sinopsis</h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                    {detail.synopsis}
                  </p>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                  {detail.genres.map((g, idx) => (
                    <span
                      key={`${g}-${idx}`}
                      className="px-3 py-1 rounded-lg bg-white dark:bg-[#16181F] border border-slate-200 dark:border-white/5 text-xs text-slate-700 dark:text-gray-300"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>

              {/* Adsterra Banner 300x250 (Hanya tampil jika !user.isPremium) */}
              {!isPremium && (
                <div className="flex justify-center lg:justify-end">
                  <AdsterraBanner300x250 />
                </div>
              )}
            </div>

            {/* Episode List */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Daftar Episode ({detail.episodes.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setSortAsc((s) => !s)}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#15171F] border border-slate-200 dark:border-white/5 text-xs font-semibold text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#E84A18]" />
                  <span>{sortAsc ? 'Terlama' : 'Terbaru'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {episodes.map((ep, idx) => (
                  <button
                    key={`${ep.episodeId}-${idx}`}
                    type="button"
                    onClick={() => handleEpisodeClick(ep)}
                    className="min-h-[54px] p-3 rounded-xl bg-white hover:bg-slate-50 dark:bg-[#14161D] dark:hover:bg-[#1D202A] border border-slate-200 dark:border-white/5 flex items-center justify-between gap-3 text-left transition-colors group shadow-sm dark:shadow-none"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#E84A18]">
                        Episode {ep.episodeNumber || '—'}
                      </p>
                      <p className="text-xs text-slate-700 dark:text-gray-200 truncate mt-0.5">
                        {ep.title}
                      </p>
                    </div>
                    <span className="w-8 h-8 rounded-lg bg-[#E84A18]/15 group-hover:bg-[#E84A18] text-[#E84A18] group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Community Comments & Exclusive VIP Emojis */}
            <CommentSection
              mediaKey={`${detail.type}:${detail.id}`}
              mediaTitle={detail.title}
            />
          </div>
        </div>
      )}

      {/* Watch Ads Modal for Free Users (!user.isPremium) */}
      <WatchAdsModal
        open={Boolean(pendingEpisode)}
        episodeTitle={pendingEpisode?.title || detail?.title || 'Episode'}
        onClose={() => setPendingEpisode(null)}
        onUpgrade={() => {
          setPendingEpisode(null);
          navigate('/profile');
        }}
        onUnlock={() => {
          if (pendingEpisode) {
            const epId = pendingEpisode.episodeId;
            setPendingEpisode(null);
            navigate(`/watch/${type}/${encodeURIComponent(epId)}`, {
              state: { adUnlocked: true, backTo: safeBackTo },
            });
          }
        }}
      />
    </Layout>
  );
}
