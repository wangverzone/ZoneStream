import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import type {
  UserProfile,
  WatchHistoryItem,
  BookmarkItem,
  WatchHistoryReward,
} from '../types';

const TOKEN_STORAGE_KEY = 'zonestream_session_token_v1';
const LEGACY_TOKEN_KEY = 'donghive_session_token_v1';
const GUEST_STORAGE_KEY = 'zonestream_guest_profile_v1';

interface AuthContextValue {
  user: UserProfile | null;
  isPremium: boolean;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  login: (identifier: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  register: (
    username: string,
    email: string,
    name: string,
    password: string,
    code: string
  ) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateProfile: (data: {
    name?: string;
    bio?: string;
    photoUrl?: string;
    bannerUrl?: string;
    activeBorder?: string;
    activeBadge?: string;
    profileTheme?: string;
    statusEmoji?: string;
    newPassword?: string;
  }) => Promise<boolean>;
  toggleFounderAdPreview: () => Promise<boolean>;
  recordWatchHistory: (item: Omit<WatchHistoryItem, 'updatedAt'>) => Promise<WatchHistoryReward>;
  toggleBookmark: (item: Omit<BookmarkItem, 'addedAt'>) => Promise<boolean>;
  getLocalHistory: () => WatchHistoryItem[];
  getLocalBookmarks: () => BookmarkItem[];
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readGuestData(): { history: WatchHistoryItem[]; bookmarks: BookmarkItem[] } {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return { history: [], bookmarks: [] };
    return JSON.parse(raw);
  } catch {
    return { history: [], bookmarks: [] };
  }
}

function writeGuestData(data: { history: WatchHistoryItem[]; bookmarks: BookmarkItem[] }) {
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota issues
  }
}

export const AVATAR_BORDER_STYLES: Record<
  string,
  { label: string; ringClass: string; previewColor: string; premiumOnly?: boolean }
> = {
  classic: {
    label: 'Classic Standar',
    ringClass: 'ring-2 ring-[#2C303A] shadow-lg',
    previewColor: 'from-slate-500 to-slate-700',
  },
  crimson: {
    label: 'Crimson Flame',
    ringClass: 'ring-[3px] ring-[#E84A18] shadow-[0_0_22px_rgba(232,74,24,0.65)]',
    previewColor: 'from-[#E84A18] to-rose-600',
  },
  azure: {
    label: 'Spirit Azure',
    ringClass: 'ring-[3px] ring-[#3B82F6] shadow-[0_0_22px_rgba(59,130,246,0.6)]',
    previewColor: 'from-sky-400 to-blue-600',
  },
  'emerald-venom': {
    label: 'Venom Emerald',
    ringClass: 'ring-[3px] ring-emerald-400 shadow-[0_0_22px_rgba(52,211,153,0.55)]',
    previewColor: 'from-emerald-400 to-teal-600',
  },
  gold: {
    label: 'Immortal Sovereign Gold',
    ringClass:
      'ring-[3px] ring-amber-400 shadow-[0_0_28px_rgba(251,191,36,0.75)]',
    previewColor: 'from-amber-300 via-yellow-400 to-orange-500',
    premiumOnly: true,
  },
  sakura: {
    label: 'Sakura Blossom Neon',
    ringClass:
      'ring-[3px] ring-rose-400 shadow-[0_0_26px_rgba(251,113,133,0.7)]',
    previewColor: 'from-pink-400 via-rose-400 to-fuchsia-500',
    premiumOnly: true,
  },
  'cyber-neon': {
    label: 'Discord Cyber Neon',
    ringClass:
      'ring-[3px] ring-cyan-400 shadow-[0_0_28px_rgba(34,211,238,0.8)]',
    previewColor: 'from-cyan-400 via-sky-500 to-fuchsia-500',
    premiumOnly: true,
  },
  'abyss-void': {
    label: 'Shadow Abyss Void',
    ringClass:
      'ring-[3px] ring-violet-500 shadow-[0_0_28px_rgba(139,92,246,0.8)]',
    previewColor: 'from-violet-500 via-purple-600 to-indigo-900',
    premiumOnly: true,
  },
  'celestial-aurora': {
    label: 'Aurora Borealis',
    ringClass:
      'ring-[3px] ring-teal-300 shadow-[0_0_30px_rgba(45,212,191,0.75)]',
    previewColor: 'from-emerald-300 via-teal-400 to-indigo-500',
    premiumOnly: true,
  },
  'frost-crystal': {
    label: 'Frost Monarch Ice',
    ringClass:
      'ring-[3px] ring-sky-300 shadow-[0_0_28px_rgba(125,211,252,0.8)]',
    previewColor: 'from-cyan-200 via-sky-400 to-blue-600',
    premiumOnly: true,
  },
  'solar-flare': {
    label: 'Solar Nova Flare',
    ringClass:
      'ring-[3px] ring-orange-400 shadow-[0_0_30px_rgba(251,146,60,0.85)]',
    previewColor: 'from-yellow-300 via-orange-500 to-red-600',
    premiumOnly: true,
  },
  'amethyst-royal': {
    label: 'Royal Amethyst Nitro',
    ringClass:
      'ring-[3px] ring-fuchsia-400 shadow-[0_0_28px_rgba(232,121,249,0.75)]',
    previewColor: 'from-fuchsia-400 via-purple-500 to-indigo-600',
    premiumOnly: true,
  },
  'blood-moon': {
    label: 'Crimson Eclipse Aura',
    ringClass:
      'ring-[3px] ring-red-500 shadow-[0_0_30px_rgba(239,68,68,0.8)]',
    previewColor: 'from-red-500 via-rose-600 to-zinc-900',
    premiumOnly: true,
  },
  'rainbow-prism': {
    label: 'Rainbow Prism Nitro',
    ringClass:
      'ring-[3.5px] ring-amber-300 shadow-[0_0_32px_rgba(232,74,24,0.85)] animate-vip-prism',
    previewColor: 'from-rose-500 via-amber-400 via-emerald-400 to-sky-500',
    premiumOnly: true,
  },
};

