import { useState } from 'react';
import { Bookmark, Clock, Play } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { MediaCard } from '../components/MediaCard';
import { useAuth } from '../context/AuthContext';
import heroFallbackImg from '../assets/images/donghua_hero_fallback_1794755348232.jpg';

export function LibraryPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'history' ? 'history' : 'bookmarks';
  const [tab, setTab] = useState<'bookmarks' | 'history'>(initialTab);
  const { isPremium, getLocalBookmarks, getLocalHistory } = useAuth();

  const bookmarks = getLocalBookmarks();
  const history = getLocalHistory();

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 pt-5">
        <div className="flex items-center justify-between gap-4 mb-5">
          <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">Library Saya</h1>

          <div className="flex items-center gap-1 bg-white dark:bg-[#14161D] p-1 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-none">
            <button
              type="button"
              onClick={() => setTab('bookmarks')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                tab === 'bookmarks'
                  ? 'bg-[#E84A18] text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-[#9CA3AF] dark:hover:text-white'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Watchlist ({bookmarks.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                tab === 'history'
                  ? 'bg-[#E84A18] text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-[#9CA3AF] dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>History ({history.length})</span>
            </button>
          </div>
        </div>

        {tab === 'bookmarks' ? (
          bookmarks.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/5 p-8 text-center">
              <p className="text-sm text-slate-800 dark:text-gray-300 font-semibold mb-1">
                Watchlist masih kosong
              </p>
              <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mb-4">
                Simpan Anime atau Donghua favoritmu dari halaman Detail agar mudah ditemukan.
              </p>
              <Link
                to="/catalog"
                className="inline-flex px-4 py-2.5 rounded-xl bg-[#E84A18] text-white text-xs font-bold"
              >
                Jelajahi Katalog
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-4">
              {bookmarks.map((b) => (
                <MediaCard
                  key={`${b.type}-${b.id}`}
                  item={{
                    id: b.id,
                    type: b.type,
                    title: b.title,
                    poster: b.poster,
                    rating: b.rating,
                    status: b.status,
                    episodeLabel: b.type === 'donghua' ? 'Donghua' : 'Anime',
                  }}
                />
              ))}
            </div>
          )
        ) : history.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/5 p-8 text-center">
            <p className="text-sm text-slate-800 dark:text-gray-300 font-semibold mb-1">
              Belum ada riwayat tontonan
            </p>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mb-4">
              Episode yang kamu tonton akan otomatis tercatat di sini.
            </p>
            <Link
              to="/"
              className="inline-flex px-4 py-2.5 rounded-xl bg-[#E84A18] text-white text-xs font-bold"
            >
              Ke Beranda
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {history.map((h) => (
              <Link
                key={h.episodeId}
                to={`/watch/${h.type}/${encodeURIComponent(h.episodeId)}`}
                state={{
                  backTo: '/library?tab=history',
                  adUnlocked: isPremium,
                  poster: h.poster,
                  seriesTitle: h.title,
                }}
                className="group flex items-center gap-3 p-2.5 rounded-2xl bg-white hover:bg-slate-50 dark:bg-[#14161D] dark:hover:bg-[#1B1E26] border border-slate-200 dark:border-white/5 transition-colors shadow-sm dark:shadow-none"
              >
                <div className="relative w-28 aspect-video rounded-xl overflow-hidden bg-slate-200 dark:bg-[#1D202A] shrink-0">
                  <img
                    src={h.poster || heroFallbackImg}
                    alt={h.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.src !== heroFallbackImg) img.src = heroFallbackImg;
                    }}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                    <Play className="w-5 h-5 text-white fill-current" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                    <div
                      className="h-full bg-[#E84A18]"
                      style={{ width: `${h.progress || 40}%` }}
                    />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#E84A18] mb-0.5">
                    Episode {h.episodeNumber}
                  </p>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {h.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] truncate mt-0.5">
                    {h.type === 'donghua' ? 'Donghua' : 'Anime'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
