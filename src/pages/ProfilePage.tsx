import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Crown,
  Diamond,
  ExternalLink,
  Eye,
  Film,
  Flame,
  Gift,
  History,
  KeyRound,
  LayoutGrid,
  Lock,
  LogOut,
  MailCheck,
  MessageCircle,
  Moon,
  Palette,
  Pencil,
  QrCode,
  RefreshCw,
  Send,
  Settings,
  ShieldBan,
  ShieldCheck,
  Smartphone,
  Smile,
  Sparkles,
  Star,
  Sun,
  UserPlus,
  Users,
  Volume2,
  Wallet,
  X,
  Zap,
  Globe,
  Trophy,
  ChevronRight,
  Upload,
  ImagePlus,
  FileCheck2,
  Loader2,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { TelegramCsButton } from '../components/TelegramCsButton';
import { ThemeToggle } from '../components/ThemeToggle';
import { TELEGRAM_BADGE_MAP, VerifiedBadge } from '../components/VerifiedBadge';
import { StatusEmojiBadge } from '../components/VipEmojis';
import { CountryFlagBadge } from '../components/CountryFlag';
import {
  AUTO_LEVEL_BORDER_PRESET,
  AvatarDecoration,
  LEVEL_RANK_BORDERS,
  STREAK_FRAME_REWARDS,
  getLevelRankTier,
  normalizeDecorationId,
} from '../components/AvatarDecoration';
import { FounderUserMonitorPanel } from '../components/FounderUserMonitorPanel';
import { LevelUpCard } from '../components/LevelUpCard';
import { DailyCheckInCard } from '../components/DailyCheckInCard';
import { CoinWalletCard } from '../components/CoinWalletCard';
import { CoinTransactionHistoryModal } from '../components/CoinTransactionHistoryModal';
import { GiftPremiumModal } from '../components/GiftPremiumModal';
import { SoundSettingsPanel } from '../components/SoundSettingsPanel';
import { VipBenefitsLog } from '../components/VipBenefitsLog';
import { BannerMedia } from '../components/BannerMedia';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { useAuth, PROFILE_THEMES } from '../context/AuthContext';
import { useBackground } from '../context/BackgroundContext';
import { useTheme } from '../context/ThemeContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { APP_LANGUAGES, useAppLanguage } from '../utils/language';
import {
  CLAN_INVITE_RESOLVED_EVENT,
  clearPendingClanInvite,
  fetchClanInvitePreview,
  getPendingClanInvite,
  type ClanInvitePreview,
} from '../utils/clanInvite';
import { uploadPaymentProofImage, formatFileSize } from '../utils/imageCompression';
import { playSoundEffect } from '../utils/soundEffects';
import type { PaymentTransaction, PremiumPackage } from '../types';
import defaultBannerImg from '../assets/images/default_profile_banner_1794755346957.jpg';

const FALLBACK_PACKAGES: PremiumPackage[] = [
  {
    id: 'vip_15k',
    name: 'VIP Bulanan 30 Hari',
    amount: 15000,
    durationDays: 30,
    bonusExp: 300,
    tagline: 'Bebas iklan 10s, Lencana VIP, Emoji Eksklusif & 2x EXP Nonton selama 30 hari penuh.',
  },
  {
    id: 'vip_20k',
    name: 'VIP Pro 60 Hari',
    amount: 20000,
    durationDays: 60,
    bonusExp: 500,
    tagline: 'Paket terlaris 60 hari penuh tanpa iklan + Bonus +500 EXP & 2x EXP Harian.',
    popular: true,
  },
  {
    id: 'vip_30k',
    name: 'VIP Immortal 365 Hari',
    amount: 30000,
    durationDays: 365,
    bonusExp: 1000,
    tagline: 'Akses VIP 1 tahun penuh (365 hari) + Bonus +1.000 EXP langsung & 2x EXP Nonton.',
  },
];

const PAYMENT_METHODS = [
  { id: 'qris', label: 'QRIS (DANA, GoPay, OVO, ShopeePay & Bank)' },
  { id: 'bni_va', label: 'BNI Virtual Account' },
  { id: 'bri_va', label: 'BRI Virtual Account' },
  { id: 'permata_va', label: 'Permata Virtual Account' },
  { id: 'cimb_niaga_va', label: 'CIMB Niaga VA' },
];

function formatIdr(value: number): string {
  return `Rp ${value.toLocaleString('id-ID')}`;
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

function getJakartaWibDateString(offsetDays = 0): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000 + offsetDays * 86_400_000);
  return now.toISOString().slice(0, 10);
}

function getTodayWibString(): string {
  return getJakartaWibDateString(0);
}

const SHORT_DAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function getLast7WibDays(): Array<{
  dateStr: string;
  shortDay: string;
  dayNum: string;
  isToday: boolean;
}> {
  const items: Array<{ dateStr: string; shortDay: string; dayNum: string; isToday: boolean }> = [];
  for (let offset = -6; offset <= 0; offset++) {
    const ms = Date.now() + 7 * 60 * 60 * 1000 + offset * 86_400_000;
    const d = new Date(ms);
    items.push({
      dateStr: d.toISOString().slice(0, 10),
      shortDay: SHORT_DAYS_ID[d.getUTCDay()],
      dayNum: String(d.getUTCDate()),
      isToday: offset === 0,
    });
  }
  return items;
}

function getStoredAuthToken(): string {
  return (
    localStorage.getItem('zonestream_session_token_v1') ||
    localStorage.getItem('donghive_session_token_v1') ||
    ''
  );
}