export interface ProfileThemeDef {
  id: string;
  label: string;
  desc: string;
  shellClass: string;
  bannerGradientOverlay: string;
  cardClass: string;
  accentTextClass: string;
  previewSwatch: string;
  premiumOnly?: boolean;
}

export const PROFILE_THEMES: Record<string, ProfileThemeDef> = {
  default: {
    id: 'default',
    label: 'Standar ZoneStream',
    desc: 'Tampilan klasik bersih',
    shellClass: '',
    bannerGradientOverlay: 'from-[#F5F7FB] dark:from-[#090A0E] via-black/35 to-black/30',
    cardClass: 'bg-white dark:bg-[#13151C] border-slate-200 dark:border-white/[0.06]',
    accentTextClass: 'text-[#E84A18]',
    previewSwatch: 'from-slate-700 via-slate-800 to-slate-900',
  },
  'nitro-aurora': {
    id: 'nitro-aurora',
    label: 'Discord Nitro Aurora',
    desc: 'Gradien indigo & emerald bercahaya',
    shellClass:
      'rounded-b-3xl bg-gradient-to-b from-indigo-500/10 via-emerald-500/5 to-transparent dark:from-indigo-500/20 dark:via-teal-500/10 dark:to-transparent ring-1 ring-indigo-400/30 shadow-[0_0_45px_rgba(99,102,241,0.18)]',
    bannerGradientOverlay: 'from-[#0b1020] via-indigo-950/50 to-emerald-950/35',
    cardClass:
      'bg-white/90 dark:bg-[#101627]/95 border-indigo-400/30 dark:border-indigo-400/35 shadow-[0_0_24px_rgba(99,102,241,0.12)]',
    accentTextClass: 'text-indigo-500 dark:text-indigo-300',
    previewSwatch: 'from-indigo-500 via-teal-400 to-emerald-400',
    premiumOnly: true,
  },
  'cyber-neon': {
    id: 'cyber-neon',
    label: 'Cyberpunk Synthwave',
    desc: 'Cahaya neon cyan & magenta',
    shellClass:
      'rounded-b-3xl bg-gradient-to-b from-cyan-500/10 via-fuchsia-500/5 to-transparent dark:from-cyan-500/20 dark:via-fuchsia-600/15 dark:to-transparent ring-1 ring-cyan-400/40 shadow-[0_0_50px_rgba(34,211,238,0.2)]',
    bannerGradientOverlay: 'from-[#070b14] via-fuchsia-950/45 to-cyan-950/40',
    cardClass:
      'bg-white/95 dark:bg-[#0E1320]/95 border-cyan-400/35 dark:border-cyan-400/40 shadow-[0_0_24px_rgba(34,211,238,0.15)]',
    accentTextClass: 'text-cyan-500 dark:text-cyan-300',
    previewSwatch: 'from-cyan-400 via-sky-500 to-fuchsia-500',
    premiumOnly: true,
  },
  'crimson-eclipse': {
    id: 'crimson-eclipse',
    label: 'Crimson Eclipse',
    desc: 'Aura merah ruby gelap menyala',
    shellClass:
      'rounded-b-3xl bg-gradient-to-b from-rose-500/10 via-red-500/5 to-transparent dark:from-rose-600/20 dark:via-red-900/15 dark:to-transparent ring-1 ring-rose-500/35 shadow-[0_0_45px_rgba(244,63,94,0.2)]',
    bannerGradientOverlay: 'from-[#16070a] via-rose-950/50 to-black/40',
    cardClass:
      'bg-white/95 dark:bg-[#180F14]/95 border-rose-500/30 dark:border-rose-500/35 shadow-[0_0_24px_rgba(244,63,94,0.14)]',
    accentTextClass: 'text-rose-500 dark:text-rose-400',
    previewSwatch: 'from-red-600 via-rose-500 to-orange-500',
    premiumOnly: true,
  },
  'sovereign-gold': {
    id: 'sovereign-gold',
    label: 'Sovereign Gold Emperor',
    desc: 'Aura emas kaisar abadi eksklusif',
    shellClass:
      'rounded-b-3xl bg-gradient-to-b from-amber-500/12 via-orange-500/5 to-transparent dark:from-amber-500/20 dark:via-orange-600/10 dark:to-transparent ring-1 ring-amber-400/40 shadow-[0_0_50px_rgba(251,191,36,0.22)]',
    bannerGradientOverlay: 'from-[#141007] via-amber-950/40 to-black/35',
    cardClass:
      'bg-white/95 dark:bg-[#17140D]/95 border-amber-400/35 dark:border-amber-400/40 shadow-[0_0_26px_rgba(251,191,36,0.16)]',
    accentTextClass: 'text-amber-500 dark:text-amber-300',
    previewSwatch: 'from-yellow-300 via-amber-500 to-orange-600',
    premiumOnly: true,
  },
  'abyss-void': {
    id: 'abyss-void',
    label: 'Abyssal Void Shadow',
    desc: 'Gelap ungu kosmik misterius',
    shellClass:
      'rounded-b-3xl bg-gradient-to-b from-violet-600/10 via-purple-700/5 to-transparent dark:from-violet-600/22 dark:via-purple-950/20 dark:to-transparent ring-1 ring-violet-500/35 shadow-[0_0_48px_rgba(139,92,246,0.22)]',
    bannerGradientOverlay: 'from-[#0c0818] via-violet-950/55 to-black/40',
    cardClass:
      'bg-white/95 dark:bg-[#13101F]/95 border-violet-500/30 dark:border-violet-400/35 shadow-[0_0_24px_rgba(139,92,246,0.15)]',
    accentTextClass: 'text-violet-500 dark:text-violet-300',
    previewSwatch: 'from-violet-500 via-purple-600 to-indigo-900',
    premiumOnly: true,
  },
  'sakura-dream': {
    id: 'sakura-dream',
    label: 'Sakura Blossom Dream',
    desc: 'Nuansa pastel pink bunga sakura',
    shellClass:
      'rounded-b-3xl bg-gradient-to-b from-pink-400/12 via-rose-400/5 to-transparent dark:from-pink-500/20 dark:via-rose-500/10 dark:to-transparent ring-1 ring-pink-400/40 shadow-[0_0_45px_rgba(244,114,182,0.2)]',
    bannerGradientOverlay: 'from-[#180a14] via-pink-950/45 to-black/30',
    cardClass:
      'bg-white/95 dark:bg-[#1A1118]/95 border-pink-400/30 dark:border-pink-400/35 shadow-[0_0_22px_rgba(244,114,182,0.14)]',
    accentTextClass: 'text-pink-500 dark:text-pink-300',
    previewSwatch: 'from-pink-300 via-rose-400 to-fuchsia-500',
    premiumOnly: true,
  },
  'frost-monarch': {
    id: 'frost-monarch',
    label: 'Frost Monarch Ice',
    desc: 'Kristal es biru berkilau',
    shellClass:
      'rounded-b-3xl bg-gradient-to-b from-sky-400/12 via-blue-500/5 to-transparent dark:from-sky-500/20 dark:via-blue-900/15 dark:to-transparent ring-1 ring-sky-400/40 shadow-[0_0_45px_rgba(56,189,248,0.22)]',
    bannerGradientOverlay: 'from-[#07111c] via-sky-950/50 to-black/35',
    cardClass:
      'bg-white/95 dark:bg-[#0E1622]/95 border-sky-400/30 dark:border-sky-400/35 shadow-[0_0_24px_rgba(56,189,248,0.15)]',
    accentTextClass: 'text-sky-500 dark:text-sky-300',
    previewSwatch: 'from-cyan-200 via-sky-400 to-blue-700',
    premiumOnly: true,
  },
  'dragon-jade': {
    id: 'dragon-jade',
    label: 'Celestial Jade Immortal',
    desc: 'Aura giok kultivasi xianxia',
    shellClass:
      'rounded-b-3xl bg-gradient-to-b from-emerald-500/12 via-teal-500/5 to-transparent dark:from-emerald-500/20 dark:via-teal-900/15 dark:to-transparent ring-1 ring-emerald-400/35 shadow-[0_0_45px_rgba(16,185,129,0.2)]',
    bannerGradientOverlay: 'from-[#071612] via-emerald-950/50 to-black/35',
    cardClass:
      'bg-white/95 dark:bg-[#0D1A16]/95 border-emerald-400/30 dark:border-emerald-400/35 shadow-[0_0_24px_rgba(16,185,129,0.14)]',
    accentTextClass: 'text-emerald-500 dark:text-emerald-300',
    previewSwatch: 'from-emerald-300 via-teal-500 to-green-700',
    premiumOnly: true,
  },
  'galactic-prism': {
    id: 'galactic-prism',
    label: 'Galactic Prism Nitro',
    desc: 'Efek pelangi spektrum premium',
    shellClass:
      'rounded-b-3xl bg-gradient-to-b from-fuchsia-500/12 via-amber-500/5 to-transparent dark:from-fuchsia-500/20 dark:via-sky-500/12 dark:to-transparent ring-1 ring-fuchsia-400/40 shadow-[0_0_52px_rgba(217,70,239,0.22)]',
    bannerGradientOverlay: 'from-[#110a1a] via-purple-950/45 to-sky-950/35',
    cardClass:
      'bg-white/95 dark:bg-[#14111E]/95 border-fuchsia-400/35 dark:border-fuchsia-400/40 shadow-[0_0_26px_rgba(217,70,239,0.16)]',
    accentTextClass: 'text-fuchsia-500 dark:text-fuchsia-300',
    previewSwatch: 'from-rose-500 via-amber-400 via-emerald-400 to-violet-500',
    premiumOnly: true,
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [guestData, setGuestData] = useState(readGuestData);

  const getToken = () =>
    localStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY) || '';

  const loadSession = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      localStorage.setItem('zonestream_is_premium', 'false');
      setLoading(false);
      return;
    }

    try {
      const resp = await fetch('/api/user/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(LEGACY_TOKEN_KEY);
        setUser(null);
        localStorage.setItem('zonestream_is_premium', 'false');
      } else {
        const json = await resp.json();
        if (json.user) {
          setUser(json.user);
          localStorage.setItem('zonestream_is_premium', String(Boolean(json.user.isPremium)));
        }
      }
    } catch {
      // Keep token on transient network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const clearAuthError = () => setAuthError(null);

  const login = async (identifier: string, password: string): Promise<boolean> => {
    setAuthError(null);
    try {
      const resp = await fetch('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setAuthError(json.error || 'Login gagal');
        return false;
      }
      localStorage.setItem(TOKEN_STORAGE_KEY, json.token);
      setUser(json.user);
      localStorage.setItem('zonestream_is_premium', String(Boolean(json.user?.isPremium)));
      return true;
    } catch {
      setAuthError('Tidak dapat terhubung ke server');
      return false;
    }
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      const resp = await fetch('/api/user/firebase-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setAuthError(json.error || 'Gagal masuk dengan akun Google');
        return false;
      }
      localStorage.setItem(TOKEN_STORAGE_KEY, json.token);
      setUser(json.user);
      localStorage.setItem('zonestream_is_premium', String(Boolean(json.user?.isPremium)));
      return true;
    } catch (err: any) {
      const msg = String(err?.code || err?.message || '');
      if (msg.includes('popup-closed-by-user')) {
        setAuthError('Popup login Google ditutup sebelum selesai.');
      } else if (msg.includes('unauthorized-domain')) {
        setAuthError(
          'Domain belum terdaftar di Firebase Authorized Domains (tambahkan domain ini di Firebase Console -> Authentication -> Settings).'
        );
      } else {
        setAuthError('Login Google gagal diproses. Pastikan popup diizinkan atau gunakan Email & Password.');
      }
      return false;
    }
  };

  const register = async (
    username: string,
    email: string,
    name: string,
    password: string,
    code: string
  ): Promise<boolean> => {
    setAuthError(null);
    try {
      const resp = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, name, password, code }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setAuthError(json.error || 'Pendaftaran gagal');
        return false;
      }
      localStorage.setItem(TOKEN_STORAGE_KEY, json.token);
      setUser(json.user);
      localStorage.setItem('zonestream_is_premium', String(Boolean(json.user?.isPremium)));
      return true;
    } catch {
      setAuthError('Tidak dapat terhubung ke server');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.setItem('zonestream_is_premium', 'false');
    localStorage.removeItem('donghive_is_premium');
    firebaseSignOut(auth).catch(() => {});
    setUser(null);
  };

  const updateProfile = async (data: {
    name?: string;
    bio?: string;
    photoUrl?: string;
    bannerUrl?: string;
    activeBorder?: string;
    activeBadge?: string;
    profileTheme?: string;
    statusEmoji?: string;
    newPassword?: string;
  }): Promise<boolean> => {
    const token = getToken();
    if (!token) return false;
    try {
      const resp = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      const json = await resp.json();
      if (resp.ok && json.user) {
        setUser(json.user);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const toggleFounderAdPreview = async (): Promise<boolean> => {
    const token = getToken();
    if (!token) return false;
    try {
      const resp = await fetch('/api/user/toggle-ad-preview', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await resp.json();
      if (resp.ok && json.user) {
        setUser(json.user);
        localStorage.setItem('zonestream_is_premium', String(Boolean(json.user.isPremium)));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const recordWatchHistory = async (
    item: Omit<WatchHistoryItem, 'updatedAt'>
  ): Promise<WatchHistoryReward> => {
    const emptyReward: WatchHistoryReward = {
      expGained: 0,
      dailyBonusGained: 0,
      streak: 0,
      levelUp: false,
      newLevel: user?.level || 1,
      isDoubleExp: false,
    };
    const token = getToken();
    if (token) {
      try {
        const resp = await fetch('/api/user/history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(item),
        });
        const json = await resp.json();
        if (resp.ok && json.user) {
          setUser(json.user);
          return {
            expGained: Number(json.expGained) || 0,
            dailyBonusGained: Number(json.dailyBonusGained) || 0,
            streak: Number(json.streak) || 1,
            levelUp: Boolean(json.levelUp),
            newLevel: Number(json.newLevel) || json.user.level || 1,
            isDoubleExp: Boolean(json.isDoubleExp),
          };
        }
      } catch {
        // Fallback to local
      }
    }

    const filtered = guestData.history.filter((h) => h.id !== item.id);
    const nextHistory = [
      { ...item, updatedAt: new Date().toISOString() },
      ...filtered,
    ].slice(0, 20);
    const next = { ...guestData, history: nextHistory };
    setGuestData(next);
    writeGuestData(next);
    return emptyReward;
  };

  const toggleBookmark = async (item: Omit<BookmarkItem, 'addedAt'>): Promise<boolean> => {
    const token = getToken();
    if (token) {
      try {
        const resp = await fetch('/api/user/bookmark', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(item),
        });
        const json = await resp.json();
        if (resp.ok && json.user) {
          setUser(json.user);
          return Boolean(json.bookmarked);
        }
      } catch {
        // Fallback
      }
    }

    const exists = guestData.bookmarks.some(
      (b) => b.id === item.id && b.type === item.type
    );
    const nextBookmarks = exists
      ? guestData.bookmarks.filter((b) => !(b.id === item.id && b.type === item.type))
      : [{ ...item, addedAt: new Date().toISOString() }, ...guestData.bookmarks];
    const next = { ...guestData, bookmarks: nextBookmarks };
    setGuestData(next);
    writeGuestData(next);
    return !exists;
  };

  const getLocalHistory = () => (user ? user.watchHistory : guestData.history);
  const getLocalBookmarks = () => (user ? user.bookmarks : guestData.bookmarks);

  const isPremium = Boolean(user?.isPremium);

  return (
    <AuthContext.Provider
      value={{
        user,
        isPremium,
        loading,
        authError,
        clearAuthError,
        login,
        loginWithGoogle,
        register,
        logout,
        refreshUser: loadSession,
        updateProfile,
        toggleFounderAdPreview,
        recordWatchHistory,
        toggleBookmark,
        getLocalHistory,
        getLocalBookmarks,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
