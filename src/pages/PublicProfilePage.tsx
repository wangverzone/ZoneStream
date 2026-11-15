import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Check,
  Clock,
  Crown,
  Flame,
  MessageCircle,
  Play,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { TELEGRAM_BADGE_MAP, VerifiedBadge } from '../components/VerifiedBadge';
import { StatusEmojiBadge } from '../components/VipEmojis';
import { AVATAR_BORDER_STYLES, PROFILE_THEMES, useAuth } from '../context/AuthContext';
import type { PublicProfileDetail, RelationshipStatus } from '../types';
import defaultAvatarImg from '../assets/images/default_avatar_ink_1794755346613.jpg';
import defaultBannerImg from '../assets/images/default_profile_banner_1794755346957.jpg';

function getToken(): string {
  return (
    localStorage.getItem('zonestream_session_token_v1') ||
    localStorage.getItem('donghive_session_token_v1') ||
    ''
  );
}

function formatLastSeen(iso?: string, isOnline?: boolean): string {
  if (isOnline) return 'Sedang Online';
  if (!iso) return 'Member ZoneStream';
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'Baru saja aktif';
  if (diffMin < 60) return `Aktif ${diffMin} menit lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Aktif ${diffHr} jam lalu`;
  return `Aktif ${Math.floor(diffHr / 24)} hari lalu`;
}

