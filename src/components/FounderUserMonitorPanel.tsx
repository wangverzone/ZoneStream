import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Crown,
  ExternalLink,
  History,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type {
  FounderGlobalCoinTxItem,
  FounderGlobalPaymentItem,
  FounderGlobalTransactionsSummary,
  FounderMonitorUser,
} from '../types';
import { AvatarDecoration } from './AvatarDecoration';
import { CountryFlagBadge } from './CountryFlag';
import { VerifiedBadge } from './VerifiedBadge';

type MonitorFilter = 'all' | 'recent' | 'online' | 'banned' | 'vip' | 'member';
type FounderSectionTab = 'users' | 'transactions';
type GlobalTxFilter = 'all' | 'payments' | 'coins';

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

function formatDateTimeId(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatVipRemaining(expiry?: string | null, isPremium?: boolean): string {
  if (!isPremium) return 'Reguler';
  if (!expiry) return 'VIP Permanen';
  const ms = new Date(expiry).getTime() - Date.now();
  if (Number.isNaN(ms)) return 'VIP Aktif';
  if (ms <= 0) return 'VIP Kedaluwarsa';
  const days = Math.ceil(ms / 86_400_000);
  return days === 0 ? 'Berakhir Hari Ini' : `Sisa ${days} Hari`;
}

function formatCoinTxTypeLabel(type: FounderGlobalCoinTxItem['type']): string {
  switch (type) {
    case 'daily_checkin':
      return 'Check-In Harian';
    case 'level_up':
      return 'Naik Level';
    case 'milestone_bonus':
      return 'Bonus Misi';
    case 'gift_sent':
      return 'Gift VIP Terkirim';
    case 'gift_received':
      return 'Gift VIP Diterima';
    case 'self_redeem':
      return 'Tukar VIP Koin';
    case 'refund':
      return 'Refund';
    case 'founder_adjust':
      return 'Kontrol Founder';
    default:
      return 'Transaksi Koin';
  }
}

export function FounderUserMonitorPanel({
  cardClass = '',
  inlineWorkspace = false,
}: {
  cardClass?: string;
  inlineWorkspace?: boolean;
}) {
  const { user } = useAuth();
  const isFounder = Boolean(user && (user.role === 'founder' || user.uid === '00000'));

  const [isOpen, setIsOpen] = useState(false);
  const [sectionTab, setSectionTab] = useState<FounderSectionTab>('users');

  // Users state
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

  // Account & Coin Control Modal state
  const [controlTarget, setControlTarget] = useState<FounderMonitorUser | null>(null);
  const [ctrlLevel, setCtrlLevel] = useState<string>('1');
  const [ctrlCoins, setCtrlCoins] = useState<string>('0');
  const [ctrlEarned, setCtrlEarned] = useState<string>('0');
  const [ctrlSpent, setCtrlSpent] = useState<string>('0');
  const [ctrlGiftsSent, setCtrlGiftsSent] = useState<string>('0');
  const [ctrlGiftsRecv, setCtrlGiftsRecv] = useState<string>('0');
  const [ctrlCoinNote, setCtrlCoinNote] = useState<string>('');
  const [ctrlVipDays, setCtrlVipDays] = useState<string>('30');
  const [ctrlVipPlan, setCtrlVipPlan] = useState<string>('');
  const [ctrlVerified, setCtrlVerified] = useState<boolean>(false);
  const [ctrlBusy, setCtrlBusy] = useState<boolean>(false);

  // Global Transactions state
  const [txLoading, setTxLoading] = useState(false);
  const [txFilter, setTxFilter] = useState<GlobalTxFilter>('all');
  const [txQuery, setTxQuery] = useState('');
  const [payments, setPayments] = useState<FounderGlobalPaymentItem[]>([]);
  const [coinLedger, setCoinLedger] = useState<FounderGlobalCoinTxItem[]>([]);
  const [txSummary, setTxSummary] = useState<FounderGlobalTransactionsSummary>({
    totalPayments: 0,
    paidPayments: 0,
    pendingPayments: 0,
    totalRevenueIdr: 0,
    totalCoinTransactions: 0,
    totalCoinsIssued: 0,
    totalCoinsSpent: 0,
  });

  const isConsoleActive = inlineWorkspace || isOpen;

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

  const fetchGlobalTransactions = useCallback(
    async (silent = false) => {
      if (!isFounder) return;
      const token = getStoredToken();
      if (!token) return;
      if (!silent) setTxLoading(true);
      try {
        const res = await fetch('/api/user/founder/transactions', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (res.ok && json.ok) {
          setPayments(Array.isArray(json.payments) ? json.payments : []);
          setCoinLedger(Array.isArray(json.coinLedger) ? json.coinLedger : []);
          if (json.summary) setTxSummary(json.summary);
        } else if (!silent) {
          setFeedback({ type: 'err', text: json.error || 'Gagal memuat transaksi global' });
        }
      } catch {
        if (!silent) {
          setFeedback({ type: 'err', text: 'Gagal terhubung ke server transaksi global' });
        }
      } finally {
        if (!silent) setTxLoading(false);
      }
    },
    [isFounder]
  );

  // Real-time polling when active
  useEffect(() => {
    if (!isFounder) return;
    void fetchUsers(!isConsoleActive);
    if (isConsoleActive) {
      void fetchGlobalTransactions(true);
    }
    const intervalMs = isConsoleActive ? 5000 : 12000;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchUsers(true);
        if (isConsoleActive && sectionTab === 'transactions') {
          void fetchGlobalTransactions(true);
        }
      }
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isFounder, isConsoleActive, sectionTab, fetchUsers, fetchGlobalTransactions]);

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

  const combinedTransactions = useMemo(() => {
    const q = txQuery.trim().toLowerCase();

    const paymentEntries =
      txFilter === 'coins'
        ? []
        : payments.map((p) => ({
            kind: 'payment' as const,
            id: p.orderId,
            sortTime: new Date(p.createdAt).getTime(),
            createdAt: p.createdAt,
            uid: p.uid,
            userName: p.userName,
            username: p.username || '',
            title: p.planName || 'Paket VIP ZoneStream',
            subtitle: `${p.orderId} · ${p.paymentMethod.toUpperCase()} · ${p.durationDays} Hari`,
            status: p.status,
            amountLabel: `Rp ${(p.totalPayment || p.amount || 0).toLocaleString('id-ID')}`,
            isPositive: p.status === 'paid',
          }));

    const coinEntries =
      txFilter === 'payments'
        ? []
        : coinLedger.map((c) => ({
            kind: 'coin' as const,
            id: c.txId,
            sortTime: new Date(c.createdAt).getTime(),
            createdAt: c.createdAt,
            uid: c.uid,
            userName: c.userName,
            username: c.username || '',
            title: formatCoinTxTypeLabel(c.type),
            subtitle: `${c.note || c.txId} · Saldo akhir: ${c.balanceAfter.toLocaleString('id-ID')} Koin`,
            status: c.type,
            amountLabel: `${c.amount > 0 ? '+' : ''}${c.amount.toLocaleString('id-ID')} Koin`,
            isPositive: c.amount >= 0,
          }));

    return [...paymentEntries, ...coinEntries]
      .filter((item) => {
        if (!q) return true;
        return (
          item.id.toLowerCase().includes(q) ||
          item.uid.toLowerCase().includes(q) ||
          item.userName.toLowerCase().includes(q) ||
          item.username.toLowerCase().includes(q) ||
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.sortTime - a.sortTime);
  }, [payments, coinLedger, txFilter, txQuery]);

  if (!isFounder) {
    return null;
  }

  const handleToggleBanUser = async (target: FounderMonitorUser) => {
    if (target.role === 'founder' || target.uid === '00000') return;
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

  const openControlModal = (target: FounderMonitorUser) => {
    setControlTarget(target);
    setCtrlLevel(String(target.level || 1));
    setCtrlCoins(String(target.coins ?? 0));
    setCtrlEarned(String(target.totalCoinsEarned ?? target.coins ?? 0));
    setCtrlSpent(String(target.totalCoinsSpent ?? 0));
    setCtrlGiftsSent(String(target.totalGiftsSent ?? 0));
    setCtrlGiftsRecv(String(target.totalGiftsReceived ?? 0));
    setCtrlCoinNote('');
    setCtrlVipDays('30');
    setCtrlVipPlan('');
    setCtrlVerified(Boolean(target.isVerified));
  };

  const syncControlInputsFromUser = (u: FounderMonitorUser) => {
    setControlTarget(u);
    setCtrlLevel(String(u.level || 1));
    setCtrlCoins(String(u.coins ?? 0));
    setCtrlEarned(String(u.totalCoinsEarned ?? u.coins ?? 0));
    setCtrlSpent(String(u.totalCoinsSpent ?? 0));
    setCtrlGiftsSent(String(u.totalGiftsSent ?? 0));
    setCtrlGiftsRecv(String(u.totalGiftsReceived ?? 0));
    setCtrlVerified(Boolean(u.isVerified));
  };

  const handleFounderControlSubmit = async (payload: {
    vipAction?: 'grant' | 'extend' | 'revoke';
    vipDays?: number;
    coinDelta?: number;
    saveAttributes?: boolean;
  }) => {
    if (!controlTarget || ctrlBusy) return;
    const token = getStoredToken();
    if (!token) return;
    setCtrlBusy(true);
    setFeedback(null);
    try {
      const body: Record<string, unknown> = { targetUid: controlTarget.uid };
      if (payload.vipAction) {
        body.vipAction = payload.vipAction;
        if (payload.vipDays) body.vipDays = payload.vipDays;
        if (ctrlVipPlan.trim()) body.vipPlan = ctrlVipPlan.trim();
      }
      if (typeof payload.coinDelta === 'number') {
        body.coinDelta = payload.coinDelta;
        if (ctrlCoinNote.trim()) body.coinNote = ctrlCoinNote.trim();
      }
      if (payload.saveAttributes) {
        if (controlTarget.role !== 'founder') {
          body.level = Math.max(1, Math.floor(Number(ctrlLevel) || 1));
          body.isVerified = ctrlVerified;
        }
        body.coins = Math.max(0, Math.floor(Number(ctrlCoins) || 0));
        body.totalCoinsEarned = Math.max(0, Math.floor(Number(ctrlEarned) || 0));
        body.totalCoinsSpent = Math.max(0, Math.floor(Number(ctrlSpent) || 0));
        body.totalGiftsSent = Math.max(0, Math.floor(Number(ctrlGiftsSent) || 0));
        body.totalGiftsReceived = Math.max(0, Math.floor(Number(ctrlGiftsRecv) || 0));
        if (ctrlCoinNote.trim()) body.coinNote = ctrlCoinNote.trim();
      }

      const res = await fetch('/api/user/founder/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: 'err', text: json.error || 'Gagal memperbarui akun user' });
      } else {
        if (json.user) {
          syncControlInputsFromUser(json.user);
        }
        const actionLabel =
          payload.vipAction === 'revoke'
            ? `VIP ${controlTarget.name} dicabut`
            : payload.vipAction === 'extend'
            ? `VIP ${controlTarget.name} diperpanjang +${payload.vipDays || 30} hari`
            : payload.vipAction === 'grant'
            ? `VIP ${controlTarget.name} diaktifkan (${payload.vipDays || 30} hari)`
            : typeof payload.coinDelta === 'number'
            ? `Koin ${controlTarget.name} diubah ${payload.coinDelta > 0 ? `+${payload.coinDelta}` : payload.coinDelta}`
            : `Statistik & data akun ${controlTarget.name} diperbarui`;
        setFeedback({ type: 'ok', text: `${actionLabel} secara real-time.` });
        setCtrlCoinNote('');
        await Promise.all([fetchUsers(true), fetchGlobalTransactions(true)]);
      }
    } catch {
      setFeedback({ type: 'err', text: 'Gagal menghubungi server kontrol Founder' });
    } finally {
      setCtrlBusy(false);
    }
  };

  const renderConsoleContent = (isModalView: boolean) => (
    <div
      className={
        isModalView
          ? 'w-full max-w-4xl max-h-[92dvh] rounded-3xl bg-white dark:bg-[#11131A] border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden'
          : `rounded-3xl bg-white dark:bg-[#13151C] border border-amber-500/30 shadow-sm dark:shadow-none overflow-hidden flex flex-col ${cardClass}`
      }
    >
      {/* Top Founder Panel Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-amber-500/[0.08] via-orange-500/[0.04] to-transparent">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-[#E84A18] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#E84A18]/20">
            <ShieldAlert className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                Founder Panel · Pusat Kontrol Admin
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
              {lastUpdated ? `Sinkron ${lastUpdated} · ` : ''}
              Kelola status VIP user, audit transaksi global, dan modifikasi statistik koin langsung.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              void fetchUsers(false);
              void fetchGlobalTransactions(false);
            }}
            disabled={loading || txLoading}
            aria-label="Muat Ulang Data Founder"
            className="min-h-[38px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-slate-700 dark:text-gray-200 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || txLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {isModalView && (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Tutup Panel"
              className="min-w-[38px] min-h-[38px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-500 dark:text-gray-300 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Founder Overview KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 sm:px-5 border-b border-slate-200 dark:border-white/[0.06] bg-slate-50/60 dark:bg-[#0D0F16]">
        <div className="rounded-xl bg-white dark:bg-[#171A23] border border-slate-200 dark:border-white/[0.07] p-3">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block">
            Total Akun ({stats.online} Online)
          </span>
          <span className="mt-0.5 text-base font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
            {stats.total}
          </span>
        </div>
        <div className="rounded-xl bg-white dark:bg-[#171A23] border border-slate-200 dark:border-white/[0.07] p-3">
          <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 block">
            Member VIP Aktif
          </span>
          <span className="mt-0.5 text-base font-extrabold font-mono tabular-nums text-sky-600 dark:text-sky-300">
            {stats.vip}
          </span>
        </div>
        <div className="rounded-xl bg-white dark:bg-[#171A23] border border-slate-200 dark:border-white/[0.07] p-3">
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block">
            Omzet VIP Global ({txSummary.paidPayments} Lunas)
          </span>
          <span className="mt-0.5 text-base font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-300">
            Rp {txSummary.totalRevenueIdr.toLocaleString('id-ID')}
          </span>
        </div>
        <div className="rounded-xl bg-white dark:bg-[#171A23] border border-slate-200 dark:border-white/[0.07] p-3">
          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 block">
            Aktivitas Ledger Koin
          </span>
          <span className="mt-0.5 text-base font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-300">
            {txSummary.totalCoinTransactions} Event
          </span>
        </div>
      </div>

      {/* Sub-navigation Tabs inside Founder Panel */}
      <div className="px-3.5 sm:px-5 pt-2 border-b border-slate-200 dark:border-white/[0.07] flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setSectionTab('users')}
          className={`min-h-[42px] px-3.5 border-b-2 text-xs sm:text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
            sectionTab === 'users'
              ? 'border-[#E84A18] text-[#E84A18]'
              : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Kontrol User, VIP &amp; Koin ({stats.total})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSectionTab('transactions');
            void fetchGlobalTransactions(false);
          }}
          className={`min-h-[42px] px-3.5 border-b-2 text-xs sm:text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
            sectionTab === 'transactions'
              ? 'border-[#E84A18] text-[#E84A18]'
              : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>
            Riwayat Transaksi Global ({txSummary.totalPayments + txSummary.totalCoinTransactions})
          </span>
        </button>
      </div>

      {feedback && (
        <div className="px-3.5 sm:px-5 pt-3">
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
        </div>
      )}

      {sectionTab === 'users' ? (
        <>
          {/* Search, Filters & Mass Ban Controls */}
          <div className="p-3.5 sm:px-5 sm:py-4 border-b border-slate-200 dark:border-white/[0.06] space-y-3 bg-slate-50/70 dark:bg-[#0C0E14]">
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

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {(
                  [
                    { id: 'all', label: `Semua (${stats.total})` },
                    { id: 'recent', label: `Baru Login (${stats.recentLogins})` },
                    { id: 'online', label: `Online (${stats.online})` },
                    { id: 'vip', label: `VIP (${stats.vip})` },
                    { id: 'member', label: 'Member' },
                    { id: 'banned', label: `Dibanned (${stats.banned})` },
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
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-extrabold inline-flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Ban Semua</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMassConfirm(massConfirm === 'unban-all' ? null : 'unban-all')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold inline-flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Unban Semua</span>
                </button>
              </div>
            </div>

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
                    {massBusy ? 'Memproses...' : 'Ya, Eksekusi'}
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
          </div>

          {/* User List */}
          <div className={`p-3.5 sm:p-5 space-y-2.5 ${isModalView ? 'flex-1 overflow-y-auto' : 'max-h-[620px] overflow-y-auto'}`}>
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
                const isTargetFounder = u.role === 'founder' || u.uid === '00000';
                const busy = busyUid === u.uid;
                return (
                  <div
                    key={u.uid}
                    className={`p-3.5 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition-colors ${
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
                              VIP · {formatVipRemaining(u.premiumExpiryDate, u.isPremium)}
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
                          <span className="font-mono tabular-nums">UID {u.uid}</span>
                          <span>·</span>
                          <span className="truncate">@{u.username}</span>
                          <span>·</span>
                          <span className="truncate">{u.email}</span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500 dark:text-gray-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-sky-400" />
                            Aktif:{' '}
                            <strong className="text-slate-700 dark:text-gray-200">
                              {u.isOnline ? 'Online sekarang' : formatRelativeTime(u.lastActiveAt)}
                            </strong>
                          </span>
                          {!isTargetFounder && (
                            <span className="font-mono tabular-nums">Lv. {u.level}</span>
                          )}
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums text-amber-600 dark:text-amber-300 font-bold">
                            <Coins className="w-3 h-3" />
                            {(u.coins ?? 0).toLocaleString('id-ID')} Koin
                          </span>
                          <span className="font-mono tabular-nums">
                            Diperoleh: {(u.totalCoinsEarned ?? 0).toLocaleString('id-ID')} · Terpakai:{' '}
                            {(u.totalCoinsSpent ?? 0).toLocaleString('id-ID')}
                          </span>
                        </div>

                        {u.isBanned && u.banReason && (
                          <p className="mt-1 text-[10px] font-semibold text-rose-500 dark:text-rose-300">
                            Alasan Ban: {u.banReason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                      <Link
                        to={`/u/${u.uid}`}
                        onClick={() => setIsOpen(false)}
                        className="min-h-[36px] px-2.5 rounded-xl bg-slate-200/80 hover:bg-slate-300 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-gray-200 text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                        title="Buka profil publik pengguna ini"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Profil</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => openControlModal(u)}
                        className="min-h-[36px] px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-700 dark:text-amber-300 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>Kelola VIP &amp; Koin</span>
                      </button>

                      {isTargetFounder ? (
                        <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Terlindungi</span>
                        </span>
                      ) : u.isBanned ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleToggleBanUser(u)}
                          className="min-h-[36px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>{busy ? '...' : 'Unban'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleToggleBanUser(u)}
                          className="min-h-[36px] px-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>{busy ? '...' : 'Ban'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        /* TAB: RIWAYAT TRANSAKSI GLOBAL */
        <>
          <div className="p-3.5 sm:px-5 sm:py-4 border-b border-slate-200 dark:border-white/[0.06] space-y-3 bg-slate-50/70 dark:bg-[#0C0E14]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={txQuery}
                  onChange={(e) => setTxQuery(e.target.value)}
                  placeholder="Cari Order ID, Tx ID, UID, @username, paket, atau catatan..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-white dark:bg-[#171A23] border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#E84A18]"
                />
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {(
                  [
                    { id: 'all', label: 'Semua' },
                    { id: 'payments', label: `Pembayaran VIP (${payments.length})` },
                    { id: 'coins', label: `Ledger Koin (${coinLedger.length})` },
                  ] as Array<{ id: GlobalTxFilter; label: string }>
                ).map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setTxFilter(chip.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                      txFilter === chip.id
                        ? 'bg-[#E84A18] text-white shadow-sm'
                        : 'bg-white dark:bg-[#171A23] text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-white/10 hover:border-[#E84A18]/50'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="rounded-xl bg-white dark:bg-[#171A23] border border-slate-200 dark:border-white/[0.07] px-3 py-2 flex items-center justify-between">
                <span className="text-slate-500 dark:text-gray-400">Menunggu Bayar</span>
                <strong className="font-mono tabular-nums text-amber-600 dark:text-amber-300">
                  {txSummary.pendingPayments}
                </strong>
              </div>
              <div className="rounded-xl bg-white dark:bg-[#171A23] border border-slate-200 dark:border-white/[0.07] px-3 py-2 flex items-center justify-between">
                <span className="text-slate-500 dark:text-gray-400">Koin Masuk Global</span>
                <strong className="font-mono tabular-nums text-emerald-600 dark:text-emerald-300">
                  +{txSummary.totalCoinsIssued.toLocaleString('id-ID')}
                </strong>
              </div>
              <div className="rounded-xl bg-white dark:bg-[#171A23] border border-slate-200 dark:border-white/[0.07] px-3 py-2 flex items-center justify-between col-span-2 sm:col-span-1">
                <span className="text-slate-500 dark:text-gray-400">Koin Dipakai Global</span>
                <strong className="font-mono tabular-nums text-rose-600 dark:text-rose-300">
                  -{txSummary.totalCoinsSpent.toLocaleString('id-ID')}
                </strong>
              </div>
            </div>
          </div>

          <div className={`p-3.5 sm:p-5 space-y-2.5 ${isModalView ? 'flex-1 overflow-y-auto' : 'max-h-[620px] overflow-y-auto'}`}>
            {txLoading && combinedTransactions.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-gray-400">
                Memuat riwayat transaksi global...
              </div>
            ) : combinedTransactions.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-gray-400">
                Belum ada riwayat transaksi yang cocok.
              </div>
            ) : (
              combinedTransactions.map((tx) => (
                <div
                  key={`${tx.kind}-${tx.id}`}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#171A23] border border-slate-200 dark:border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        tx.kind === 'payment'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : tx.isPositive
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {tx.kind === 'payment' ? (
                        <CreditCard className="w-4 h-4" />
                      ) : tx.isPositive ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                          {tx.title}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400">
                          · {tx.userName}{' '}
                          <span className="font-mono tabular-nums">(UID {tx.uid})</span>
                        </span>
                        {tx.kind === 'payment' && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                              tx.status === 'paid'
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                                : tx.status === 'pending'
                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                                : 'bg-rose-500/20 text-rose-600 dark:text-rose-300'
                            }`}
                          >
                            {tx.status === 'paid'
                              ? 'Lunas'
                              : tx.status === 'pending'
                              ? 'Menunggu'
                              : tx.status === 'expired'
                              ? 'Kedaluwarsa'
                              : 'Gagal'}
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 text-[11px] text-slate-600 dark:text-gray-300 break-words">
                        {tx.subtitle}
                      </p>

                      <p className="mt-1 text-[10px] text-slate-400 flex items-center gap-1.5">
                        <Receipt className="w-3 h-3" />
                        <span>{formatDateTimeId(tx.createdAt)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <span
                      className={`text-xs sm:text-sm font-extrabold font-mono tabular-nums whitespace-nowrap ${
                        tx.kind === 'payment'
                          ? tx.status === 'paid'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-700 dark:text-gray-200'
                          : tx.isPositive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {tx.amountLabel}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {inlineWorkspace ? (
        renderConsoleContent(false)
      ) : (
        /* Summary Card Fallback (when rendered outside inline workspace) */
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
                      Founder Panel · Kontrol Akun &amp; Transaksi Global
                    </h3>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider">
                      Khusus Founder
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-[#9CA3AF] mt-0.5">
                    Kelola status VIP, cek transaksi global, dan modifikasi statistik koin user secara real-time.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="w-full sm:w-auto min-h-[42px] px-4 rounded-xl bg-gradient-to-r from-[#E84A18] to-rose-600 hover:brightness-110 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25 transition-all"
              >
                <Users className="w-4 h-4" />
                <span>Buka Founder Panel ({stats.total})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal View when opened from summary card */}
      {!inlineWorkspace && isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4">
          {renderConsoleContent(true)}
        </div>
      )}

      {/* Per-User Founder Control Sub-Modal (VIP + Coin Stats + Level) */}
      {controlTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#13151C] border border-amber-500/35 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5" />
                  <span>Kontrol Akun Founder</span>
                </p>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
                  {controlTarget.name} · @{controlTarget.username}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-gray-400 font-mono">
                  UID {controlTarget.uid}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setControlTarget(null)}
                aria-label="Tutup Kontrol Akun"
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-500 dark:text-gray-300 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[78dvh] overflow-y-auto">
              {/* 1. VIP Premium Control (For non-founder users) */}
              {controlTarget.role !== 'founder' && controlTarget.uid !== '00000' && (
                <div className="rounded-2xl p-3.5 bg-slate-50 dark:bg-[#191C26] border border-slate-200 dark:border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#E84A18]" />
                      <span>Kelola Status VIP User</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                        controlTarget.isPremium
                          ? 'bg-orange-500/20 text-orange-600 dark:text-orange-300'
                          : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-gray-300'
                      }`}
                    >
                      {formatVipRemaining(controlTarget.premiumExpiryDate, controlTarget.isPremium)}
                    </span>
                  </div>

                  {controlTarget.isPremium && controlTarget.premiumExpiryDate && (
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">
                      Paket: <strong className="text-slate-700 dark:text-gray-200">{controlTarget.premiumPlan || 'VIP Aktif'}</strong> · Berlaku s/d{' '}
                      <strong className="text-slate-700 dark:text-gray-200">
                        {new Date(controlTarget.premiumExpiryDate).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </strong>
                    </p>
                  )}

                  <div className="grid grid-cols-4 gap-1.5">
                    {[3, 7, 30, 365].map((days) => (
                      <button
                        key={days}
                        type="button"
                        disabled={ctrlBusy}
                        onClick={() =>
                          void handleFounderControlSubmit({
                            vipAction: controlTarget.isPremium ? 'extend' : 'grant',
                            vipDays: days,
                          })
                        }
                        className="min-h-[36px] rounded-xl bg-[#E84A18]/15 hover:bg-[#E84A18] text-[#E84A18] hover:text-white border border-[#E84A18]/30 text-[11px] font-extrabold transition-colors disabled:opacity-50"
                      >
                        +{days} Hr
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={ctrlVipPlan}
                      onChange={(e) => setCtrlVipPlan(e.target.value)}
                      placeholder="Label paket (opsional, mis: VIP Emperor)"
                      className="w-full h-9 px-2.5 rounded-xl bg-white dark:bg-[#11131A] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={3650}
                        value={ctrlVipDays}
                        onChange={(e) => setCtrlVipDays(e.target.value)}
                        className="w-20 h-9 px-2.5 rounded-xl bg-white dark:bg-[#11131A] border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                        placeholder="Hari"
                      />
                      <button
                        type="button"
                        disabled={ctrlBusy}
                        onClick={() =>
                          void handleFounderControlSubmit({
                            vipAction: controlTarget.isPremium ? 'extend' : 'grant',
                            vipDays: Math.max(1, Math.floor(Number(ctrlVipDays) || 30)),
                          })
                        }
                        className="flex-1 min-h-[36px] px-3 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-extrabold disabled:opacity-50 whitespace-nowrap"
                      >
                        {controlTarget.isPremium ? 'Perpanjang' : 'Aktifkan VIP'}
                      </button>
                    </div>
                  </div>

                  {controlTarget.isPremium && (
                    <button
                      type="button"
                      disabled={ctrlBusy}
                      onClick={() => void handleFounderControlSubmit({ vipAction: 'revoke' })}
                      className="w-full min-h-[36px] px-3 rounded-xl bg-rose-600/15 hover:bg-rose-600 text-rose-600 dark:text-rose-300 hover:text-white border border-rose-500/35 text-xs font-extrabold transition-colors disabled:opacity-50"
                    >
                      Cabut Status VIP Sekarang
                    </button>
                  )}
                </div>
              )}

              {/* 2. Modifikasi Statistik Koin & Level Secara Langsung */}
              <div className="rounded-2xl p-3.5 bg-slate-50 dark:bg-[#191C26] border border-slate-200 dark:border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-500" />
                    <span>Modifikasi Statistik Koin Langsung</span>
                  </span>
                  <span className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-300">
                    {(controlTarget.coins ?? 0).toLocaleString('id-ID')} Koin
                  </span>
                </div>

                {/* Quick +/- Coin Adjustments */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[-500, 500, 1000, 5000].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      disabled={ctrlBusy}
                      onClick={() => void handleFounderControlSubmit({ coinDelta: delta })}
                      className={`min-h-[34px] rounded-xl border text-[11px] font-extrabold font-mono transition-colors disabled:opacity-50 ${
                        delta < 0
                          ? 'bg-rose-500/10 hover:bg-rose-600 text-rose-600 dark:text-rose-300 hover:text-white border-rose-500/30'
                          : 'bg-amber-500/15 hover:bg-amber-500 text-amber-700 dark:text-amber-300 hover:text-slate-950 border-amber-500/30'
                      }`}
                    >
                      {delta > 0 ? `+${delta.toLocaleString('id-ID')}` : delta.toLocaleString('id-ID')}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 block">
                      Saldo Koin Saat Ini
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={50000000}
                      value={ctrlCoins}
                      onChange={(e) => setCtrlCoins(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl bg-white dark:bg-[#11131A] border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 block">
                      Total Koin Diperoleh
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100000000}
                      value={ctrlEarned}
                      onChange={(e) => setCtrlEarned(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl bg-white dark:bg-[#11131A] border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 block">
                      Total Koin Dibelanjakan
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100000000}
                      value={ctrlSpent}
                      onChange={(e) => setCtrlSpent(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl bg-white dark:bg-[#11131A] border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 block">
                      Gift Terkirim / Diterima
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100000}
                        value={ctrlGiftsSent}
                        onChange={(e) => setCtrlGiftsSent(e.target.value)}
                        title="Total Gift Terkirim"
                        className="w-full h-9 px-2.5 rounded-xl bg-white dark:bg-[#11131A] border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100000}
                        value={ctrlGiftsRecv}
                        onChange={(e) => setCtrlGiftsRecv(e.target.value)}
                        title="Total Gift Diterima"
                        className="w-full h-9 px-2.5 rounded-xl bg-white dark:bg-[#11131A] border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                      />
                    </div>
                  </label>
                </div>

                <input
                  type="text"
                  maxLength={180}
                  value={ctrlCoinNote}
                  onChange={(e) => setCtrlCoinNote(e.target.value)}
                  placeholder="Catatan audit transaksi koin (opsional, tercatat di riwayat global)"
                  className="w-full h-9 px-3 rounded-xl bg-white dark:bg-[#11131A] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                />

                {controlTarget.role !== 'founder' && controlTarget.uid !== '00000' && (
                  <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-slate-200 dark:border-white/[0.06]">
                    <label className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 block">
                        Level User
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={9999}
                        value={ctrlLevel}
                        onChange={(e) => setCtrlLevel(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl bg-white dark:bg-[#11131A] border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 pt-5 cursor-pointer">
                      <span className="text-xs font-semibold text-slate-700 dark:text-gray-200">
                        Centang Verified
                      </span>
                      <input
                        type="checkbox"
                        checked={ctrlVerified}
                        onChange={(e) => setCtrlVerified(e.target.checked)}
                        className="w-4 h-4 accent-[#E84A18]"
                      />
                    </label>
                  </div>
                )}

                <button
                  type="button"
                  disabled={ctrlBusy}
                  onClick={() => void handleFounderControlSubmit({ saveAttributes: true })}
                  className="w-full min-h-[40px] rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-slate-900 text-xs font-extrabold transition-colors disabled:opacity-50"
                >
                  {ctrlBusy ? 'Menyimpan...' : 'Simpan Statistik Koin & Akun'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
