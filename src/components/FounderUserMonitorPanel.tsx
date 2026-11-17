import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Crown,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { FounderMonitorUser } from '../types';
import { AvatarDecoration } from './AvatarDecoration';
import { CountryFlagBadge } from './CountryFlag';
import { VerifiedBadge } from './VerifiedBadge';

type MonitorFilter = 'all' | 'recent' | 'online' | 'banned' | 'vip' | 'member';

function getStoredToken(): string {
  return (
    localStorage.getItem('zonestream_session_token_v1') ||
    localStorage.getItem('donghive_session_token_v1') ||
    ''
  );
}

function formatRelativeTime(iso: string): string {
  if (!iso) return 'Belum tercatat';
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms) || ms <= 0) return 'Belum tercatat';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 45) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} hari lalu`;
  return new Date(ms).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function FounderUserMonitorPanel({ cardClass = '' }: { cardClass?: string }) {
  const { user } = useAuth();
  const isFounder = user?.role === 'founder';

  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<FounderMonitorUser[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    online: 0,
    recentLogins: 0,
    banned: 0,
    vip: 0,
    members: 0,
  });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<MonitorFilter>('all');
  const [query, setQuery] = useState('');
  const [banReasonInput, setBanReasonInput] = useState('');
  const [busyUid, setBusyUid] = useState<string>('');
  const [massConfirm, setMassConfirm] = useState<'ban-all' | 'unban-all' | null>(null);
  const [massBusy, setMassBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchUsers = useCallback(
    async (silent = false) => {
      if (!isFounder) return;
      const token = getStoredToken();
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const res = await fetch('/api/user/founder/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (res.ok && json.ok) {
          setUsers(Array.isArray(json.users) ? json.users : []);
          if (json.stats) setStats(json.stats);
          setLastUpdated(
            new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );
        } else if (!silent) {
          setFeedback({ type: 'err', text: json.error || 'Gagal memuat daftar pengguna' });
        }
      } catch {
        if (!silent) {
          setFeedback({ type: 'err', text: 'Gagal terhubung ke server monitoring' });
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [isFounder]
  );

  // Real-time polling for Founder summary card (8s) and open monitor console (4s)
  useEffect(() => {
    if (!isFounder) return;
    void fetchUsers(!isOpen);
    const intervalMs = isOpen ? 4000 : 8000;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchUsers(true);
      }
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isFounder, isOpen, fetchUsers]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === 'online' && !u.isOnline) return false;
      if (filter === 'recent' && !u.isRecentlyLoggedIn) return false;
      if (filter === 'banned' && !u.isBanned) return false;
      if (filter === 'vip' && (!u.isPremium || u.role === 'founder')) return false;
      if (filter === 'member' && (u.isPremium || u.role === 'founder')) return false;

      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      );
    });
  }, [users, filter, query]);

  if (!isFounder) {
    return null;
  }

  const handleToggleBanUser = async (target: FounderMonitorUser) => {
    if (target.role === 'founder') return;
    const token = getStoredToken();
    if (!token) return;
    const nextBanned = !target.isBanned;
    setBusyUid(target.uid);
    setFeedback(null);
    try {
      const res = await fetch('/api/user/founder/ban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUid: target.uid,
          banned: nextBanned,
          reason: nextBanned ? banReasonInput.trim() : '',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: 'err', text: json.error || 'Gagal memperbarui status ban' });
      } else {
        setFeedback({
          type: 'ok',
          text: nextBanned
            ? `Akun ${target.name} (UID ${target.uid}) berhasil dibanned secara real-time.`
            : `Akun ${target.name} (UID ${target.uid}) berhasil di-unban.`,
        });
        await fetchUsers(true);
      }
    } catch {
      setFeedback({ type: 'err', text: 'Gagal menghubungi server' });
    } finally {
      setBusyUid('');
    }
  };

  const handleMassBan = async (banned: boolean) => {
    const token = getStoredToken();
    if (!token) return;
    setMassBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/user/founder/ban-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          banned,
          reason: banned ? banReasonInput.trim() || 'Kebijakan Founder' : '',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: 'err', text: json.error || 'Gagal memproses aksi massal' });
      } else {
        setFeedback({
          type: 'ok',
          text: banned
            ? `${json.affectedCount} akun user berhasil dibanned secara real-time (akun Founder tetap aman).`
            : `${json.affectedCount} akun user berhasil di-unban kembali.`,
        });
        setMassConfirm(null);
        await fetchUsers(true);
      }
    } catch {
      setFeedback({ type: 'err', text: 'Gagal menghubungi server' });
    } finally {
      setMassBusy(false);
    }
  };

  return (
    <>
      {/* Founder Exclusive Dashboard Card */}
      <div className="px-4 mt-4">
        <div
          className={`rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/[0.09] via-rose-500/[0.04] to-transparent p-4 sm:p-5 shadow-sm dark:shadow-none ${cardClass}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/25 shrink-0">
                <Crown className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    Panel Founder · Monitor &amp; Ban User Real-Time
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider">
                    Khusus Founder
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-[#9CA3AF] mt-0.5">
                  Pantau semua user, akun yang baru login, serta ban 1 akun atau semua user secara real-time.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="w-full sm:w-auto min-h-[42px] px-4 rounded-xl bg-gradient-to-r from-[#E84A18] to-rose-600 hover:brightness-110 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25 transition-all"
            >
              <Users className="w-4 h-4" />
              <span>Buka Monitor User ({stats.total})</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            <div className="rounded-xl bg-white/80 dark:bg-[#171A23] border border-slate-200 dark:border-white/[0.07] p-2.5">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block">
                Total User
              </span>
              <span className="text-base font-extrabold font-mono-tabular text-slate-900 dark:text-white">
                {stats.total}
              </span>
            </div>
            <div className="rounded-xl bg-white/80 dark:bg-[#171A23] border border-slate-200 dark:border-white/[0.07] p-2.5">
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                Online Sekarang
              </span>
              <span className="text-base font-extrabold font-mono-tabular text-emerald-600 dark:text-emerald-300">
                {stats.online}
              </span>
            </div>
            <div className="rounded-xl bg-white/80 dark:bg-[#171A23] border border-slate-200 dark:border-white/[0.07] p-2.5">
              <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 block">
                Baru Login (1 Jam)
              </span>
              <span className="text-base font-extrabold font-mono-tabular text-sky-600 dark:text-sky-300">
                {stats.recentLogins}
              </span>
            </div>
            <div className="rounded-xl bg-white/80 dark:bg-[#171A23] border border-slate-200 dark:border-white/[0.07] p-2.5">
              <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 block">
                Akun Dibanned
              </span>
              <span className="text-base font-extrabold font-mono-tabular text-rose-600 dark:text-rose-300">
                {stats.banned}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen / Modal Real-Time Founder User Console */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4">
          <div className="w-full max-w-3xl max-h-[92dvh] rounded-3xl bg-white dark:bg-[#11131A] border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 text-white flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                      Founder Real-Time User Monitor
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live 5d
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                    {lastUpdated ? `Diperbarui ${lastUpdated} · ` : ''}
                    {stats.total} akun terdaftar · {stats.online} online · {stats.recentLogins} baru login
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void fetchUsers(false)}
                  disabled={loading}
                  aria-label="Muat Ulang Data User"
                  className="min-h-[38px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-gray-200 text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Tutup Panel"
                  className="min-w-[38px] min-h-[38px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-500 dark:text-gray-300 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search, Filters & Mass Ban Controls */}
            <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-white/[0.06] space-y-3 bg-slate-50/70 dark:bg-[#0C0E14]">
              {/* Search & Reason Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cari nama, @username, email, UID..."
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#E84A18]"
                  />
                </div>
                <input
                  type="text"
                  maxLength={120}
                  value={banReasonInput}
                  onChange={(e) => setBanReasonInput(e.target.value)}
                  placeholder="Alasan ban (opsional, mis: Spam / Scam)"
                  className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Filter Tabs + Mass Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  {(
                    [
                      { id: 'all', label: `Semua (${stats.total})` },
                      { id: 'recent', label: `Baru Login (${stats.recentLogins})` },
                      { id: 'online', label: `Online (${stats.online})` },
                      { id: 'banned', label: `Dibanned (${stats.banned})` },
                      { id: 'vip', label: `VIP (${stats.vip})` },
                      { id: 'member', label: 'Member' },
                    ] as Array<{ id: MonitorFilter; label: string }>
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilter(tab.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                        filter === tab.id
                          ? 'bg-[#E84A18] text-white shadow-sm'
                          : 'bg-white dark:bg-[#171A23] text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-white/10 hover:border-[#E84A18]/50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setMassConfirm(massConfirm === 'ban-all' ? null : 'ban-all')}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-extrabold inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Ban Semua User</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMassConfirm(massConfirm === 'unban-all' ? null : 'unban-all')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Unban Semua</span>
                  </button>
                </div>
              </div>

              {/* 2-Step Confirmation Box for Mass Ban / Unban */}
              {massConfirm && (
                <div
                  className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2.5 ${
                    massConfirm === 'ban-all'
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-200'
                      : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-200'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      {massConfirm === 'ban-all'
                        ? `Yakin ban SEMUA ${stats.members} user non-founder secara real-time?`
                        : `Yakin buka ban (unban) untuk semua ${stats.banned} user yang dibanned?`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={massBusy}
                      onClick={() => void handleMassBan(massConfirm === 'ban-all')}
                      className={`px-3 py-1.5 rounded-xl text-white text-xs font-extrabold ${
                        massConfirm === 'ban-all'
                          ? 'bg-rose-600 hover:bg-rose-500'
                          : 'bg-emerald-600 hover:bg-emerald-500'
                      }`}
                    >
                      {massBusy ? 'Memproses...' : 'Ya, Eksekusi Sekarang'}
                    </button>
                    <button
                      type="button"
                      disabled={massBusy}
                      onClick={() => setMassConfirm(null)}
                      className="px-3 py-1.5 rounded-xl bg-white/70 dark:bg-white/10 text-slate-700 dark:text-gray-200 text-xs font-bold"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {feedback && (
                <div
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                    feedback.type === 'ok'
                      ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-700 dark:text-emerald-200'
                      : 'bg-rose-500/15 border-rose-500/35 text-rose-700 dark:text-rose-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {feedback.type === 'ok' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{feedback.text}</span>
                  </span>
                  <button type="button" onClick={() => setFeedback(null)} aria-label="Tutup">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* User List */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-2.5">
              {loading && users.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-gray-400">
                  Memuat data semua pengguna secara real-time...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-gray-400">
                  Tidak ada user yang cocok dengan filter atau pencarian.
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isTargetFounder = u.role === 'founder';
                  const busy = busyUid === u.uid;
                  return (
                    <div
                      key={u.uid}
                      className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        u.isBanned
                          ? 'bg-rose-500/[0.06] border-rose-500/35'
                          : u.isOnline
                          ? 'bg-emerald-500/[0.04] border-emerald-500/25'
                          : 'bg-slate-50 dark:bg-[#171A23] border-slate-200 dark:border-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <AvatarDecoration
                            src={u.photoUrl}
                            alt={u.name}
                            decorationId={u.activeBorder}
                            level={u.level}
                            isFounder={isTargetFounder}
                            size="sm"
                          />
                          {u.isOnline && !u.isBanned && (
                            <span
                              title="Online sekarang"
                              className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#171A23]"
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                              {u.name}
                            </span>
                            <CountryFlagBadge countryCode={u.countryCode} size="xs" />
                            {(u.isPremium || isTargetFounder) && (
                              <VerifiedBadge
                                size="sm"
                                isFounder={isTargetFounder}
                                badgeLabel={u.activeBadge}
                              />
                            )}
                            {isTargetFounder && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[9px] font-extrabold uppercase">
                                Founder
                              </span>
                            )}
                            {!isTargetFounder && u.isPremium && (
                              <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-600 dark:text-sky-300 text-[9px] font-extrabold uppercase">
                                VIP
                              </span>
                            )}
                            {u.isRecentlyLoggedIn && !u.isBanned && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-[9px] font-extrabold uppercase">
                                Baru Login
                              </span>
                            )}
                            {u.isBanned && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-extrabold uppercase">
                                Banned
                              </span>
                            )}
                          </div>

                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-gray-400">
                            <span className="font-mono-tabular">UID: {u.uid}</span>
                            <span>·</span>
                            <span className="truncate">@{u.username}</span>
                            <span>·</span>
                            <span className="truncate">{u.email}</span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500 dark:text-gray-400">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-sky-400" />
                              Login: <strong className="text-slate-700 dark:text-gray-200">{formatRelativeTime(u.lastLoginAt)}</strong>
                            </span>
                            <span>
                              Aktif: <strong className="text-slate-700 dark:text-gray-200">{u.isOnline ? 'Online sekarang' : formatRelativeTime(u.lastActiveAt)}</strong>
                            </span>
                            {!isTargetFounder && (
                              <span className="font-mono-tabular">Lv. {u.level}</span>
                            )}
                          </div>

                          {u.isBanned && u.banReason && (
                            <p className="mt-1 text-[10px] font-semibold text-rose-500 dark:text-rose-300">
                              Alasan Ban: {u.banReason}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end shrink-0">
                        {isTargetFounder ? (
                          <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-[11px] font-bold inline-flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Terlindungi</span>
                          </span>
                        ) : u.isBanned ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleToggleBanUser(u)}
                            className="min-h-[38px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition-colors"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>{busy ? '...' : 'Unban Akun'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleToggleBanUser(u)}
                            className="min-h-[38px] px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>{busy ? '...' : 'Ban Akun'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
