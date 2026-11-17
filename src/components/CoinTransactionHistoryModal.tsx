import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarCheck2,
  ChevronDown,
  ChevronUp,
  Coins,
  Crown,
  Gift,
  History,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import type { CoinLedgerEntry, UserProfile } from '../types';

interface CoinTransactionHistoryModalProps {
  open: boolean;
  onClose: () => void;
  user: UserProfile;
  onOpenGiftModal?: (mode: 'gift' | 'self') => void;
}

type HistoryFilter = 'all' | 'gains' | 'expenditures';

interface LedgerSummary {
  coins: number;
  totalCoinsEarned: number;
  totalCoinsSpent: number;
  totalGiftsSent: number;
  totalGiftsReceived: number;
}

function getStoredToken(): string {
  try {
    return (
      localStorage.getItem('zonestream_session_token_v1') ||
      localStorage.getItem('donghive_session_token_v1') ||
      ''
    );
  } catch {
    return '';
  }
}

function formatFullTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getTxCategoryMeta(type: CoinLedgerEntry['type']) {
  switch (type) {
    case 'daily_checkin':
      return {
        label: 'Daily Check-in',
        badgeText: 'Hadiah Check-in 24 Jam',
        Icon: CalendarCheck2,
        iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        isGain: true,
        isExpense: false,
      };
    case 'level_up':
      return {
        label: 'Naik Level',
        badgeText: 'Hadiah Level-Up',
        Icon: TrendingUp,
        iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        isGain: true,
        isExpense: false,
      };
    case 'milestone_bonus':
      return {
        label: 'Tugas & Misi Harian',
        badgeText: 'Bonus Misi',
        Icon: Sparkles,
        iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        isGain: true,
        isExpense: false,
      };
    case 'self_redeem':
      return {
        label: 'Pembelian Premium',
        badgeText: 'Tukar VIP Sendiri',
        Icon: Crown,
        iconBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
        isGain: false,
        isExpense: true,
      };
    case 'gift_sent':
      return {
        label: 'Bagi Prem ke Member',
        badgeText: 'Gift VIP Terkirim',
        Icon: ArrowUpRight,
        iconBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
        isGain: false,
        isExpense: true,
      };
    case 'gift_received':
      return {
        label: 'Gift Premium Masuk',
        badgeText: 'VIP Diterima',
        Icon: ArrowDownLeft,
        iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
        isGain: true,
        isExpense: false,
      };
    case 'refund':
      return {
        label: 'Pengembalian Koin',
        badgeText: 'Refund Otomatis',
        Icon: RotateCcw,
        iconBg: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
        isGain: true,
        isExpense: false,
      };
    case 'founder_adjust':
      return {
        label: 'Penyesuaian Founder',
        badgeText: 'Kontrol Founder',
        Icon: Crown,
        iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
        isGain: true,
        isExpense: false,
      };
    default:
      return {
        label: 'Aktivitas Koin',
        badgeText: 'Transaksi',
        Icon: Coins,
        iconBg: 'bg-slate-500/15 text-slate-600 dark:text-gray-300',
        isGain: false,
        isExpense: false,
      };
  }
}

