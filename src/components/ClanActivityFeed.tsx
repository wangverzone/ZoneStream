import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  Check,
  Crown,
  Flame,
  RefreshCw,
  Search,
  Shield,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import defaultAvatarImg from '../assets/images/default_avatar_ink_1794755346613.jpg';

export type ClanActivityFilter =
  | 'all'
  | 'level_up'
  | 'mission_complete'
  | 'member_join'
  | 'role_change';

export type ClanMemberRole = 'leader' | 'co_leader' | 'elder' | 'member';

export interface ClanActivityEntry {
  _id: string;
  clanId: string;
  actorUid: string;
  actorName: string;
  actorPhoto: string;
  actorLevel?: number;
  actorRole?: string;
  isLeader?: boolean;
  type: 'level_up' | 'mission_complete' | 'member_join' | 'role_change' | 'member_kick';
  title: string;
  detail: string;
  expGained: number;
  newLevel: number;
  streakDay: number;
  createdAt: string;
}

export interface MostActiveClanMember {
  uid: string;
  name: string;
  photoUrl: string;
  level: number;
  role: string;
  clanRole: ClanMemberRole;
  isLeader: boolean;
  isOnline?: boolean;
  isInactive?: boolean;
  inactiveDays?: number | null;
  episodesWatched: number;
  dailyEpisodes: number;
  watchStreak: number;
  missionsCompleted: number;
  levelUps: number;
  latestActivityAt: string;
  activityScore: number;
}

const ROLE_DISPLAY: Record<ClanMemberRole, { label: string; textClass: string }> = {
  leader: { label: 'Ketua Klan', textClass: 'text-amber-500 dark:text-amber-400' },
  co_leader: { label: 'Wakil Ketua', textClass: 'text-sky-500 dark:text-sky-400' },
  elder: { label: 'Tetua Klan', textClass: 'text-emerald-600 dark:text-emerald-400' },
  member: { label: 'Anggota', textClass: 'text-slate-500 dark:text-gray-400' },
};

function getToken(): string {
  return (
    localStorage.getItem('zonestream_session_token_v1') ||
    localStorage.getItem('donghive_session_token_v1') ||
    ''
  );
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return 'Belum tercatat';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return 'Belum tercatat';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 45) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}j lalu`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}h lalu`;
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

interface ClanActivityFeedProps {
  clanId: string;
  isLeader: boolean;
  currentUid?: string;
  onClanUpdated?: () => void;
}

