import { useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Film,
  MessageCircle,
  Search,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { TELEGRAM_BADGE_MAP, VerifiedBadge, resolveDisplayBadgeLabel } from '../components/VerifiedBadge';
import { StatusEmojiBadge } from '../components/VipEmojis';
import { AvatarDecoration, getLevelRankTier } from '../components/AvatarDecoration';
import { PROFILE_THEMES, useAuth } from '../context/AuthContext';
import type { PublicCommunityUser, RelationshipStatus } from '../types';

function getToken(): string {
  return (
    localStorage.getItem('zonestream_session_token_v1') ||
    localStorage.getItem('donghive_session_token_v1') ||
    ''
  );
}

export function CommunityPage() {
  const { user: me } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'all' | 'friends' | 'requests'>('all');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<PublicCommunityUser[]>([]);
  const [friends, setFriends] = useState<PublicCommunityUser[]>([]);
  const [incoming, setIncoming] = useState<PublicCommunityUser[]>([]);
  const [outgoing, setOutgoing] = useState<PublicCommunityUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyUid, setBusyUid] = useState('');

  const fetchSearchUsers = async (qStr: string) => {
    const trimmed = qStr.trim();
    if (!me || !trimmed) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`/api/social/users?q=${encodeURIComponent(trimmed)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (json.ok && Array.isArray(json.users)) {
        setUsers(json.users);
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriends = async () => {
    if (!me) return;
    try {
      const token = getToken();
      const res = await fetch('/api/social/friends', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok) {
        setFriends(json.friends || []);
        setIncoming(json.incomingRequests || []);
        setOutgoing(json.outgoingRequests || []);
      }
    } catch {
      // Ignore transient error
    }
  };

  useEffect(() => {
    if (!me || !query.trim()) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      fetchSearchUsers(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, me?.uid]);

  useEffect(() => {
    if (me) fetchFriends();
  }, [me?.uid]);

  const handleFriendAction = async (
    targetUid: string,
    action: 'request' | 'accept' | 'remove'
  ) => {
    if (!me) {
      navigate('/profile');
      return;
    }
    setBusyUid(targetUid);
    try {
      const token = getToken();
      const res = await fetch(`/api/social/friends/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUid }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        const nextRel = json.relationship as RelationshipStatus;
        setUsers((prev) =>
          prev.map((u) => (u.uid === targetUid ? { ...u, relationship: nextRel } : u))
        );
        await fetchFriends();
      }
    } finally {
      setBusyUid('');
    }
  };

  const displayedList =
    tab === 'friends' ? friends : tab === 'requests' ? [...incoming, ...outgoing] : users;

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 pt-5 pb-12 max-w-6xl mx-auto">
        {/* Hero Header Distinguishing User Search vs Anime/Donghua Search */}
        <div className="rounded-3xl bg-gradient-to-br from-white via-slate-50 to-orange-50/60 dark:from-[#141722] dark:via-[#11131C] dark:to-[#1D1310] border border-slate-200 dark:border-white/[0.08] p-5 sm:p-7 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#E84A18] mb-1">
                <Users className="w-4 h-4" />
                <span>Komunitas &amp; Pertemanan ZoneStream</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                Cari User via UID atau @Username
              </h1>
            </div>

            <div className="flex items-center flex-wrap gap-2 shrink-0">
              <Link
                to="/catalog"
                className="min-h-[40px] px-3.5 rounded-xl bg-white dark:bg-[#191C28] hover:border-[#E84A18] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-200 inline-flex items-center gap-1.5 transition-colors"
              >
                <Film className="w-3.5 h-3.5 text-[#E84A18]" />
                <span>Cari Anime/Donghua</span>
              </Link>
              <Link
                to="/chat"
                className="min-h-[40px] px-4 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-lg shadow-[#E84A18]/25 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Buka Chat WA</span>
              </Link>
            </div>
          </div>

          {/* Dedicated User Search Bar */}
          <div className="mt-4 relative">
            <Search className="w-4 h-4 text-[#E84A18] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              disabled={!me}
              onChange={(e) => {
                setQuery(e.target.value);
                if (tab !== 'all') setTab('all');
              }}
              placeholder={me ? 'Username atau UID' : 'Login untuk cari Username atau UID'}
              className="w-full h-12 pl-11 pr-4 rounded-2xl bg-white dark:bg-[#0B0D13] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#E84A18] shadow-sm disabled:opacity-60"
            />
          </div>

          {/* Tabs */}
          <div className="mt-4 flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                tab === 'all'
                  ? 'bg-[#E84A18] text-white shadow'
                  : 'bg-white/80 dark:bg-white/5 text-slate-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10'
              }`}
            >
              Hasil Pencarian ({users.length})
            </button>
            {me && (
              <>
                <button
                  type="button"
                  onClick={() => setTab('friends')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                    tab === 'friends'
                      ? 'bg-[#E84A18] text-white shadow'
                      : 'bg-white/80 dark:bg-white/5 text-slate-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10'
                  }`}
                >
                  Teman Saya ({friends.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTab('requests')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 ${
                    tab === 'requests'
                      ? 'bg-[#E84A18] text-white shadow'
                      : 'bg-white/80 dark:bg-white/5 text-slate-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10'
                  }`}
                >
                  <span>Permintaan</span>
                  {incoming.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-mono-tabular">
                      {incoming.length}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* User Cards Grid */}
        {!me ? (
          <div className="rounded-3xl bg-white dark:bg-[#13151C] border border-slate-200 dark:border-white/[0.06] p-10 text-center">
            <Users className="w-9 h-9 text-[#E84A18] mx-auto mb-3" />
            <p className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              Masuk Akun untuk Mencari Member
            </p>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
              Cari menggunakan Username atau UID.
            </p>
            <Link
              to="/profile"
              className="mt-4 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold shadow-lg shadow-[#E84A18]/25 transition-colors"
            >
              Login Sekarang
            </Link>
          </div>
        ) : loading && tab === 'all' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 rounded-3xl bg-slate-200 dark:bg-[#141720] animate-pulse"
              />
            ))}
          </div>
        ) : displayedList.length === 0 ? (
          <div className="rounded-3xl bg-white dark:bg-[#13151C] border border-slate-200 dark:border-white/[0.06] p-8 text-center">
            <Sparkles className="w-7 h-7 text-[#E84A18] mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {tab === 'friends'
                ? 'Belum ada teman'
                : tab === 'requests'
                ? 'Tidak ada permintaan pertemanan'
                : !query.trim()
                ? 'Ketik Username atau UID'
                : 'User tidak ditemukan'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedList.map((u) => {
              const isFounder = u.role === 'founder';
              const hasVip = Boolean(u.isPremium || isFounder);
              const themeDef =
                PROFILE_THEMES[hasVip ? u.profileTheme || 'default' : 'default'] ||
                PROFILE_THEMES.default;
              const rel = u.relationship || (me?.uid === u.uid ? 'self' : 'none');

              return (
                <div
                  key={u.uid}
                  className={`rounded-3xl border border-slate-200 dark:border-white/[0.08] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all flex flex-col justify-between ${themeDef.shellClass}`}
                >
                  {/* Mini Banner Header */}
                  <div>
                    <Link to={`/u/${u.uid}`} className="block relative h-20 overflow-hidden bg-slate-900">
                      {u.bannerUrl ? (
                        <img
                          src={u.bannerUrl}
                          alt={u.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover opacity-85"
                        />
                      ) : null}
                      <div
                        className={`absolute inset-0 bg-gradient-to-t ${themeDef.bannerGradientOverlay}`}
                      />
                      <span className="absolute top-2.5 right-3 text-[10px] font-mono-tabular font-bold px-2 py-0.5 rounded-full bg-black/55 text-white backdrop-blur-sm">
                        {isFounder ? 'Lv. ∞' : `Lv. ${u.level}`}
                      </span>
                    </Link>

                    <div className="px-4 pb-3 -mt-8 relative">
                      <Link to={`/u/${u.uid}`} className="inline-block relative">
                        <AvatarDecoration
                          src={u.photoUrl}
                          alt={u.name}
                          decorationId={u.activeBorder}
                          level={u.level}
                          isFounder={isFounder}
                          size="lg"
                        >
                          {u.isOnline && (
                            <span className="absolute bottom-0.5 right-0.5 z-30 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#13151C]" />
                          )}
                        </AvatarDecoration>
                      </Link>

                      <div className="mt-2">
                        <Link
                          to={`/u/${u.uid}`}
                          className="flex items-center gap-1.5 flex-wrap group"
                        >
                          <span className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-[#E84A18] transition-colors truncate">
                            {u.name}
                          </span>
                          {hasVip && (
                            <VerifiedBadge
                              size="sm"
                              isFounder={isFounder}
                              badgeLabel={u.activeBadge}
                            />
                          )}
                          {hasVip && u.statusEmoji && (
                            <StatusEmojiBadge statusEmoji={u.statusEmoji} size="xs" />
                          )}
                        </Link>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                          <span className="truncate">@{u.username}</span>
                          <span>·</span>
                          <span className={`font-bold shrink-0 ${getLevelRankTier(u.level, isFounder).textClass}`}>
                            {getLevelRankTier(u.level, isFounder).tierName}
                          </span>
                          <span>·</span>
                          <span className="font-mono-tabular shrink-0">UID: {u.uid}</span>
                        </div>
                        {hasVip && (() => {
                          const safeBadge = resolveDisplayBadgeLabel(u.activeBadge, isFounder, hasVip);
                          return (
                            <span
                              className={`inline-block mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                TELEGRAM_BADGE_MAP.get(safeBadge)?.pillClass ||
                                'bg-amber-500/20 text-amber-400'
                              }`}
                            >
                              {safeBadge}
                            </span>
                          );
                        })()}
                        <p className="mt-2 text-xs text-slate-600 dark:text-gray-300 line-clamp-2 min-h-[32px]">
                          {u.bio || 'Penonton setia Anime & Donghua di ZoneStream.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="px-4 pb-4 pt-2 border-t border-slate-200/70 dark:border-white/[0.06] flex items-center gap-2">
                    <Link
                      to={`/u/${u.uid}`}
                      className="flex-1 min-h-[38px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-slate-800 dark:text-white text-xs font-bold flex items-center justify-center transition-colors"
                    >
                      Lihat Profil
                    </Link>

                    {rel === 'none' && (
                      <button
                        type="button"
                        disabled={busyUid === u.uid}
                        onClick={() => handleFriendAction(u.uid, 'request')}
                        className="min-h-[38px] px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white/10 dark:hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1 transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Teman</span>
                      </button>
                    )}

                    {rel === 'pending_sent' && (
                      <button
                        type="button"
                        disabled={busyUid === u.uid}
                        onClick={() => handleFriendAction(u.uid, 'remove')}
                        className="min-h-[38px] px-3 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300 text-xs font-bold inline-flex items-center gap-1"
                        title="Klik untuk membatalkan"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Terkirim</span>
                      </button>
                    )}

                    {rel === 'pending_received' && (
                      <>
                        <button
                          type="button"
                          disabled={busyUid === u.uid}
                          onClick={() => handleFriendAction(u.uid, 'accept')}
                          className="min-h-[38px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Terima</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyUid === u.uid}
                          onClick={() => handleFriendAction(u.uid, 'remove')}
                          className="min-h-[38px] px-2.5 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-gray-300"
                          aria-label="Tolak"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {rel === 'friend' && (
                      <span className="min-h-[38px] px-3 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-xs font-bold inline-flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" />
                      </span>
                    )}

                    {rel !== 'self' && (
                      <button
                        type="button"
                        onClick={() => (me ? navigate(`/chat/${u.uid}`) : navigate('/profile'))}
                        className="min-h-[38px] px-3 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold inline-flex items-center gap-1 transition-colors"
                        aria-label={`Chat ${u.name}`}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Chat</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
