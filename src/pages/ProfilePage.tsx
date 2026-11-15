import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  Diamond,
  ExternalLink,
  Eye,
  Flame,
  History,
  KeyRound,
  Lock,
  LogOut,
  MailCheck,
  MessageCircle,
  Pencil,
  QrCode,
  RefreshCw,
  Send,
  ShieldBan,
  Smile,
  Sparkles,
  Star,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { TelegramCsButton } from '../components/TelegramCsButton';
import { ThemeToggle } from '../components/ThemeToggle';
import { TELEGRAM_BADGE_MAP, VerifiedBadge } from '../components/VerifiedBadge';
import { StatusEmojiBadge } from '../components/VipEmojis';
import { useAuth, AVATAR_BORDER_STYLES, PROFILE_THEMES } from '../context/AuthContext';
import type { PaymentTransaction, PremiumPackage } from '../types';
import defaultBannerImg from '../assets/images/default_profile_banner_1794755346957.jpg';
import defaultAvatarImg from '../assets/images/default_avatar_ink_1794755346613.jpg';

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
  { id: 'qris', label: 'QRIS (Semua E-Wallet & Bank)' },
  { id: 'bni_va', label: 'BNI Virtual Account' },
  { id: 'bri_va', label: 'BRI Virtual Account' },
  { id: 'permata_va', label: 'Permata Virtual Account' },
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

