import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Camera,
  Check,
  ChevronRight,
  Crown,
  Frame,
  Globe,
  Image as ImageIcon,
  KeyRound,
  Lock,
  Mail,
  MessageSquareQuote,
  Palette,
  Send,
  Sparkles,
  UserPen,
  Volume2,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import {
  TELEGRAM_BADGE_PRESETS,
  VerifiedBadge,
  isFounderBadgeLabel,
  resolveDisplayBadgeLabel,
} from '../components/VerifiedBadge';
import { StatusEmojiBadge, VIP_EMOJIS } from '../components/VipEmojis';
import { CountryFlagBadge } from '../components/CountryFlag';
import {
  AvatarDecoration,
  DISCORD_AVATAR_DECORATIONS,
  STREAK_FRAME_REWARDS,
  normalizeDecorationId,
} from '../components/AvatarDecoration';
import { useAuth, AVATAR_BORDER_STYLES, PROFILE_THEMES } from '../context/AuthContext';
import { APP_LANGUAGES, useAppLanguage } from '../utils/language';
import { SoundSettingsPanel } from '../components/SoundSettingsPanel';
import { SOUND_PRESETS, useSoundSettings } from '../utils/soundEffects';
import defaultBannerImg from '../assets/images/default_profile_banner_1794755346957.jpg';
import heroFallbackImg from '../assets/images/donghua_hero_fallback_1794755348232.jpg';

const PRESET_BANNERS = [
  { label: 'Mecha Cyber', src: defaultBannerImg },
  { label: 'Xianxia Cultivator', src: heroFallbackImg },
];

