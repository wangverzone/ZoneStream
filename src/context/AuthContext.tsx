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
const USER_CACHE_KEY = 'zonestream_user_cache_v2';

function readCachedUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

function writeCachedUser(u: UserProfile | null) {
  try {
    if (!u) {
      localStorage.removeItem(USER_CACHE_KEY);
    } else {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
    }
  } catch {
    // Ignore storage quota issues
  }
}

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
  'dragon-crown': {
    label: 'Sovereign Dragon Crown',
    ringClass: 'ring-1 ring-amber-400/40',
    previewColor: 'from-amber-300 via-yellow-500 to-orange-600',
    premiumOnly: true,
  },
  'cat-ears': {
    label: 'Cyber Neko Headset',
    ringClass: 'ring-1 ring-pink-400/40',
    previewColor: 'from-pink-400 via-rose-500 to-indigo-500',
    premiumOnly: true,
  },
  'kitsune-ears': {
    label: 'Nine-Tail Kitsune Spirit',
    ringClass: 'ring-1 ring-rose-400/40',
    previewColor: 'from-rose-400 via-red-500 to-sky-400',
    premiumOnly: true,
  },
  'angel-wings': {
    label: 'Seraphim Celestial Wings',
    ringClass: 'ring-1 ring-sky-300/40',
    previewColor: 'from-sky-200 via-cyan-300 to-blue-500',
    premiumOnly: true,
  },
  'lightning-aura': {
    label: 'Thunder God Aureole',
    ringClass: 'ring-1 ring-purple-400/40',
    previewColor: 'from-purple-400 via-violet-500 to-amber-300',
    premiumOnly: true,
  },
  'sakura-wreath': {
    label: 'Sakura Blossom Wreath',
    ringClass: 'ring-1 ring-pink-300/40',
    previewColor: 'from-pink-300 via-rose-400 to-pink-600',
    premiumOnly: true,
  },
  'sword-lotus': {
    label: 'Immortal Flying Swords',
    ringClass: 'ring-1 ring-emerald-400/40',
    previewColor: 'from-emerald-300 via-teal-500 to-green-700',
    premiumOnly: true,
  },
  'shadow-horns': {
    label: 'Abyssal Monarch Horns',
    ringClass: 'ring-1 ring-violet-500/40',
    previewColor: 'from-violet-500 via-purple-700 to-slate-900',
    premiumOnly: true,
  },
  'cyber-visor': {
    label: 'Mecha Tactical HUD',
    ringClass: 'ring-1 ring-cyan-400/40',
    previewColor: 'from-cyan-300 via-sky-500 to-blue-700',
    premiumOnly: true,
  },
  'frost-crown': {
    label: 'Glacial Ice Diadem',
    ringClass: 'ring-1 ring-cyan-200/40',
    previewColor: 'from-cyan-100 via-sky-300 to-blue-500',
    premiumOnly: true,
  },
  'astral-orbit': {
    label: 'Cosmic Starlight Orbit',
    ringClass: 'ring-1 ring-indigo-400/40',
    previewColor: 'from-indigo-300 via-violet-500 to-amber-300',
    premiumOnly: true,
  },
  none: {
    label: 'Polos (Tanpa Dekorasi)',
    ringClass: 'ring-1 ring-white/15',
    previewColor: 'from-slate-600 to-slate-800',
  },
  classic: {
    label: 'Polos (Tanpa Dekorasi)',
    ringClass: 'ring-1 ring-white/15',
    previewColor: 'from-slate-600 to-slate-800',
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
    desc: 'Studio sinematik gelap bersih',
    shellClass: '',
    bannerGradientOverlay: 'from-[#F5F7FB] dark:from-[#090A0E] via-[#090A0E]/45 to-black/25',
    cardClass: 'bg-white dark:bg-[#13151C] border-slate-200 dark:border-white/[0.07]',
    accentTextClass: 'text-[#E84A18]',
    previewSwatch: 'from-slate-700 via-slate-800 to-slate-900',
  },
  'sovereign-gold': {
    id: 'sovereign-gold',
    label: 'Sovereign Gold',
    desc: 'Aksen kultivator kaisar emas',
    shellClass: 'bg-gradient-to-b from-amber-500/[0.06] via-transparent to-transparent',
    bannerGradientOverlay: 'from-[#F5F7FB] dark:from-[#090A0E] via-[#120F08]/60 to-black/30',
    cardClass: 'bg-white dark:bg-[#141310] border-amber-500/20 dark:border-amber-500/20',
    accentTextClass: 'text-amber-500 dark:text-amber-400',
    previewSwatch: 'from-amber-400 via-yellow-500 to-orange-600',
    premiumOnly: true,
  },
  'nitro-aurora': {
    id: 'nitro-aurora',
    label: 'Midnight Indigo',
    desc: 'Nuansa indigo & cyan elegan',
    shellClass: 'bg-gradient-to-b from-indigo-500/[0.06] via-transparent to-transparent',
    bannerGradientOverlay: 'from-[#F5F7FB] dark:from-[#090A0E] via-[#0B1020]/60 to-black/30',
    cardClass: 'bg-white dark:bg-[#111522] border-indigo-500/20 dark:border-indigo-400/20',
    accentTextClass: 'text-indigo-500 dark:text-indigo-400',
    previewSwatch: 'from-indigo-500 via-sky-500 to-teal-400',
    premiumOnly: true,
  },
  'cyber-neon': {
    id: 'cyber-neon',
    label: 'Cyber Mecha',
    desc: 'Permukaan biru siber masa depan',
    shellClass: 'bg-gradient-to-b from-cyan-500/[0.06] via-transparent to-transparent',
    bannerGradientOverlay: 'from-[#F5F7FB] dark:from-[#090A0E] via-[#08131C]/60 to-black/30',
    cardClass: 'bg-white dark:bg-[#101720] border-cyan-500/20 dark:border-cyan-400/20',
    accentTextClass: 'text-cyan-500 dark:text-cyan-400',
    previewSwatch: 'from-cyan-400 via-sky-500 to-indigo-600',
    premiumOnly: true,
  },
  'crimson-eclipse': {
    id: 'crimson-eclipse',
    label: 'Crimson Ember',
    desc: 'Aksen merah bara sinematik',
    shellClass: 'bg-gradient-to-b from-rose-500/[0.06] via-transparent to-transparent',
    bannerGradientOverlay: 'from-[#F5F7FB] dark:from-[#090A0E] via-[#170A0E]/60 to-black/30',
    cardClass: 'bg-white dark:bg-[#171115] border-rose-500/20 dark:border-rose-500/20',
    accentTextClass: 'text-rose-500 dark:text-rose-400',
    previewSwatch: 'from-rose-500 via-red-600 to-orange-600',
    premiumOnly: true,
  },
  'abyss-void': {
    id: 'abyss-void',
    label: 'Abyssal Monarch',
    desc: 'Ungu gelap shadow monarch',
    shellClass: 'bg-gradient-to-b from-violet-500/[0.06] via-transparent to-transparent',
    bannerGradientOverlay: 'from-[#F5F7FB] dark:from-[#090A0E] via-[#110B1D]/60 to-black/30',
    cardClass: 'bg-white dark:bg-[#14111D] border-violet-500/20 dark:border-violet-400/20',
    accentTextClass: 'text-violet-500 dark:text-violet-400',
    previewSwatch: 'from-violet-500 via-purple-600 to-slate-900',
    premiumOnly: true,
  },
  'sakura-dream': {
    id: 'sakura-dream',
    label: 'Sakura Twilight',
    desc: 'Sentuhan bunga sakura malam',
    shellClass: 'bg-gradient-to-b from-pink-500/[0.06] via-transparent to-transparent',
    bannerGradientOverlay: 'from-[#F5F7FB] dark:from-[#090A0E] via-[#180C14]/60 to-black/30',
    cardClass: 'bg-white dark:bg-[#181217] border-pink-500/20 dark:border-pink-400/20',
    accentTextClass: 'text-pink-500 dark:text-pink-400',
    previewSwatch: 'from-pink-400 via-rose-500 to-purple-600',
    premiumOnly: true,
  },
  'frost-monarch': {
    id: 'frost-monarch',
    label: 'Glacial Frost',
    desc: 'Biru es glasial tenang',
    shellClass: 'bg-gradient-to-b from-sky-500/[0.06] via-transparent to-transparent',
    bannerGradientOverlay: 'from-[#F5F7FB] dark:from-[#090A0E] via-[#09131E]/60 to-black/30',
    cardClass: 'bg-white dark:bg-[#101620] border-sky-500/20 dark:border-sky-400/20',
    accentTextClass: 'text-sky-500 dark:text-sky-400',
    previewSwatch: 'from-sky-300 via-blue-500 to-indigo-700',
    premiumOnly: true,
  },
  'dragon-jade': {
    id: 'dragon-jade',
    label: 'Immortal Jade',
    desc: 'Hijau giok sekte abadi',
    shellClass: 'bg-gradient-to-b from-emerald-500/[0.06] via-transparent to-transparent',
    bannerGradientOverlay: 'from-[#F5F7FB] dark:from-[#090A0E] via-[#081511]/60 to-black/30',
    cardClass: 'bg-white dark:bg-[#101815] border-emerald-500/20 dark:border-emerald-400/20',
    accentTextClass: 'text-emerald-500 dark:text-emerald-400',
    previewSwatch: 'from-emerald-400 via-teal-500 to-green-800',
    premiumOnly: true,
  },
  'galactic-prism': {
    id: 'galactic-prism',
    label: 'Astral Nebula',
    desc: 'Kosmik bintang gelap',
    shellClass: 'bg-gradient-to-b from-purple-500/[0.06] via-transparent to-transparent',
    bannerGradientOverlay: 'from-[#F5F7FB] dark:from-[#090A0E] via-[#120C1C]/60 to-black/30',
    cardClass: 'bg-white dark:bg-[#14121C] border-purple-500/20 dark:border-purple-400/20',
    accentTextClass: 'text-purple-500 dark:text-purple-400',
    previewSwatch: 'from-indigo-500 via-purple-500 to-pink-500',
    premiumOnly: true,
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(readCachedUser);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [guestData, setGuestData] = useState(readGuestData);

  const setUser = useCallback((next: UserProfile | null) => {
    setUserState(next);
    writeCachedUser(next);
  }, []);

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
  }, [setUser]);

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
    // Optimistically update local state & cache immediately so navigating back to /profile never shows stale state
    setUserState((prev) => {
      if (!prev) return prev;
      const optimistic: UserProfile = {
        ...prev,
        ...(typeof data.name === 'string' ? { name: data.name } : {}),
        ...(typeof data.bio === 'string' ? { bio: data.bio } : {}),
        ...(typeof data.photoUrl === 'string' ? { photoUrl: data.photoUrl } : {}),
        ...(typeof data.bannerUrl === 'string' ? { bannerUrl: data.bannerUrl } : {}),
        ...(typeof data.activeBorder === 'string' ? { activeBorder: data.activeBorder } : {}),
        ...(typeof data.activeBadge === 'string' ? { activeBadge: data.activeBadge } : {}),
        ...(typeof data.profileTheme === 'string' ? { profileTheme: data.profileTheme } : {}),
        ...(typeof data.statusEmoji === 'string' ? { statusEmoji: data.statusEmoji } : {}),
      };
      writeCachedUser(optimistic);
      return optimistic;
    });
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
      return true;
    } catch {
      return true;
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