export function ProfilePage() {
  const {
    user,
    isPremium,
    loading,
    authError,
    clearAuthError,
    login,
    loginWithGoogle,
    register,
    logout,
    refreshUser,
    updateProfile,
    toggleFounderAdPreview,
    getLocalHistory,
    getLocalBookmarks,
  } = useAuth();
  const { lang, currentLanguageOption, changeLanguage } = useAppLanguage();
  const { isDark, setTheme } = useTheme();
  const { config: bgConfig, activePreset: activeBgPreset, openCustomizer } = useBackground();
  const { isInstalled: isPwaInstalled } = usePWAInstall();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regName, setRegName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCode, setRegCode] = useState('');
  const [regCodeBusy, setRegCodeBusy] = useState(false);
  const [regCodeMsg, setRegCodeMsg] = useState<{ type: 'ok' | 'err'; text: string; code?: string } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const [showXpModal, setShowXpModal] = useState(false);
  const [showGiftCoinModal, setShowGiftCoinModal] = useState(false);
  const [showCoinHistoryModal, setShowCoinHistoryModal] = useState(false);
  const [giftCoinMode, setGiftCoinMode] = useState<'gift' | 'self'>('gift');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [packages, setPackages] = useState<PremiumPackage[]>(FALLBACK_PACKAGES);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('vip_20k');
  const [paymentMethod, setPaymentMethod] = useState<string>('qris');
  const [creatingTx, setCreatingTx] = useState(false);
  const [checkingTx, setCheckingTx] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [activeTx, setActiveTx] = useState<PaymentTransaction | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedText, setCopiedText] = useState(false);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string>('');
  const [proofUploadedUrl, setProofUploadedUrl] = useState<string>('');
  const [proofStoragePath, setProofStoragePath] = useState<string>('');
  const [proofSizeLabel, setProofSizeLabel] = useState<string>('');
  const [proofSenderRef, setProofSenderRef] = useState<string>('');
  const [uploadingProof, setUploadingProof] = useState<boolean>(false);
  const [proofUploadPct, setProofUploadPct] = useState<number>(0);
  const [submittingProof, setSubmittingProof] = useState<boolean>(false);
  const [proofStatusMsg, setProofStatusMsg] = useState<string | null>(null);

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ type: 'ok' | 'err'; text: string; code?: string } | null>(null);
  const [userClan, setUserClan] = useState<any>(null);
  const [equippingFrameId, setEquippingFrameId] = useState<string>('');
  const [streakFrameNotice, setStreakFrameNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pendingClanInvite, setPendingClanInviteState] = useState<ClanInvitePreview | null>(null);
  const [settingsSection, setSettingsSection] = useState<'appearance' | 'sound' | 'account'>('appearance');

  useEffect(() => {
    if (user) {
      setPendingClanInviteState(null);
      return;
    }
    const pendingCode = getPendingClanInvite();
    if (!pendingCode) {
      setPendingClanInviteState(null);
      return;
    }
    let cancelled = false;
    void fetchClanInvitePreview(pendingCode).then((res) => {
      if (cancelled) return;
      if (res.ok && res.clan) {
        setPendingClanInviteState(res.clan);
      } else {
        setPendingClanInviteState(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const loadMyClan = () => {
      fetch('/api/social/clans', {
        headers: { Authorization: `Bearer ${getStoredAuthToken()}` },
      })
        .then((res) => res.json())
        .then((json) => {
          if (json.ok && Array.isArray(json.clans)) {
            const found = json.clans.find(
              (c: any) => c.leaderUid === user.uid || c.members?.includes(user.uid)
            );
            setUserClan(found || null);
          }
        })
        .catch(() => {});
    };
    loadMyClan();
    const onResolved = () => loadMyClan();
    window.addEventListener(CLAN_INVITE_RESOLVED_EVENT, onResolved);
    return () => window.removeEventListener(CLAN_INVITE_RESOLVED_EVENT, onResolved);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    void refreshUser();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshUser();
      }
    }, 15_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshUser();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.uid]);

  const isFounderUser = user?.role === 'founder';
  const level = user?.level ?? 1;
  const levelDisplay = isFounderUser ? '∞' : String(level);
  const exp = user?.exp ?? 25;
  const todayWib = getTodayWibString();
  const yesterdayWib = getJakartaWibDateString(-1);
  const rawStreak = user?.watchStreak ?? 0;
  const isStreakCurrent = Boolean(
    user?.lastWatchDate && (user.lastWatchDate === todayWib || user.lastWatchDate === yesterdayWib)
  );
  const watchStreak = isStreakCurrent ? Math.max(1, rawStreak) : 0;
  const longestStreak = Math.max(user?.longestStreak ?? 0, watchStreak);
  const watchedToday = Boolean(user?.lastWatchDate && user.lastWatchDate === todayWib);
  const dailyEpisodesToday = watchedToday ? Math.max(1, user?.dailyEpisodesWatched ?? 1) : 0;

  const watchedDateSet = new Set<string>(user?.streakDates || []);
  if (user?.lastWatchDate) {
    watchedDateSet.add(user.lastWatchDate);
    if (watchStreak > 1) {
      const anchorMs = new Date(`${user.lastWatchDate}T00:00:00Z`).getTime();
      if (!Number.isNaN(anchorMs)) {
        for (let i = 0; i < Math.min(watchStreak, 7); i++) {
          watchedDateSet.add(new Date(anchorMs - i * 86_400_000).toISOString().slice(0, 10));
        }
      }
    }
  }
  const last7Days = getLast7WibDays();
  const bestStreakForRewards = Math.max(longestStreak, watchStreak);
  const unlockedFramesSet = new Set<string>(user?.unlockedStreakFrames || []);

  const handleEquipStreakFrame = async (frameId: string, frameName: string) => {
    setEquippingFrameId(frameId);
    setStreakFrameNotice(null);
    const ok = await updateProfile({ activeBorder: frameId });
    setEquippingFrameId('');
    if (ok) {
      setStreakFrameNotice({
        type: 'ok',
        text: `Frame ${frameName} berhasil dipasang ke avatar profilmu!`,
      });
    } else {
      const isLevelFrame = frameId.startsWith('rank-') || frameId === 'level-auto';
      setStreakFrameNotice({
        type: 'err',
        text: isLevelFrame
          ? 'Gagal memasang bingkai level. Pastikan level kamu sudah memenuhi syarat.'
          : 'Gagal memasang frame. Pastikan streak kamu sudah memenuhi syarat.',
      });
    }
  };

  const rawTab = searchParams.get('tab');
  const activeProfileTab: 'overview' | 'wallet' | 'streak' | 'settings' | 'founder' =
    rawTab === 'wallet' ||
    rawTab === 'streak' ||
    rawTab === 'settings' ||
    (rawTab === 'founder' && isFounderUser)
      ? rawTab
      : 'overview';

  const setActiveProfileTab = (
    tab: 'overview' | 'wallet' | 'streak' | 'settings' | 'founder'
  ) => {
    if (tab === 'overview') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  };

  const activeTheme =
    PROFILE_THEMES[user?.profileTheme || 'default'] || PROFILE_THEMES.default;

  const historyCount = getLocalHistory().length;
  const bookmarkCount = getLocalBookmarks().length;
  const hasVipBadge = Boolean(user && (user.isVerified || isPremium || isFounderUser));
  const badgePreset = user?.activeBadge ? TELEGRAM_BADGE_MAP.get(user.activeBadge) : undefined;
  const BadgeIcon = badgePreset?.icon || BadgeCheck;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hadPendingInvite = Boolean(getPendingClanInvite());
    setSubmitting(true);
    const ok = await login(identifier, password);
    setSubmitting(false);
    if (ok && hadPendingInvite) {
      navigate('/leaderboard?tab=clans');
    }
  };

  const handleGoogleLogin = async () => {
    const hadPendingInvite = Boolean(getPendingClanInvite());
    const loginPromise = loginWithGoogle();
    setGoogleBusy(true);
    const ok = await loginPromise;
    setGoogleBusy(false);
    if (ok && hadPendingInvite) {
      navigate('/leaderboard?tab=clans');
    }
  };

  const handleSendRegisterCode = async () => {
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setRegCodeMsg({ type: 'err', text: 'Masukkan alamat email yang valid terlebih dahulu.' });
      return;
    }
    setRegCodeBusy(true);
    setRegCodeMsg(null);
    clearAuthError();
    try {
      const res = await fetch('/api/user/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'register', targetEmail: regEmail.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setRegCodeMsg({ type: 'err', text: json.error || 'Gagal mengirim kode' });
      } else {
        setRegCodeMsg({ type: 'ok', text: json.message, code: json.previewCode });
      }
    } catch {
      setRegCodeMsg({ type: 'err', text: 'Gagal menghubungi server' });
    } finally {
      setRegCodeBusy(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hadPendingInvite = Boolean(getPendingClanInvite());
    setSubmitting(true);
    const ok = await register(regUsername, regEmail, regName, regPassword, regCode);
    setSubmitting(false);
    if (ok && hadPendingInvite) {
      navigate('/leaderboard?tab=clans');
    }
  };

  useEffect(() => {
    if (!showUpgradeModal) return;
    fetch('/api/payment/packages')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && Array.isArray(json.packages) && json.packages.length > 0) {
          setPackages(json.packages);
        }
      })
      .catch(() => {});
  }, [showUpgradeModal]);

  useEffect(() => {
    if (!activeTx?.paymentNumber || activeTx.paymentMethod !== 'qris') {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(activeTx.paymentNumber, {
      width: 300,
      margin: 2,
      color: { dark: '#0B0D14', light: '#FFFFFF' },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [activeTx?.paymentNumber, activeTx?.paymentMethod]);

  const resetProofState = () => {
    setProofPreviewUrl('');
    setProofUploadedUrl('');
    setProofStoragePath('');
    setProofSizeLabel('');
    setProofSenderRef('');
    setUploadingProof(false);
    setProofUploadPct(0);
    setSubmittingProof(false);
    setProofStatusMsg(null);
  };

  const checkTransactionStatus = async (orderId: string, silent = false) => {
    const token = getStoredAuthToken();
    if (!token || !orderId) return;
    if (!silent) {
      setCheckingTx(true);
      setPaymentError(null);
    }
    try {
      const res = await fetch(`/api/payment/status/${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        if (json.status === 'paid') {
          setActiveTx((prev) =>
            prev
              ? { ...prev, ...(json.transaction || {}), status: 'paid', verificationStage: 'verified' }
              : prev
          );
          setPaymentError(null);
          setProofStatusMsg(null);
          playSoundEffect('levelUp');
          await refreshUser();
        } else if (json.verificationStage === 'verifying_proof') {
          setActiveTx((prev) =>
            prev ? { ...prev, ...(json.transaction || {}), verificationStage: 'verifying_proof' } : prev
          );
          setPaymentError(null);
          setProofStatusMsg(
            'Webhook & Polling Otomatis: Bukti transfer sedang diverifikasi ke database...'
          );
        } else if (json.status === 'expired' || json.status === 'failed') {
          setActiveTx((prev) => (prev ? { ...prev, status: json.status } : prev));
          setPaymentError(
            'Transaksi sudah kedaluwarsa atau gagal. Silakan buat tagihan baru.'
          );
        } else if (!silent) {
          setPaymentError(
            'Pembayaran belum terdeteksi di mutasi otomatis. Silakan unggah foto Bukti Transfer di bawah untuk verifikasi otomatis instan.'
          );
        }
      } else if (!silent) {
        setPaymentError(json.error || 'Gagal memeriksa status pembayaran.');
      }
    } catch {
      if (!silent) {
        setPaymentError('Gagal menghubungi server pembayaran.');
      }
    } finally {
      if (!silent) setCheckingTx(false);
    }
  };

  const submitPaymentProofToServer = async (
    orderId: string,
    uploadedUrl: string,
    storagePath: string,
    senderRefText: string
  ) => {
    const token = getStoredAuthToken();
    if (!token || !orderId || !uploadedUrl) return;
    setSubmittingProof(true);
    setPaymentError(null);
    setProofStatusMsg('Mengirim bukti transfer & menjalankan verifikasi otomatis...');
    try {
      const res = await fetch(`/api/payment/submit-proof/${encodeURIComponent(orderId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          proofImageUrl: uploadedUrl,
          proofStoragePath: storagePath,
          senderRef: senderRefText,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setPaymentError(json.error || 'Gagal mengirim bukti transfer.');
        setProofStatusMsg(null);
        return;
      }
      if (json.status === 'paid') {
        setActiveTx((prev) =>
          prev
            ? { ...prev, ...(json.transaction || {}), status: 'paid', verificationStage: 'verified' }
            : prev
        );
        setProofStatusMsg(null);
        playSoundEffect('levelUp');
        await refreshUser();
      } else {
        setActiveTx((prev) =>
          prev
            ? {
                ...prev,
                ...(json.transaction || {}),
                proofImageUrl: uploadedUrl,
                verificationStage: 'verifying_proof',
              }
            : prev
        );
        setProofStatusMsg(
          json.message ||
            'Bukti transfer diterima! Sistem sedang memverifikasi & mengaktifkan status Verified secara otomatis...'
        );
      }
    } catch {
      setPaymentError('Gagal menghubungi server saat mengirim bukti transfer.');
      setProofStatusMsg(null);
    } finally {
      setSubmittingProof(false);
    }
  };

  const handleSelectProofFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeTx) return;

    setPaymentError(null);
    setUploadingProof(true);
    setProofUploadPct(10);
    setProofStatusMsg('Mengompresi & mengunggah bukti transfer ke Firebase/Server...');

    try {
      const result = await uploadPaymentProofImage(
        file,
        user?.uid || activeTx.uid,
        activeTx.orderId,
        (pct) => setProofUploadPct(pct)
      );
      setProofPreviewUrl(result.compressed.previewDataUrl);
      setProofUploadedUrl(result.url);
      setProofStoragePath(result.storagePath);
      setProofSizeLabel(
        `${formatFileSize(result.compressed.compressedSize)}${
          result.uploadedToFirebase ? ' · Firebase Storage' : ' · Terkompresi'
        }`
      );
      setUploadingProof(false);

      // Immediately submit the uploaded proof to trigger automatic webhook/polling verification
      await submitPaymentProofToServer(
        activeTx.orderId,
        result.url,
        result.storagePath,
        proofSenderRef
      );
    } catch (err: any) {
      setUploadingProof(false);
      setProofStatusMsg(null);
      setPaymentError(err?.message || 'Gagal memproses foto bukti transfer.');
    }
  };

  const handleConfirmPayment = async (orderId: string) => {
    const token = getStoredAuthToken();
    if (!token || !orderId) return;

    // If user selected proof image and it's ready, ensure it's submitted or confirmed
    setCheckingTx(true);
    setPaymentError(null);
    try {
      if (proofUploadedUrl && activeTx?.verificationStage !== 'verifying_proof') {
        await submitPaymentProofToServer(
          orderId,
          proofUploadedUrl,
          proofStoragePath,
          proofSenderRef
        );
      }
      const res = await fetch(`/api/payment/confirm/${encodeURIComponent(orderId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (res.ok && json.ok && json.status === 'paid') {
        setActiveTx((prev) =>
          prev
            ? { ...prev, ...(json.transaction || {}), status: 'paid', verificationStage: 'verified' }
            : prev
        );
        setProofStatusMsg(null);
        playSoundEffect('levelUp');
        await refreshUser();
      } else {
        setPaymentError(json.error || 'Gagal memverifikasi pembayaran');
      }
    } catch {
      setPaymentError('Gagal menghubungi server pembayaran');
    } finally {
      setCheckingTx(false);
    }
  };

  const handleDownloadQris = () => {
    if (!qrDataUrl || !activeTx) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QRIS-ZoneStream-${activeTx.orderId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (!showUpgradeModal || !activeTx || activeTx.status === 'paid') return;
    const intervalMs = activeTx.verificationStage === 'verifying_proof' ? 1500 : 3500;
    const poll = setInterval(() => {
      checkTransactionStatus(activeTx.orderId, true);
    }, intervalMs);
    return () => clearInterval(poll);
  }, [showUpgradeModal, activeTx?.orderId, activeTx?.status, activeTx?.verificationStage]);

  const handleCreateTransaction = async () => {
    const token = getStoredAuthToken();
    if (!token) {
      setPaymentError('Silakan login terlebih dahulu.');
      return;
    }
    const pkg = packages.find((p) => p.id === selectedPlanId) || packages[1] || packages[0];
    setCreatingTx(true);
    setPaymentError(null);
    resetProofState();
    try {
      const res = await fetch('/api/payment/create-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: pkg.amount,
          planId: pkg.id,
          paymentMethod,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.transaction) {
        setPaymentError(json.error || 'Gagal membuat transaksi');
      } else {
        setActiveTx(json.transaction);
      }
    } catch {
      setPaymentError('Tidak dapat terhubung ke server pembayaran');
    } finally {
      setCreatingTx(false);
    }
  };

  const handleCopyNumber = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleSendForgotCode = async () => {
    if (!forgotIdentifier.trim()) return;
    setForgotBusy(true);
    setForgotMsg(null);
    try {
      const res = await fetch('/api/user/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'forgot-password', identifier: forgotIdentifier.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setForgotMsg({ type: 'err', text: json.error || 'Akun tidak ditemukan' });
      } else {
        setForgotMsg({ type: 'ok', text: json.message, code: json.previewCode });
      }
    } catch {
      setForgotMsg({ type: 'err', text: 'Gagal menghubungi server' });
    } finally {
      setForgotBusy(false);
    }
  };

  const handleConfirmForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotBusy(true);
    setForgotMsg(null);
    try {
      const res = await fetch('/api/user/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: forgotIdentifier.trim(),
          code: forgotCode.trim(),
          newPassword: forgotNewPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setForgotMsg({ type: 'err', text: json.error || 'Kode salah' });
      } else {
        setForgotMsg({ type: 'ok', text: 'Password berhasil direset! Silakan masuk.' });
        setTimeout(() => {
          setShowForgotModal(false);
          setForgotMsg(null);
          setForgotCode('');
          setForgotNewPassword('');
        }, 1100);
      }
    } catch {
      setForgotMsg({ type: 'err', text: 'Gagal mereset password' });
    } finally {
      setForgotBusy(false);
    }
  };

  // Dedicated Auth Screen when NOT logged in
  if (!loading && !user) {
    return (
      <Layout>
        <div className="relative min-h-[calc(100vh-88px)] flex flex-col items-center justify-center px-4 py-8">
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            <TelegramCsButton />
            <div className="lg:hidden">
              <ThemeToggle />
            </div>
          </div>

          <div className="absolute inset-x-0 top-0 h-72 overflow-hidden pointer-events-none">
            <img
              src={defaultBannerImg}
              alt=""
              className="w-full h-full object-cover opacity-30 dark:opacity-35 blur-[2px]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-[#F5F7FB]/85 to-[#F5F7FB] dark:from-[#090A0E]/40 dark:via-[#090A0E]/85 dark:to-[#090A0E]" />
          </div>

          <div className="relative z-10 w-full max-w-md">
            <div className="text-center mb-6">
              <img
                src="/assets/aistudio/1089871178568589499_751994dc.jfif"
                alt="ZoneStream Logo"
                className="w-16 h-16 mx-auto rounded-2xl object-cover ring-2 ring-[#E84A18] shadow-xl shadow-[#E84A18]/35 mb-3"
              />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Masuk ke ZoneStream
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#9CA3AF] mt-1">
                Sinkronkan history nonton harian, raih 2x EXP VIP, dan buka lencana eksklusif.
              </p>
            </div>

            {pendingClanInvite && (
              <div className="mb-4 rounded-2xl bg-[#00A884]/15 border border-[#00A884]/40 p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {pendingClanInvite.avatarUrl || pendingClanInvite.leaderPhoto ? (
                    <img
                      src={pendingClanInvite.avatarUrl || pendingClanInvite.leaderPhoto}
                      alt={pendingClanInvite.name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-xl object-cover border border-[#00A884]/50 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-slate-800 text-[#00A884] flex items-center justify-center font-extrabold text-xs shrink-0">
                      [{pendingClanInvite.tag}]
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#00A884]">
                      Undangan Klan Aktif • {pendingClanInvite.inviteCode}
                    </p>
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      [{pendingClanInvite.tag}] {pendingClanInvite.name}
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-gray-300">
                      Masuk atau daftar sekarang untuk otomatis bergabung secara real-time!
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearPendingClanInvite();
                    setPendingClanInviteState(null);
                  }}
                  aria-label="Batalkan undangan klan"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Auth Card */}
            <div className="rounded-3xl bg-white/95 dark:bg-[#13151C]/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-5 sm:p-6 shadow-2xl">
              <button
                type="button"
                disabled={googleBusy}
                onClick={handleGoogleLogin}
                className="w-full min-h-[48px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-gray-100 dark:text-[#0B0C0F] font-bold text-sm flex items-center justify-center gap-3 shadow-lg transition-all active:scale-[0.99] disabled:opacity-60"
              >
                <GoogleLogo />
                <span>
                  {googleBusy ? 'Menghubungkan ke Google...' : 'Lanjutkan dengan Google'}
                </span>
              </button>

              <div className="relative my-5 flex items-center">
                <div className="flex-1 border-t border-slate-200 dark:border-white/10" />
                <span className="px-3 text-[11px] font-medium text-slate-500 dark:text-[#7A808D]">
                  atau gunakan email &amp; password
                </span>
                <div className="flex-1 border-t border-slate-200 dark:border-white/10" />
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/5 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('login');
                    clearAuthError();
                  }}
                  className={`flex-1 min-h-[40px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    authTab === 'login'
                      ? 'bg-[#E84A18] text-white shadow-md shadow-[#E84A18]/25'
                      : 'text-slate-600 hover:text-slate-900 dark:text-[#9CA3AF] dark:hover:text-white'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Masuk Akun</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('register');
                    clearAuthError();
                  }}
                  className={`flex-1 min-h-[40px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    authTab === 'register'
                      ? 'bg-[#E84A18] text-white shadow-md shadow-[#E84A18]/25'
                      : 'text-slate-600 hover:text-slate-900 dark:text-[#9CA3AF] dark:hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Daftar Member</span>
                </button>
              </div>

              {authError && (
                <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-medium space-y-2">
                  <p>{authError}</p>
                  {authError.includes('Authorized Domains') && typeof window !== 'undefined' && (
                    <>
                      <p className="text-[11px] text-slate-600 dark:text-gray-300 leading-relaxed">
                        Selama preview atau sebelum domain Vercel ditambahkan, Anda tetap bisa masuk &amp; mengecek semua fitur akun langsung lewat form <strong>Email/Username &amp; Password</strong> di bawah atau tab <strong>Daftar Member</strong>.
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCopyNumber(window.location.hostname)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-white/10 text-white text-[11px] font-bold inline-flex items-center gap-1 hover:bg-[#E84A18] transition-colors"
                        >
                          {copiedText ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>
                            {copiedText
                              ? 'Domain Tersalin!'
                              : `Salin Domain: ${window.location.hostname}`}
                          </span>
                        </button>
                        <a
                          href="https://console.firebase.google.com/project/zonestream-61ffe/authentication/settings"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-white/5 text-slate-900 dark:text-white text-[11px] font-semibold inline-flex items-center gap-1 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Buka Firebase Console</span>
                        </a>
                      </div>
                    </>
                  )}
                </div>
              )}

              {authTab === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">
                      Email atau Username
                    </label>
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Masukkan email atau username"
                      className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#1A1D26] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#E84A18]"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(true)}
                        className="text-[11px] font-semibold text-[#E84A18] hover:underline"
                      >
                        Lupa Password?
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password akun"
                      className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#1A1D26] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#E84A18]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full min-h-[48px] rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#E84A18]/25 transition-all active:scale-[0.99]"
                  >
                    <Lock className="w-4 h-4" />
                    <span>{submitting ? 'Memverifikasi...' : 'Masuk ke Akun'}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">
                        Username
                      </label>
                      <input
                        type="text"
                        required
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="contoh: wanglin99"
                        className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#1A1D26] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#E84A18]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">
                        Nama Tampilan
                      </label>
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Nama profil kamu"
                        className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#1A1D26] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#E84A18]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">
                      Email Akun
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="emailkamu@gmail.com"
                        className="flex-1 h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#1A1D26] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#E84A18]"
                      />
                      <button
                        type="button"
                        disabled={regCodeBusy || !regEmail.includes('@')}
                        onClick={handleSendRegisterCode}
                        className="px-3.5 h-11 rounded-xl bg-slate-900 hover:bg-[#E84A18] dark:bg-[#222634] dark:hover:bg-[#E84A18] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{regCodeBusy ? 'Mengirim...' : 'Kirim Kode'}</span>
                      </button>
                    </div>
                  </div>

                  {regCodeMsg && (
                    <div
                      className={`p-3 rounded-xl text-xs font-medium ${
                        regCodeMsg.type === 'ok'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      <p>{regCodeMsg.text}</p>
                      {regCodeMsg.code && (
                        <p className="mt-1 font-mono-tabular font-bold text-slate-900 dark:text-white text-sm">
                          Kode Verifikasi 6 Digit: {regCodeMsg.code}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">
                      Kode Verifikasi Email (6 Digit)
                    </label>
                    <div className="relative">
                      <MailCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        inputMode="numeric"
                        value={regCode}
                        onChange={(e) => setRegCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="Masukkan 6 digit angka"
                        className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-50 dark:bg-[#1A1D26] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white font-mono-tabular tracking-[0.25em] placeholder:tracking-normal placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#E84A18]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1.5">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#1A1D26] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#E84A18]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full min-h-[48px] rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#E84A18]/25 transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{submitting ? 'Memverifikasi & Mendaftar...' : 'Verifikasi & Buat Akun'}</span>
                  </button>
                </form>
              )}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white dark:bg-[#13151C]/80 border border-slate-200 dark:border-white/[0.06] p-3">
                <History className="w-4 h-4 text-[#E84A18] mx-auto mb-1" />
                <p className="text-[11px] font-semibold text-slate-700 dark:text-gray-200">
                  Sinkron Riwayat
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-[#13151C]/80 border border-slate-200 dark:border-white/[0.06] p-3">
                <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400 mx-auto mb-1" />
                <p className="text-[11px] font-semibold text-slate-700 dark:text-gray-200">
                  EXP Harian
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-[#13151C]/80 border border-slate-200 dark:border-white/[0.06] p-3">
                <Sparkles className="w-4 h-4 text-sky-500 dark:text-sky-400 mx-auto mb-1" />
                <p className="text-[11px] font-semibold text-slate-700 dark:text-gray-200">
                  Lencana VIP
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Forgot Password Modal */}
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/10 p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Reset Password via Kode 6 Digit
                </h3>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {forgotMsg && (
                <div
                  className={`mb-3 p-3 rounded-xl text-xs font-medium ${
                    forgotMsg.type === 'ok'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30'
                  }`}
                >
                  <p>{forgotMsg.text}</p>
                  {forgotMsg.code && (
                    <p className="mt-1 font-mono-tabular font-bold text-slate-900 dark:text-white text-sm">
                      Kode OTP 6 Digit: {forgotMsg.code}
                    </p>
                  )}
                </div>
              )}

              <form onSubmit={handleConfirmForgotPassword} className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-600 dark:text-gray-300 mb-1">
                    Email atau Username Akun
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      placeholder="Email atau username"
                      className="flex-1 h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#1B1E26] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#E84A18]"
                    />
                    <button
                      type="button"
                      disabled={forgotBusy || !forgotIdentifier.trim()}
                      onClick={handleSendForgotCode}
                      className="px-3.5 h-11 rounded-xl bg-slate-900 dark:bg-[#222634] hover:bg-[#E84A18] text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Kirim Kode</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 dark:text-gray-300 mb-1">
                    Kode Verifikasi (6 Digit)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    inputMode="numeric"
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#1B1E26] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white font-mono-tabular tracking-[0.25em] focus:outline-none focus:border-[#E84A18]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 dark:text-gray-300 mb-1">
                    Password Baru
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#1B1E26] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#E84A18]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotBusy}
                  className="w-full h-11 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white font-bold text-sm"
                >
                  {forgotBusy ? 'Memproses...' : 'Reset Password Sekarang'}
                </button>
              </form>
            </div>
          </div>
        )}
      </Layout>
    );
  }

  const userCoins = Math.max(0, Math.floor(Number(user?.coins ?? 0)));

  return (
    <Layout>
      <div className="max-w-5xl mx-auto pb-12 sm:px-4 sm:pt-4">
        {/* Clean Profile Header Shell */}
        <div
          className={`relative sm:rounded-3xl overflow-hidden border-b sm:border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[0_18px_45px_rgba(0,0,0,0.45)] ${activeTheme.shellClass}`}
          style={
            user?.profileBgColor
              ? {
                  backgroundImage: `radial-gradient(ellipse at top, ${user.profileBgColor}34 0%, transparent 72%)`,
                }
              : undefined
          }
        >
          {/* Cover Banner */}
          <div className="relative h-44 sm:h-60 w-full overflow-hidden bg-slate-900 dark:bg-[#0D0F16]">
            <BannerMedia
              src={user?.bannerUrl}
              fallbackSrc={defaultBannerImg}
              alt="Latar Belakang Profil"
              fetchPriority="high"
              className="w-full h-full object-cover object-center contrast-[1.04] saturate-[1.06] transition-transform duration-500"
            />
            {user?.profileBgColor && (
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-30 mix-blend-soft-light pointer-events-none"
                style={{ backgroundColor: user.profileBgColor }}
              />
            )}
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/75 via-black/30 to-transparent pointer-events-none" />

            <div className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-20 flex items-center gap-2">
              {user && (
                <Link
                  to="/profile/edit"
                  aria-label="Edit Foto Profil & Latar Belakang"
                  className="min-h-[38px] px-3.5 rounded-xl bg-black/60 hover:bg-[#E84A18] border border-white/20 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md whitespace-nowrap shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Profil</span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => setActiveProfileTab('settings')}
                aria-label="Buka Pengaturan"
                className="min-h-[38px] px-3 rounded-xl bg-black/60 hover:bg-black/80 border border-white/20 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md whitespace-nowrap shrink-0"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pengaturan</span>
              </button>
            </div>
          </div>

          {/* Identity & Primary Actions */}
          <div className="relative z-10 px-4 sm:px-7 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4 min-w-0">
                <div className="shrink-0 self-start">
                  <AvatarDecoration
                    src={user?.photoUrl}
                    alt={user?.name || 'ZoneStream'}
                    decorationId={user?.activeBorder}
                    level={user?.level}
                    isFounder={isFounderUser}
                    bgColor={user?.profileBgColor}
                    size="xl"
                  >
                    {user && (
                      <Link
                        to="/profile/edit"
                        aria-label="Ubah Foto Profil"
                        className="absolute bottom-0.5 right-0.5 z-30 w-8 h-8 rounded-full bg-[#E84A18] hover:bg-[#F35B2B] text-white flex items-center justify-center border-2 border-[#F5F7FB] dark:border-[#090A0E] shadow-md transition-transform active:scale-95"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </AvatarDecoration>
                </div>

                <div className="min-w-0 sm:pb-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                      {user?.name || 'Memuat...'}
                    </h1>
                    <CountryFlagBadge countryCode={user?.countryCode} size="sm" />
                    {hasVipBadge && (
                      <VerifiedBadge
                        size="lg"
                        isFounder={isFounderUser}
                        badgeLabel={user?.activeBadge}
                      />
                    )}
                    {hasVipBadge && user?.statusEmoji && (
                      <StatusEmojiBadge statusEmoji={user.statusEmoji} size="md" />
                    )}
                  </div>

                  {user && (
                    <>
                      <div className="mt-1 flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-600 dark:text-gray-300">
                        {user.username && (
                          <span className="font-semibold text-slate-800 dark:text-gray-100">
                            @{user.username}
                          </span>
                        )}
                        <span aria-hidden="true" className="text-slate-400">·</span>
                        <span className="font-mono tabular-nums">UID {user.uid}</span>
                        <span aria-hidden="true" className="text-slate-400">·</span>
                        <span className="font-mono tabular-nums font-bold text-[#E84A18]">
                          Lv. {levelDisplay}
                        </span>
                        {(() => {
                          const rankTier = getLevelRankTier(user?.level, isFounderUser);
                          return (
                            <>
                              <span aria-hidden="true" className="text-slate-400">·</span>
                              <span className={`font-bold ${rankTier.textClass}`}>
                                {rankTier.tierName}
                              </span>
                            </>
                          );
                        })()}
                        <span aria-hidden="true" className="text-slate-400">·</span>
                        <span className="inline-flex items-center gap-1 font-semibold">
                          {hasVipBadge && <BadgeIcon className="w-3.5 h-3.5 text-amber-500" />}
                          <span>
                            {user.activeBadge ||
                              (isFounderUser ? 'Founder' : isPremium ? 'Verified VIP' : 'Member')}
                          </span>
                        </span>
                        {userClan && (
                          <>
                            <span aria-hidden="true" className="text-slate-400">·</span>
                            <Link
                              to="/leaderboard?tab=clans"
                              className="font-bold text-amber-600 dark:text-amber-400 hover:underline"
                            >
                              [{userClan.tag}] {userClan.name}
                            </Link>
                          </>
                        )}
                      </div>

                      {user.bio && (
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 mt-1.5 max-w-2xl line-clamp-2">
                          {user.bio}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Clean Action Bar */}
              {user && (
                <div className="flex flex-wrap items-center gap-2 shrink-0 sm:pb-1">
                  <Link
                    to="/chat"
                    className="min-h-[38px] px-3.5 rounded-xl bg-[#00A884] hover:bg-[#06CF9C] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap shrink-0"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Chat</span>
                  </Link>
                  <Link
                    to={`/u/${user.uid}`}
                    className="min-h-[38px] px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#191C26] dark:hover:bg-[#222634] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#E84A18]" />
                    <span>Profil Publik</span>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Major-Website Horizontal Navigation Tabs */}
          <div className="px-4 sm:px-7 border-t border-slate-200/80 dark:border-white/[0.07] bg-white/60 dark:bg-black/20">
            <nav
              aria-label="Navigasi Profil"
              className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar -mb-px"
            >
              <button
                type="button"
                onClick={() => setActiveProfileTab('overview')}
                className={`min-h-[46px] px-3 sm:px-4 border-b-2 text-xs sm:text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                  activeProfileTab === 'overview'
                    ? 'border-[#E84A18] text-[#E84A18]'
                    : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Ringkasan</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveProfileTab('wallet')}
                className={`min-h-[46px] px-3 sm:px-4 border-b-2 text-xs sm:text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                  activeProfileTab === 'wallet'
                    ? 'border-[#E84A18] text-[#E84A18]'
                    : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>Dompet &amp; VIP</span>
                {userCoins > 0 && (
                  <span className="text-[11px] font-mono tabular-nums text-amber-600 dark:text-amber-400">
                    ({userCoins.toLocaleString('id-ID')})
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveProfileTab('streak')}
                className={`min-h-[46px] px-3 sm:px-4 border-b-2 text-xs sm:text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                  activeProfileTab === 'streak'
                    ? 'border-[#E84A18] text-[#E84A18]'
                    : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Flame className="w-4 h-4" />
                <span>Misi &amp; Frame</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveProfileTab('settings')}
                className={`min-h-[46px] px-3 sm:px-4 border-b-2 text-xs sm:text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                  activeProfileTab === 'settings'
                    ? 'border-[#E84A18] text-[#E84A18]'
                    : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Pengaturan</span>
              </button>

              {isFounderUser && (
                <button
                  type="button"
                  onClick={() => setActiveProfileTab('founder')}
                  className={`min-h-[46px] px-3 sm:px-4 border-b-2 text-xs sm:text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                    activeProfileTab === 'founder'
                      ? 'border-[#E84A18] text-[#E84A18]'
                      : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Panel Founder</span>
                </button>
              )}
            </nav>
          </div>
        </div>

        {/* Tab Workspace Content */}
        <div className="mt-5 px-4 sm:px-0 space-y-5">
          {/* TAB 1: RINGKASAN (OVERVIEW) */}
          {activeProfileTab === 'overview' && (
            <>
              {/* 4-Column Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Link
                  to="/library?tab=history"
                  className={`rounded-2xl border p-4 hover:border-[#E84A18]/50 transition-colors ${activeTheme.cardClass}`}
                >
                  <div className="flex items-center justify-between text-slate-500 dark:text-[#9CA3AF]">
                    <span className="text-xs font-semibold">Ditonton</span>
                    <History className="w-4 h-4 text-[#E84A18]" />
                  </div>
                  <p className="mt-1.5 text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                    {historyCount}
                  </p>
                </Link>

                <Link
                  to="/library"
                  className={`rounded-2xl border p-4 hover:border-[#E84A18]/50 transition-colors ${activeTheme.cardClass}`}
                >
                  <div className="flex items-center justify-between text-slate-500 dark:text-[#9CA3AF]">
                    <span className="text-xs font-semibold">Watchlist</span>
                    <Bookmark className="w-4 h-4 text-[#3B82F6]" />
                  </div>
                  <p className="mt-1.5 text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                    {bookmarkCount}
                  </p>
                </Link>

                <button
                  type="button"
                  onClick={() => setActiveProfileTab('streak')}
                  className={`rounded-2xl border p-4 text-left hover:border-[#E84A18]/50 transition-colors ${activeTheme.cardClass}`}
                >
                  <div className="flex items-center justify-between text-slate-500 dark:text-[#9CA3AF]">
                    <span className="text-xs font-semibold">Watch Streak</span>
                    <Flame className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="mt-1.5 text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                    {watchStreak} Hari
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveProfileTab('wallet')}
                  className={`rounded-2xl border p-4 text-left hover:border-[#E84A18]/50 transition-colors ${activeTheme.cardClass}`}
                >
                  <div className="flex items-center justify-between text-slate-500 dark:text-[#9CA3AF]">
                    <span className="text-xs font-semibold">Keanggotaan</span>
                    <Crown className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="mt-1.5 text-xl font-extrabold text-slate-900 dark:text-white truncate">
                    {isFounderUser ? 'Founder' : isPremium ? 'VIP Aktif' : 'Member'}
                  </p>
                </button>
              </div>

              {/* Daily Check-in 24-Hour Bonus Coins & Streak Tracker */}
              {user && (
                <DailyCheckInCard
                  user={user}
                  cardClass={activeTheme.cardClass}
                  onOpenHistoryModal={() => setShowCoinHistoryModal(true)}
                />
              )}

              {/* Balanced 2-Column Overview Split */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                <div className="lg:col-span-7">
                  {user && (
                    <LevelUpCard
                      level={level}
                      exp={exp}
                      isFounder={isFounderUser}
                      isPremium={isPremium}
                      coins={user.coins ?? 0}
                      totalWatchMinutes={user.totalWatchMinutes}
                      totalCommentsCount={user.totalCommentsCount}
                      totalEpisodesWatched={user.totalEpisodesWatched || historyCount}
                      onOpenXpGuide={() => setShowXpModal(true)}
                      onOpenCoinGift={() => {
                        setGiftCoinMode('gift');
                        setShowGiftCoinModal(true);
                      }}
                    />
                  )}
                </div>

                {/* Right Column: Clean Account & Community Shortcuts */}
                <div className={`lg:col-span-5 rounded-2xl border divide-y divide-slate-100 dark:divide-white/[0.06] ${activeTheme.cardClass}`}>
                  {/* Wallet & VIP Quick Access */}
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                          Dompet Koin &amp; Bagi Prem
                        </p>
                        <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-0.5 font-mono tabular-nums">
                          {userCoins.toLocaleString('id-ID')} Koin tersedia
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveProfileTab('wallet')}
                        className="text-xs font-bold text-[#E84A18] hover:underline whitespace-nowrap shrink-0"
                      >
                        Kelola VIP
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setGiftCoinMode('gift');
                          setShowGiftCoinModal(true);
                        }}
                        className="min-h-[38px] px-3 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        <Gift className="w-3.5 h-3.5" />
                        <span>Bagi Prem</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCoinHistoryModal(true)}
                        className="min-h-[38px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-800 dark:text-gray-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        <History className="w-3.5 h-3.5 text-amber-500" />
                        <span>Riwayat Koin</span>
                      </button>
                    </div>
                  </div>

                  {/* Klan & Leaderboard Row */}
                  <Link
                    to="/leaderboard"
                    className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                        <Trophy className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {userClan ? `[${userClan.tag}] ${userClan.name}` : 'Leaderboard & Klan Wibu'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] truncate">
                          Peringkat Top Charisma &amp; komunitas klan
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </Link>

                  {/* Settings Quick Row */}
                  <button
                    type="button"
                    onClick={() => setActiveProfileTab('settings')}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-gray-300 flex items-center justify-center shrink-0">
                        <Settings className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          Pengaturan &amp; Preferensi
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] truncate">
                          Tema {isDark ? 'Gelap' : 'Terang'} · Bahasa {currentLanguageOption.nativeLabel} · Suara
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: DOMPET KOIN & LANGGANAN VIP */}
          {activeProfileTab === 'wallet' && (
            <>
              {user && (
                <CoinWalletCard
                  user={user}
                  cardClass={activeTheme.cardClass}
                  onOpenGiftModal={(mode) => {
                    setGiftCoinMode(mode);
                    setShowGiftCoinModal(true);
                  }}
                  onOpenHistoryModal={() => setShowCoinHistoryModal(true)}
                />
              )}

              {/* Unified Subscription & VIP Membership Card */}
              <div className={`rounded-2xl border p-5 shadow-sm dark:shadow-none ${activeTheme.cardClass}`}>
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E84A18] to-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
                      {isPremium || isFounderUser ? (
                        <Crown className="w-5 h-5" />
                      ) : (
                        <Diamond className="w-5 h-5 fill-current" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                        {isFounderUser
                          ? 'Founder Lifetime VIP'
                          : isPremium
                          ? 'Keanggotaan Premium VIP Aktif'
                          : 'Upgrade ke ZoneStream Premium VIP'}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-0.5">
                        Lv. {levelDisplay} ({user?.exp || 0} EXP) ·{' '}
                        {user?.role === 'founder'
                          ? 'Aktif Seumur Hidup'
                          : isPremium && user?.premiumExpiryDate
                          ? `Berlaku hingga ${new Date(user.premiumExpiryDate).toLocaleDateString(
                              'id-ID',
                              {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              }
                            )}`
                          : 'Bebas iklan 10s, 2× EXP, Lencana Verified & Tema Discord'}
                      </p>
                    </div>
                  </div>

                  {!isPremium && !isFounderUser && (
                    <button
                      type="button"
                      onClick={() => setShowUpgradeModal(true)}
                      className="min-h-[42px] px-4 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap shrink-0"
                    >
                      <Star className="w-4 h-4 fill-current" />
                      <span>Beli Premium VIP</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4">
                  <div className="rounded-xl bg-slate-50 dark:bg-[#1A1D26] border border-slate-200 dark:border-white/5 p-3 flex items-center gap-2.5">
                    <BadgeCheck className="w-4 h-4 text-sky-500 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-gray-100">
                      Lencana &amp; Emoji
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-[#1A1D26] border border-slate-200 dark:border-white/5 p-3 flex items-center gap-2.5">
                    <ShieldBan className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-gray-100">
                      Bebas Iklan 10s
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-[#1A1D26] border border-slate-200 dark:border-white/5 p-3 flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-gray-100">
                      2× EXP Nonton
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-[#1A1D26] border border-slate-200 dark:border-white/5 p-3 flex items-center gap-2.5">
                    <Smile className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-gray-100">
                      Tema &amp; Stiker VIP
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {(isPremium || isFounderUser) && (
                    <Link
                      to="/profile/edit"
                      className="min-h-[42px] px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs inline-flex items-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Kustomisasi Profil &amp; Lencana VIP</span>
                    </Link>
                  )}

                  <a
                    href="https://t.me/ZhuuVerzon"
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[42px] px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Upgrade via Bot Telegram</span>
                  </a>

                  <TelegramCsButton />

                  {isFounderUser && (
                    <button
                      type="button"
                      onClick={toggleFounderAdPreview}
                      className={`min-h-[42px] px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 border transition-colors whitespace-nowrap ${
                        isPremium
                          ? 'bg-slate-50 hover:bg-slate-100 dark:bg-[#171922] dark:hover:bg-[#1E212D] text-slate-700 dark:text-gray-300 border-slate-200 dark:border-white/10'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {isPremium ? <Eye className="w-3.5 h-3.5 text-[#E84A18]" /> : <Crown className="w-3.5 h-3.5" />}
                      <span>
                        {isPremium ? 'Simulasi User Gratis' : 'Kembalikan Mode Founder'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <VipBenefitsLog
                user={user}
                isPremium={isPremium}
                cardClass={activeTheme.cardClass}
                onOpenUpgrade={() => setShowUpgradeModal(true)}
              />
            </>
          )}

          {/* TAB 3: MISI & FRAME HARIAN */}
          {activeProfileTab === 'streak' && (
            <div className="space-y-4">
              {user && (
                <DailyCheckInCard
                  user={user}
                  cardClass={activeTheme.cardClass}
                  onOpenHistoryModal={() => setShowCoinHistoryModal(true)}
                />
              )}

              <div className={`rounded-2xl border p-4 sm:p-5 shadow-sm dark:shadow-none ${activeTheme.cardClass}`}>
              {/* Header Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 text-white flex items-center justify-center shadow-md shadow-orange-500/25 shrink-0">
                    <Flame className="w-5 h-5 fill-current" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                      Daily Watch Streak &amp; Misi Harian
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                      <span className="font-mono tabular-nums font-bold text-orange-500 dark:text-amber-400">
                        {watchStreak} Hari Beruntun
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Rekor Terbaik: {longestStreak} Hari
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Hari Ini: {dailyEpisodesToday} Ep
                      </span>
                    </div>
                  </div>
                </div>

                {watchedToday ? (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1.5 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Streak Terjaga Hari Ini</span>
                  </span>
                ) : (
                  <Link
                    to="/catalog"
                    className="min-h-[38px] px-3.5 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors shrink-0 whitespace-nowrap"
                  >
                    <span>Tonton 1 Ep Sekarang</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              {/* 7-Day Rolling Consistency Calendar */}
              <div className="py-4 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="flex items-center justify-between mb-2.5 text-xs text-slate-500 dark:text-[#9CA3AF]">
                  <span>Kalender Konsistensi 7 Hari Terakhir</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {last7Days.filter((d) => watchedDateSet.has(d.dateStr)).length}/7 Hari Aktif
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {last7Days.map((day) => {
                    const isDone = watchedDateSet.has(day.dateStr);
                    return (
                      <div
                        key={day.dateStr}
                        className={`rounded-xl py-2.5 px-1 flex flex-col items-center justify-center gap-1 border text-center transition-colors ${
                          isDone
                            ? 'bg-gradient-to-b from-orange-500/15 to-rose-500/10 border-orange-500/40 text-orange-600 dark:text-amber-300'
                            : day.isToday
                            ? 'bg-slate-100 dark:bg-white/[0.04] border-dashed border-[#E84A18]/60 text-slate-700 dark:text-gray-200'
                            : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/[0.05] text-slate-400 dark:text-gray-500'
                        }`}
                      >
                        <span className="text-[10px] font-semibold leading-none">{day.shortDay}</span>
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            isDone
                              ? 'bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-sm'
                              : day.isToday
                              ? 'border border-[#E84A18]/60 text-[#E84A18]'
                              : 'bg-slate-200/70 dark:bg-white/[0.05]'
                          }`}
                        >
                          {isDone ? (
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          ) : (
                            <span className="text-[10px] font-mono tabular-nums font-bold">{day.dayNum}</span>
                          )}
                        </div>
                        <span className="text-[9px] font-mono tabular-nums leading-none opacity-80">
                          {day.isToday ? 'Hari Ini' : day.dayNum}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Frame Rewards Gallery */}
              <div className="pt-4">
                <div className="mb-3">
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                    Hadiah Frame Profil Animasi Eksklusif
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                    Tonton anime setiap hari untuk membuka &amp; memasang bingkai avatar animasi.
                  </p>
                </div>

                {streakFrameNotice && (
                  <div
                    className={`mb-3 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border ${
                      streakFrameNotice.type === 'ok'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                    }`}
                  >
                    <span>{streakFrameNotice.text}</span>
                    <button
                      type="button"
                      onClick={() => setStreakFrameNotice(null)}
                      className="opacity-70 hover:opacity-100"
                      aria-label="Tutup notifikasi"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STREAK_FRAME_REWARDS.map((frame) => {
                    const unlocked = Boolean(
                      isFounderUser ||
                        unlockedFramesSet.has(frame.id) ||
                        bestStreakForRewards >= frame.minStreak
                    );
                    const equipped = normalizeDecorationId(user?.activeBorder) === frame.id;
                    const progressNum = isFounderUser
                      ? frame.minStreak
                      : Math.min(bestStreakForRewards, frame.minStreak);
                    const pct = Math.round((progressNum / frame.minStreak) * 100);
                    const busy = equippingFrameId === frame.id;

                    return (
                      <div
                        key={frame.id}
                        className={`rounded-xl border p-3 flex items-center gap-3 transition-colors ${
                          equipped
                            ? 'bg-[#E84A18]/[0.08] border-[#E84A18]/60'
                            : unlocked
                            ? 'bg-slate-50 dark:bg-[#171A23] border-slate-200 dark:border-white/10'
                            : 'bg-slate-50/60 dark:bg-[#12141B] border-slate-200/70 dark:border-white/[0.05]'
                        }`}
                      >
                        <div className="p-1 shrink-0">
                          <AvatarDecoration
                            src={user?.photoUrl}
                            alt={frame.name}
                            decorationId={frame.id}
                            size="md"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                              {frame.name}
                            </p>
                            <span className="text-[10px] font-mono tabular-nums font-bold text-orange-500 dark:text-amber-400 shrink-0">
                              {frame.tierLabel}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate mt-0.5">
                            {frame.subtitle}
                          </p>

                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: frame.accentColor,
                                }}
                              />
                            </div>
                            <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-gray-400 shrink-0">
                              {progressNum}/{frame.minStreak}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {equipped ? (
                            <span className="px-2.5 py-1.5 rounded-lg bg-[#E84A18]/20 text-[#E84A18] dark:text-[#FF8A65] text-[11px] font-extrabold inline-flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              <span>Aktif</span>
                            </span>
                          ) : unlocked ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleEquipStreakFrame(frame.id, frame.name)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 text-[11px] font-extrabold transition-opacity disabled:opacity-50"
                            >
                              {busy ? '...' : 'Pasang'}
                            </button>
                          ) : (
                            <span
                              className="px-2.5 py-1.5 rounded-lg bg-slate-200/80 dark:bg-white/[0.06] text-slate-500 dark:text-gray-400 text-[10px] font-bold inline-flex items-center gap-1"
                              title={`Capai ${frame.minStreak} hari beruntun untuk membuka`}
                            >
                              <Lock className="w-3 h-3" />
                              <span>{frame.minStreak - progressNum}h lagi</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Level-Scaled Rank Borders Gallery */}
              {(() => {
                const userLv = Math.max(1, Number(user?.level || 1));
                const currentRankTier = getLevelRankTier(user?.level, isFounderUser);
                const normalizedBorder = normalizeDecorationId(user?.activeBorder);
                const isAutoEquipped = normalizedBorder === 'level-auto';
                const autoBusy = equippingFrameId === AUTO_LEVEL_BORDER_PRESET.id;

                return (
                  <div className="pt-5 mt-5 border-t border-slate-200 dark:border-white/[0.06]">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div>
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                          Progres Bingkai Level (Bronze → Silver → Gold → Platinum)
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                          Tingkatkan level akunmu untuk membuka bingkai SVG animasi berjenjang — aktif di profil, komentar &amp; chat.
                        </p>
                      </div>
                      <span className={`text-xs font-extrabold whitespace-nowrap ${currentRankTier.textClass}`}>
                        Rank Saat Ini: {currentRankTier.tierName} ({isFounderUser ? 'Lv. ∞' : `Lv. ${userLv}`})
                      </span>
                    </div>

                    {/* Auto Level Scale Option */}
                    <div
                      className={`mb-3 rounded-xl border p-3 flex items-center justify-between gap-3 transition-colors ${
                        isAutoEquipped
                          ? 'bg-[#E84A18]/[0.08] border-[#E84A18]/60'
                          : 'bg-slate-50 dark:bg-[#171A23] border-slate-200 dark:border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-1 shrink-0">
                          <AvatarDecoration
                            src={user?.photoUrl}
                            alt={AUTO_LEVEL_BORDER_PRESET.name}
                            decorationId="level-auto"
                            level={user?.level}
                            isFounder={isFounderUser}
                            size="md"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            {AUTO_LEVEL_BORDER_PRESET.name} ({currentRankTier.tierName})
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                            {AUTO_LEVEL_BORDER_PRESET.subtitle}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {isAutoEquipped ? (
                          <span className="px-2.5 py-1.5 rounded-lg bg-[#E84A18]/20 text-[#E84A18] dark:text-[#FF8A65] text-[11px] font-extrabold inline-flex items-center gap-1 whitespace-nowrap">
                            <Check className="w-3 h-3" />
                            <span>Aktif</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={autoBusy}
                            onClick={() =>
                              void handleEquipStreakFrame(
                                AUTO_LEVEL_BORDER_PRESET.id,
                                AUTO_LEVEL_BORDER_PRESET.name
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 text-[11px] font-extrabold transition-opacity disabled:opacity-50 whitespace-nowrap"
                          >
                            {autoBusy ? '...' : 'Aktifkan Auto'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {LEVEL_RANK_BORDERS.map((tier) => {
                        const unlocked = Boolean(isFounderUser || userLv >= tier.minLevel);
                        const equipped = normalizedBorder === tier.id;
                        const progressNum = isFounderUser
                          ? tier.minLevel
                          : Math.min(userLv, tier.minLevel);
                        const pct = Math.round((progressNum / Math.max(1, tier.minLevel)) * 100);
                        const busy = equippingFrameId === tier.id;

                        return (
                          <div
                            key={tier.id}
                            className={`rounded-xl border p-3 flex items-center gap-3 transition-colors ${
                              equipped
                                ? 'bg-[#E84A18]/[0.08] border-[#E84A18]/60'
                                : unlocked
                                ? 'bg-slate-50 dark:bg-[#171A23] border-slate-200 dark:border-white/10'
                                : 'bg-slate-50/60 dark:bg-[#12141B] border-slate-200/70 dark:border-white/[0.05]'
                            }`}
                          >
                            <div className="p-1 shrink-0">
                              <AvatarDecoration
                                src={user?.photoUrl}
                                alt={tier.name}
                                decorationId={tier.id}
                                size="md"
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                                  {tier.name}
                                </p>
                                <span
                                  className={`text-[10px] font-mono tabular-nums font-bold shrink-0 ${tier.textClass}`}
                                >
                                  {tier.levelRangeLabel}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate mt-0.5">
                                {tier.subtitle}
                              </p>

                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                      width: `${pct}%`,
                                      backgroundColor: tier.accentColor,
                                    }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-gray-400 shrink-0">
                                  Lv.{progressNum}/{tier.minLevel}
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0">
                              {equipped ? (
                                <span className="px-2.5 py-1.5 rounded-lg bg-[#E84A18]/20 text-[#E84A18] dark:text-[#FF8A65] text-[11px] font-extrabold inline-flex items-center gap-1 whitespace-nowrap">
                                  <Check className="w-3 h-3" />
                                  <span>Aktif</span>
                                </span>
                              ) : unlocked ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleEquipStreakFrame(tier.id, tier.name)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 text-[11px] font-extrabold transition-opacity disabled:opacity-50 whitespace-nowrap"
                                >
                                  {busy ? '...' : 'Pasang'}
                                </button>
                              ) : (
                                <span
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-200/80 dark:bg-white/[0.06] text-slate-500 dark:text-gray-400 text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                                  title={`Capai Level ${tier.minLevel} untuk membuka`}
                                >
                                  <Lock className="w-3 h-3" />
                                  <span>Lv.{tier.minLevel}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
            </div>
          )}

          {/* TAB 4: PENGATURAN (MAJOR PLATFORM SETTINGS CENTER) */}
          {activeProfileTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Settings Sidebar Menu */}
              <aside
                className={`lg:col-span-4 rounded-2xl border p-2 shadow-sm dark:shadow-none ${activeTheme.cardClass}`}
              >
                <p className="px-3 pt-2 pb-2 text-xs font-extrabold text-slate-500 dark:text-gray-400">
                  Kategori Pengaturan
                </p>
                <div className="grid grid-cols-3 lg:grid-cols-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setSettingsSection('appearance')}
                    className={`min-h-[42px] px-3 rounded-xl text-xs font-bold flex items-center justify-center lg:justify-start gap-2.5 transition-colors whitespace-nowrap ${
                      settingsSection === 'appearance'
                        ? 'bg-[#E84A18] text-white shadow-sm'
                        : 'text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <Palette className="w-4 h-4 shrink-0" />
                    <span className="truncate">Tampilan &amp; Bahasa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettingsSection('sound')}
                    className={`min-h-[42px] px-3 rounded-xl text-xs font-bold flex items-center justify-center lg:justify-start gap-2.5 transition-colors whitespace-nowrap ${
                      settingsSection === 'sound'
                        ? 'bg-[#E84A18] text-white shadow-sm'
                        : 'text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <Volume2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">Suara &amp; Efek</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettingsSection('account')}
                    className={`min-h-[42px] px-3 rounded-xl text-xs font-bold flex items-center justify-center lg:justify-start gap-2.5 transition-colors whitespace-nowrap ${
                      settingsSection === 'account'
                        ? 'bg-[#E84A18] text-white shadow-sm'
                        : 'text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="truncate">Akun &amp; Sesi</span>
                  </button>
                </div>
              </aside>

              {/* Settings Content Pane */}
              <div className="lg:col-span-8 space-y-4">
                {settingsSection === 'appearance' && (
                  <>
                    {/* Theme Mode */}
                    <div className={`rounded-2xl border p-5 shadow-sm dark:shadow-none ${activeTheme.cardClass}`}>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                            Tema Antarmuka
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
                            Pilih tampilan Terang atau Gelap yang nyaman untuk mata Anda
                          </p>
                        </div>
                        <ThemeToggle compact />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setTheme('light')}
                          className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-colors ${
                            !isDark
                              ? 'border-[#E84A18] bg-[#E84A18]/10 text-slate-900 dark:text-white'
                              : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1A1D26] text-slate-600 dark:text-gray-300'
                          }`}
                        >
                          <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                          <div>
                            <p className="text-xs font-extrabold">Mode Terang</p>
                            <p className="text-[11px] opacity-75">Bersih &amp; cerah</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setTheme('dark')}
                          className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-colors ${
                            isDark
                              ? 'border-[#E84A18] bg-[#E84A18]/15 text-slate-900 dark:text-white'
                              : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1A1D26] text-slate-600 dark:text-gray-300'
                          }`}
                        >
                          <Moon className="w-4 h-4 text-[#E84A18] shrink-0" />
                          <div>
                            <p className="text-xs font-extrabold">Mode Gelap</p>
                            <p className="text-[11px] opacity-75">Nyaman di malam hari</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Language & Subtitles */}
                    <div className={`rounded-2xl border p-5 shadow-sm dark:shadow-none ${activeTheme.cardClass}`}>
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="w-8 h-8 rounded-xl bg-[#E84A18]/15 text-[#E84A18] flex items-center justify-center shrink-0">
                          <Globe className="w-4 h-4" />
                        </span>
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                            Bahasa Aplikasi &amp; Subtitle (4 Bahasa)
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
                            Pilih bahasa antarmuka dan subtitle otomatis saat menonton anime
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {APP_LANGUAGES.map((opt) => {
                          const active = lang === opt.code;
                          return (
                            <button
                              key={opt.code}
                              type="button"
                              onClick={() => changeLanguage(opt.code)}
                              className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                                active
                                  ? 'border-[#E84A18] bg-[#E84A18]/15 text-slate-900 dark:text-white shadow-sm'
                                  : 'border-slate-200 dark:border-white/10 bg-slate-50 hover:bg-slate-100 dark:bg-[#1A1D26] dark:hover:bg-[#222634] text-slate-700 dark:text-gray-300'
                              }`}
                            >
                              <CountryFlagBadge countryCode={opt.countryCode} size="sm" />
                              <div className="min-w-0">
                                <p className="text-xs font-extrabold truncate">{opt.nativeLabel}</p>
                                <p className="text-[10px] text-[#E84A18] font-bold truncate">{opt.subLabel}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* App-Wide Photo / Video Background Customizer */}
                    <div className={`rounded-2xl border p-5 shadow-sm dark:shadow-none ${activeTheme.cardClass}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-9 h-9 rounded-xl bg-[#E84A18]/15 text-[#E84A18] flex items-center justify-center shrink-0">
                            <Film className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                              Latar Belakang Aplikasi (Foto &amp; Video)
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-[#9CA3AF] truncate">
                              {bgConfig.mode === 'none'
                                ? 'Mode polos (tanpa gambar/video latar)'
                                : bgConfig.mode === 'custom-upload'
                                ? `Upload sendiri: ${bgConfig.customUploadName || 'Media Kustom'}`
                                : bgConfig.mode === 'custom-url'
                                ? `Link kustom (${bgConfig.customUrlKind === 'video' ? 'Video' : 'Foto'})`
                                : `${activeBgPreset?.label || 'Preset'} · Opasitas ${bgConfig.opacity}%`}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={openCustomizer}
                          className="min-h-[40px] px-4 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap shrink-0"
                        >
                          <Film className="w-3.5 h-3.5" />
                          <span>Ganti Foto / Video</span>
                        </button>
                      </div>
                    </div>

                    {/* Standalone App (PWA) Card */}
                    <div className={`rounded-2xl border p-5 shadow-sm dark:shadow-none ${activeTheme.cardClass}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-9 h-9 rounded-xl bg-[#E84A18]/15 text-[#E84A18] flex items-center justify-center shrink-0">
                            <Smartphone className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                              Aplikasi Standalone (Mode Layar Penuh)
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
                              {isPwaInstalled
                                ? 'Aplikasi sudah berjalan dalam mode Standalone tanpa bar browser.'
                                : 'Pasang ZoneStream ke perangkat agar terbuka seperti aplikasi asli tanpa bar browser.'}
                            </p>
                          </div>
                        </div>
                        {isPwaInstalled ? (
                          <span className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mode Aplikasi Aktif</span>
                          </span>
                        ) : (
                          <PWAInstallButton variant="pill" />
                        )}
                      </div>
                    </div>

                    {/* Customize Profile Link */}
                    {user && (
                      <Link
                        to="/profile/edit"
                        className={`rounded-2xl border p-4 flex items-center justify-between gap-3 hover:border-[#E84A18] transition-colors ${activeTheme.cardClass}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-9 h-9 rounded-xl bg-[#E84A18]/15 text-[#E84A18] flex items-center justify-center shrink-0">
                            <Pencil className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                              Edit Profil, Banner &amp; Tema Kartu
                            </p>
                            <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
                              Ubah foto profil, sampul banner, bingkai avatar, bio, dan negara
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                      </Link>
                    )}
                  </>
                )}

                {settingsSection === 'sound' && (
                  <div className={`rounded-2xl border p-5 shadow-sm dark:shadow-none ${activeTheme.cardClass}`}>
                    <SoundSettingsPanel embedded />
                  </div>
                )}

                {settingsSection === 'account' && user && (
                  <>
                    {/* Account Details */}
                    <div className={`rounded-2xl border p-5 shadow-sm dark:shadow-none ${activeTheme.cardClass}`}>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">
                        Informasi Akun
                      </h3>
                      <div className="divide-y divide-slate-100 dark:divide-white/[0.06] text-xs">
                        <div className="py-2.5 flex items-center justify-between gap-3">
                          <span className="text-slate-500 dark:text-gray-400">Nama Tampilan</span>
                          <span className="font-bold text-slate-900 dark:text-white">{user.name}</span>
                        </div>
                        <div className="py-2.5 flex items-center justify-between gap-3">
                          <span className="text-slate-500 dark:text-gray-400">Username</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            @{user.username}
                          </span>
                        </div>
                        <div className="py-2.5 flex items-center justify-between gap-3">
                          <span className="text-slate-500 dark:text-gray-400">User ID (UID)</span>
                          <button
                            type="button"
                            onClick={() => handleCopyNumber(user.uid)}
                            className="font-mono tabular-nums font-bold text-slate-900 dark:text-white inline-flex items-center gap-1.5 hover:text-[#E84A18]"
                          >
                            <span>{user.uid}</span>
                            {copiedText ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                        </div>
                        <div className="py-2.5 flex items-center justify-between gap-3">
                          <span className="text-slate-500 dark:text-gray-400">Email</span>
                          <span className="font-medium text-slate-800 dark:text-gray-200 truncate">
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Audit, Help & Session */}
                    <div className={`rounded-2xl border p-5 shadow-sm dark:shadow-none space-y-3 ${activeTheme.cardClass}`}>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        Riwayat, Bantuan &amp; Sesi
                      </h3>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setShowCoinHistoryModal(true)}
                          className="min-h-[40px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-slate-800 dark:text-white text-xs font-bold inline-flex items-center gap-2 transition-colors"
                        >
                          <Coins className="w-4 h-4 text-amber-500" />
                          <span>Buka Coin Transaction History</span>
                        </button>

                        <TelegramCsButton />
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            Keluar dari Sesi Perangkat Ini
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                            Riwayat tontonan &amp; progres tetap aman tersimpan di akun Anda
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={logout}
                          className="min-h-[40px] px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Keluar Akun</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: PANEL FOUNDER (FOUNDER ONLY) */}
          {activeProfileTab === 'founder' && isFounderUser && (
            <FounderUserMonitorPanel cardClass={activeTheme.cardClass} />
          )}
        </div>
      </div>

      {/* Cara Dapatkan XP Modal */}
      {showXpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/10 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Cara Naik Level &amp; Dapatkan XP
              </h3>
              <button
                type="button"
                onClick={() => setShowXpModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-3">
              Progress bar level meningkat otomatis dari <strong>durasi menonton anime</strong> dan{' '}
              <strong>jumlah komentar</strong> yang kamu berikan! Member <strong>VIP / Founder</strong> otomatis mendapat{' '}
              <strong className="text-amber-500">2× EXP Lipat Ganda</strong>.
            </p>
            <ul className="space-y-2.5 text-xs text-slate-700 dark:text-gray-300">
              <li className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="font-semibold">Durasi Menonton Anime (Per Menit)</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono-tabular">
                  +15 <span className="text-amber-500">(VIP +30)</span>
                </span>
              </li>
              <li className="flex items-center justify-between p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
                <span className="font-semibold">Beri Komentar / Balasan</span>
                <span className="font-bold text-sky-600 dark:text-sky-400 font-mono-tabular">
                  +25 <span className="text-amber-500">(VIP +50)</span>
                </span>
              </li>
              <li className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-[#1B1E26]">
                <span>Bonus Nonton Harian Pertama</span>
                <span className="font-bold text-[#E84A18] font-mono-tabular">
                  +50 <span className="text-amber-500">(VIP +100)</span>
                </span>
              </li>
              <li className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-[#1B1E26]">
                <span>Bonus Streak Nonton Beruntun</span>
                <span className="font-bold text-amber-500 font-mono-tabular">
                  +75 <span className="text-amber-400">(VIP +150)</span>
                </span>
              </li>
              <li className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="font-semibold">Hadiah Koin Setiap Naik Level</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 font-mono-tabular">
                  +350~2.000 Koin
                </span>
              </li>
              <li className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-[#1B1E26]">
                <span>Nonton Episode Baru</span>
                <span className="font-bold text-[#3B82F6] font-mono-tabular">
                  +30 <span className="text-amber-500">(VIP +60)</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Coin Gift / Bagi Prem Modal */}
      <GiftPremiumModal
        open={showGiftCoinModal}
        onClose={() => setShowGiftCoinModal(false)}
        initialMode={giftCoinMode}
        onSuccess={() => {
          void refreshUser();
        }}
      />

      {/* Coin Transaction History Modal */}
      {user && (
        <CoinTransactionHistoryModal
          open={showCoinHistoryModal}
          onClose={() => setShowCoinHistoryModal(false)}
          user={user}
          onOpenGiftModal={(mode) => {
            setGiftCoinMode(mode);
            setShowGiftCoinModal(true);
          }}
        />
      )}

      {/* Upgrade Premium Checkout Modal (1-Web In-App QRIS & Virtual Account) */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 pt-16 sm:pt-6 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/10 p-5 sm:p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#E84A18] text-white flex items-center justify-center shadow-md shadow-[#E84A18]/30">
                  <QrCode className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                    ZoneStream VIP · QRIS &amp; VA Instan
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                    Pembayaran Langsung di Dalam Web · Aktivasi Otomatis
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUpgradeModal(false);
                  setActiveTx(null);
                  setPaymentError(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {paymentError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-medium">
                {paymentError}
              </div>
            )}

            {!activeTx ? (
              <>
                <p className="text-xs font-bold text-slate-700 dark:text-gray-200 mb-2">
                  1. Pilih Paket ZoneStream VIP (Bonus EXP + 2x EXP Nonton):
                </p>
                <div className="space-y-2.5 mb-4">
                  {packages.map((pkg) => {
                    const selected = selectedPlanId === pkg.id;
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setSelectedPlanId(pkg.id)}
                        className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-start justify-between gap-3 ${
                          selected
                            ? 'bg-[#E84A18]/10 border-[#E84A18] shadow-sm'
                            : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#1B1E26] dark:hover:bg-[#222632] border-slate-200 dark:border-white/5'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                              {pkg.name}
                            </span>
                            {pkg.popular && (
                              <span className="px-2 py-0.5 rounded-md bg-[#E84A18] text-white text-[10px] font-bold">
                                Terlaris
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-300 text-[10px] font-bold font-mono-tabular">
                              +{pkg.bonusExp} EXP
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] mt-1 leading-snug">
                            {pkg.tagline}
                          </p>
                        </div>
                        <span className="text-sm sm:text-base font-extrabold text-[#E84A18] font-mono-tabular whitespace-nowrap shrink-0">
                          {formatIdr(pkg.amount)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs font-bold text-slate-700 dark:text-gray-200 mb-2">
                  2. Pilih Metode Pembayaran (Langsung di Web Ini):
                </p>
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-semibold text-left transition-colors ${
                        m.id === 'qris' ? 'col-span-2 ' : ''
                      }${
                        paymentMethod === m.id
                          ? 'bg-[#E84A18] border-[#E84A18] text-white shadow-sm'
                          : 'bg-slate-50 dark:bg-[#1B1E26] border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={creatingTx}
                  onClick={handleCreateTransaction}
                  className="w-full min-h-[48px] rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#E84A18]/25 transition-all"
                >
                  <QrCode className="w-4 h-4" />
                  <span>
                    {creatingTx
                      ? 'Menyiapkan QRIS & Kode Bayar...'
                      : 'Tampilkan QRIS / Kode Pembayaran Sekarang'}
                  </span>
                </button>
              </>
            ) : activeTx.status === 'paid' ? (
              <div className="py-4 text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h4 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Pembayaran Berhasil Diverifikasi!
                </h4>
                <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed">
                  Paket <strong>{activeTx.planName}</strong> telah aktif otomatis. Lencana Verified, dekorasi avatar 3D, bebas iklan, dan <strong>2x EXP</strong> sudah terpasang di akunmu!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowUpgradeModal(false);
                    setActiveTx(null);
                  }}
                  className="w-full min-h-[46px] rounded-xl bg-[#E84A18] text-white font-bold text-sm"
                >
                  Selesai
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-50 dark:bg-[#1B1E26] border border-slate-200 dark:border-white/10 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-gray-400">Order ID</span>
                    <button
                      type="button"
                      onClick={() => handleCopyNumber(activeTx.orderId)}
                      className="font-mono-tabular font-bold text-slate-900 dark:text-white inline-flex items-center gap-1 hover:text-[#E84A18]"
                    >
                      <span>{activeTx.orderId}</span>
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-gray-400">Paket Dipilih</span>
                    <span className="font-bold text-slate-900 dark:text-white">{activeTx.planName}</span>
                  </div>
                  {activeTx.fee > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-gray-400">Kode Unik Verifikasi</span>
                      <span className="font-mono-tabular font-bold text-amber-500">+{activeTx.fee}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200 dark:border-white/10">
                    <span className="font-semibold text-slate-700 dark:text-gray-300">Total Bayar</span>
                    <span className="text-base font-extrabold text-[#E84A18] font-mono-tabular">
                      {formatIdr(activeTx.totalPayment || activeTx.amount)}
                    </span>
                  </div>
                </div>

                {activeTx.paymentMethod === 'qris' ? (
                  <div className="flex flex-col items-center p-4 rounded-2xl bg-white border-2 border-[#E84A18]/40 shadow-inner">
                    <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                      <span className="text-xs font-black tracking-wider text-slate-900">
                        QRIS · STANDAR PEMBAYARAN NASIONAL
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 text-[10px] font-bold">
                        GPN / INSTAN
                      </span>
                    </div>
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="QRIS Pembayaran ZoneStream"
                        className="w-56 h-56 sm:w-64 sm:h-64 object-contain"
                      />
                    ) : (
                      <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-500">
                        Membuat QRIS...
                      </div>
                    )}
                    <p className="text-xs font-extrabold text-slate-800 mt-1">
                      ZONESTREAM VIP OFFICIAL
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5 text-center">
                      Scan langsung dari DANA, GoPay, OVO, ShopeePay, BCA, BRI, Mandiri, BNI, SeaBank.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      {qrDataUrl && (
                        <button
                          type="button"
                          onClick={handleDownloadQris}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold inline-flex items-center gap-1.5"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Simpan Gambar QRIS</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopyNumber(String(activeTx.totalPayment || activeTx.amount))}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold inline-flex items-center gap-1"
                      >
                        {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedText ? 'Tersalin!' : 'Salin Nominal'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-100 dark:bg-[#1B1E26] border border-slate-200 dark:border-white/10 p-4 space-y-2.5">
                    <p className="text-xs font-bold text-slate-700 dark:text-gray-200">
                      Nomor Pembayaran ({activeTx.paymentMethod.replace(/_/g, ' ').toUpperCase()}):
                    </p>
                    <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white dark:bg-[#11131A] border border-slate-200 dark:border-white/10">
                      <span className="font-mono-tabular text-base sm:text-lg font-extrabold text-slate-900 dark:text-white break-all">
                        {activeTx.paymentNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyNumber(activeTx.paymentNumber)}
                        className="px-3.5 py-2 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
                      >
                        {copiedText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedText ? 'Tersalin' : 'Salin Nomor'}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">
                      Selesaikan pembayaran sesuai nominal tepat di atas, lalu klik tombol verifikasi di bawah.
                    </p>
                  </div>
                )}

                {/* Upload Bukti Transfer & Auto-Update Verification Section */}
                <div className="rounded-2xl bg-slate-50 dark:bg-[#1B1E26] border border-slate-200 dark:border-white/10 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <FileCheck2 className="w-4 h-4 text-[#E84A18]" />
                        <span>Upload Bukti Transfer (Verifikasi Otomatis Instan)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5 leading-snug">
                        Unggah foto/screenshot bukti pembayaran. Sistem akan memverifikasi mutasi secara otomatis ke database dan mengubah status profilmu menjadi <strong>Verified VIP</strong> tanpa menunggu admin.
                      </p>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={proofSenderRef}
                    onChange={(e) => setProofSenderRef(e.target.value)}
                    placeholder="Nama pengirim / e-Wallet / catatan referensi (opsional)"
                    className="w-full h-9 px-3 rounded-xl bg-white dark:bg-[#12141C] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#E84A18]"
                  />

                  <label className="w-full cursor-pointer block">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleSelectProofFile}
                      disabled={uploadingProof || submittingProof}
                      className="hidden"
                    />
                    <div
                      className={`w-full rounded-xl border-2 border-dashed p-3 transition-all flex items-center justify-between gap-3 ${
                        proofPreviewUrl
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-slate-300 dark:border-white/15 hover:border-[#E84A18] bg-white dark:bg-[#12141C]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {proofPreviewUrl ? (
                          <img
                            src={proofPreviewUrl}
                            alt="Preview Bukti Transfer"
                            className="w-12 h-12 rounded-lg object-cover border border-emerald-500/40 shrink-0"
                          />
                        ) : (
                          <span className="w-10 h-10 rounded-xl bg-[#E84A18]/15 text-[#E84A18] flex items-center justify-center shrink-0">
                            {uploadingProof ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <ImagePlus className="w-5 h-5" />
                            )}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {uploadingProof
                              ? `Mengunggah Bukti Transfer (${proofUploadPct}%)...`
                              : proofPreviewUrl
                              ? 'Bukti Transfer Terlampir (Klik untuk ganti)'
                              : 'Pilih Foto / Screenshot Bukti Transfer'}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                            {proofSizeLabel || 'Format JPG, PNG, WebP · Auto-kompresi & sinkronisasi instan'}
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1.5 rounded-lg bg-[#E84A18] text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{proofPreviewUrl ? 'Ganti' : 'Upload'}</span>
                      </span>
                    </div>
                  </label>

                  {(proofStatusMsg || activeTx.verificationStage === 'verifying_proof') && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-amber-600 dark:text-amber-300 text-xs font-semibold">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0 text-[#E84A18]" />
                      <span>
                        {proofStatusMsg ||
                          'Memverifikasi bukti transfer & memperbarui status Verified ke database secara otomatis...'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    disabled={checkingTx || uploadingProof || submittingProof}
                    onClick={() => handleConfirmPayment(activeTx.orderId)}
                    className="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-[#E84A18] to-[#FF6B35] hover:from-[#F35B2B] hover:to-[#FF7D4D] disabled:opacity-60 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#E84A18]/30 transition-all"
                  >
                    {checkingTx || submittingProof ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>
                      {checkingTx || submittingProof
                        ? 'Memverifikasi Pembayaran & Bukti Transfer...'
                        : proofUploadedUrl
                        ? 'Verifikasi Bukti Transfer & Aktifkan Status Verified Sekarang'
                        : 'Sudah Transfer · Cek Verifikasi Otomatis'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={checkingTx}
                    onClick={() => checkTransactionStatus(activeTx.orderId, false)}
                    className="w-full min-h-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1E222D] dark:hover:bg-[#272C3A] text-slate-800 dark:text-gray-200 font-semibold text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-white/10"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${checkingTx ? 'animate-spin' : ''}`} />
                    <span>Sinkronisasi Real-Time Database (Auto-Polling Aktif)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTx(null);
                      resetProofState();
                    }}
                    className="w-full py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white"
                  >
                    Ganti Paket / Metode Pembayaran
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