function fileToCompressedDataUrl(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.94));
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function EditProfilePage() {
  const { user, isPremium, updateProfile } = useAuth();
  const { lang, currentLanguageOption, changeLanguage } = useAppLanguage();
  const { settings: soundSettings } = useSoundSettings();
  const navigate = useNavigate();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const initializedUidRef = useRef<string>('');

  const canCustomizePremium = Boolean(isPremium || user?.role === 'founder');

  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl || '');
  const [bannerUrl, setBannerUrl] = useState(user?.bannerUrl || '');
  const [activeBorder, setActiveBorder] = useState(user?.activeBorder || 'none');
  const [activeBadge, setActiveBadge] = useState(user?.activeBadge || 'Member');
  const [profileTheme, setProfileTheme] = useState(user?.profileTheme || 'default');
  const [statusEmoji, setStatusEmoji] = useState(user?.statusEmoji || '');

  const [editingField, setEditingField] = useState<
    | 'name'
    | 'bio'
    | 'language'
    | 'sound'
    | 'badge'
    | 'status-emoji'
    | 'theme'
    | 'border'
    | 'banner'
    | 'email'
    | 'password'
    | 'premium-lock'
    | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [autoSavedLabel, setAutoSavedLabel] = useState<string>('');
  const [badgeNotice, setBadgeNotice] = useState<string>('');
  const badgeNoticeTimerRef = useRef<number | null>(null);

  const showFounderBadgeNotice = () => {
    setBadgeNotice('Lencana Verified Founder eksklusif hanya dapat digunakan oleh akun Founder.');
    if (badgeNoticeTimerRef.current) {
      window.clearTimeout(badgeNoticeTimerRef.current);
    }
    badgeNoticeTimerRef.current = window.setTimeout(() => {
      setBadgeNotice('');
      badgeNoticeTimerRef.current = null;
    }, 3500);
  };

  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpFeedback, setOtpFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [previewOtp, setPreviewOtp] = useState<string>('');

  useEffect(() => {
    if (!user) {
      navigate('/profile', { replace: true });
      return;
    }
    if (initializedUidRef.current !== user.uid) {
      initializedUidRef.current = user.uid;
      const founderUser = user.role === 'founder';
      setName(user.name);
      setBio(user.bio || '');
      setPhotoUrl(user.photoUrl);
      setBannerUrl(user.bannerUrl);
      setActiveBorder(user.activeBorder || 'none');
      setActiveBadge(
        resolveDisplayBadgeLabel(user.activeBadge, founderUser, Boolean(user.isPremium || isPremium))
      );
      setProfileTheme(user.profileTheme || 'default');
      setStatusEmoji(user.statusEmoji || '');
    }
  }, [user, navigate, isPremium]);

  const resetOtpState = () => {
    setOtpCode('');
    setNewEmail('');
    setCurrentPassword('');
    setNewPassword('');
    setOtpFeedback(null);
    setPreviewOtp('');
  };

  const triggerAutoSave = async (
    overrides: Partial<{
      name: string;
      bio: string;
      photoUrl: string;
      bannerUrl: string;
      activeBorder: string;
      activeBadge: string;
      profileTheme: string;
      statusEmoji: string;
    }>,
    label = 'Tersimpan otomatis!'
  ) => {
    if (!user) return false;
    const payload: {
      name: string;
      bio: string;
      activeBorder: string;
      photoUrl?: string;
      bannerUrl?: string;
      activeBadge?: string;
      profileTheme?: string;
      statusEmoji?: string;
    } = {
      name: (overrides.name ?? name).trim() || user.name,
      bio: (overrides.bio ?? bio).trim(),
      activeBorder: overrides.activeBorder ?? activeBorder,
    };
    if (canCustomizePremium) {
      const candidateBadge = overrides.activeBadge ?? activeBadge;
      const safeBadge =
        user.role !== 'founder' && isFounderBadgeLabel(candidateBadge)
          ? 'Verified VIP'
          : candidateBadge;
      payload.photoUrl = overrides.photoUrl ?? photoUrl;
      payload.bannerUrl = overrides.bannerUrl ?? bannerUrl;
      payload.activeBadge = safeBadge;
      payload.profileTheme = overrides.profileTheme ?? profileTheme;
      payload.statusEmoji = overrides.statusEmoji ?? statusEmoji;
    }
    const ok = await updateProfile(payload);
    if (ok) {
      setAutoSavedLabel(label);
      setTimeout(() => setAutoSavedLabel(''), 2400);
    }
    return ok;
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canCustomizePremium) {
      setEditingField('premium-lock');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToCompressedDataUrl(file, 900);
    setPhotoUrl(dataUrl);
    void triggerAutoSave({ photoUrl: dataUrl }, 'Foto profil HD tersimpan!');
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canCustomizePremium) {
      setEditingField('premium-lock');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToCompressedDataUrl(file, 1920);
    setBannerUrl(dataUrl);
    setEditingField(null);
    void triggerAutoSave({ bannerUrl: dataUrl }, 'Latar HD tersimpan!');
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const ok = await triggerAutoSave({}, 'Profil berhasil disimpan!');
    setSaving(false);
    if (ok) {
      setSavedToast(true);
      setTimeout(() => {
        navigate('/profile');
      }, 400);
    }
  };

  const handleSendCode = async (purpose: 'change-email' | 'change-password') => {
    setOtpBusy(true);
    setOtpFeedback(null);
    setPreviewOtp('');
    try {
      const token =
        localStorage.getItem('zonestream_session_token_v1') ||
        localStorage.getItem('donghive_session_token_v1') ||
        '';
      const targetEmail = purpose === 'change-email' ? newEmail.trim() : user?.email || '';
      const res = await fetch('/api/user/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ purpose, targetEmail }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOtpFeedback({ type: 'err', text: json.error || 'Gagal mengirim kode' });
      } else {
        setOtpFeedback({ type: 'ok', text: json.message });
        if (json.previewCode) setPreviewOtp(json.previewCode);
      }
    } catch {
      setOtpFeedback({ type: 'err', text: 'Gagal terhubung ke server' });
    } finally {
      setOtpBusy(false);
    }
  };

  const handleVerifyChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpBusy(true);
    setOtpFeedback(null);
    try {
      const token =
        localStorage.getItem('zonestream_session_token_v1') ||
        localStorage.getItem('donghive_session_token_v1') ||
        '';
      const res = await fetch('/api/user/verify-change-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newEmail, code: otpCode, currentPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOtpFeedback({ type: 'err', text: json.error || 'Kode verifikasi salah' });
      } else {
        setOtpFeedback({ type: 'ok', text: 'Email berhasil diperbarui!' });
        setTimeout(() => window.location.reload(), 900);
      }
    } catch {
      setOtpFeedback({ type: 'err', text: 'Gagal memverifikasi kode' });
    } finally {
      setOtpBusy(false);
    }
  };

  const handleVerifyChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpBusy(true);
    setOtpFeedback(null);
    try {
      const token =
        localStorage.getItem('zonestream_session_token_v1') ||
        localStorage.getItem('donghive_session_token_v1') ||
        '';
      const res = await fetch('/api/user/verify-change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: otpCode, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOtpFeedback({ type: 'err', text: json.error || 'Kode verifikasi salah' });
      } else {
        setOtpFeedback({ type: 'ok', text: 'Password berhasil diubah!' });
        setTimeout(() => {
          setEditingField(null);
          resetOtpState();
        }, 900);
      }
    } catch {
      setOtpFeedback({ type: 'err', text: 'Gagal mengubah password' });
    } finally {
      setOtpBusy(false);
    }
  };

  const borderStyle =
    AVATAR_BORDER_STYLES[activeBorder]?.ringClass || AVATAR_BORDER_STYLES.classic.ringClass;
  const activeThemeDef = PROFILE_THEMES[profileTheme] || PROFILE_THEMES.default;
  const activeStatusObj = VIP_EMOJIS.find((v) => v.id === statusEmoji);
  const isFounder = user?.role === 'founder';

  return (
    <Layout hideBottomNav>
      <div className="max-w-2xl mx-auto pb-12">
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarUpload}
          className="hidden"
        />
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          onChange={handleBannerUpload}
          className="hidden"
        />

        {/* Banner Header + Live Discord Theme Preview */}
        <div className={`relative pb-4 ${activeThemeDef.shellClass}`}>
          <div className="relative h-52 sm:h-64 w-full overflow-hidden bg-slate-900 dark:bg-[#14161D]">
            <img
              src={bannerUrl || defaultBannerImg}
              alt="Banner Preview"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className={`absolute inset-0 bg-gradient-to-t ${activeThemeDef.bannerGradientOverlay}`} />

            <button
              type="button"
              onClick={ async () => {
                await triggerAutoSave({});
                navigate('/profile');
              }}
              aria-label="Kembali ke Profil"
              className="absolute top-4 left-4 z-20 min-h-[42px] min-w-[42px] rounded-xl bg-black/55 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center border border-white/15 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {autoSavedLabel && (
              <div className="absolute top-4 left-16 z-20 px-3 py-1.5 rounded-xl bg-emerald-500/90 backdrop-blur-md text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg">
                <Check className="w-3.5 h-3.5" />
                <span>{autoSavedLabel}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                canCustomizePremium ? setEditingField('banner') : setEditingField('premium-lock')
              }
              aria-label="Ganti Latar Belakang Profil"
              className="absolute bottom-4 right-4 z-20 min-h-[40px] px-3.5 rounded-xl bg-black/65 hover:bg-[#E84A18] border border-white/15 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg cursor-pointer"
            >
              {canCustomizePremium ? (
                <Camera className="w-4 h-4" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{canCustomizePremium ? 'Ganti Latar' : 'Latar (Premium)'}</span>
            </button>
          </div>

          {/* Avatar — pointer-events-none on outer wrapper so banner bottom-right button stays clickable */}
          <div className="relative z-10 -mt-14 flex flex-col items-center px-4 pointer-events-none">
            <div className="relative pointer-events-auto">
              <AvatarDecoration
                src={photoUrl}
                alt={name}
                decorationId={activeBorder}
                size="xl"
              >
                <button
                  type="button"
                  onClick={() =>
                    canCustomizePremium
                      ? avatarInputRef.current?.click()
                      : setEditingField('premium-lock')
                  }
                  aria-label="Upload Foto Profil"
                  className={`absolute bottom-0 right-0 z-30 w-9 h-9 rounded-full text-white flex items-center justify-center shadow-lg border-2 border-[#F5F7FB] dark:border-[#090A0E] transition-colors ${
                    canCustomizePremium
                      ? 'bg-[#E84A18] hover:bg-[#F35B2B]'
                      : 'bg-slate-700 hover:bg-amber-500'
                  }`}
                >
                  {canCustomizePremium ? (
                    <Camera className="w-4 h-4" />
                  ) : (
                    <Lock className="w-4 h-4 text-amber-400" />
                  )}
                </button>
              </AvatarDecoration>
            </div>

            <div className="mt-3 flex items-center justify-center gap-1.5 flex-wrap pointer-events-auto">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">{name}</h1>
              <CountryFlagBadge countryCode={user?.countryCode} size="sm" />
              {canCustomizePremium && (
                <VerifiedBadge
                  size="md"
                  isFounder={isFounder}
                  badgeLabel={activeBadge}
                />
              )}
              {canCustomizePremium && statusEmoji && (
                <StatusEmojiBadge statusEmoji={statusEmoji} size="sm" />
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-0.5 pointer-events-auto">
              {user?.email} · {isFounder ? 'Lv. ∞' : `Lv. ${user?.level || 1}`} · UID: {user?.uid}
            </p>
          </div>
        </div>

        {/* Settings List Card */}
        <div className="px-4 mt-6">
          {!canCustomizePremium && (
            <div className="mb-4 rounded-2xl bg-amber-50 dark:bg-gradient-to-r dark:from-[#1D1614] dark:to-[#161821] border border-amber-300 dark:border-amber-500/25 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Crown className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />
                <p className="text-xs text-slate-800 dark:text-gray-200 leading-snug">
                  Upgrade ke <strong className="text-amber-700 dark:text-amber-300">Premium VIP</strong> untuk membuka{' '}
                  <strong>Tema Discord</strong>, <strong>14 Border VIP</strong>, <strong>Lencana Telegram</strong> &amp; <strong>Emoji Status Nama</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="px-3 py-1.5 rounded-lg bg-[#E84A18] text-white text-[11px] font-bold whitespace-nowrap shrink-0"
              >
                Upgrade
              </button>
            </div>
          )}

          <div className="rounded-2xl bg-white dark:bg-[#13151C] border border-slate-200 dark:border-white/[0.06] divide-y divide-slate-200 dark:divide-white/[0.06] overflow-hidden shadow-sm dark:shadow-none">
            <button
              type="button"
              onClick={() => setEditingField('name')}
              className="w-full min-h-[58px] px-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <UserPen className="w-5 h-5 text-slate-600 dark:text-gray-300" />
                <span className="text-sm font-medium text-slate-900 dark:text-white">Nama Akun</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[#9CA3AF]">
                <span className="truncate max-w-[160px] text-slate-900 dark:text-white font-semibold">
                  {name}
                </span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setEditingField('bio')}
              className="w-full min-h-[58px] px-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <MessageSquareQuote className="w-5 h-5 text-slate-600 dark:text-gray-300" />
                <span className="text-sm font-medium text-slate-900 dark:text-white">Bio Profil</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[#9CA3AF]">
                <span className="truncate max-w-[160px]">{bio || 'Tambah bio...'}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setEditingField('language')}
              className="w-full min-h-[58px] px-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-[#E84A18]" />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  Bahasa Aplikasi &amp; Subtitle (4 Bahasa)
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[#9CA3AF]">
                <span className="inline-flex items-center gap-1.5 text-slate-900 dark:text-white font-semibold">
                  <CountryFlagBadge countryCode={currentLanguageOption.countryCode} size="xs" />
                  <span>{currentLanguageOption.nativeLabel}</span>
                </span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setEditingField('sound')}
              className="w-full min-h-[58px] px-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-emerald-500" />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  Efek Suara (Chat, Notifikasi &amp; Level Up)
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[#9CA3AF]">
                <span className="truncate max-w-[140px] text-slate-900 dark:text-white font-semibold">
                  {Math.round(soundSettings.volume * 100) === 0
                    ? 'Senyap'
                    : SOUND_PRESETS.chat.find((p) => p.id === soundSettings.chat)?.labelId || 'Aktif'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                canCustomizePremium
                  ? avatarInputRef.current?.click()
                  : setEditingField('premium-lock')
              }
              className="w-full min-h-[58px] px-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5 text-slate-600 dark:text-gray-300" />
                <span className="text-sm font-medium text-slate-900 dark:text-white">Foto Profil</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[#9CA3AF]">
                {canCustomizePremium ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Upload Foto
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-xs">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Khusus Premium</span>
                  </span>
                )}
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                canCustomizePremium ? setEditingField('banner') : setEditingField('premium-lock')
              }
              className="w-full min-h-[58px] px-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <ImageIcon className="w-5 h-5 text-slate-600 dark:text-gray-300" />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  Latar Belakang (Banner)
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[#9CA3AF]">
                {canCustomizePremium ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Ubah Latar
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-xs">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Khusus Premium</span>
                  </span>
                )}
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                canCustomizePremium ? setEditingField('theme') : setEditingField('premium-lock')
              }
              className="w-full min-h-[58px] px-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Palette className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  Tema Profil (Gaya Discord)
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[#9CA3AF]">
                {canCustomizePremium ? (
                  <span className="text-indigo-600 dark:text-indigo-300 font-semibold truncate max-w-[140px]">
                    {activeThemeDef.label}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-xs">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Khusus Premium</span>
                  </span>
                )}
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setEditingField('border')}
              className="w-full min-h-[58px] px-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Frame className="w-5 h-5 text-[#E84A18]" />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  Dekorasi Avatar Discord (12 Gaya SVG)
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[#9CA3AF]">
                <span className="truncate max-w-[150px] font-semibold text-slate-800 dark:text-gray-200">
                  {AVATAR_BORDER_STYLES[normalizeDecorationId(activeBorder)]?.label ||
                    AVATAR_BORDER_STYLES[activeBorder]?.label ||
                    'Tanpa Dekorasi'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (canCustomizePremium) {
                  setBadgeNotice('');
                  setEditingField('badge');
                } else {
                  setEditingField('premium-lock');
                }
              }}
              className="w-full min-h-[58px] px-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Award className="w-5 h-5 text-sky-500 dark:text-sky-400" />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  Lencana Verified (Telegram)
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[#9CA3AF]">
                {canCustomizePremium ? (
                  <span className="text-sky-600 dark:text-sky-400 font-semibold truncate max-w-[140px]">
                    {activeBadge}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-xs">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Khusus Premium</span>
                  </span>
                )}
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                canCustomizePremium
                  ? setEditingField('status-emoji')
                  : setEditingField('premium-lock')
              }
              className="w-full min-h-[58px] px-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  Emoji Status Samping Nama
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[#9CA3AF]">
                {canCustomizePremium ? (
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-300 font-semibold">
                    {statusEmoji && <StatusEmojiBadge statusEmoji={statusEmoji} size="xs" />}
                    <span>{activeStatusObj ? activeStatusObj.label : 'Belum dipasang'}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-xs">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Khusus Premium</span>
                  </span>
                )}
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                resetOtpState();
                setEditingField('email');
              }}
              className="w-full min-h-[58px] px-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-slate-600 dark:text-gray-300" />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  Ubah Email (Kode OTP Gmail)
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[#9CA3AF]">
                <span className="truncate max-w-[140px]">{user?.email}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                resetOtpState();
                setEditingField('password');
              }}
              className="w-full min-h-[58px] px-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <KeyRound className="w-5 h-5 text-slate-600 dark:text-gray-300" />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  Ubah Password (Kode Gmail)
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[#9CA3AF]">
                <span>Verifikasi 6 Digit</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="mt-6 w-full min-h-[50px] rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#E84A18]/25 transition-all active:scale-[0.98]"
          >
            {savedToast ? (
              <>
                <Check className="w-4 h-4" />
                <span>Tersimpan ke MongoDB!</span>
              </>
            ) : (
              <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan Profil'}</span>
            )}
          </button>
        </div>
      </div>

      {/* Premium Lock Modal */}
      {editingField === 'premium-lock' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#14161D] border border-amber-400/50 dark:border-amber-500/30 p-6 text-center shadow-2xl">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#E84A18] to-amber-500 text-white flex items-center justify-center mb-3 shadow-lg shadow-[#E84A18]/30">
              <Crown className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-1.5">
              Fitur Khusus Premium VIP
            </h3>
            <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed mb-5">
              Edit <strong>Foto Profil</strong>, <strong>Latar Belakang</strong>, <strong>Tema Profil Discord</strong>, <strong>Border VIP</strong>, <strong>Lencana Telegram</strong>, dan <strong>Emoji Status Nama</strong> hanya tersedia untuk member <strong>Premium</strong> &amp; <strong>Founder</strong>.
            </p>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="w-full h-11 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white font-bold text-sm"
              >
                Upgrade ke Premium Sekarang
              </button>
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="w-full h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-gray-300 font-semibold text-xs"
              >
                Nanti Saja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sound Effects Picker Modal */}
      {editingField === 'sound' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
          <div className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-3xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/10 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200 dark:border-white/[0.08]">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Pengaturan Efek Suara
              </h3>
              <button
                type="button"
                onClick={() => setEditingField(null)}
                aria-label="Tutup Pengaturan Suara"
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SoundSettingsPanel embedded />
          </div>
        </div>
      )}

      {/* 4-Language App & Subtitle Picker Modal */}
      {editingField === 'language' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/10 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Pilih Bahasa &amp; Subtitle (4 Bahasa)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-gray-400">
                  Mengatur bahasa aplikasi dan subtitle otomatis saat menonton video
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {APP_LANGUAGES.map((opt) => {
                const selected = lang === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => {
                      changeLanguage(opt.code);
                      setEditingField(null);
                      setAutoSavedLabel(`Bahasa ${opt.nativeLabel} & ${opt.subLabel} aktif!`);
                      setTimeout(() => setAutoSavedLabel(''), 2400);
                    }}
                    className={`w-full p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all ${
                      selected
                        ? 'border-[#E84A18] bg-[#E84A18]/15 shadow-sm'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50 hover:bg-slate-100 dark:bg-[#1B1E26] dark:hover:bg-[#232732]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CountryFlagBadge countryCode={opt.countryCode} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                            {opt.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#E84A18]/20 text-[#E84A18] text-[10px] font-bold">
                            {opt.subLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate mt-0.5">
                          {opt.description}
                        </p>
                      </div>
                    </div>
                    {selected && (
                      <span className="w-6 h-6 rounded-full bg-[#E84A18] text-white flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Edit Name Modal */}
      {editingField === 'name' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/10 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Ubah Nama Akun</h3>
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#1B1E26] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#E84A18] mb-4"
            />
            <button
              type="button"
              onClick={() => {
                setEditingField(null);
                void triggerAutoSave({ name }, 'Nama akun tersimpan!');
              }}
              className="w-full h-11 rounded-xl bg-[#E84A18] text-white font-bold text-sm"
            >
              Terapkan &amp; Simpan
            </button>
          </div>
        </div>
      )}

      {/* Edit Bio Modal */}
      {editingField === 'bio' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/10 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Ubah Bio Profil</h3>
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              rows={3}
              maxLength={160}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tulis bio atau kutipan anime/donghua favoritmu..."
              className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#1B1E26] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#E84A18] mb-4 resize-none"
            />
            <button
              type="button"
              onClick={() => {
                setEditingField(null);
                void triggerAutoSave({ bio }, 'Bio profil tersimpan!');
              }}
              className="w-full h-11 rounded-xl bg-[#E84A18] text-white font-bold text-sm"
            >
              Terapkan &amp; Simpan
            </button>
          </div>
        </div>
      )}

      {/* Edit Banner Modal (Premium & Founder) */}
      {editingField === 'banner' && canCustomizePremium && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/10 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Ubah Latar Belakang Profil
              </h3>
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              className="w-full min-h-[46px] mb-4 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              <span>Upload Gambar dari Galeri / Perangkat</span>
            </button>

            <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 mb-2">
              Atau pilih latar bawaan:
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {PRESET_BANNERS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setBannerUrl(p.src);
                      setEditingField(null);
                      void triggerAutoSave({ bannerUrl: p.src }, 'Latar belakang tersimpan!');
                    }}
                    className="group relative h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 hover:border-[#E84A18]"
                  >
                    <img src={p.src} alt={p.label} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/45 flex items-end p-2">
                      <span className="text-[11px] font-bold text-white">{p.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      {/* Discord-Style Profile Theme Modal (Premium & Founder) */}
      {editingField === 'theme' && canCustomizePremium && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/10 p-5 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Pilih Tema Profil (Gaya Discord)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-gray-400">
                  Memberi aura cahaya &amp; warna kartu eksklusif di profil Anda
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 overflow-y-auto pr-1">
              {Object.values(PROFILE_THEMES).map((theme) => {
                const selected = profileTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      setProfileTheme(theme.id);
                      setEditingField(null);
                      void triggerAutoSave({ profileTheme: theme.id }, `Tema ${theme.label} dipasang!`);
                    }}
                    className={`w-full p-3 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all ${
                      selected
                        ? 'bg-[#E84A18]/15 border-[#E84A18] shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#1B1E26] dark:hover:bg-[#232732] border-slate-200 dark:border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${theme.previewSwatch} shrink-0 border border-white/20 shadow`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {theme.label}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                          {theme.desc}
                        </p>
                      </div>
                    </div>
                    {selected && <Check className="w-4 h-4 text-[#E84A18] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Floating Global Notification for Founder-Only Badge */}
      {badgeNotice && (
        <div
          role="alert"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md px-4 py-3 rounded-2xl bg-[#1A1318]/95 border border-amber-400/50 text-amber-100 shadow-2xl backdrop-blur-md flex items-center gap-3"
        >
          <span className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4" />
          </span>
          <p className="text-xs sm:text-sm font-bold leading-snug flex-1">{badgeNotice}</p>
          <button
            type="button"
            onClick={() => setBadgeNotice('')}
            aria-label="Tutup notifikasi"
            className="text-amber-300/80 hover:text-white shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Telegram-Style Verified Badge Modal */}
      {editingField === 'badge' && canCustomizePremium && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/10 p-5 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Pilih Lencana Verified ({TELEGRAM_BADGE_PRESETS.length} Gaya)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-gray-400">
                  Lencana tampil di profil dan kolom komentar Anda
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBadgeNotice('');
                  setEditingField(null);
                }}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {badgeNotice && (
              <div
                role="status"
                className="mb-3 px-3 py-2.5 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-700 dark:text-amber-200 text-xs font-semibold flex items-center gap-2"
              >
                <Lock className="w-4 h-4 text-amber-500 dark:text-amber-300 shrink-0" />
                <span>{badgeNotice}</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto pr-1">
              {TELEGRAM_BADGE_PRESETS.map((b) => {
                const Icon = b.icon;
                const lockedForMember = Boolean(b.founderOnly && !isFounder);
                const selected = !lockedForMember && activeBadge === b.label;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      if (lockedForMember) {
                        showFounderBadgeNotice();
                        return;
                      }
                      setBadgeNotice('');
                      setActiveBadge(b.label);
                      setEditingField(null);
                      void triggerAutoSave({ activeBadge: b.label }, `Lencana ${b.label} dipasang!`);
                    }}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                      selected
                        ? 'border-[#E84A18] bg-[#E84A18]/10'
                        : lockedForMember
                        ? 'border-amber-400/30 bg-amber-500/[0.06] hover:bg-amber-500/[0.12] opacity-85 cursor-not-allowed'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1B1E26] hover:bg-slate-100 dark:hover:bg-[#232732]'
                    }`}
                  >
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 min-w-0 ${b.pillClass}`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{b.label}</span>
                    </span>
                    {lockedForMember ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[9px] font-bold inline-flex items-center gap-0.5 shrink-0">
                        <Lock className="w-2.5 h-2.5" /> Founder
                      </span>
                    ) : (
                      selected && <Check className="w-4 h-4 text-[#E84A18] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3D Equippable Status Emoji Modal (Telegram / Discord 3D Emblem Style) */}
      {editingField === 'status-emoji' && canCustomizePremium && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#11131B] border border-slate-200 dark:border-white/15 p-5 shadow-2xl max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Pasang Emoji 3D Eksklusif di Nama
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-gray-400">
                  Emblem 3D berkilau tampil otomatis di samping nama Anda di semua perangkat
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setStatusEmoji('');
                setEditingField(null);
                void triggerAutoSave({ statusEmoji: '' }, 'Emoji status dilepas!');
              }}
              className={`w-full mb-3 h-10 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between border ${
                !statusEmoji
                  ? 'border-[#E84A18] bg-[#E84A18]/15 text-[#E84A18]'
                  : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#191C26] text-slate-600 dark:text-gray-300'
              }`}
            >
              <span>Tanpa Emoji Status</span>
              {!statusEmoji && <Check className="w-4 h-4" />}
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto pr-1 py-1">
              {VIP_EMOJIS.map((vip) => {
                const Icon = vip.icon;
                const selected = statusEmoji === vip.id;
                return (
                  <button
                    key={vip.id}
                    type="button"
                    onClick={() => {
                      setStatusEmoji(vip.id);
                      setEditingField(null);
                      void triggerAutoSave({ statusEmoji: vip.id }, `Emoji 3D ${vip.label} dipasang!`);
                    }}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors text-left ${
                      selected
                        ? 'border-[#E84A18] bg-gradient-to-r from-[#E84A18]/25 to-amber-500/15 ring-1 ring-[#E84A18]/50 shadow-lg'
                        : `${vip.bgClass} ${vip.borderClass} hover:brightness-110`
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-black/30 border border-white/15 flex items-center justify-center shrink-0 shadow-inner">
                        <Icon className="w-7 h-7" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs sm:text-sm font-extrabold truncate ${vip.textClass}`}>
                          {vip.label}
                        </p>
                        <p className="text-[10px] text-slate-600 dark:text-gray-300 truncate">
                          {vip.subtitle}
                        </p>
                      </div>
                    </div>
                    {selected && (
                      <span className="w-6 h-6 rounded-full bg-[#E84A18] text-white flex items-center justify-center shrink-0 shadow">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Discord-Style 3D SVG Avatar Decorations Modal */}
      {editingField === 'border' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-[#11131B] border border-slate-200 dark:border-white/15 p-5 shadow-2xl max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Pilih Dekorasi Avatar 3D Discord (12 Gaya)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-gray-400">
                  Klik dekorasi untuk langsung memasang &amp; menyimpan otomatis ke profil Anda
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto pr-1 py-1">
              {STREAK_FRAME_REWARDS.map((sf) => {
                const bestStreak = Math.max(user?.longestStreak || 0, user?.watchStreak || 0);
                const unlocked = Boolean(
                  user?.role === 'founder' ||
                    (user?.unlockedStreakFrames || []).includes(sf.id) ||
                    bestStreak >= sf.minStreak
                );
                const selected = normalizeDecorationId(activeBorder) === sf.id;
                return (
                  <button
                    key={sf.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => {
                      setActiveBorder(sf.id);
                      setEditingField(null);
                      void triggerAutoSave(
                        { activeBorder: sf.id },
                        `Frame Streak ${sf.name} berhasil dipasang!`
                      );
                    }}
                    className={`relative rounded-2xl p-3.5 border flex flex-col items-center text-center gap-2.5 transition-colors ${
                      selected
                        ? 'border-[#E84A18] bg-gradient-to-b from-[#E84A18]/20 to-transparent ring-1 ring-[#E84A18]/50 shadow-lg'
                        : !unlocked
                        ? 'border-slate-200 dark:border-white/5 bg-slate-100/70 dark:bg-[#171920] opacity-60 cursor-not-allowed'
                        : 'border-amber-500/30 bg-amber-500/[0.06] hover:bg-amber-500/[0.12]'
                    }`}
                  >
                    <div className="py-1.5">
                      <AvatarDecoration
                        src={photoUrl}
                        alt={sf.name}
                        decorationId={sf.id}
                        size="lg"
                      />
                    </div>
                    <div className="min-w-0 w-full">
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                        {sf.name}
                      </p>
                      <p className="text-[10px] text-amber-500 dark:text-amber-300 line-clamp-1 font-semibold">
                        Reward Streak {sf.tierLabel}
                      </p>
                    </div>
                    {!unlocked ? (
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-slate-800/80 text-gray-300 text-[9px] font-bold inline-flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> {sf.tierLabel}
                      </span>
                    ) : selected ? (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#E84A18] text-white flex items-center justify-center shadow">
                        <Check className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                        Terbuka
                      </span>
                    )}
                  </button>
                );
              })}

              {DISCORD_AVATAR_DECORATIONS.map((preset) => {
                const locked = Boolean(preset.vip && !canCustomizePremium);
                const selected = normalizeDecorationId(activeBorder) === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      setActiveBorder(preset.id);
                      setEditingField(null);
                      void triggerAutoSave(
                        { activeBorder: preset.id },
                        `Dekorasi ${preset.name} berhasil dipasang!`
                      );
                    }}
                    className={`relative rounded-2xl p-3.5 border flex flex-col items-center text-center gap-2.5 transition-colors ${
                      selected
                        ? 'border-[#E84A18] bg-gradient-to-b from-[#E84A18]/20 to-transparent ring-1 ring-[#E84A18]/50 shadow-lg'
                        : locked
                        ? 'border-slate-200 dark:border-white/5 bg-slate-100/70 dark:bg-[#171920] opacity-60 cursor-not-allowed'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50 hover:bg-slate-100 dark:bg-[#181B24] dark:hover:bg-[#212533]'
                    }`}
                  >
                    <div className="py-1.5">
                      <AvatarDecoration
                        src={photoUrl}
                        alt={preset.name}
                        decorationId={preset.id}
                        size="lg"
                      />
                    </div>
                    <div className="min-w-0 w-full">
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                        {preset.name}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-gray-400 line-clamp-1">
                        {preset.subtitle}
                      </p>
                    </div>
                    {locked ? (
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[9px] font-bold inline-flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> VIP
                      </span>
                    ) : selected ? (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#E84A18] text-white flex items-center justify-center shadow">
                        <Check className="w-3 h-3" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Change Email via Email Code Modal */}
      {editingField === 'email' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/10 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Ubah Email dengan Kode Verifikasi
              </h3>
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {otpFeedback && (
              <div
                className={`mb-3 p-3 rounded-xl text-xs font-medium ${
                  otpFeedback.type === 'ok'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30'
                }`}
              >
                <p>{otpFeedback.text}</p>
                {previewOtp && (
                  <p className="mt-1 font-mono-tabular font-bold text-slate-900 dark:text-white text-sm">
                    Kode OTP Sementara: {previewOtp}
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleVerifyChangeEmail} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-gray-300 mb-1">
                  Alamat Email Gmail Baru
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="emailbaru@gmail.com"
                    className="flex-1 h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#1B1E26] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#E84A18]"
                  />
                  <button
                    type="button"
                    disabled={otpBusy || !newEmail.includes('@')}
                    onClick={() => handleSendCode('change-email')}
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
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#1B1E26] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white font-mono-tabular tracking-[0.25em] focus:outline-none focus:border-[#E84A18]"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 dark:text-gray-300 mb-1">
                  Password Saat Ini
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Konfirmasi password akun"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#1B1E26] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#E84A18]"
                />
              </div>

              <button
                type="submit"
                disabled={otpBusy}
                className="w-full h-11 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white font-bold text-sm"
              >
                {otpBusy ? 'Memverifikasi...' : 'Verifikasi & Ubah Email'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Change Password via Email Code Modal */}
      {editingField === 'password' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/10 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Ubah Password via Kode Gmail
              </h3>
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mb-3">
              Kode verifikasi 6 digit akan dikirim ke email terdaftar:{' '}
              <strong className="text-slate-900 dark:text-white">{user?.email}</strong>
            </p>

            {otpFeedback && (
              <div
                className={`mb-3 p-3 rounded-xl text-xs font-medium ${
                  otpFeedback.type === 'ok'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30'
                }`}
              >
                <p>{otpFeedback.text}</p>
                {previewOtp && (
                  <p className="mt-1 font-mono-tabular font-bold text-slate-900 dark:text-white text-sm">
                    Kode OTP Sementara: {previewOtp}
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              disabled={otpBusy}
              onClick={() => handleSendCode('change-password')}
              className="w-full min-h-[42px] mb-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-[#222634] dark:hover:bg-[#2C3144] text-white text-xs font-bold flex items-center justify-center gap-2 border border-slate-200 dark:border-white/10"
            >
              <Send className="w-3.5 h-3.5 text-[#E84A18]" />
              <span>Kirim Kode Verifikasi ke {user?.email}</span>
            </button>

            <form onSubmit={handleVerifyChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-gray-300 mb-1">
                  Kode Verifikasi (6 Digit)
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  inputMode="numeric"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
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
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#1B1E26] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#E84A18]"
                />
              </div>

              <button
                type="submit"
                disabled={otpBusy}
                className="w-full h-11 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white font-bold text-sm"
              >
                {otpBusy ? 'Memverifikasi...' : 'Verifikasi & Simpan Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
