import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { Crown, Heart, Play, Plus, Search, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { AvatarWithBadges, ClanLeaderSvgEmblem, TopRankSvgEmblem } from '../components/AvatarBadges';
import defaultAvatarImg from '../assets/images/default_avatar_ink_1794755346613.jpg';

export function getLevelBadgeInfo(level: number) {
  if (level >= 9000) {
    return {
      title: 'God Level 9999',
      color: 'from-purple-500 via-rose-500 to-amber-400',
      border: 'border-amber-400 shadow-amber-500/80',
      icon: '⚡👑',
    };
  }
  return {
    title: `Level ${level}`,
    color: 'from-cyan-400 to-blue-600',
    border: 'border-cyan-400 shadow-cyan-500/40',
    icon: '⚡',
  };
}

function getToken(): string {
  return (
    localStorage.getItem('zonestream_session_token_v1') ||
    localStorage.getItem('donghive_session_token_v1') ||
    ''
  );
}

export function LeaderboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'charisma' | 'watchtime' | 'clans' | 'levels'>('charisma');
  const [clanFilter, setClanFilter] = useState<'Level' | 'Anggota' | 'Terbuka' | 'Baru'>('Level');
  const [clanSearch, setClanSearch] = useState('');

  const [realUsers, setRealUsers] = useState<any[]>([]);
  const [clans, setClans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningClanId, setJoiningClanId] = useState('');

  // Modal Create Clan
  const [showCreateClanModal, setShowCreateClanModal] = useState(false);
  const [clanName, setClanName] = useState('');
  const [clanTag, setClanTag] = useState('');
  const [clanDesc, setClanDesc] = useState('');
  const [creatingClan, setCreatingClan] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const token = getToken();
      const [usrRes, clanRes] = await Promise.all([
        fetch('/api/social/leaderboard', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch('/api/social/clans', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
      ]);
      const usrJson = await usrRes.json();
      const clanJson = await clanRes.json();

      let mappedUsers: any[] = [];
      if (usrJson.ok && Array.isArray(usrJson.users)) {
        mappedUsers = usrJson.users.map((u: any) => {
          const isMe = Boolean(user && u.uid === user.uid);
          const isFounder = u.role === 'founder';
          const userLevel = isFounder ? 999999 : (u.level || 1);
          const userCharisma = isFounder ? Math.max(9999, Number(u.charisma ?? 9999)) : Number(u.charisma ?? 0);
          const watched = Number(u.totalEpisodesWatched || 0);
          return {
            uid: u.uid,
            name: u.name || u.username,
            username: u.username,
            level: userLevel,
            exp: u.exp || 0,
            charisma: userCharisma,
            episodesWatched: watched,
            hours: `${Math.round((watched * 24) / 60)} Jam`,
            clan: u.clan || '',
            clanName: u.clanName || '',
            clanRank: u.clanRank || null,
            isClanLeader: Boolean(u.isClanLeader),
            topRank: u.topRank || null,
            topCategory: u.topCategory || null,
            avatar: u.photoUrl || defaultAvatarImg,
            isMe,
            isPremium: Boolean(u.isPremium || isFounder),
            activeBadge: u.activeBadge || (isFounder ? 'Verified Founder' : 'Member'),
            role: isFounder ? 'founder' : 'member',
          };
        });
      }

      if (user) {
        const uAny = user as any;
        const isFounder = user.email === 'wanglin72kk@gmail.com' || user.role === 'founder';
        const myIndex = mappedUsers.findIndex((u) => u.uid === user.uid);
        if (myIndex >= 0) {
          mappedUsers[myIndex] = {
            ...mappedUsers[myIndex],
            name: user.name || mappedUsers[myIndex].name,
            level: isFounder ? 999999 : (user.level || mappedUsers[myIndex].level || 1),
            exp: user.exp ?? mappedUsers[myIndex].exp ?? 0,
            charisma: isFounder
              ? Math.max(9999, Number(uAny.charisma ?? mappedUsers[myIndex].charisma ?? 9999))
              : Number(uAny.charisma ?? mappedUsers[myIndex].charisma ?? 0),
            episodesWatched: Number(uAny.totalEpisodesWatched ?? mappedUsers[myIndex].episodesWatched ?? 0),
            hours: `${Math.round((Number(uAny.totalEpisodesWatched ?? mappedUsers[myIndex].episodesWatched ?? 0) * 24) / 60)} Jam`,
            avatar: user.photoUrl || mappedUsers[myIndex].avatar || defaultAvatarImg,
            isMe: true,
          };
        } else {
          const watched = Number(uAny.totalEpisodesWatched || 0);
          mappedUsers.push({
            uid: user.uid,
            name: user.name || user.username,
            username: user.username,
            level: isFounder ? 999999 : (user.level || 1),
            exp: user.exp || 0,
            charisma: isFounder ? Math.max(9999, Number(uAny.charisma ?? 9999)) : Number(uAny.charisma ?? 0),
            episodesWatched: watched,
            hours: `${Math.round((watched * 24) / 60)} Jam`,
            clan: '',
            clanName: '',
            clanRank: null,
            isClanLeader: false,
            topRank: null,
            topCategory: null,
            avatar: user.photoUrl || defaultAvatarImg,
            isMe: true,
            isPremium: Boolean(user.isPremium || isFounder),
            activeBadge: user.activeBadge || (isFounder ? 'Verified Founder' : 'Member'),
            role: isFounder ? 'founder' : 'member',
          });
        }
      }

      setRealUsers(mappedUsers);

      if (clanJson.ok && Array.isArray(clanJson.clans)) {
        setClans(clanJson.clans);
      }
    } catch {
      // Keep existing state on transient error
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadData();
    const timer = setInterval(() => {
      void loadData();
    }, 15000);
    return () => clearInterval(timer);
  }, [loadData]);

  const handleCreateClan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/profile');
      return;
    }
    if (!clanName.trim() || !clanTag.trim() || creatingClan) return;
    setCreatingClan(true);
    try {
      const token = getToken();
      const res = await fetch('/api/social/clans/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: clanName.trim(),
          tag: clanTag.trim().toUpperCase(),
          description: clanDesc.trim(),
          status: 'Terbuka',
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setShowCreateClanModal(false);
        setClanName('');
        setClanTag('');
        setClanDesc('');
        setActiveTab('clans');
        await loadData();
      } else {
        alert(json.error || 'Gagal membuat klan');
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setCreatingClan(false);
    }
  };

  const handleJoinClan = async (clanId: string) => {
    if (!user) {
      navigate('/profile');
      return;
    }
    setJoiningClanId(clanId);
    try {
      const token = getToken();
      const res = await fetch('/api/social/clans/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clanId }),
      });
      const json = await res.json();
      if (res.ok) {
        await loadData();
      } else {
        alert(json.error || 'Gagal bergabung');
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setJoiningClanId('');
    }
  };

  const topCharismaUsers = useMemo(
    () =>
      [...realUsers]
        .sort((a, b) => b.charisma - a.charisma || b.level - a.level || b.episodesWatched - a.episodesWatched)
        .slice(0, 20),
    [realUsers]
  );

  const topWatchers = useMemo(
    () =>
      [...realUsers]
        .sort((a, b) => b.episodesWatched - a.episodesWatched || b.level - a.level || b.charisma - a.charisma)
        .slice(0, 20),
    [realUsers]
  );

  const topLevels = useMemo(
    () =>
      [...realUsers]
        .sort((a, b) => b.level - a.level || b.exp - a.exp || b.episodesWatched - a.episodesWatched)
        .slice(0, 20),
    [realUsers]
  );

  const filteredClans = useMemo(() => {
    let list = [...clans];
    const q = clanSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          String(c.name || '').toLowerCase().includes(q) ||
          String(c.tag || '').toLowerCase().includes(q) ||
          String(c.clanId || '').toLowerCase().includes(q) ||
          String(c.leaderName || '').toLowerCase().includes(q)
      );
    }
    if (clanFilter === 'Terbuka') {
      list = list.filter((c) => c.status === 'Terbuka');
    } else if (clanFilter === 'Anggota') {
      list.sort((a, b) => (b.membersCount || b.members?.length || 0) - (a.membersCount || a.members?.length || 0));
    } else if (clanFilter === 'Baru') {
      list.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    } else {
      list.sort(
        (a, b) =>
          (b.realtimeScore || 0) - (a.realtimeScore || 0) ||
          (b.level || 1) - (a.level || 1) ||
          (b.charisma || 0) - (a.charisma || 0)
      );
    }
    return list;
  }, [clans, clanSearch, clanFilter]);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-[#161923] to-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Peringkat &amp; Hall of Fame
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Peringkat real-time pengguna &amp; klan nyata berdasarkan Level, Like (Charisma), dan Aktivitas Nonton.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-gray-300">
              <span className="inline-flex items-center gap-1.5">
                <ClanLeaderSvgEmblem className="w-4 h-4 shrink-0" />
                <span>Lencana Pemimpin Klan</span>
              </span>
              <span aria-hidden="true" className="text-gray-600">·</span>
              <span className="inline-flex items-center gap-1.5">
                <TopRankSvgEmblem rank={1} className="w-4 h-4 shrink-0" />
                <span>Medali Top #1–#10 (klik lencana di avatar)</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => (user ? setShowCreateClanModal(true) : navigate('/profile'))}
            className="px-5 py-2.5 rounded-2xl bg-[#00A884] hover:bg-[#06CF9C] text-white text-xs font-extrabold inline-flex items-center gap-2 shadow-lg shadow-[#00A884]/30 transition-transform hover:scale-105 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Klan Baru</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white dark:bg-[#14161F] p-2 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('charisma')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'charisma'
                ? 'bg-[#E84A18] text-white shadow-md'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Heart className="w-3.5 h-3.5 fill-current" />
            <span>Top Charisma</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('watchtime')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'watchtime'
                ? 'bg-[#E84A18] text-white shadow-md'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Top Nonton Anime</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('clans')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'clans'
                ? 'bg-[#00A884] text-white shadow-md'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Clan Teratas</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('levels')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'levels'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Peringkat Level</span>
          </button>
        </div>

        {/* Tab 1: Top Charisma */}
        {activeTab === 'charisma' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gradient-to-r from-pink-900/40 via-purple-900/40 to-slate-900 border border-pink-500/30 p-4 rounded-2xl">
              <div className="text-center sm:text-left">
                <p className="text-xs font-extrabold text-white">Cara Menaikkan Charisma (Like Profil):</p>
                <p className="text-[11px] text-pink-300 mt-0.5">
                  Semua user memulai dari 0 Charisma. Kunjungi profil teman dan klik tombol Sukai Profil (♥) untuk menambah poin Charisma mereka secara real-time!
                </p>
              </div>
              <Link
                to="/community"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white text-xs font-bold shadow-lg shadow-pink-500/30 inline-flex items-center gap-1.5 shrink-0"
              >
                <Heart className="w-4 h-4 fill-current" />
                <span>Cari &amp; Like Profil User</span>
              </Link>
            </div>

            {topCharismaUsers.length > 0 && (
              <div className="relative pt-8 pb-6 px-4 bg-gradient-to-b from-[#251B2E] via-[#181522] to-[#11131A] rounded-3xl border border-pink-500/20 shadow-2xl overflow-visible">
                <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300 text-[11px] font-extrabold tracking-widest uppercase whitespace-nowrap">
                  ❤️ The Big 3 • Paling Dicintai
                </div>

                <div className="grid grid-cols-3 gap-3 items-end pt-8">
                  {/* Rank 2 */}
                  <div className="flex flex-col items-center text-center space-y-2">
                    {topCharismaUsers[1] && (
                      <Link to={`/u/${topCharismaUsers[1].uid}`} className="group flex flex-col items-center space-y-2">
                        <div className="relative">
                          <AvatarWithBadges
                            uid={topCharismaUsers[1].uid}
                            ownerName={topCharismaUsers[1].name}
                            clanLeader={
                              topCharismaUsers[1].isClanLeader
                                ? {
                                    isLeader: true,
                                    clanTag: topCharismaUsers[1].clan,
                                    clanName: topCharismaUsers[1].clanName,
                                    clanRank: topCharismaUsers[1].clanRank,
                                  }
                                : null
                            }
                            topRank={{ rank: 2, category: 'charisma' }}
                            size="lg"
                            popoverAlign="left"
                          >
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-0.5 bg-gradient-to-tr from-cyan-400 to-purple-500 shadow-lg shadow-purple-500/30">
                              <img
                                src={topCharismaUsers[1].avatar}
                                alt={topCharismaUsers[1].name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full rounded-full object-cover"
                              />
                            </div>
                          </AvatarWithBadges>
                          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-slate-300 text-slate-900 text-xs font-extrabold flex items-center justify-center shadow z-20">
                            2
                          </span>
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-extrabold text-white group-hover:text-pink-300 truncate max-w-[105px]">
                            {topCharismaUsers[1].name}
                          </p>
                          <p className="text-[10px] text-pink-400 font-bold flex items-center justify-center gap-0.5 mt-0.5">
                            <Heart className="w-3 h-3 fill-current" /> {topCharismaUsers[1].charisma}
                          </p>
                        </div>
                      </Link>
                    )}
                  </div>

                  {/* Rank 1 */}
                  <div className="flex flex-col items-center text-center space-y-2 -translate-y-5">
                    <Crown className="w-8 h-8 text-amber-400 animate-bounce drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]" />
                    {topCharismaUsers[0] && (
                      <Link to={`/u/${topCharismaUsers[0].uid}`} className="group flex flex-col items-center space-y-2">
                        <div className="relative">
                          <AvatarWithBadges
                            uid={topCharismaUsers[0].uid}
                            ownerName={topCharismaUsers[0].name}
                            clanLeader={
                              topCharismaUsers[0].isClanLeader
                                ? {
                                    isLeader: true,
                                    clanTag: topCharismaUsers[0].clan,
                                    clanName: topCharismaUsers[0].clanName,
                                    clanRank: topCharismaUsers[0].clanRank,
                                  }
                                : null
                            }
                            topRank={{ rank: 1, category: 'charisma' }}
                            size="xl"
                            popoverAlign="center"
                          >
                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 bg-gradient-to-tr from-amber-400 via-rose-500 to-amber-300 shadow-2xl shadow-amber-500/40 ring-4 ring-amber-400/30">
                              <img
                                src={topCharismaUsers[0].avatar}
                                alt={topCharismaUsers[0].name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full rounded-full object-cover"
                              />
                            </div>
                          </AvatarWithBadges>
                          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 text-slate-950 text-xs font-extrabold flex items-center justify-center shadow z-20">
                            1
                          </span>
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-extrabold text-amber-300 group-hover:text-white truncate max-w-[130px]">
                            {topCharismaUsers[0].name}
                          </p>
                          <p className="text-[11px] text-pink-400 font-extrabold flex items-center justify-center gap-0.5 mt-0.5">
                            <Heart className="w-3.5 h-3.5 fill-current" /> {topCharismaUsers[0].charisma}
                          </p>
                        </div>
                      </Link>
                    )}
                  </div>

                  {/* Rank 3 */}
                  <div className="flex flex-col items-center text-center space-y-2">
                    {topCharismaUsers[2] && (
                      <Link to={`/u/${topCharismaUsers[2].uid}`} className="group flex flex-col items-center space-y-2">
                        <div className="relative">
                          <AvatarWithBadges
                            uid={topCharismaUsers[2].uid}
                            ownerName={topCharismaUsers[2].name}
                            clanLeader={
                              topCharismaUsers[2].isClanLeader
                                ? {
                                    isLeader: true,
                                    clanTag: topCharismaUsers[2].clan,
                                    clanName: topCharismaUsers[2].clanName,
                                    clanRank: topCharismaUsers[2].clanRank,
                                  }
                                : null
                            }
                            topRank={{ rank: 3, category: 'charisma' }}
                            size="lg"
                            popoverAlign="right"
                          >
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-0.5 bg-gradient-to-tr from-amber-600 to-rose-700 shadow-lg shadow-rose-900/40">
                              <img
                                src={topCharismaUsers[2].avatar}
                                alt={topCharismaUsers[2].name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full rounded-full object-cover"
                              />
                            </div>
                          </AvatarWithBadges>
                          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-amber-700 text-white text-xs font-extrabold flex items-center justify-center shadow z-20">
                            3
                          </span>
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-extrabold text-white group-hover:text-pink-300 truncate max-w-[105px]">
                            {topCharismaUsers[2].name}
                          </p>
                          <p className="text-[10px] text-pink-400 font-bold flex items-center justify-center gap-0.5 mt-0.5">
                            <Heart className="w-3 h-3 fill-current" /> {topCharismaUsers[2].charisma}
                          </p>
                        </div>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {loading && topCharismaUsers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">Memuat peringkat pengguna...</div>
              ) : (
                topCharismaUsers.slice(3).map((u, idx) => {
                  const badgeInfo = getLevelBadgeInfo(u.level);
                  const rowRank = idx + 4;
                  return (
                    <Link
                      key={u.uid}
                      to={`/u/${u.uid}`}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#14161F] border border-slate-200 dark:border-white/5 hover:border-pink-500/40 shadow-sm transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="w-6 text-center text-xs font-extrabold text-slate-400">{rowRank}</span>
                        <AvatarWithBadges
                          uid={u.uid}
                          ownerName={u.name}
                          clanLeader={
                            u.isClanLeader
                              ? {
                                  isLeader: true,
                                  clanTag: u.clan,
                                  clanName: u.clanName,
                                  clanRank: u.clanRank,
                                }
                              : null
                          }
                          topRank={rowRank <= 10 ? { rank: rowRank, category: 'charisma' } : null}
                          size="md"
                          popoverAlign="left"
                        >
                          <img
                            src={u.avatar}
                            alt={u.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full object-cover shrink-0"
                          />
                        </AvatarWithBadges>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                              {u.name}
                            </span>
                            {u.isPremium && (
                              <VerifiedBadge
                                size="sm"
                                isFounder={u.role === 'founder'}
                                badgeLabel={u.activeBadge}
                              />
                            )}
                            {u.clan && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[10px] font-bold">
                                [{u.clan}]
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 font-semibold">
                              {badgeInfo.icon} {u.role === 'founder' ? 'Lv. ∞' : `Lv. ${u.level}`}
                            </span>
                            <span className="text-slate-400">UID: {u.uid}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-pink-500 font-bold text-xs shrink-0">
                        <Heart className="w-4 h-4 fill-current" />
                        <span>{u.charisma}</span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Top Watchtime */}
        {activeTab === 'watchtime' && (
          <div className="space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white mb-2">
              Peringkat Penonton Anime &amp; Donghua Terbanyak
            </h2>
            {topWatchers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-[#14161F] rounded-2xl border border-slate-200 dark:border-white/5">
                Belum ada data tontonan pengguna.
              </div>
            ) : (
              topWatchers.map((w, idx) => (
                <Link
                  key={w.uid}
                  to={`/u/${w.uid}`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#14161F] border border-slate-200 dark:border-white/5 hover:border-[#E84A18]/40 shadow-sm transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0 ${
                        idx === 0
                          ? 'bg-amber-500 text-white'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-900'
                          : idx === 2
                          ? 'bg-amber-800 text-white'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <AvatarWithBadges
                      uid={w.uid}
                      ownerName={w.name}
                      clanLeader={
                        w.isClanLeader
                          ? {
                              isLeader: true,
                              clanTag: w.clan,
                              clanName: w.clanName,
                              clanRank: w.clanRank,
                            }
                          : null
                      }
                      topRank={idx + 1 <= 10 ? { rank: idx + 1, category: 'watchtime' } : null}
                      size="md"
                      popoverAlign="left"
                      popoverPlacement={idx === 0 ? 'bottom' : 'top'}
                    >
                      <img
                        src={w.avatar}
                        alt={w.name}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-full object-cover shrink-0"
                      />
                    </AvatarWithBadges>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {w.name}
                        </span>
                        {w.isPremium && (
                          <VerifiedBadge
                            size="sm"
                            isFounder={w.role === 'founder'}
                            badgeLabel={w.activeBadge}
                          />
                        )}
                        {w.clan && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-500 text-[10px] font-bold">
                            [{w.clan}]
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                        {w.episodesWatched} Episode Ditonton · Total Durasi:{' '}
                        <strong className="text-[#E84A18]">{w.hours}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-3 py-1 rounded-xl bg-[#E84A18]/15 text-[#E84A18] text-xs font-bold">
                      Rank #{idx + 1}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Top Clans (100% Real User-Created Clans, Zero Bots) */}
        {activeTab === 'clans' && (
          <div className="space-y-6">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={clanSearch}
                onChange={(e) => setClanSearch(e.target.value)}
                placeholder="Cari nama klan, tag, atau ID..."
                className="w-full h-11 pl-10 pr-4 rounded-2xl bg-white dark:bg-[#161922] border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#00A884]"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {(['Level', 'Anggota', 'Terbuka', 'Baru'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setClanFilter(filter)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                    clanFilter === filter
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-gray-300'
                  }`}
                >
                  {filter}
                </button>
              ))}
              <button
                type="button"
                onClick={() => (user ? setShowCreateClanModal(true) : navigate('/profile'))}
                className="ml-auto px-4 py-1.5 rounded-full bg-[#00A884] text-white text-xs font-bold inline-flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Klan</span>
              </button>
            </div>

            {filteredClans.length === 0 ? (
              <div className="rounded-3xl bg-white dark:bg-[#14161F] border border-slate-200 dark:border-white/10 p-10 text-center space-y-3">
                <Users className="w-10 h-10 text-[#00A884] mx-auto" />
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Belum Ada Klan Terdaftar
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-400 max-w-sm mx-auto">
                  Jadilah pelopor dengan membuat klan pertama! Klan akan langsung masuk peringkat Top Klan otomatis sesuai Level, Like, dan jumlah tontonan anggotanya.
                </p>
                <button
                  type="button"
                  onClick={() => (user ? setShowCreateClanModal(true) : navigate('/profile'))}
                  className="px-5 py-2.5 rounded-xl bg-[#00A884] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Klan Pertamamu</span>
                </button>
              </div>
            ) : (
              <>
                {/* Dynamic Clan Podium Top 3 */}
                <div className="relative pt-6 pb-6 px-4 bg-gradient-to-b from-[#251B2E] via-[#181522] to-[#11131A] rounded-3xl border border-purple-500/20 shadow-2xl overflow-visible">
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[11px] font-extrabold tracking-widest uppercase whitespace-nowrap">
                    👑 Clan Teratas
                  </div>

                  <div className="grid grid-cols-3 gap-3 items-end pt-8">
                    {/* Rank 2 */}
                    <div className="flex flex-col items-center text-center space-y-2">
                      {filteredClans[1] && (
                        <>
                          <div className="relative">
                            <AvatarWithBadges
                              uid={filteredClans[1].leaderUid}
                              ownerName={filteredClans[1].leaderName || filteredClans[1].name}
                              clanLeader={{
                                isLeader: true,
                                clanTag: filteredClans[1].tag,
                                clanName: filteredClans[1].name,
                                clanRank: 2,
                              }}
                              topRank={{ rank: 2 }}
                              size="lg"
                              popoverAlign="left"
                            >
                              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-0.5 bg-gradient-to-tr from-cyan-400 to-blue-600 shadow-lg flex items-center justify-center overflow-hidden bg-[#1A1D26]">
                                {filteredClans[1].avatarUrl || filteredClans[1].leaderPhoto ? (
                                  <img
                                    src={filteredClans[1].avatarUrl || filteredClans[1].leaderPhoto}
                                    alt={filteredClans[1].name}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full rounded-full object-cover"
                                  />
                                ) : (
                                  <span className="text-white font-extrabold text-sm">[{filteredClans[1].tag}]</span>
                                )}
                              </div>
                            </AvatarWithBadges>
                            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-slate-300 text-slate-900 text-xs font-extrabold flex items-center justify-center shadow z-20">
                              2
                            </span>
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[105px]">
                              {filteredClans[1].name}
                            </p>
                            <p className="text-[10px] text-amber-400 font-bold mt-0.5">
                              [{filteredClans[1].tag}] · Lv {filteredClans[1].level}
                            </p>
                            <p className="text-[9px] text-gray-400 font-mono">
                              {filteredClans[1].membersCount || filteredClans[1].members?.length || 1} anggota · ♥ {filteredClans[1].charisma || 0}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Rank 1 */}
                    <div className="flex flex-col items-center text-center space-y-2 -translate-y-4">
                      <Crown className="w-7 h-7 text-amber-400 animate-bounce" />
                      {filteredClans[0] && (
                        <>
                          <div className="relative">
                            <AvatarWithBadges
                              uid={filteredClans[0].leaderUid}
                              ownerName={filteredClans[0].leaderName || filteredClans[0].name}
                              clanLeader={{
                                isLeader: true,
                                clanTag: filteredClans[0].tag,
                                clanName: filteredClans[0].name,
                                clanRank: 1,
                              }}
                              topRank={{ rank: 1 }}
                              size="xl"
                              popoverAlign="center"
                            >
                              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 bg-gradient-to-tr from-amber-400 via-rose-500 to-amber-300 shadow-2xl flex items-center justify-center overflow-hidden bg-[#1A1D26] ring-4 ring-amber-400/30">
                                {filteredClans[0].avatarUrl || filteredClans[0].leaderPhoto ? (
                                  <img
                                    src={filteredClans[0].avatarUrl || filteredClans[0].leaderPhoto}
                                    alt={filteredClans[0].name}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full rounded-full object-cover"
                                  />
                                ) : (
                                  <span className="text-white font-extrabold text-lg">[{filteredClans[0].tag}]</span>
                                )}
                              </div>
                            </AvatarWithBadges>
                            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 text-slate-950 text-xs font-extrabold flex items-center justify-center shadow z-20">
                              1
                            </span>
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-extrabold text-amber-300 truncate max-w-[130px]">
                              {filteredClans[0].name}
                            </p>
                            <p className="text-[11px] text-amber-400 font-extrabold mt-0.5">
                              [{filteredClans[0].tag}] · Lv {filteredClans[0].level}
                            </p>
                            <p className="text-[10px] text-gray-300 font-mono">
                              {filteredClans[0].membersCount || filteredClans[0].members?.length || 1} anggota · ♥ {filteredClans[0].charisma || 0}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Rank 3 */}
                    <div className="flex flex-col items-center text-center space-y-2">
                      {filteredClans[2] && (
                        <>
                          <div className="relative">
                            <AvatarWithBadges
                              uid={filteredClans[2].leaderUid}
                              ownerName={filteredClans[2].leaderName || filteredClans[2].name}
                              clanLeader={{
                                isLeader: true,
                                clanTag: filteredClans[2].tag,
                                clanName: filteredClans[2].name,
                                clanRank: 3,
                              }}
                              topRank={{ rank: 3 }}
                              size="lg"
                              popoverAlign="right"
                            >
                              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-0.5 bg-gradient-to-tr from-purple-500 to-pink-600 shadow-lg flex items-center justify-center overflow-hidden bg-[#1A1D26]">
                                {filteredClans[2].avatarUrl || filteredClans[2].leaderPhoto ? (
                                  <img
                                    src={filteredClans[2].avatarUrl || filteredClans[2].leaderPhoto}
                                    alt={filteredClans[2].name}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full rounded-full object-cover"
                                  />
                                ) : (
                                  <span className="text-white font-extrabold text-sm">[{filteredClans[2].tag}]</span>
                                )}
                              </div>
                            </AvatarWithBadges>
                            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-amber-700 text-white text-xs font-extrabold flex items-center justify-center shadow z-20">
                              3
                            </span>
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[105px]">
                              {filteredClans[2].name}
                            </p>
                            <p className="text-[10px] text-amber-400 font-bold mt-0.5">
                              [{filteredClans[2].tag}] · Lv {filteredClans[2].level}
                            </p>
                            <p className="text-[9px] text-gray-400 font-mono">
                              {filteredClans[2].membersCount || filteredClans[2].members?.length || 1} anggota · ♥ {filteredClans[2].charisma || 0}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* All Ranked Clans List */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
                    Daftar Klan Real-Time ({filteredClans.length})
                  </p>
                  {filteredClans.map((c, idx) => {
                    const isMember = Boolean(user && Array.isArray(c.members) && c.members.includes(user.uid));
                    const isFull = (c.membersCount || c.members?.length || 1) >= (c.maxMembers || 50);
                    return (
                      <div
                        key={c.clanId || c.name}
                        className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#14161F] border border-slate-200 dark:border-white/5 shadow-sm gap-3"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="w-6 text-center text-xs font-extrabold text-slate-400">{idx + 1}</span>
                          <AvatarWithBadges
                            uid={c.leaderUid}
                            ownerName={c.leaderName || c.name}
                            clanLeader={{
                              isLeader: true,
                              clanTag: c.tag,
                              clanName: c.name,
                              clanRank: idx + 1,
                            }}
                            topRank={idx + 1 <= 10 ? { rank: idx + 1 } : null}
                            size="md"
                            popoverAlign="left"
                          >
                            {c.avatarUrl || c.leaderPhoto ? (
                              <img
                                src={c.avatarUrl || c.leaderPhoto}
                                alt={c.name}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-xl object-cover shrink-0 border border-amber-500/30"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center font-extrabold text-xs shrink-0 border border-amber-500/30">
                                [{c.tag}]
                              </div>
                            )}
                          </AvatarWithBadges>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                                {c.name}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                                [{c.tag}] · Lv {c.level || 1}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                              {c.membersCount || c.members?.length || 1} / {c.maxMembers || 50} anggota · ♥ {c.charisma || 0} Like · 🎬 {c.episodesWatched || 0} Ep
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {isMember ? (
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                              Anggota
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isFull || joiningClanId === c.clanId}
                              onClick={() => handleJoinClan(c.clanId)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shadow ${
                                isFull
                                  ? 'bg-slate-700 text-gray-400 cursor-not-allowed'
                                  : 'bg-[#00A884] hover:bg-[#06CF9C] text-white'
                              }`}
                            >
                              {joiningClanId === c.clanId ? '...' : isFull ? 'Penuh' : 'Gabung'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 4: Level Rankings */}
        {activeTab === 'levels' && (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/30 text-xs text-amber-200">
              ⚡ <strong>Peringkat Level Real-Time:</strong> Setiap user yang lebih rajin menonton anime &amp; donghua akan otomatis naik level dan menyalip peringkat secara real-time!
            </div>
            {topLevels.map((lvl, idx) => {
              const info = getLevelBadgeInfo(lvl.level);
              return (
                <Link
                  key={lvl.uid}
                  to={`/u/${lvl.uid}`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#14161F] border border-slate-200 dark:border-white/5 hover:border-amber-500/40 shadow-sm transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0 ${
                        idx === 0
                          ? 'bg-amber-500 text-white'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-900'
                          : idx === 2
                          ? 'bg-amber-800 text-white'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <AvatarWithBadges
                      uid={lvl.uid}
                      ownerName={lvl.name}
                      clanLeader={
                        lvl.isClanLeader
                          ? {
                              isLeader: true,
                              clanTag: lvl.clan,
                              clanName: lvl.clanName,
                              clanRank: lvl.clanRank,
                            }
                          : null
                      }
                      topRank={idx + 1 <= 10 ? { rank: idx + 1, category: 'level' } : null}
                      size="md"
                      popoverAlign="left"
                      popoverPlacement={idx === 0 ? 'bottom' : 'top'}
                    >
                      <img
                        src={lvl.avatar}
                        alt={lvl.name}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-full object-cover shrink-0"
                      />
                    </AvatarWithBadges>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {lvl.name}
                        </span>
                        {lvl.isPremium && (
                          <VerifiedBadge
                            size="sm"
                            isFounder={lvl.role === 'founder'}
                            badgeLabel={lvl.activeBadge}
                          />
                        )}
                        {lvl.clan && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-500 text-[10px] font-bold">
                            [{lvl.clan}]
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-purple-500/20 text-amber-400 font-extrabold text-[11px] border border-amber-500/30">
                          {info.icon} {lvl.role === 'founder' ? 'God Level 9999' : `Level ${lvl.level}`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-xs font-mono font-bold text-slate-400">UID: {lvl.uid}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Modal Buat Klan */}
        {showCreateClanModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#14161F] border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Buat Klan Baru
              </h3>
              <form onSubmit={handleCreateClan} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-gray-300 mb-1">
                    Nama Klan
                  </label>
                  <input
                    type="text"
                    required
                    value={clanName}
                    onChange={(e) => setClanName(e.target.value)}
                    placeholder="Contoh: ZoneVerzon"
                    className="w-full h-10 px-3 rounded-xl bg-slate-100 dark:bg-[#202533] text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-gray-300 mb-1">
                    Tag Klan (3-5 Huruf)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={clanTag}
                    onChange={(e) => setClanTag(e.target.value)}
                    placeholder="Contoh: PVE"
                    className="w-full h-10 px-3 rounded-xl bg-slate-100 dark:bg-[#202533] text-xs text-slate-900 dark:text-white uppercase border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-gray-300 mb-1">
                    Deskripsi / Moto Klan
                  </label>
                  <textarea
                    rows={3}
                    value={clanDesc}
                    onChange={(e) => setClanDesc(e.target.value)}
                    placeholder="Moto atau syarat masuk klan..."
                    className="w-full p-3 rounded-xl bg-slate-100 dark:bg-[#202533] text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateClanModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white text-xs font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={creatingClan}
                    className="px-5 py-2 rounded-xl bg-[#00A884] text-white text-xs font-bold shadow"
                  >
                    {creatingClan ? 'Membuat...' : 'Buat Klan Sekarang'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
