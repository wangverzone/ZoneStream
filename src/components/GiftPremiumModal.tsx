import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Coins,
  Crown,
  Gift,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { CoinPremiumPackage, PublicCommunityUser } from '../types';
import { playSoundEffect } from '../utils/soundEffects';

interface GiftRecipient {
  uid: string;
  username: string;
  name: string;
  photoUrl?: string;
  isPremium?: boolean;
  role?: 'member' | 'founder';
}

interface GiftPremiumModalProps {
  open: boolean;
  onClose: () => void;
  initialRecipient?: GiftRecipient | null;
  initialMode?: 'gift' | 'self';
  onSuccess?: (info: {
    isSelfRedeem: boolean;
    packageName: string;
    durationDays: number;
    recipientUid?: string;
    recipientName?: string;
  }) => void;
}

const FALLBACK_COIN_PACKAGES: CoinPremiumPackage[] = [
  {
    id: 'prem_1d',
    name: 'VIP Express 1 Hari',
    coinCost: 1000,
    durationDays: 1,
    bonusExp: 50,
    description: 'Aktifkan status Verified VIP, bebas iklan & 2× EXP selama 24 jam penuh.',
  },
  {
    id: 'prem_3d',
    name: 'VIP Squad 3 Hari',
    coinCost: 3000,
    durationDays: 3,
    bonusExp: 150,
    badgeTag: 'Populer',
    description: 'Bagikan atau aktifkan 3 hari penuh Verified VIP + bonus +150 EXP.',
  },
  {
    id: 'prem_7d',
    name: 'VIP Weekly 7 Hari',
    coinCost: 6500,
    durationDays: 7,
    bonusExp: 400,
    badgeTag: 'Hemat 500',
    description: 'Akses VIP 1 minggu penuh dengan harga hemat 500 Koin +400 EXP.',
  },
  {
    id: 'prem_14d',
    name: 'VIP Sovereign 14 Hari',
    coinCost: 12500,
    durationDays: 14,
    bonusExp: 800,
    badgeTag: 'Hemat 1.500',
    description: 'Akses VIP 2 minggu penuh +800 EXP dan semua dekorasi profil.',
  },
  {
    id: 'prem_30d',
    name: 'VIP Emperor 30 Hari',
    coinCost: 25000,
    durationDays: 30,
    bonusExp: 1800,
    badgeTag: 'Hemat 5.000',
    description: 'Paket VIP 1 bulan penuh paling hemat +1.800 EXP langsung.',
  },
];

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

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function GiftPremiumModal({
  open,
  onClose,
  initialRecipient = null,
  initialMode = 'gift',
  onSuccess,
}: GiftPremiumModalProps) {
  const { user, applyUserSnapshot } = useAuth();
  const isFounder = user?.role === 'founder';

  const [packages, setPackages] = useState<CoinPremiumPackage[]>(FALLBACK_COIN_PACKAGES);
  const [selectedPkgId, setSelectedPkgId] = useState<string>('prem_1d');
  const [mode, setMode] = useState<'gift' | 'self'>(initialMode);
  const [recipient, setRecipient] = useState<GiftRecipient | null>(initialRecipient);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicCommunityUser[]>([]);
  const [searching, setSearching] = useState(false);

  const [giftMessage, setGiftMessage] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    title: string;
    detail: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setSuccessInfo(null);
    setConfirmStep(false);
    setRecipient(initialRecipient || null);
    setMode(isFounder ? 'gift' : initialRecipient ? 'gift' : initialMode);
    setSearchQuery('');
    setSearchResults([]);
    setGiftMessage('');

    fetch('/api/coins/packages')
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.packages) && json.packages.length > 0) {
          setPackages(json.packages);
        }
      })
      .catch(() => {});
  }, [open, initialRecipient, initialMode, isFounder]);

  useEffect(() => {
    if (!open || mode !== 'gift') return;
    const clean = searchQuery.trim();
    if (clean.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const token = getStoredToken();
        const res = await fetch(`/api/social/search?q=${encodeURIComponent(clean)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (res.ok && json.ok && Array.isArray(json.users)) {
          setSearchResults(
            json.users.filter(
              (u: PublicCommunityUser) => u.uid !== user?.uid && u.role !== 'founder'
            )
          );
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [searchQuery, open, mode, user?.uid]);

  if (!open || !user) return null;

  const userCoins = Math.max(0, Math.floor(Number(user.coins ?? 0)));
  const selectedPkg = packages.find((p) => p.id === selectedPkgId) || packages[0];
  const canAfford = userCoins >= selectedPkg.coinCost;
  const remainingCoins = Math.max(0, userCoins - selectedPkg.coinCost);

  const hasValidTarget =
    mode === 'self' || Boolean(recipient && recipient.uid && recipient.uid !== user.uid);

  const handleConfirmGift = async () => {
    if (!canAfford || !hasValidTarget || submitting) return;
    const token = getStoredToken();
    if (!token) {
      setErrorMsg('Sesi login tidak ditemukan. Silakan masuk ulang.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    const requestId = generateRequestId();

    try {
      const targetUid = mode === 'self' ? user.uid : recipient!.uid;
      const res = await fetch('/api/coins/gift-premium', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          packageId: selectedPkg.id,
          targetUid,
          requestId,
          giftMessage: giftMessage.trim(),
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || 'Gagal memproses transaksi koin.');
        setConfirmStep(false);
        return;
      }

      if (json.user) {
        applyUserSnapshot(json.user);
      }
      playSoundEffect('levelUp');

      const title = json.isSelfRedeem
        ? `${selectedPkg.durationDays} Hari VIP Premium Aktif!`
        : `Berhasil Bagi Prem ke ${recipient?.name || json.recipient?.name}!`;
      const detail = json.isSelfRedeem
        ? `Saldo berkurang ${selectedPkg.coinCost.toLocaleString('id-ID')} Koin. Status Verified VIP + Bebas Iklan langsung aktif.`
        : `${selectedPkg.durationDays} Hari VIP Premium telah dikirim ke @${
            recipient?.username || json.recipient?.username
          }. Penerima mendapat notifikasi langsung.`;

      setSuccessInfo({ title, detail });
      setConfirmStep(false);

      if (onSuccess) {
        onSuccess({
          isSelfRedeem: Boolean(json.isSelfRedeem),
          packageName: selectedPkg.name,
          durationDays: selectedPkg.durationDays,
          recipientUid: targetUid,
          recipientName: recipient?.name || json.recipient?.name,
        });
      }
    } catch {
      setErrorMsg('Gagal terhubung ke server. Koin Anda aman dan tidak terpotong.');
      setConfirmStep(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#13151D] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.07] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                Bagi Prem &amp; Tukar Koin
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 truncate">
                Gunakan Koin hasil naik level untuk memberi VIP Premium
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal Bagi Prem"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Current Coin Balance Banner */}
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/[0.08] border border-amber-500/25 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Coins className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-200/80">
                  Saldo Koin Kamu
                </p>
                <p className="text-lg font-extrabold text-slate-900 dark:text-white font-mono tabular-nums leading-tight">
                  {userCoins.toLocaleString('id-ID')} Koin
                </p>
              </div>
            </div>

            <div className="text-right text-[11px] text-slate-600 dark:text-gray-300">
              <p className="font-semibold">Rate Resmi</p>
              <p className="font-mono tabular-nums text-amber-700 dark:text-amber-300 font-bold">
                1.000 Koin = 1 Hari VIP
              </p>
            </div>
          </div>

          {successInfo ? (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {successInfo.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed">
                {successInfo.detail}
              </p>
              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSuccessInfo(null);
                    setConfirmStep(false);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-white/10 text-xs font-bold text-slate-800 dark:text-white hover:opacity-90"
                >
                  Bagi Prem Lagi
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold"
                >
                  Selesai
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Mode Switcher */}
              {!isFounder && (
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('gift');
                      setConfirmStep(false);
                      setErrorMsg(null);
                    }}
                    className={`min-h-[38px] px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                      mode === 'gift'
                        ? 'bg-[#E84A18] text-white shadow-sm'
                        : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Gift className="w-3.5 h-3.5" />
                    <span>Bagi ke Teman</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('self');
                      setConfirmStep(false);
                      setErrorMsg(null);
                    }}
                    className={`min-h-[38px] px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                      mode === 'self'
                        ? 'bg-[#E84A18] text-white shadow-sm'
                        : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>Pakai Sendiri</span>
                  </button>
                </div>
              )}

              {/* Recipient Selector when mode === 'gift' */}
              {mode === 'gift' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-gray-200">
                    Penerima Premium
                  </label>

                  {recipient ? (
                    <div className="rounded-xl bg-slate-50 dark:bg-[#191C26] border border-slate-200 dark:border-white/10 p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {recipient.photoUrl ? (
                          <img
                            src={recipient.photoUrl}
                            alt={recipient.name}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#E84A18]/20 text-[#E84A18] font-extrabold text-xs flex items-center justify-center shrink-0">
                            {recipient.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            {recipient.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-gray-400 font-mono truncate">
                            @{recipient.username} · UID {recipient.uid}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRecipient(null);
                          setConfirmStep(false);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors shrink-0"
                      >
                        Ganti
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Cari @username, nama, atau UID penerima..."
                          className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-50 dark:bg-[#191C26] border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#E84A18]"
                        />
                      </div>

                      {searching && (
                        <p className="text-[11px] text-slate-500 dark:text-gray-400 px-1">
                          Mencari member...
                        </p>
                      )}

                      {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                        <p className="text-[11px] text-slate-500 dark:text-gray-400 px-1">
                          Member tidak ditemukan. Pastikan username atau UID benar.
                        </p>
                      )}

                      {searchResults.length > 0 && (
                        <div className="rounded-xl border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/[0.06] max-h-40 overflow-y-auto bg-white dark:bg-[#171A23]">
                          {searchResults.slice(0, 6).map((u) => (
                            <button
                              key={u.uid}
                              type="button"
                              onClick={() => {
                                setRecipient({
                                  uid: u.uid,
                                  username: u.username,
                                  name: u.name,
                                  photoUrl: u.photoUrl,
                                  isPremium: u.isPremium,
                                  role: u.role,
                                });
                                setSearchResults([]);
                                setSearchQuery('');
                              }}
                              className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {u.photoUrl ? (
                                  <img
                                    src={u.photoUrl}
                                    alt={u.name}
                                    referrerPolicy="no-referrer"
                                    className="w-8 h-8 rounded-full object-cover shrink-0"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 text-xs font-bold flex items-center justify-center shrink-0">
                                    {u.name.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {u.name}
                                  </p>
                                  <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                                    @{u.username} · Lv. {u.level}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[11px] font-bold text-[#E84A18] shrink-0">
                                Pilih
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Package Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-gray-200">
                    Pilih Durasi Premium (Sesuai Saldo Koin)
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {packages.map((pkg) => {
                    const affordable = userCoins >= pkg.coinCost;
                    const active = selectedPkg.id === pkg.id;
                    const shortBy = Math.max(0, pkg.coinCost - userCoins);
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => {
                          setSelectedPkgId(pkg.id);
                          setConfirmStep(false);
                          setErrorMsg(null);
                        }}
                        className={`w-full rounded-xl border p-3 text-left transition-all flex items-center justify-between gap-3 ${
                          active
                            ? 'border-[#E84A18] bg-[#E84A18]/[0.07] dark:bg-[#E84A18]/15'
                            : 'border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#171A23] hover:border-slate-300 dark:hover:border-white/20'
                        } ${!affordable ? 'opacity-70' : ''}`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                              {pkg.durationDays} Hari VIP Premium
                            </span>
                            {pkg.badgeTag && (
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-300">
                                · {pkg.badgeTag}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5 truncate">
                            Bebas Iklan · Verified VIP · +{pkg.bonusExp} Bonus EXP
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <p
                            className={`text-xs sm:text-sm font-extrabold font-mono tabular-nums ${
                              affordable
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-rose-500 dark:text-rose-400'
                            }`}
                          >
                            {pkg.coinCost.toLocaleString('id-ID')} Koin
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-gray-400">
                            {affordable
                              ? 'Koin cukup'
                              : `Kurang ${shortBy.toLocaleString('id-ID')}`}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Gift Note */}
              {mode === 'gift' && recipient && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-gray-200 mb-1">
                    Pesan Hadiah (Opsional)
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value)}
                    placeholder="Contoh: Nih Prem gratis buat maraton anime bareng!"
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-[#191C26] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#E84A18]"
                  />
                </div>
              )}

              {errorMsg && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-xs font-semibold text-rose-600 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Confirmation Box or Primary CTA */}
              {confirmStep ? (
                <div className="rounded-2xl bg-slate-100 dark:bg-[#191C26] border border-slate-200 dark:border-white/15 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-white">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Konfirmasi Transaksi Koin</span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-gray-300 space-y-1">
                    <div className="flex justify-between gap-2">
                      <span>Penerima</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {mode === 'self'
                          ? `${user.name} (Akun Sendiri)`
                          : `${recipient?.name} (@${recipient?.username})`}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Durasi VIP</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {selectedPkg.durationDays} Hari (+{selectedPkg.bonusExp} EXP)
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Potongan Koin</span>
                      <span className="font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                        -{selectedPkg.coinCost.toLocaleString('id-ID')} Koin
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 pt-1 border-t border-slate-200 dark:border-white/10">
                      <span>Sisa Saldo Koin</span>
                      <span className="font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                        {remainingCoins.toLocaleString('id-ID')} Koin
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setConfirmStep(false)}
                      className="flex-1 min-h-[42px] rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-200"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleConfirmGift}
                      className="flex-1 min-h-[42px] rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-lg shadow-[#E84A18]/25 disabled:opacity-60"
                    >
                      <Check className="w-4 h-4" />
                      <span>{submitting ? 'Memproses Aman...' : 'Konfirmasi & Kirim'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!canAfford || !hasValidTarget}
                  onClick={() => {
                    setErrorMsg(null);
                    setConfirmStep(true);
                  }}
                  className="w-full min-h-[46px] rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] disabled:bg-slate-300 dark:disabled:bg-white/10 disabled:text-slate-500 dark:disabled:text-gray-500 text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 shadow-lg shadow-[#E84A18]/20 transition-all"
                >
                  {mode === 'self' ? (
                    <UserCheck className="w-4 h-4" />
                  ) : (
                    <Gift className="w-4 h-4" />
                  )}
                  <span>
                    {!canAfford
                      ? `Koin Kurang (${(selectedPkg.coinCost - userCoins).toLocaleString('id-ID')} Koin lagi)`
                      : !hasValidTarget
                      ? 'Pilih Penerima Terlebih Dahulu'
                      : mode === 'self'
                      ? `Aktifkan ${selectedPkg.durationDays} Hari VIP (${selectedPkg.coinCost.toLocaleString('id-ID')} Koin)`
                      : `Bagi ${selectedPkg.durationDays} Hari Prem ke @${recipient?.username}`}
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