export function ClanActivityFeed({
  clanId,
  isLeader,
  currentUid = '',
  onClanUpdated,
}: ClanActivityFeedProps) {
  const [filter, setFilter] = useState<ClanActivityFilter>('all');
  const [memberViewFilter, setMemberViewFilter] = useState<'all' | 'inactive' | 'officers'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [activities, setActivities] = useState<ClanActivityEntry[]>([]);
  const [mostActiveMembers, setMostActiveMembers] = useState<MostActiveClanMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [promotingUid, setPromotingUid] = useState('');
  const [confirmKickUid, setConfirmKickUid] = useState('');
  const [kickingUid, setKickingUid] = useState('');

  const loadActivity = useCallback(
    async (isManual = false) => {
      if (!clanId) return;
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      if (isManual) setRefreshing(true);
      try {
        const res = await fetch(
          `/api/social/clans/${encodeURIComponent(clanId)}/activity?filter=${encodeURIComponent(filter)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const json = await res.json();
        if (res.ok && json.ok) {
          setActivities(Array.isArray(json.activities) ? json.activities : []);
          setMostActiveMembers(
            Array.isArray(json.mostActiveMembers) ? json.mostActiveMembers : []
          );
          setError(null);
        } else {
          setError(json.error || 'Gagal memuat aktivitas klan.');
        }
      } catch {
        setError('Koneksi terganggu saat memuat log aktivitas klan.');
      } finally {
        setLoading(false);
        if (isManual) setRefreshing(false);
      }
    },
    [clanId, filter]
  );

  useEffect(() => {
    setLoading(true);
    void loadActivity(false);
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadActivity(false);
      }
    }, 4000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadActivity(false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadActivity]);

  useEffect(() => {
    if (!actionNotice) return;
    const t = window.setTimeout(() => setActionNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [actionNotice]);

  const myClanRole = useMemo<ClanMemberRole>(() => {
    if (isLeader) return 'leader';
    const me = mostActiveMembers.find((m) => m.uid === currentUid);
    return me?.clanRole || 'member';
  }, [isLeader, mostActiveMembers, currentUid]);

  const canKickMembers = isLeader || myClanRole === 'co_leader';
  const inactiveCount = useMemo(
    () => mostActiveMembers.filter((m) => m.isInactive).length,
    [mostActiveMembers]
  );

  const handlePromoteMember = async (targetUid: string, newRole: ClanMemberRole) => {
    if (!isLeader || promotingUid) return;
    setPromotingUid(targetUid);
    setActionNotice(null);
    try {
      const token = getToken();
      const res = await fetch('/api/social/clans/promote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clanId, targetUid, newRole }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setActionNotice({
          type: 'ok',
          text: json.message || 'Jabatan anggota klan berhasil diperbarui!',
        });
        await loadActivity(false);
        onClanUpdated?.();
      } else {
        setActionNotice({
          type: 'err',
          text: json.error || 'Gagal memperbarui jabatan anggota.',
        });
      }
    } catch {
      setActionNotice({ type: 'err', text: 'Gagal menghubungi server untuk promosi jabatan.' });
    } finally {
      setPromotingUid('');
    }
  };

  const handleKickMember = async (targetUid: string, isInactive?: boolean) => {
    if (!canKickMembers || kickingUid) return;
    setKickingUid(targetUid);
    setActionNotice(null);
    try {
      const token = getToken();
      const res = await fetch('/api/social/clans/kick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clanId,
          targetUid,
          reason: isInactive
            ? 'Anggota tidak aktif dalam klan'
            : 'Dikeluarkan oleh pengurus klan',
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setConfirmKickUid('');
        setActionNotice({
          type: 'ok',
          text: json.message || 'Anggota berhasil dikeluarkan dari klan.',
        });
        await loadActivity(false);
        onClanUpdated?.();
      } else {
        setActionNotice({
          type: 'err',
          text: json.error || 'Gagal mengeluarkan anggota dari klan.',
        });
      }
    } catch {
      setActionNotice({ type: 'err', text: 'Gagal menghubungi server saat mengeluarkan anggota.' });
    } finally {
      setKickingUid('');
    }
  };

  const filteredMembers = useMemo(() => {
    let list = [...mostActiveMembers];
    if (memberViewFilter === 'inactive') {
      list = list.filter((m) => m.isInactive);
    } else if (memberViewFilter === 'officers') {
      list = list.filter((m) => m.clanRole !== 'member');
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.uid.toLowerCase().includes(q) ||
          ROLE_DISPLAY[m.clanRole || 'member'].label.toLowerCase().includes(q)
      );
    }
    return list;
  }, [mostActiveMembers, memberViewFilter, searchQuery]);

  const filteredActivities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activities;
    return activities.filter(
      (a) =>
        a.actorName.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.detail.toLowerCase().includes(q)
    );
  }, [activities, searchQuery]);

  const visibleActiveMembers =
    showAllMembers || memberViewFilter !== 'all' || searchQuery.trim()
      ? filteredMembers
      : filteredMembers.slice(0, 5);

  return (
    <div className="pt-4 border-t border-slate-200 dark:border-white/10 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#00A884] shrink-0" />
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
              Manajemen Anggota, Promosi Jabatan &amp; Clan Activity Feed
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
            {isLeader
              ? 'Atur promosi jabatan (Wakil Ketua / Tetua), keluarkan (Kick) anggota tidak aktif, dan pantau misi selesai secara real-time.'
              : 'Daftar anggota paling aktif, jabatan klan, serta log penyelesaian misi dan level-up secara real-time.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadActivity(true)}
          disabled={refreshing}
          className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-gray-200 text-[11px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Memuat...' : 'Segarkan'}</span>
        </button>
      </div>

      {actionNotice && (
        <div
          className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold ${
            actionNotice.type === 'ok'
              ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/35 text-rose-600 dark:text-rose-300'
          }`}
        >
          <span>{actionNotice.text}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="p-0.5 opacity-70 hover:opacity-100"
            aria-label="Tutup pemberitahuan"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Member Management & Most Active Members Section */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#10131C] border border-slate-200 dark:border-white/[0.07]">
            <button
              type="button"
              onClick={() => setMemberViewFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                memberViewFilter === 'all'
                  ? 'bg-white dark:bg-[#1E2331] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Semua Anggota ({mostActiveMembers.length})
            </button>
            <button
              type="button"
              onClick={() => setMemberViewFilter('inactive')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                memberViewFilter === 'inactive'
                  ? 'bg-white dark:bg-[#1E2331] text-rose-500 shadow-sm'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tidak Aktif ({inactiveCount})
            </button>
            <button
              type="button"
              onClick={() => setMemberViewFilter('officers')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                memberViewFilter === 'officers'
                  ? 'bg-white dark:bg-[#1E2331] text-amber-500 shadow-sm'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Pengurus Klan
            </button>
          </div>

          {mostActiveMembers.length > 5 && memberViewFilter === 'all' && (
            <button
              type="button"
              onClick={() => setShowAllMembers((v) => !v)}
              className="text-[11px] font-bold text-[#00A884] hover:underline whitespace-nowrap"
            >
              {showAllMembers ? 'Tampilkan Top 5' : `Lihat Semua (${mostActiveMembers.length})`}
            </button>
          )}
        </div>

        {loading && mostActiveMembers.length === 0 ? (
          <div className="space-y-2">
            {[0, 1].map((idx) => (
              <div
                key={idx}
                className="h-14 rounded-xl bg-slate-100 dark:bg-white/[0.04] animate-pulse"
              />
            ))}
          </div>
        ) : visibleActiveMembers.length === 0 ? (
          <div className="py-5 px-4 text-center rounded-xl bg-slate-50/70 dark:bg-[#10131C] border border-dashed border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-gray-400">
            {memberViewFilter === 'inactive'
              ? 'Semua anggota klan saat ini aktif! Tidak ada anggota yang masuk daftar tidak aktif.'
              : 'Tidak ada anggota yang cocok dengan filter.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-200/70 dark:divide-white/[0.06] rounded-xl bg-slate-50/80 dark:bg-[#10131C] border border-slate-200/80 dark:border-white/[0.07]">
            {visibleActiveMembers.map((m, idx) => {
              const roleMeta = ROLE_DISPLAY[m.clanRole || 'member'] || ROLE_DISPLAY.member;
              const isSelf = Boolean(currentUid && m.uid === currentUid);
              const canLeaderPromoteThis = isLeader && !isSelf && !m.isLeader;
              const canKickThis =
                !isSelf &&
                !m.isLeader &&
                (isLeader || (myClanRole === 'co_leader' && m.clanRole !== 'co_leader'));

              return (
                <div
                  key={m.uid}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-5 text-center font-mono-tabular font-extrabold shrink-0 ${
                        idx === 0
                          ? 'text-amber-500'
                          : idx === 1
                          ? 'text-slate-400'
                          : idx === 2
                          ? 'text-amber-700 dark:text-amber-600'
                          : 'text-slate-500'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <Link to={`/u/${m.uid}`} className="shrink-0">
                      <img
                        src={m.photoUrl || defaultAvatarImg}
                        alt={m.name}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-white/10"
                      />
                    </Link>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
                        <Link
                          to={`/u/${m.uid}`}
                          className="font-bold text-slate-900 dark:text-white hover:text-[#00A884] truncate max-w-[150px]"
                        >
                          {m.name}
                        </Link>
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                        <span className={`text-[11px] font-bold ${roleMeta.textClass}`}>
                          {roleMeta.label}
                        </span>
                        {m.isInactive && (
                          <>
                            <span aria-hidden="true" className="text-slate-400">
                              ·
                            </span>
                            <span className="text-[11px] font-bold text-rose-500">
                              Tidak Aktif
                              {typeof m.inactiveDays === 'number' && m.inactiveDays >= 3
                                ? ` (${m.inactiveDays}h)`
                                : ''}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-gray-400 font-mono-tabular truncate">
                        {m.role === 'founder' ? 'Lv ∞' : `Lv ${m.level}`} · {m.episodesWatched} Ep ·{' '}
                        {m.missionsCompleted} Misi
                        {m.levelUps > 0 ? ` · ${m.levelUps} LvUp` : ''}
                        {m.watchStreak > 0 ? ` · ${m.watchStreak}h Streak` : ''} ·{' '}
                        {m.isOnline ? 'Online' : formatRelativeTime(m.latestActivityAt)}
                      </p>
                    </div>
                  </div>

                  {/* Leader / Officer Management Controls: Promotion & Kick */}
                  {(canLeaderPromoteThis || canKickThis) && (
                    <div className="flex flex-wrap items-center gap-1.5 sm:justify-end shrink-0 pl-7 sm:pl-0">
                      {canLeaderPromoteThis && (
                        <label className="inline-flex items-center gap-1">
                          <span className="sr-only">Jabatan {m.name}</span>
                          <select
                            aria-label={`Ubah jabatan ${m.name}`}
                            disabled={promotingUid === m.uid}
                            value={m.clanRole || 'member'}
                            onChange={(e) =>
                              void handlePromoteMember(m.uid, e.target.value as ClanMemberRole)
                            }
                            className="h-8 px-2.5 rounded-lg bg-white dark:bg-[#191D2A] border border-slate-200 dark:border-white/15 text-[11px] font-bold text-slate-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                          >
                            <option value="member">Anggota</option>
                            <option value="elder">Promosi: Tetua Klan</option>
                            <option value="co_leader">Promosi: Wakil Ketua</option>
                            <option value="leader">Jadikan Ketua Klan</option>
                          </select>
                        </label>
                      )}

                      {canKickThis && (
                        <>
                          {confirmKickUid === m.uid ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={kickingUid === m.uid}
                                onClick={() => void handleKickMember(m.uid, m.isInactive)}
                                className="h-8 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold inline-flex items-center gap-1 whitespace-nowrap"
                              >
                                <Check className="w-3 h-3" />
                                <span>{kickingUid === m.uid ? '...' : 'Ya, Kick'}</span>
                              </button>
                              <button
                                type="button"
                                disabled={kickingUid === m.uid}
                                onClick={() => setConfirmKickUid('')}
                                className="h-8 px-2 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-gray-200 text-[11px] font-bold"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmKickUid(m.uid)}
                              className={`h-8 px-2.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap transition-colors border ${
                                m.isInactive
                                  ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border-rose-500/35'
                                  : 'bg-slate-100 dark:bg-white/[0.06] hover:bg-rose-500/15 text-slate-600 dark:text-gray-300 hover:text-rose-400 border-slate-200 dark:border-white/10'
                              }`}
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              <span>{m.isInactive ? 'Kick Inaktif' : 'Kick'}</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Activity Feed Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2">
        <div
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#10131C] border border-slate-200 dark:border-white/[0.07] overflow-x-auto"
          role="tablist"
          aria-label="Filter aktivitas klan"
        >
          {(
            [
              { id: 'all', label: 'Semua Log' },
              { id: 'level_up', label: 'Naik Level' },
              { id: 'mission_complete', label: 'Misi Selesai' },
              { id: 'role_change', label: 'Promosi' },
              { id: 'member_join', label: 'Gabung' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors ${
                filter === tab.id
                  ? 'bg-white dark:bg-[#1E2331] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-56">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari anggota atau misi..."
            className="w-full h-9 pl-8 pr-3 rounded-xl bg-slate-50 dark:bg-[#10131C] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#00A884]"
          />
        </div>
      </div>

      {/* Real-Time Activity Timeline */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-semibold text-rose-500 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => loadActivity(true)}
            className="underline font-bold whitespace-nowrap"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {loading && activities.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 rounded-xl bg-slate-100 dark:bg-white/[0.04] animate-pulse"
            />
          ))}
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="py-6 px-4 text-center rounded-xl bg-slate-50/70 dark:bg-[#10131C] border border-dashed border-slate-200 dark:border-white/10 space-y-1.5">
          <p className="text-xs font-bold text-slate-700 dark:text-gray-200">
            {searchQuery
              ? 'Tidak ada aktivitas yang cocok dengan pencarianmu.'
              : 'Belum ada log aktivitas untuk filter ini.'}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-gray-400 max-w-md mx-auto">
            Aktivitas tercatat otomatis secara real-time saat anggota menyelesaikan misi tontonan, menjaga streak harian, naik level, dipromosikan, atau bergabung ke klan.
          </p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-200/70 dark:divide-white/[0.06] rounded-xl bg-slate-50/80 dark:bg-[#10131C] border border-slate-200/80 dark:border-white/[0.07]">
          {filteredActivities.map((act) => {
            const isLevelUp = act.type === 'level_up';
            const isMission = act.type === 'mission_complete';
            const isRoleChange = act.type === 'role_change';
            const isKick = act.type === 'member_kick';

            return (
              <div
                key={act._id}
                className="flex items-start justify-between gap-3 px-3.5 py-3 hover:bg-slate-100/70 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isLevelUp
                        ? 'bg-amber-500/15 text-amber-500'
                        : isMission
                        ? 'bg-emerald-500/15 text-[#00A884]'
                        : isRoleChange
                        ? 'bg-indigo-500/15 text-indigo-400'
                        : isKick
                        ? 'bg-rose-500/15 text-rose-500'
                        : 'bg-sky-500/15 text-sky-400'
                    }`}
                  >
                    {isLevelUp ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : isMission ? (
                      <Award className="w-4 h-4" />
                    ) : isRoleChange ? (
                      <Crown className="w-4 h-4" />
                    ) : isKick ? (
                      <Shield className="w-4 h-4" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                  </div>

                  <Link to={`/u/${act.actorUid}`} className="shrink-0 mt-0.5">
                    <img
                      src={act.actorPhoto || defaultAvatarImg}
                      alt={act.actorName}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-white/10"
                    />
                  </Link>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                      <Link
                        to={`/u/${act.actorUid}`}
                        className="font-extrabold text-slate-900 dark:text-white hover:text-[#00A884] truncate max-w-[160px]"
                      >
                        {act.actorName}
                      </Link>
                      <span className="font-semibold text-slate-700 dark:text-gray-200">
                        {act.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5 break-words">
                      {act.detail}
                      {act.streakDay > 0 && isMission ? (
                        <span className="inline-flex items-center gap-0.5 ml-1.5 text-amber-500 font-semibold font-mono-tabular">
                          <Flame className="w-3 h-3 inline" />
                          {act.streakDay}h
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-mono-tabular text-slate-400 whitespace-nowrap shrink-0 mt-0.5">
                  {formatRelativeTime(act.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