function getTodayWibString(): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
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
    toggleFounderAdPreview,
    getLocalHistory,
    getLocalBookmarks,
  } = useAuth();

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

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ type: 'ok' | 'err'; text: string; code?: string } | null>(null);

  const isFounderUser = user?.role === 'founder';
  const level = user?.level ?? 1;
  const levelDisplay = isFounderUser ? '∞' : String(level);
  const exp = user?.exp ?? 25;
  const expNeeded = Math.max(100, level * 200);
  const progressPct = isFounderUser ? 100 : Math.min(100, Math.round((exp / expNeeded) * 100));
  const watchStreak = user?.watchStreak ?? 0;
  const watchedToday = Boolean(user?.lastWatchDate && user.lastWatchDate === getTodayWibString());

  const borderStyle =
    AVATAR_BORDER_STYLES[user?.activeBorder || 'classic']?.ringClass ||
    AVATAR_BORDER_STYLES.classic.ringClass;
  const activeTheme =
    PROFILE_THEMES[user?.profileTheme || 'default'] || PROFILE_THEMES.default;

  const historyCount = getLocalHistory().length;
  const bookmarkCount = getLocalBookmarks().length;
  const hasVipBadge = Boolean(user && (user.isVerified || isPremium || isFounderUser));
  const badgePreset = user?.activeBadge ? TELEGRAM_BADGE_MAP.get(user.activeBadge) : undefined;
  const BadgeIcon = badgePreset?.icon || BadgeCheck;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await login(identifier, password);
    setSubmitting(false);
  };

  const handleGoogleLogin = async () => {
    setGoogleBusy(true);
    await loginWithGoogle();
    setGoogleBusy(false);
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
    setSubmitting(true);
    await register(regUsername, regEmail, regName, regPassword, regCode);
    setSubmitting(false);
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
    QRCode.toDataURL(activeTx.paymentNumber, { width: 256, margin: 2 })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [activeTx?.paymentNumber, activeTx?.paymentMethod]);

  const checkTransactionStatus = async (orderId: string, silent = false) => {
    const token = getStoredAuthToken();
    if (!token || !orderId) return;
    if (!silent) setCheckingTx(true);
    try {
      const res = await fetch(`/api/payment/status/${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        if (json.status === 'paid') {
          setActiveTx((prev) => (prev ? { ...prev, status: 'paid' } : prev));
          await refreshUser();
        }
      }
    } catch {
      // Keep polling silently
    } finally {
      if (!silent) setCheckingTx(false);
    }
  };

  useEffect(() => {
    if (!showUpgradeModal || !activeTx || activeTx.status === 'paid') return;
    const poll = setInterval(() => {
      checkTransactionStatus(activeTx.orderId, true);
    }, 4000);
    return () => clearInterval(poll);
  }, [showUpgradeModal, activeTx?.orderId, activeTx?.status]);

  const handleCreateTransaction = async () => {
    const token = getStoredAuthToken();
    if (!token) {
      setPaymentError('Silakan login terlebih dahulu.');
      return;
    }
    const pkg = packages.find((p) => p.id === selectedPlanId) || packages[1] || packages[0];
    setCreatingTx(true);
    setPaymentError(null);
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
        setPaymentError(json.error || 'Gagal membuat transaksi Pakasir');
      } else {
        setActiveTx(json.transaction);
      }
    } catch {
      setPaymentError('Tidak dapat terhubung ke gateway Pakasir');
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
                src="/assets/aistudio/sara_seo_pfp_6f6b2a74.jfif"
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

  return (
    <Layout>
      <div className="max-w-3xl mx-auto pb-8">
        {/* Top Banner + Overlapping Avatar + Discord Profile Theme Aura */}
        <div className={`relative pb-5 ${activeTheme.shellClass}`}>
          <div className="relative h-52 sm:h-64 w-full overflow-hidden bg-slate-900 dark:bg-[#14161D]">
            <img
              src={user?.bannerUrl || defaultBannerImg}
              alt="Latar Belakang Profil"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className={`absolute inset-0 bg-gradient-to-t ${activeTheme.bannerGradientOverlay}`} />

            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              <TelegramCsButton />
              <div className="lg:hidden">
                <ThemeToggle compact />
              </div>
              {user && (
                <Link
                  to="/profile/edit"
                  aria-label="Edit Foto Profil & Latar Belakang"
                  className="min-h-[40px] px-3.5 rounded-xl bg-black/55 hover:bg-[#E84A18] border border-white/15 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Profil</span>
                </Link>
              )}
            </div>
          </div>

          <div className="relative z-10 -mt-16 flex flex-col items-center px-4">
            <div className="relative">
              <img
                src={user?.photoUrl || defaultAvatarImg}
                alt={user?.name || 'ZoneStream'}
                referrerPolicy="no-referrer"
                className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover bg-white dark:bg-[#181A20] ${borderStyle}`}
              />
              {user && (
                <Link
                  to="/profile/edit"
                  aria-label="Ubah Foto Profil"
                  className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#E84A18] hover:bg-[#F35B2B] text-white flex items-center justify-center border-2 border-[#F5F7FB] dark:border-[#090A0E] shadow-lg transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            <div className="mt-3 flex items-center justify-center gap-1.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {user?.name || 'Memuat...'}
              </h1>
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
                {user.bio ? (
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 mt-1 text-center max-w-md">
                    {user.bio}
                  </p>
                ) : null}
                <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] mt-0.5">{user.email}</p>
                <div className="mt-2.5 flex items-center justify-center flex-wrap gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                      badgePreset?.pillClass ||
                      (isFounderUser
                        ? 'bg-gradient-to-r from-amber-500 to-[#E84A18] text-white shadow-md shadow-[#E84A18]/25'
                        : isPremium
                        ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25'
                        : 'bg-white dark:bg-[#1A1D26] text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-white/10')
                    }`}
                  >
                    {hasVipBadge && <BadgeIcon className="w-3.5 h-3.5" />}
                    <span>{user.activeBadge || (isPremium ? 'Verified VIP' : 'Member')}</span>
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white dark:bg-[#1A1D26] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-gray-200 font-mono-tabular">
                    Lv. {levelDisplay}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white dark:bg-[#1A1D26] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-gray-300 font-mono-tabular">
                    UID: {user.uid}
                  </span>
                </div>

                {/* Social & Messenger Shortcuts */}
                <div className="mt-3.5 flex items-center justify-center flex-wrap gap-2">
                  <Link
                    to={`/u/${user.uid}`}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#181B25] hover:border-[#E84A18] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-white inline-flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#E84A18]" />
                    <span>Profil Publik</span>
                  </Link>
                  <Link
                    to="/community"
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#181B25] hover:border-[#E84A18] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-white inline-flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <Users className="w-3.5 h-3.5 text-sky-500" />
                    <span>Cari User &amp; Teman</span>
                  </Link>
                  <Link
                    to="/chat"
                    className="px-3.5 py-2 rounded-xl bg-[#00A884] hover:bg-[#06CF9C] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Chat WA</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bento Stats Strip */}
        <div className="px-4 mt-5 grid grid-cols-4 gap-2.5">
          <Link
            to="/library?tab=history"
            className={`rounded-2xl border p-3 text-center hover:border-[#E84A18]/40 transition-colors shadow-sm dark:shadow-none ${activeTheme.cardClass}`}
          >
            <History className="w-4 h-4 text-[#E84A18] mx-auto mb-1" />
            <p className="text-base font-extrabold text-slate-900 dark:text-white font-mono-tabular">
              {historyCount}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-[#9CA3AF]">Ditonton</p>
          </Link>

          <Link
            to="/library"
            className={`rounded-2xl border p-3 text-center hover:border-[#E84A18]/40 transition-colors shadow-sm dark:shadow-none ${activeTheme.cardClass}`}
          >
            <Bookmark className="w-4 h-4 text-[#3B82F6] mx-auto mb-1" />
            <p className="text-base font-extrabold text-slate-900 dark:text-white font-mono-tabular">
              {bookmarkCount}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-[#9CA3AF]">Watchlist</p>
          </Link>

          <div className={`rounded-2xl border p-3 text-center shadow-sm dark:shadow-none ${activeTheme.cardClass}`}>
            <Flame className="w-4 h-4 text-amber-500 mx-auto mb-1" />
            <p className="text-base font-extrabold text-slate-900 dark:text-white font-mono-tabular">
              {watchStreak}h
            </p>
            <p className="text-[10px] text-slate-500 dark:text-[#9CA3AF]">Streak</p>
          </div>

          <div className={`rounded-2xl border p-3 text-center shadow-sm dark:shadow-none ${activeTheme.cardClass}`}>
            <BadgeCheck
              className={`w-4 h-4 mx-auto mb-1 ${
                hasVipBadge ? 'text-sky-500 dark:text-sky-400' : 'text-slate-400 dark:text-gray-500'
              }`}
            />
            <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
              {isFounderUser ? 'Founder' : isPremium ? 'VIP' : 'Gratis'}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-[#9CA3AF]">Status</p>
          </div>
        </div>

        {/* EXP & Daily Watch Mission Progress Card */}
        <div className="px-4 mt-4">
          <div className={`rounded-2xl border p-4 sm:p-5 shadow-sm dark:shadow-none ${activeTheme.cardClass}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-500 dark:text-amber-400 flex items-center justify-center">
                  <Zap className="w-4 h-4 fill-current" />
                </span>
                <div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    Level &amp; Misi Nonton Harian
                  </span>
                </div>
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-[#3B82F6] font-mono-tabular">
                <Zap className="w-3.5 h-3.5 fill-current" />
                {isFounderUser ? '∞ / ∞ EXP' : `${exp} / ${expNeeded}`}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#9CA3AF] mb-2">
              <span>
                {isFounderUser
                  ? 'Level Tak Terbatas (Akses Penuh Founder)'
                  : `Kemajuan ke Level ${level + 1}`}
              </span>
              <span className="font-bold text-slate-900 dark:text-white font-mono-tabular">
                {isFounderUser ? 'MAX · ∞' : `${progressPct}%`}
              </span>
            </div>

            <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isFounderUser
                    ? 'bg-gradient-to-r from-amber-400 via-[#E84A18] to-amber-500'
                    : 'bg-gradient-to-r from-[#3B82F6] to-[#60A5FA]'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.05]">
              <span
                className={`text-xs font-semibold ${
                  watchedToday
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-[#E84A18]'
                }`}
              >
                {watchedToday
                  ? `Misi hari ini selesai · Streak ${watchStreak} hari`
                  : 'Tonton 1 episode hari ini untuk klaim +50 EXP harian!'}
              </span>

              <button
                type="button"
                onClick={() => setShowXpModal(true)}
                className="text-xs font-semibold text-[#3B82F6] hover:text-blue-500 inline-flex items-center gap-1 transition-colors"
              >
                <span>Cara dapatkan EXP</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Upgrade to Premium + Verified Badge Card */}
        <div className="px-4 mt-4">
          <div className={`rounded-2xl border p-4 sm:p-5 shadow-sm dark:shadow-none ${activeTheme.cardClass}`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E84A18] to-amber-500 text-white flex items-center justify-center shadow-lg shadow-[#E84A18]/30 shrink-0">
                  {isPremium ? (
                    <Crown className="w-5 h-5" />
                  ) : (
                    <Diamond className="w-5 h-5 fill-current" />
                  )}
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {isPremium ? 'Premium & Lencana VIP Aktif!' : 'Upgrade ke Premium VIP!'}
                    </h2>
                    {hasVipBadge && (
                      <VerifiedBadge
                        size="sm"
                        isFounder={isFounderUser}
                        badgeLabel={user?.activeBadge}
                      />
                    )}
                    {hasVipBadge && user?.statusEmoji && (
                      <StatusEmojiBadge statusEmoji={user.statusEmoji} size="xs" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
                    {isPremium
                      ? user?.premiumExpiryDate
                        ? `Aktif hingga ${new Date(user.premiumExpiryDate).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })} · 2x EXP & Bebas Iklan aktif.`
                        : 'Seluruh iklan nonaktif, Tema Discord, 2x EXP, Lencana & Emoji Status aktif.'
                      : 'Dapatkan lencana VIP, Tema Discord, 2x EXP setiap nonton, & bebas iklan 10 detik.'}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs font-semibold text-slate-600 dark:text-gray-300 mb-3">
              Fitur Premium &amp; Lencana VIP
            </p>

            <div className="grid grid-cols-2 gap-2.5 mb-5">
              <div className="rounded-xl bg-slate-50 dark:bg-[#1A1D26] border border-slate-200 dark:border-white/5 p-3 flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-500 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <BadgeCheck className="w-4 h-4" />
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-gray-100 leading-snug">
                  Lencana &amp; Emoji Nama
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-[#1A1D26] border border-slate-200 dark:border-white/5 p-3 flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldBan className="w-4 h-4" />
                </span>
                <span className="text-xs font-medium text-slate-800 dark:text-gray-200 leading-snug">
                  Bebas Iklan &amp; Timer 10s
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-[#1A1D26] border border-slate-200 dark:border-white/5 p-3 flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="text-xs font-medium text-slate-800 dark:text-gray-200 leading-snug">
                  Emoji &amp; Stiker VIP
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-[#1A1D26] border border-slate-200 dark:border-white/5 p-3 flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-rose-500/15 text-rose-500 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Smile className="w-4 h-4" />
                </span>
                <span className="text-xs font-medium text-slate-800 dark:text-gray-200 leading-snug">
                  Tema Discord &amp; Latar
                </span>
              </div>
            </div>

            {isPremium || user?.role === 'founder' ? (
              <div className="space-y-2.5">
                <Link
                  to="/profile/edit"
                  className="w-full min-h-[48px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#202430] dark:hover:bg-[#292E3D] text-slate-900 dark:text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors border border-slate-200 dark:border-white/10"
                >
                  <CheckCircle2 className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                  <span>Edit Foto, Latar, Badge Verified &amp; Email</span>
                </Link>

                {user?.role === 'founder' && (
                  <button
                    type="button"
                    onClick={toggleFounderAdPreview}
                    className={`w-full min-h-[42px] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-colors ${
                      isPremium
                        ? 'bg-slate-50 hover:bg-slate-100 dark:bg-[#171922] dark:hover:bg-[#1E212D] text-slate-600 dark:text-gray-300 border-slate-200 dark:border-white/5'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    {isPremium ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-[#E84A18]" />
                        <span>Simulasi Tampilan User Gratis (Aktifkan Iklan 10s &amp; Banner)</span>
                      </>
                    ) : (
                      <>
                        <Crown className="w-3.5 h-3.5" />
                        <span>Kembalikan Mode Founder VIP (Bebas Iklan)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                className="w-full min-h-[48px] rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#E84A18]/25 transition-all active:scale-[0.98]"
              >
                <Star className="w-4 h-4 fill-current" />
                <span>Beli Premium &amp; Dapatkan Lencana VIP!</span>
              </button>
            )}
          </div>
        </div>

        {/* Logout button */}
        {user && (
          <div className="px-4 mt-4 flex justify-end">
            <button
              type="button"
              onClick={logout}
              className="min-h-[42px] px-4 rounded-xl bg-white hover:bg-rose-50 dark:bg-[#13151C] dark:hover:bg-rose-500/15 text-slate-600 hover:text-rose-600 dark:text-gray-400 dark:hover:text-rose-400 border border-slate-200 dark:border-white/5 text-xs font-semibold inline-flex items-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar Akun</span>
            </button>
          </div>
        )}
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
              Tonton episode Anime atau Donghua setiap hari! Member <strong>VIP / Founder</strong> otomatis mendapat{' '}
              <strong className="text-amber-500">2x EXP Lipat Ganda</strong>.
            </p>
            <ul className="space-y-2.5 text-xs text-slate-700 dark:text-gray-300">
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
              <li className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-[#1B1E26]">
                <span>Nonton Episode Baru</span>
                <span className="font-bold text-[#3B82F6] font-mono-tabular">
                  +30 <span className="text-amber-500">(VIP +60)</span>
                </span>
              </li>
              <li className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-[#1B1E26]">
                <span>Tonton Ulang Episode</span>
                <span className="font-bold text-[#3B82F6] font-mono-tabular">
                  +10 <span className="text-amber-500">(VIP +20)</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Upgrade Premium Checkout Modal (Pakasir Automated QRIS / VA) */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/10 p-5 sm:p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-full bg-[#E84A18] text-white flex items-center justify-center">
                  <BadgeCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    ZoneStream VIP · Pembayaran Otomatis
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                    Powered by Pakasir · Aktivasi Instan Tanpa Admin
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
                  2. Pilih Metode Pembayaran:
                </p>
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-semibold text-left transition-colors ${
                        paymentMethod === m.id
                          ? 'bg-[#E84A18] border-[#E84A18] text-white'
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
                  <span>{creatingTx ? 'Membuat Transaksi Pakasir...' : 'Buat Tagihan Pembayaran'}</span>
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
                  Paket <strong>{activeTx.planName}</strong> telah aktif otomatis. Lencana Verified, bebas iklan, dan <strong>2x EXP</strong> sudah terpasang di akunmu!
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
                    <span className="font-mono-tabular font-bold text-slate-900 dark:text-white">
                      {activeTx.orderId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-gray-400">Paket Dipilih</span>
                    <span className="font-bold text-slate-900 dark:text-white">{activeTx.planName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200 dark:border-white/10">
                    <span className="font-semibold text-slate-700 dark:text-gray-300">Total Bayar</span>
                    <span className="text-base font-extrabold text-[#E84A18] font-mono-tabular">
                      {formatIdr(activeTx.totalPayment || activeTx.amount)}
                    </span>
                  </div>
                </div>

                {activeTx.paymentMethod === 'qris' && qrDataUrl ? (
                  <div className="flex flex-col items-center p-4 rounded-2xl bg-white border border-slate-200">
                    <img
                      src={qrDataUrl}
                      alt="QRIS Pembayaran Pakasir"
                      className="w-52 h-52 object-contain"
                    />
                    <p className="text-[11px] font-semibold text-slate-600 mt-2 text-center">
                      Scan QRIS via GoPay, OVO, DANA, ShopeePay, BCA, BRI, Mandiri, dll.
                    </p>
                  </div>
                ) : activeTx.paymentNumber ? (
                  <div className="rounded-2xl bg-slate-100 dark:bg-[#1B1E26] border border-slate-200 dark:border-white/10 p-3.5">
                    <p className="text-[11px] text-slate-500 dark:text-gray-400 mb-1">
                      Nomor Virtual Account / Kode Pembayaran ({activeTx.paymentMethod.toUpperCase()}):
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-tabular text-base font-extrabold text-slate-900 dark:text-white break-all">
                        {activeTx.paymentNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyNumber(activeTx.paymentNumber)}
                        className="px-3 py-1.5 rounded-lg bg-[#E84A18] text-white text-xs font-bold inline-flex items-center gap-1 shrink-0"
                      >
                        {copiedText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedText ? 'Tersalin' : 'Salin'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-xs text-amber-700 dark:text-amber-300">
                    Klik tombol <strong>Bayar via Halaman Pakasir</strong> di bawah untuk menyelesaikan pembayaran dengan QRIS / Virtual Account.
                  </div>
                )}

                <div className="space-y-2.5">
                  <a
                    href={activeTx.paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[46px] rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#E84A18]/25 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Bayar via Halaman Pakasir</span>
                  </a>

                  <button
                    type="button"
                    disabled={checkingTx}
                    onClick={() => checkTransactionStatus(activeTx.orderId, false)}
                    className="w-full min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1E222D] dark:hover:bg-[#272C3A] text-slate-800 dark:text-gray-200 font-semibold text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-white/10"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${checkingTx ? 'animate-spin' : ''}`} />
                    <span>{checkingTx ? 'Memeriksa Status...' : 'Cek Status Pembayaran (Auto-Sync 4s)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTx(null)}
                    className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white"
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
