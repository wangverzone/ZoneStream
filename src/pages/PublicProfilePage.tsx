import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Check,
  Clock,
  Crown,
  Flame,
  Gift,
  Heart,
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
import { TELEGRAM_BADGE_MAP, VerifiedBadge, resolveDisplayBadgeLabel } from '../components/VerifiedBadge';
import { StatusEmojiBadge } from '../components/VipEmojis';
import { CountryFlagBadge } from '../components/CountryFlag';
import { AvatarDecoration } from '../components/AvatarDecoration';
import { LevelUpCard } from '../components/LevelUpCard';
import { OnlineStatusPill } from '../components/ProfileStatusBadges';
import { GiftPremiumModal } from '../components/GiftPremiumModal';
import { PROFILE_THEMES, useAuth } from '../context/AuthContext';
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

  const [profile, setProfile] = useState<(PublicProfileDetail & { charisma?: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [showGiftPremModal, setShowGiftPremModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadProfile = async (silent = false) => {
    try {
      const token = getToken();
      const res = await fetch(`/api/social/profile/${encodeURIComponent(uid)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        if (!silent) setNotFound(true);
        return;
      }
      const json = await res.json();
      if (json.ok && json.profile) {
        setProfile(json.profile);
        setNotFound(false);
      } else if (!silent) {
        setNotFound(true);
      }
    } catch {
      if (!silent) setNotFound(true);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void loadProfile(false);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadProfile(true);
      }
    }, 5000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadProfile(true);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [uid, viewer?.uid]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const handleLikeProfile = async () => {
    if (!viewer) {
      showToast('Silakan masuk akun terlebih dahulu untuk menyukai profil ini.');
      navigate('/profile');
      return;
    }
    if (viewer.uid === profile?.uid) {
      showToast('Kamu tidak bisa menyukai profil sendiri. Biarkan user lain yang like!');
      return;
    }
    if (likeBusy || !profile) return;
    setLikeBusy(true);
    try {
      const token = getToken();
      const res = await fetch(`/api/social/profile/${encodeURIComponent(profile.uid)}/like`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setProfile((prev) =>
          prev ? { ...prev, charisma: json.charisma, hasLiked: Boolean(json.liked) } : prev
        );
        showToast(json.message || 'Berhasil menyukai profil! +1 Charisma (♥)');
      } else {
        showToast(json.error || 'Gagal menyukai profil');
      }
    } catch {
      showToast('Gagal menyukai profil');
    } finally {
      setLikeBusy(false);
    }
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

        {/* Discord-themed 3D Profile Header Card */}
        <div
          className={`relative sm:rounded-3xl overflow-hidden border-b sm:border border-slate-200 dark:border-white/[0.12] shadow-[0_22px_55px_rgba(0,0,0,0.5)] ${themeDef.shellClass}`}
          style={
            profile.profileBgColor
              ? {
                  backgroundImage: `radial-gradient(ellipse at top, ${profile.profileBgColor}34 0%, transparent 72%)`,
                }
              : undefined
          }
        >
          {/* Banner */}
          <div className="relative h-52 sm:h-72 w-full overflow-hidden bg-slate-900 dark:bg-[#0D0F16]">
            <img
              src={profile.bannerUrl || defaultBannerImg}
              alt={`Latar ${profile.name}`}
              referrerPolicy="no-referrer"
              decoding="async"
              fetchPriority="high"
              className="w-full h-full object-cover object-center contrast-[1.06] saturate-[1.08] brightness-[1.02]"
            />
            {profile.profileBgColor && (
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-30 mix-blend-soft-light pointer-events-none"
                style={{ backgroundColor: profile.profileBgColor }}
              />
            )}
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#090A0E] via-[#090A0E]/65 to-transparent pointer-events-none" />
            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 pointer-events-none" />

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="absolute top-4 left-4 z-20 min-h-[40px] px-3.5 rounded-xl bg-black/65 hover:bg-black/85 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 border border-white/20 shadow-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>

            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-bold backdrop-blur-md border shadow-md ${
                  profile.isOnline
                    ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-200'
                    : 'bg-black/60 border-white/20 text-gray-200'
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
                  <AvatarDecoration
                    src={profile.photoUrl}
                    alt={profile.name}
                    decorationId={profile.activeBorder}
                    bgColor={profile.profileBgColor}
                    size="xl"
                  >
                    {profile.isOnline && (
                      <span
                        title="Sedang Online"
                        className="absolute bottom-2 right-2 z-30 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-[#13151C]"
                      />
                    )}
                  </AvatarDecoration>
                </div>

                <div className="pb-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
                      {profile.name}
                    </h1>
                    <CountryFlagBadge countryCode={profile.countryCode} size="sm" />
                    {hasVip && (
                      <VerifiedBadge
                        size="lg"
                        isFounder={isTargetFounder}
                        badgeLabel={profile.activeBadge}
                      />
                    )}
                    {hasVip && profile.statusEmoji && (
                      <StatusEmojiBadge statusEmoji={profile.statusEmoji} size="md" />
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
                    {hasVip && (() => {
                      const safeBadge = resolveDisplayBadgeLabel(profile.activeBadge, isTargetFounder, hasVip);
                      return (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            TELEGRAM_BADGE_MAP.get(safeBadge)?.pillClass ||
                            'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {safeBadge}
                        </span>
                      );
                    })()}
                    <OnlineStatusPill
                      dbIsOnline={Boolean(profile.isOnline)}
                      isOwnProfile={rel === 'self'}
                      onSyncNow={() => loadProfile(true)}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons & Real-Time Like Button */}
              <div className="flex items-center flex-wrap gap-2.5">
                {rel !== 'self' && (
                  <button
                    type="button"
                    disabled={likeBusy}
                    onClick={handleLikeProfile}
                    className={`min-h-[42px] px-4 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-lg transition-transform hover:scale-105 ${
                      profile.hasLiked
                        ? 'bg-rose-700 hover:bg-rose-600 shadow-rose-600/30 ring-2 ring-pink-300/40'
                        : 'bg-pink-600 hover:bg-pink-500 shadow-pink-600/30'
                    }`}
                    title="Sukai profil untuk menaikkan Charisma user ini"
                  >
                    <Heart className={`w-4 h-4 fill-current ${profile.hasLiked ? 'text-white' : 'text-pink-200 animate-pulse'}`} />
                    <span>
                      {profile.hasLiked ? 'Disukai' : 'Sukai Profil'} ({profile.charisma ?? 0})
                    </span>
                  </button>
                )}

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

                    {!isTargetFounder && (
                      <button
                        type="button"
                        onClick={() =>
                          viewer ? setShowGiftPremModal(true) : navigate('/profile')
                        }
                        className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 shadow-lg shadow-amber-500/25 transition-colors"
                        title="Bagikan VIP Premium ke pengguna ini memakai Koin hasil naik level"
                      >
                        <Gift className="w-4 h-4" />
                        <span>Bagi Prem</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {profile.bio && (
              <p className="mt-4 text-xs sm:text-sm text-slate-700 dark:text-gray-200 leading-relaxed max-w-2xl">
                {profile.bio}
              </p>
            )}

            {/* Real-Time Level Up Progress Card */}
            <div className="mt-4">
              <LevelUpCard
                level={profile.level}
                exp={profile.exp ?? 0}
                isFounder={isTargetFounder}
                isPremium={profile.isPremium}
                totalWatchMinutes={profile.totalWatchMinutes}
                totalCommentsCount={profile.totalCommentsCount}
                totalEpisodesWatched={profile.totalEpisodesWatched}
              />
            </div>

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
                  <Heart className="w-3.5 h-3.5 text-pink-500 fill-current" />
                  <span>Charisma</span>
                </p>
                <p className="mt-1 text-base font-extrabold text-slate-900 dark:text-white font-mono-tabular">
                  {profile.charisma ?? 0}
                </p>
              </div>
              <div className={`rounded-2xl p-3.5 ${themeDef.cardClass}`}>
                <p className="text-[11px] text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  <span>Status</span>
                </p>
                <p className="mt-1 text-base font-extrabold text-slate-900 dark:text-white truncate">
                  {isTargetFounder ? 'Founder' : hasVip ? 'VIP Member' : 'Member'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Watch History & Bookmarks */}
        <div className="mt-6 space-y-6">
          <div className="bg-white dark:bg-[#13151C] rounded-3xl p-5 border border-slate-200 dark:border-white/10 shadow-sm">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Play className="w-4 h-4 text-[#E84A18]" />
              <span>Riwayat Nonton Terakhir</span>
            </h2>
            {profile.recentHistory && profile.recentHistory.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {profile.recentHistory.map((item: any, idx: number) => (
                  <div key={idx} className="rounded-2xl bg-slate-50 dark:bg-[#1A1D26] p-2.5 border border-slate-200 dark:border-white/5 space-y-1.5">
                    <img src={item.poster || defaultBannerImg} alt="" className="w-full h-28 rounded-xl object-cover" />
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.title}</p>
                    <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate">{item.episodeTitle || `Ep ${item.episodeNumber}`}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-4">Belum ada riwayat tontonan publik.</p>
            )}
          </div>

          <div className="bg-white dark:bg-[#13151C] rounded-3xl p-5 border border-slate-200 dark:border-white/10 shadow-sm">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-amber-500" />
              <span>Daftar Bookmark</span>
            </h2>
            {profile.bookmarks && profile.bookmarks.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {profile.bookmarks.map((b: any, idx: number) => (
                  <div key={idx} className="rounded-2xl bg-slate-50 dark:bg-[#1A1D26] p-2.5 border border-slate-200 dark:border-white/5 space-y-1.5">
                    <img src={b.poster || defaultBannerImg} alt="" className="w-full h-28 rounded-xl object-cover" />
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{b.title}</p>
                    <p className="text-[10px] text-amber-500 font-bold">★ {b.rating || '8.5'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-4">Belum ada bookmark publik.</p>
            )}
          </div>
        </div>
      </div>

      <GiftPremiumModal
        open={showGiftPremModal}
        onClose={() => setShowGiftPremModal(false)}
        initialMode="gift"
        initialRecipient={
          profile
            ? {
                uid: profile.uid,
                username: profile.username,
                name: profile.name,
                photoUrl: profile.photoUrl,
                isPremium: profile.isPremium,
                role: profile.role,
              }
            : null
        }
        onSuccess={(info) => {
          showToast(
            `Berhasil membagikan ${info.durationDays} Hari VIP Premium ke ${profile.name}!`
          );
          void loadProfile(true);
        }}
      />
    </Layout>
  );
}