export function CoinTransactionHistoryModal({
  open,
  onClose,
  user,
  onOpenGiftModal,
}: CoinTransactionHistoryModalProps) {
  const [entries, setEntries] = useState<CoinLedgerEntry[]>([]);
  const [summary, setSummary] = useState<LedgerSummary>({
    coins: Math.max(0, Math.floor(Number(user.coins ?? 0))),
    totalCoinsEarned: Math.max(0, Math.floor(Number(user.totalCoinsEarned ?? user.coins ?? 0))),
    totalCoinsSpent: Math.max(0, Math.floor(Number(user.totalCoinsSpent ?? 0))),
    totalGiftsSent: Math.max(0, Math.floor(Number(user.totalGiftsSent ?? 0))),
    totalGiftsReceived: Math.max(0, Math.floor(Number(user.totalGiftsReceived ?? 0))),
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setErrorMsg('Sesi login tidak ditemukan.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/coins/history', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || 'Gagal memuat riwayat transaksi koin.');
        return;
      }
      setEntries(Array.isArray(json.history) ? json.history : []);
      setSummary({
        coins: Number(json.coins ?? user.coins ?? 0),
        totalCoinsEarned: Number(json.totalCoinsEarned ?? user.totalCoinsEarned ?? 0),
        totalCoinsSpent: Number(json.totalCoinsSpent ?? user.totalCoinsSpent ?? 0),
        totalGiftsSent: Number(json.totalGiftsSent ?? user.totalGiftsSent ?? 0),
        totalGiftsReceived: Number(json.totalGiftsReceived ?? user.totalGiftsReceived ?? 0),
      });
    } catch {
      setErrorMsg('Tidak dapat terhubung ke server untuk memuat riwayat koin.');
    } finally {
      setLoading(false);
    }
  }, [user.coins, user.totalCoinsEarned, user.totalCoinsSpent, user.totalGiftsSent, user.totalGiftsReceived]);

  useEffect(() => {
    if (!open) return;
    setFilter('all');
    setSearchTerm('');
    setExpandedTxId(null);
    void fetchHistory();
  }, [open, fetchHistory]);

  const filteredEntries = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return entries.filter((item) => {
      const meta = getTxCategoryMeta(item.type);
      if (filter === 'gains' && !meta.isGain) return false;
      if (filter === 'expenditures' && !meta.isExpense) return false;
      if (!q) return true;
      const haystack = `${item.txId} ${item.note} ${item.peerUsername || ''} ${
        item.peerName || ''
      } ${item.peerUid || ''} ${item.packageId || ''} ${meta.label}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [entries, filter, searchTerm]);

  const gainsCount = useMemo(
    () => entries.filter((e) => getTxCategoryMeta(e.type).isGain).length,
    [entries]
  );
  const expenseCount = useMemo(
    () => entries.filter((e) => getTxCategoryMeta(e.type).isExpense).length,
    [entries]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coin-history-modal-title"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-[#13151D] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[88vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.07] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="coin-history-modal-title"
                className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate"
              >
                Coin Transaction History
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 truncate">
                Log lengkap perolehan koin dari misi/level &amp; pengeluaran Premium
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={loading}
              onClick={() => void fetchHistory()}
              aria-label="Muat ulang riwayat koin"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup modal Coin Transaction History"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-white/[0.06] shrink-0 space-y-3">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl bg-amber-50/90 dark:bg-amber-500/[0.07] border border-amber-500/20 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-200/80 truncate">
                Saldo Aktif
              </p>
              <p className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5 truncate">
                {summary.coins.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50/90 dark:bg-emerald-500/[0.07] border border-emerald-500/20 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-200/80 truncate">
                Pemasukan Misi
              </p>
              <p className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-0.5 truncate">
                +{summary.totalCoinsEarned.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="rounded-xl bg-rose-50/90 dark:bg-rose-500/[0.07] border border-rose-500/20 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-rose-800 dark:text-rose-200/80 truncate">
                Belanja Premium
              </p>
              <p className="text-sm sm:text-base font-extrabold text-rose-600 dark:text-rose-400 font-mono tabular-nums mt-0.5 truncate">
                -{summary.totalCoinsSpent.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          {/* Filter Tabs & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  filter === 'all'
                    ? 'bg-white dark:bg-[#1C1F2B] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Semua ({entries.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('gains')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  filter === 'gains'
                    ? 'bg-white dark:bg-[#1C1F2B] text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Pemasukan ({gainsCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('expenditures')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  filter === 'expenditures'
                    ? 'bg-white dark:bg-[#1C1F2B] text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Pengeluaran ({expenseCount})
              </button>
            </div>

            <div className="relative sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari catatan, ID, @user..."
                className="w-full h-9 pl-8 pr-3 rounded-xl bg-slate-50 dark:bg-[#191C26] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#E84A18]"
              />
            </div>
          </div>
        </div>

        {/* Scrollable Ledger List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="space-y-2.5 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl bg-slate-100 dark:bg-white/[0.04] animate-pulse"
                />
              ))}
            </div>
          ) : errorMsg ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-xs font-semibold text-rose-500">{errorMsg}</p>
              <button
                type="button"
                onClick={() => void fetchHistory()}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-bold"
              >
                Coba Lagi
              </button>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 flex items-center justify-center mx-auto">
                <Coins className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {entries.length === 0
                    ? 'Belum Ada Transaksi Koin'
                    : 'Tidak Ada Transaksi yang Cocok'}
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed">
                  {entries.length === 0
                    ? 'Selesaikan misi tontonan harian, beri komentar, atau naik level untuk mengumpulkan koin pertamamu!'
                    : 'Coba ubah filter atau kata kunci pencarian untuk melihat log lainnya.'}
                </p>
              </div>
              {entries.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setFilter('all');
                    setSearchTerm('');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-white/10 text-xs font-bold text-slate-800 dark:text-white"
                >
                  Reset Filter
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {filteredEntries.map((item) => {
                const meta = getTxCategoryMeta(item.type);
                const Icon = meta.Icon;
                const isPositive = item.amount > 0;
                const isGiftIn = item.type === 'gift_received';
                const isExpanded = expandedTxId === item.txId;

                return (
                  <div key={item.txId} className="py-3 first:pt-1 last:pb-1">
                    <button
                      type="button"
                      onClick={() => setExpandedTxId(isExpanded ? null : item.txId)}
                      className="w-full flex items-start justify-between gap-3 text-left group"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${meta.iconBg}`}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                            <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                              {meta.label}
                            </span>
                            <span className="text-[11px] text-slate-400" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-[11px] font-medium text-slate-500 dark:text-gray-400">
                              {formatFullTimestamp(item.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-gray-200 mt-0.5 leading-snug break-words">
                            {item.note}
                          </p>
                          <div className="mt-1 flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-gray-400">
                            <span className="font-mono tabular-nums">
                              Saldo akhir: {item.balanceAfter.toLocaleString('id-ID')} Koin
                            </span>
                            {item.peerUsername && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>@{item.peerUsername}</span>
                              </>
                            )}
                            {item.durationDays && item.durationDays > 0 ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                  {item.durationDays} Hari VIP
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span
                          className={`text-xs sm:text-sm font-extrabold font-mono tabular-nums ${
                            isPositive
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isGiftIn
                              ? 'text-amber-500'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isGiftIn
                            ? `+${item.durationDays || 1} Hari VIP`
                            : `${isPositive ? '+' : ''}${item.amount.toLocaleString('id-ID')} Koin`}
                        </span>
                        <span className="text-[10px] text-slate-400 inline-flex items-center gap-0.5 group-hover:text-slate-600 dark:group-hover:text-gray-200">
                          <span>Detail</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-2.5 ml-12 rounded-xl bg-slate-50 dark:bg-[#181B25] border border-slate-200/80 dark:border-white/[0.07] p-3 text-[11px] text-slate-600 dark:text-gray-300 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        <div>
                          <span className="text-slate-400">ID Transaksi: </span>
                          <span className="font-mono text-slate-800 dark:text-gray-100 select-all">
                            {item.txId}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Kategori: </span>
                          <span className="font-semibold text-slate-800 dark:text-gray-100">
                            {meta.badgeText}
                          </span>
                        </div>
                        {item.packageId && (
                          <div>
                            <span className="text-slate-400">Kode Paket: </span>
                            <span className="font-mono text-slate-800 dark:text-gray-100">
                              {item.packageId}
                            </span>
                          </div>
                        )}
                        {item.peerUid && (
                          <div>
                            <span className="text-slate-400">
                              {item.type === 'gift_received' ? 'Pengirim: ' : 'Penerima: '}
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-gray-100">
                              {item.peerName || '-'} (@{item.peerUsername || '-'} · UID{' '}
                              {item.peerUid})
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-white/[0.07] bg-slate-50/70 dark:bg-[#101219] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-gray-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Catatan diaudit otomatis oleh server</span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenGiftModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenGiftModal('gift');
                }}
                className="min-h-[38px] px-3.5 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Gift className="w-3.5 h-3.5" />
                <span>Bagi Prem</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[38px] px-4 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-xs font-bold text-slate-800 dark:text-white transition-colors whitespace-nowrap"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