export function PublicProfilePage() {
  const { uid = '' } = useParams();
  const navigate = useNavigate();
  const { user: viewer } = useAuth();

  const [profile, setProfile] = useState<PublicProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadProfile = async () => {
    try {
      const token = getToken();
      const res = await fetch(`/api/social/profile/${encodeURIComponent(uid)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const json = await res.json();
      if (json.ok && json.profile) {
        setProfile(json.profile);
        setNotFound(false);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadProfile();
  }, [uid, viewer?.uid]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const handleFriendAction = async (action: 'request' | 'accept' | 'remove') => {
    if (!viewer) {
      navigate('/profile');
      return;
    }
    if (!profile || actionBusy) return;
    setActionBusy(true);
    try {
      const token = getToken();
      const res = await fetch(`/api/social/friends/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUid: profile.uid }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                relationship: json.relationship as RelationshipStatus,
                friendsCount:
                  action === 'accept'
                    ? prev.friendsCount + 1
                    : action === 'remove' && prev.relationship === 'friend'
                    ? Math.max(0, prev.friendsCount - 1)
                    : prev.friendsCount,
              }
            : prev
        );
        if (json.message) showToast(json.message);
      }
    } catch {
      showToast('Gagal memproses aksi pertemanan');
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 pt-6 space-y-4">
          <div className="h-56 rounded-3xl bg-slate-200 dark:bg-[#15171F] animate-pulse" />
          <div className="h-32 rounded-3xl bg-slate-200 dark:bg-[#15171F] animate-pulse" />
        </div>
      </Layout>
    );
  }

  if (notFound || !profile) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-4 pt-16 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#E84A18]/15 text-[#E84A18] flex items-center justify-center">
            <Users className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Profil Tidak Ditemukan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400">
            Pengguna dengan UID tersebut tidak tersedia atau belum terdaftar di ZoneStream.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-[#1A1D26] text-xs font-bold text-slate-900 dark:text-white"
            >
              Kembali
            </button>
            <Link
              to="/community"
              className="px-4 py-2.5 rounded-xl bg-[#E84A18] text-white text-xs font-bold"
            >
              Cari User Lain
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const isTargetFounder = profile.role === 'founder';
  const hasVip = Boolean(profile.isPremium || isTargetFounder);
  const borderCls =
    AVATAR_BORDER_STYLES[profile.activeBorder || 'classic']?.ringClass ||
    AVATAR_BORDER_STYLES.classic.ringClass;
  const themeDef =
    PROFILE_THEMES[hasVip ? profile.profileTheme || 'default' : 'default'] ||
    PROFILE_THEMES.default;
  const rel = profile.relationship || (viewer?.uid === profile.uid ? 'self' : 'none');

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-0 sm:px-6 lg:px-8 pt-0 sm:pt-5 pb-12">
        {toast && (
          <div className="fixed top-20 right-4 z-50 px-4 py-2.5 rounded-xl bg-[#11131B] text-white border border-[#E84A18]/40 text-xs font-bold shadow-2xl">
            {toast}
          </div>
        )}

        {/* Discord-themed Profile Header Card */}
        <div
          className={`relative sm:rounded-3xl overflow-hidden border-b sm:border border-slate-200 dark:border-white/[0.08] shadow-xl ${themeDef.shellClass}`}
        >
          {/* Banner */}
          <div className="relative h-48 sm:h-64 w-full overflow-hidden bg-slate-900">
            <img
              src={profile.bannerUrl || defaultBannerImg}
              alt={`Latar ${profile.name}`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className={`absolute inset-0 bg-gradient-to-t ${themeDef.bannerGradientOverlay}`} />

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="absolute top-4 left-4 z-20 min-h-[40px] px-3 rounded-xl bg-black/55 hover:bg-black/80 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 border border-white/15 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>

            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-bold backdrop-blur-md border ${
                  profile.isOnline
                    ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                    : 'bg-black/50 border-white/15 text-gray-200'
                }`}
              >
                {formatLastSeen(profile.lastActiveAt, profile.isOnline)}
              </span>
            </div>
          </div>

          {/* Identity & Actions */}
          <div className="relative px-4 sm:px-8 pb-6 -mt-14 sm:-mt-16">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="relative self-start">
                  <img
                    src={profile.photoUrl || defaultAvatarImg}
                    alt={profile.name}
                    referrerPolicy="no-referrer"
                    className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover bg-white dark:bg-[#14161D] ${borderCls}`}
                  />
                  {profile.isOnline && (
                    <span
                      title="Sedang Online"
                      className="absolute bottom-2 right-2 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-[#13151C]"
                    />
                  )}
                </div>

                <div className="pb-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                      {profile.name}
                    </h1>
                    {hasVip && (
                      <VerifiedBadge
                        size="lg"
                        isFounder={isTargetFounder}
                        badgeLabel={profile.activeBadge}
                      />
                    )}
                    {hasVip && profile.statusEmoji && (
                      <StatusEmojiBadge statusEmoji={profile.statusEmoji} size="sm" />
                    )}
                  </div>

                  <div className="mt-1 flex items-center flex-wrap gap-2 text-xs text-slate-500 dark:text-gray-300">
                    <span className="font-semibold text-slate-700 dark:text-gray-200">
                      @{profile.username}
                    </span>
                    <span>·</span>
                    <span className="font-mono-tabular">UID: {profile.uid}</span>
                    <span>·</span>
                    <span className="font-bold text-[#E84A18]">
                      {isTargetFounder ? 'Lv. ∞' : `Lv. ${profile.level}`}
                    </span>
                    {hasVip && (
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          TELEGRAM_BADGE_MAP.get(profile.activeBadge)?.pillClass ||
                          'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {profile.activeBadge || (isTargetFounder ? 'Verified Founder' : 'VIP')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center flex-wrap gap-2.5">
                {rel === 'self' ? (
                  <Link
                    to="/profile/edit"
                    className="min-h-[42px] px-4 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-lg shadow-[#E84A18]/25"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Edit Profil Saya</span>
                  </Link>
                ) : (
                  <>
                    {rel === 'none' && (
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => handleFriendAction('request')}
                        className="min-h-[42px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white/10 dark:hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Tambah Teman</span>
                      </button>
                    )}

                    {rel === 'pending_sent' && (
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => handleFriendAction('remove')}
                        className="min-h-[42px] px-4 rounded-xl bg-amber-500/15 hover:bg-rose-500/15 text-amber-600 dark:text-amber-300 hover:text-rose-500 border border-amber-500/30 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Clock className="w-4 h-4" />
                        <span>Menunggu · Batalkan</span>
                      </button>
                    )}

                    {rel === 'pending_received' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => handleFriendAction('accept')}
                          className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          <span>Terima Teman</span>
                        </button>
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => handleFriendAction('remove')}
                          className="min-h-[42px] px-3 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-gray-200 text-xs font-bold inline-flex items-center"
                          aria-label="Tolak permintaan teman"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {rel === 'friend' && (
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => handleFriendAction('remove')}
                        className="min-h-[42px] px-4 rounded-xl bg-emerald-500/15 hover:bg-rose-500/15 text-emerald-600 dark:text-emerald-300 hover:text-rose-500 border border-emerald-500/30 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Berteman</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        viewer ? navigate(`/chat/${profile.uid}`) : navigate('/profile')
                      }
                      className="min-h-[42px] px-4 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-lg shadow-[#E84A18]/25 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Kirim Pesan</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {profile.bio && (
              <p className="mt-4 text-xs sm:text-sm text-slate-700 dark:text-gray-200 leading-relaxed max-w-2xl">
                {profile.bio}
              </p>
            )}

            {/* Quick Community Stats Strip */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className={`rounded-2xl p-3.5 ${themeDef.cardClass}`}>
                <p className="text-[11px] text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                  <span>Peringkat</span>
                </p>
                <p className="mt-1 text-base font-extrabold text-slate-900 dark:text-white font-mono-tabular">
                  {isTargetFounder ? 'Lv. ∞' : `Lv. ${profile.level}`}
                </p>
              </div>
              <div className={`rounded-2xl p-3.5 ${themeDef.cardClass}`}>
                <p className="text-[11px] text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-500" />
                  <span>Teman</span>
                </p>
                <p className="mt-1 text-base font-extrabold text-slate-900 dark:text-white font-mono-tabular">
                  {profile.friendsCount}
                </p>
              </div>
              <div className={`rounded-2xl p-3.5 ${themeDef.cardClass}`}>
                <p className="text-[11px] text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-[#E84A18]" />
                  <span>Streak Harian</span>
                </p>
                <p className="mt-1 text-base font-extrabold text-slate-900 dark:text-white font-mono-tabular">
                  {profile.watchStreak || 0} Hari
                </p>
              </div>
              <div className={`rounded-2xl p-3.5 ${themeDef.cardClass}`}>
                <p className="text-[11px] text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Episode Ditonton</span>
                </p>
                <p className="mt-1 text-base font-extrabold text-slate-900 dark:text-white font-mono-tabular">
                  {profile.totalEpisodesWatched || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Watchlist Favorit & Aktivitas Terakhir */}
        <div className="px-4 sm:px-0 mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="rounded-3xl bg-white dark:bg-[#13151C] border border-slate-200 dark:border-white/[0.07] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[#E84A18]" />
                <span>Watchlist Favorit ({profile.bookmarks.length})</span>
              </h2>
            </div>

            {profile.bookmarks.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-gray-400 py-6 text-center">
                Belum ada judul favorit yang disimpan.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {profile.bookmarks.slice(0, 6).map((b) => (
                  <Link
                    key={`${b.type}:${b.id}`}
                    to={`/detail/${b.type}/${encodeURIComponent(b.id)}`}
                    className="group rounded-2xl overflow-hidden bg-slate-100 dark:bg-[#0D0F14] border border-slate-200 dark:border-white/5 hover:border-[#E84A18]/60 transition-colors"
                  >
                    <div className="aspect-[3/4] overflow-hidden bg-slate-800">
                      {b.poster ? (
                        <img
                          src={b.poster}
                          alt={b.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : null}
                    </div>
                    <div className="p-2">
                      <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                        {b.title}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase">
                        {b.type}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-white dark:bg-[#13151C] border border-slate-200 dark:border-white/[0.07] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-[#E84A18]" />
                <span>Terakhir Ditonton</span>
              </h2>
            </div>

            {profile.recentHistory.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-gray-400 py-6 text-center">
                Belum ada aktivitas tontonan terbaru.
              </p>
            ) : (
              <div className="space-y-2.5">
                {profile.recentHistory.slice(0, 5).map((h) => (
                  <Link
                    key={`${h.type}:${h.episodeId}`}
                    to={`/detail/${h.type}/${encodeURIComponent(h.id)}`}
                    className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-[#0D0F14] hover:bg-slate-100 dark:hover:bg-[#171A23] border border-slate-200 dark:border-white/5 transition-colors"
                  >
                    <img
                      src={h.poster || defaultAvatarImg}
                      alt={h.title}
                      referrerPolicy="no-referrer"
                      className="w-12 h-16 rounded-xl object-cover shrink-0 bg-slate-800"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {h.title}
                      </p>
                      <p className="text-[11px] text-[#E84A18] font-semibold mt-0.5 truncate">
                        {h.episodeTitle || `Episode ${h.episodeNumber}`}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase mt-0.5">
                        {h.type}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
}
