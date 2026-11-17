import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { playSoundEffect } from '../utils/soundEffects';
import { logSessionEvent } from '../utils/sessionLogger';
import {
  acceptClanInvite,
  CLAN_INVITE_RESOLVED_EVENT,
  clearPendingClanInvite,
  getPendingClanInvite,
  type ClanInviteResolveResult,
} from '../utils/clanInvite';
import type {
  UserProfile,
  WatchHistoryItem,
  BookmarkItem,
  EpisodeBookmarkItem,
  WatchHistoryReward,
} from '../types';

const TOKEN_STORAGE_KEY = 'zonestream_session_token_v1';
const LEGACY_TOKEN_KEY = 'donghive_session_token_v1';
const GUEST_STORAGE_KEY = 'zonestream_guest_profile_v1';
const USER_CACHE_KEY = 'zonestream_user_cache_v2';

function readStoredToken(): string {
  try {
    const primary = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (primary) return primary;
    const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacy) {
      try {
        localStorage.setItem(TOKEN_STORAGE_KEY, legacy);
      } catch {
        // ignore migration write failure
      }
      return legacy;
    }
    return '';
  } catch {
    return '';
  }
}

function compactUserForStorage(u: UserProfile): UserProfile {
  const safePhoto =
    u.photoUrl && u.photoUrl.startsWith('data:image/') && u.photoUrl.length > 100_000
      ? ''
      : u.photoUrl;
  const safeBanner =
    u.bannerUrl && u.bannerUrl.startsWith('data:image/') && u.bannerUrl.length > 100_000
      ? ''
      : u.bannerUrl;
  return {
    ...u,
    photoUrl: safePhoto,
    bannerUrl: safeBanner,
    watchHistory: Array.isArray(u.watchHistory) ? u.watchHistory.slice(0, 15) : [],
  };
}

function writeCachedUser(u: UserProfile | null) {
  try {
    if (!u) {
      localStorage.removeItem(USER_CACHE_KEY);
    } else {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(compactUserForStorage(u)));
    }
  } catch {
    // Evict stale cache if localStorage quota is full so token writes never fail
    try {
      localStorage.removeItem(USER_CACHE_KEY);
    } catch {
      // Ignore storage restrictions
    }
  }
}

function readCachedUser(): UserProfile | null {
  try {
    const token = readStoredToken();
    if (!token) return null;
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

function safePersistToken(token: string, uid?: string, source = 'auth'): boolean {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    logSessionEvent('token_saved', {
      uid,
      hasJwt: true,
      hasFirebaseUser: Boolean(auth.currentUser),
      detail: { source },
    });
    return true;
  } catch (err) {
    // Recover from QuotaExceededError by clearing non-critical cache entries first
    try {
      localStorage.removeItem(USER_CACHE_KEY);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      logSessionEvent('token_storage_recovered', {
        level: 'warn',
        uid,
        hasJwt: true,
        detail: { source, reason: err instanceof Error ? err.message : 'quota_exceeded' },
      });
      return true;
    } catch (retryErr) {
      logSessionEvent('token_storage_recovered', {
        level: 'error',
        uid,
        hasJwt: false,
        detail: {
          source,
          failed: true,
          error: retryErr instanceof Error ? retryErr.message : String(retryErr),
        },
      });
      return false;
    }
  }
}

function clearStoredTokens(reason: string, uid?: string) {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
    localStorage.setItem('zonestream_is_premium', 'false');
    localStorage.removeItem('donghive_is_premium');
  } catch {
    // ignore storage errors
  }
  logSessionEvent('token_removed', {
    level: reason === 'explicit_logout' ? 'info' : 'warn',
    uid,
    hasJwt: false,
    hasFirebaseUser: Boolean(auth.currentUser),
    detail: { reason },
  });
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
    profileBgColor?: string;
    statusEmoji?: string;
    newPassword?: string;
  }) => Promise<boolean>;
  toggleFounderAdPreview: () => Promise<boolean>;
  recordWatchHistory: (item: Omit<WatchHistoryItem, 'updatedAt'>) => Promise<WatchHistoryReward>;
  recordWatchDuration: (
    minutes: number,
    meta?: { title?: string }
  ) => Promise<WatchHistoryReward>;
  applyUserSnapshot: (nextUser: UserProfile) => void;
  toggleBookmark: (item: Omit<BookmarkItem, 'addedAt'>) => Promise<boolean>;
  toggleEpisodeBookmark: (item: Omit<EpisodeBookmarkItem, 'addedAt'>) => Promise<boolean>;
  getLocalHistory: () => WatchHistoryItem[];
  getLocalBookmarks: () => BookmarkItem[];
  getLocalEpisodeBookmarks: () => EpisodeBookmarkItem[];
  lastClanInviteResult: ClanInviteResolveResult | null;
  clearLastClanInviteResult: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readGuestData(): {
  history: WatchHistoryItem[];
  bookmarks: BookmarkItem[];
  episodeBookmarks: EpisodeBookmarkItem[];
} {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return { history: [], bookmarks: [], episodeBookmarks: [] };
    const parsed = JSON.parse(raw);
    return {
      history: parsed.history || [],
      bookmarks: parsed.bookmarks || [],
      episodeBookmarks: parsed.episodeBookmarks || [],
    };
  } catch {
    return { history: [], bookmarks: [], episodeBookmarks: [] };
  }
}

function writeGuestData(data: {
  history: WatchHistoryItem[];
  bookmarks: BookmarkItem[];
  episodeBookmarks: EpisodeBookmarkItem[];
}) {
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
  'streak-ember': {
    label: 'Ember Pulse (3d Streak)',
    ringClass: 'ring-1 ring-orange-400/50',
    previewColor: 'from-orange-500 via-amber-400 to-red-600',
    premiumOnly: false,
  },
  'streak-aurora': {
    label: 'Aurora Prism (7d Streak)',
    ringClass: 'ring-1 ring-cyan-400/50',
    previewColor: 'from-cyan-400 via-emerald-400 to-purple-500',
    premiumOnly: false,
  },
  'streak-celestial': {
    label: 'Celestial Orbit (14d Streak)',
    ringClass: 'ring-1 ring-yellow-400/50',
    previewColor: 'from-amber-300 via-yellow-500 to-sky-500',
    premiumOnly: false,
  },
  'streak-eternal': {
    label: 'Eternal Phoenix (30d Streak)',
    ringClass: 'ring-1 ring-rose-500/50',
    previewColor: 'from-rose-500 via-amber-400 to-red-600',
    premiumOnly: false,
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
  const [lastClanInviteResult, setLastClanInviteResult] = useState<ClanInviteResolveResult | null>(null);
  const resolvingInviteRef = useRef<string | null>(null);
  const lastKnownLevelRef = useRef<{ uid: string; level: number } | null>(null);
  const sessionEpochRef = useRef<number>(0);
  const inFlightSessionRef = useRef<Promise<void> | null>(null);
  const explicitLogoutRef = useRef<boolean>(false);

  const setUser = useCallback((next: UserProfile | null) => {
    if (next) {
      const prev = lastKnownLevelRef.current;
      if (
        prev &&
        prev.uid === next.uid &&
        next.role !== 'founder' &&
        typeof next.level === 'number' &&
        next.level > prev.level
      ) {
        playSoundEffect('levelUp');
      }
      lastKnownLevelRef.current = { uid: next.uid, level: Number(next.level) || 1 };
    } else {
      lastKnownLevelRef.current = null;
    }
    setUserState(next);
    writeCachedUser(next);
  }, []);

  const getToken = () => readStoredToken();

  const exchangeFirebaseGoogleIdToken = useCallback(
    async (idToken: string, source = 'google_oauth'): Promise<boolean> => {
      const epochAtStart = sessionEpochRef.current;
      const resp = await fetch('/api/user/firebase-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setAuthError(json.error || 'Gagal masuk dengan akun Google');
        logSessionEvent('login_google_error', {
          level: 'warn',
          hasJwt: Boolean(readStoredToken()),
          hasFirebaseUser: Boolean(auth.currentUser),
          detail: { source, status: resp.status, error: json.error },
        });
        return false;
      }
      if (epochAtStart !== sessionEpochRef.current && explicitLogoutRef.current) {
        return false;
      }
      explicitLogoutRef.current = false;
      sessionEpochRef.current += 1;
      safePersistToken(json.token, json.user?.uid, source);
      setUser(json.user);
      try {
        localStorage.setItem('zonestream_is_premium', String(Boolean(json.user?.isPremium)));
      } catch {
        // ignore
      }
      logSessionEvent('login_google_success', {
        uid: json.user?.uid,
        hasJwt: true,
        hasFirebaseUser: Boolean(auth.currentUser),
        detail: { source, role: json.user?.role },
      });
      return true;
    },
    [setUser]
  );

  const loadSession = useCallback(async () => {
    if (inFlightSessionRef.current) {
      return inFlightSessionRef.current;
    }

    const run = (async () => {
      const epochAtStart = sessionEpochRef.current;
      const token = readStoredToken();
      if (!token) {
        if (epochAtStart === sessionEpochRef.current) {
          setUser(null);
          try {
            localStorage.setItem('zonestream_is_premium', 'false');
          } catch {
            // ignore
          }
          setLoading(false);
        }
        return;
      }

      logSessionEvent('session_restore_start', {
        hasJwt: true,
        hasFirebaseUser: Boolean(auth.currentUser),
        detail: { epoch: epochAtStart },
      });

      try {
        const manualOffline = localStorage.getItem('zonestream_manual_offline_v1') === 'true';
        const meUrl = manualOffline ? '/api/user/me?preserveOffline=1' : '/api/user/me';
        const resp = await fetch(meUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Guard against stale async completion if user logged in/out while request was in flight
        if (epochAtStart !== sessionEpochRef.current || readStoredToken() !== token) {
          return;
        }

        if (resp.ok) {
          const json = await resp.json();
          if (json.user) {
            setUser(json.user);
            try {
              localStorage.setItem('zonestream_is_premium', String(Boolean(json.user.isPremium)));
            } catch {
              // ignore
            }
            logSessionEvent('session_restore_ok', {
              uid: json.user.uid,
              hasJwt: true,
              hasFirebaseUser: Boolean(auth.currentUser),
            });
          }
          return;
        }

        // Only explicit 401 (expired/invalid JWT) or 403 banned should invalidate a stored session.
        // Never log out on 404/429/500/502/503/504 transient errors!
        if (resp.status === 403) {
          let errJson: any = null;
          try {
            errJson = await resp.json();
          } catch {
            // ignore JSON parse failure
          }
          if (errJson?.banned) {
            const banMsg = errJson.error || 'Akun Anda telah dibanned oleh Founder.';
            sessionEpochRef.current += 1;
            clearStoredTokens('http_403_banned', user?.uid);
            firebaseSignOut(auth).catch(() => {});
            setUser(null);
            setAuthError(banMsg);
            logSessionEvent('session_invalidated_banned', {
              level: 'error',
              hasJwt: false,
              detail: { status: 403, banReason: errJson.banReason || '' },
            });
            return;
          }
        }

        if (resp.status === 401) {
          // If Firebase Auth still has an active Google session, attempt seamless JWT recovery first
          if (auth.currentUser && !explicitLogoutRef.current) {
            try {
              const freshIdToken = await auth.currentUser.getIdToken(true);
              const recovered = await exchangeFirebaseGoogleIdToken(
                freshIdToken,
                'jwt_401_firebase_recovery'
              );
              if (recovered) {
                logSessionEvent('firebase_session_recovered', {
                  hasJwt: true,
                  hasFirebaseUser: true,
                  detail: { trigger: 'http_401' },
                });
                return;
              }
            } catch {
              // Fall through to explicit invalidation if Firebase token refresh also fails
            }
          }

          sessionEpochRef.current += 1;
          clearStoredTokens('http_401_unauthorized', user?.uid);
          firebaseSignOut(auth).catch(() => {});
          setUser(null);
          logSessionEvent('session_invalidated_401', {
            level: 'warn',
            hasJwt: false,
            detail: { status: 401 },
          });
          return;
        }

        // Transient HTTP errors (404/429/500/502/503/504): keep token & active session intact!
        logSessionEvent('session_preserved_on_transient_error', {
          level: 'warn',
          uid: user?.uid,
          hasJwt: true,
          hasFirebaseUser: Boolean(auth.currentUser),
          detail: { status: resp.status },
        });
      } catch (err) {
        // Network error / server restarting: preserve token & cached session
        logSessionEvent('session_preserved_on_transient_error', {
          level: 'warn',
          uid: user?.uid,
          hasJwt: Boolean(readStoredToken()),
          hasFirebaseUser: Boolean(auth.currentUser),
          detail: { error: err instanceof Error ? err.message : 'network_error' },
        });
      } finally {
        setLoading(false);
      }
    })();

    inFlightSessionRef.current = run;
    try {
      await run;
    } finally {
      if (inFlightSessionRef.current === run) {
        inFlightSessionRef.current = null;
      }
    }
  }, [setUser, exchangeFirebaseGoogleIdToken, user?.uid]);

  useEffect(() => {
    let active = true;
    const initialToken = readStoredToken();
    const initialCached = readCachedUser();

    logSessionEvent('session_init', {
      uid: initialCached?.uid,
      hasJwt: Boolean(initialToken),
      hasFirebaseUser: Boolean(auth.currentUser),
      detail: { hasCachedProfile: Boolean(initialCached) },
    });

    void (async () => {
      try {
        const redirectResult = await getRedirectResult(auth);
        if (active && redirectResult?.user) {
          logSessionEvent('firebase_redirect_result', {
            hasJwt: Boolean(readStoredToken()),
            hasFirebaseUser: true,
            detail: { email: redirectResult.user.email },
          });
          const idToken = await redirectResult.user.getIdToken();
          await exchangeFirebaseGoogleIdToken(idToken, 'google_redirect_result');
          setLoading(false);
          return;
        }
      } catch (err: any) {
        const msg = String(err?.code || err?.message || '');
        logSessionEvent('login_google_error', {
          level: 'warn',
          detail: { source: 'getRedirectResult', code: msg },
        });
        if (msg.includes('unauthorized-domain')) {
          setAuthError(
            'Domain belum terdaftar di Firebase Authorized Domains (tambahkan domain ini di Firebase Console -> Authentication -> Settings).'
          );
        }
      }
      if (active) {
        await loadSession();
      }
    })();

    // Monitor Firebase Auth state cleanly: recover Google sessions if JWT is missing,
    // and NEVER wipe Email/Password JWT sessions when fbUser is null.
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      if (!active) return;
      const currentJwt = readStoredToken();
      logSessionEvent('firebase_auth_state_changed', {
        hasJwt: Boolean(currentJwt),
        hasFirebaseUser: Boolean(fbUser),
        detail: {
          fbUid: fbUser?.uid || null,
          fbEmail: fbUser?.email || null,
          explicitLogout: explicitLogoutRef.current,
        },
      });

      if (fbUser && !currentJwt && !explicitLogoutRef.current) {
        void (async () => {
          try {
            const idToken = await fbUser.getIdToken();
            if (!active || readStoredToken() || explicitLogoutRef.current) return;
            const ok = await exchangeFirebaseGoogleIdToken(idToken, 'onAuthStateChanged_recovery');
            if (ok) {
              logSessionEvent('firebase_session_recovered', {
                hasJwt: true,
                hasFirebaseUser: true,
                detail: { trigger: 'onAuthStateChanged' },
              });
            }
          } catch {
            // ignore silent recovery errors
          } finally {
            if (active) setLoading(false);
          }
        })();
      }
    });

    // Cross-tab localStorage synchronization
    const onStorageChange = (e: StorageEvent) => {
      if (e.key !== TOKEN_STORAGE_KEY) return;
      logSessionEvent('cross_tab_storage_sync', {
        hasJwt: Boolean(e.newValue),
        detail: { hadOldValue: Boolean(e.oldValue), hasNewValue: Boolean(e.newValue) },
      });
      if (!e.newValue) {
        sessionEpochRef.current += 1;
        setUser(null);
      } else if (e.newValue !== e.oldValue) {
        sessionEpochRef.current += 1;
        void loadSession();
      }
    };
    window.addEventListener('storage', onStorageChange);

    return () => {
      active = false;
      unsubscribeAuth();
      window.removeEventListener('storage', onStorageChange);
    };
  }, [loadSession, exchangeFirebaseGoogleIdToken, setUser]);

  // Real-time session heartbeat: detect ban / role / VIP changes reliably without aggressive polling
  useEffect(() => {
    if (!user) return;
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadSession();
      }
    }, 15_000);
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadSession();
      }
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [user?.uid, loadSession]);

  // Real-time auto-join clan whenever a pending recruit invite exists and the user becomes authenticated
  useEffect(() => {
    if (!user?.uid) return;
    const pendingCode = getPendingClanInvite();
    if (!pendingCode) return;
    const attemptKey = `${user.uid}:${pendingCode}`;
    if (resolvingInviteRef.current === attemptKey) return;

    const token = readStoredToken();
    if (!token) return;

    resolvingInviteRef.current = attemptKey;
    clearPendingClanInvite();

    void (async () => {
      const result = await acceptClanInvite(pendingCode, token);
      setLastClanInviteResult(result);
      if (result.ok && !result.alreadyMember) {
        playSoundEffect('notification');
      }
      window.dispatchEvent(new CustomEvent(CLAN_INVITE_RESOLVED_EVENT, { detail: result }));
      if (resolvingInviteRef.current === attemptKey) {
        resolvingInviteRef.current = null;
      }
    })();
  }, [user?.uid]);

  const clearAuthError = () => setAuthError(null);
  const clearLastClanInviteResult = useCallback(() => setLastClanInviteResult(null), []);

  const login = async (identifier: string, password: string): Promise<boolean> => {
    setAuthError(null);
    explicitLogoutRef.current = false;
    try {
      const resp = await fetch('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setAuthError(json.error || 'Login gagal');
        logSessionEvent('login_password_failed', {
          level: 'warn',
          detail: { status: resp.status, error: json.error },
        });
        return false;
      }
      sessionEpochRef.current += 1;
      safePersistToken(json.token, json.user?.uid, 'login_password');
      setUser(json.user);
      try {
        localStorage.setItem('zonestream_is_premium', String(Boolean(json.user?.isPremium)));
      } catch {
        // ignore
      }
      logSessionEvent('login_password_success', {
        uid: json.user?.uid,
        hasJwt: true,
        detail: { role: json.user?.role },
      });
      return true;
    } catch {
      setAuthError('Tidak dapat terhubung ke server');
      return false;
    }
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    // Trigger signInWithPopup synchronously before any React state update so the browser preserves user activation
    const popupPromise = signInWithPopup(auth, googleProvider);
    explicitLogoutRef.current = false;
    setAuthError(null);
    logSessionEvent('login_google_popup_start', {
      hasJwt: Boolean(readStoredToken()),
      hasFirebaseUser: Boolean(auth.currentUser),
    });
    try {
      const result = await popupPromise;
      const idToken = await result.user.getIdToken();
      return await exchangeFirebaseGoogleIdToken(idToken, 'google_popup');
    } catch (err: any) {
      const msg = String(err?.code || err?.message || '');
      logSessionEvent('login_google_error', {
        level: 'warn',
        detail: { source: 'google_popup', code: msg },
      });
      if (msg.includes('popup-blocked') || msg.includes('cancelled-popup-request')) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return false;
        } catch {
          setAuthError(
            'Pop-up diblokir oleh browser. Izinkan pop-up untuk situs ini di ikon kanan atas address bar atau gunakan Email & Password.'
          );
          return false;
        }
      } else if (msg.includes('popup-closed-by-user')) {
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
    explicitLogoutRef.current = false;
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
      sessionEpochRef.current += 1;
      safePersistToken(json.token, json.user?.uid, 'register');
      setUser(json.user);
      try {
        localStorage.setItem('zonestream_is_premium', String(Boolean(json.user?.isPremium)));
      } catch {
        // ignore
      }
      logSessionEvent('register_success', {
        uid: json.user?.uid,
        hasJwt: true,
      });
      return true;
    } catch {
      setAuthError('Tidak dapat terhubung ke server');
      return false;
    }
  };

  const logout = () => {
    const prevUid = user?.uid;
    explicitLogoutRef.current = true;
    sessionEpochRef.current += 1;
    clearStoredTokens('explicit_logout', prevUid);
    firebaseSignOut(auth).catch(() => {});
    setUser(null);
    logSessionEvent('explicit_logout', {
      uid: prevUid,
      hasJwt: false,
      hasFirebaseUser: false,
    });
  };

  const updateProfile = async (data: {
    name?: string;
    bio?: string;
    photoUrl?: string;
    bannerUrl?: string;
    activeBorder?: string;
    activeBadge?: string;
    profileTheme?: string;
    profileBgColor?: string;
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
        ...(typeof data.profileBgColor === 'string'
          ? { profileBgColor: data.profileBgColor }
          : {}),
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
            longestStreak: Number(json.longestStreak) || Number(json.streak) || 1,
            levelUp: Boolean(json.levelUp),
            newLevel: Number(json.newLevel) || json.user.level || 1,
            coinsGained: Number(json.coinsGained) || 0,
            newCoins: Number(json.newCoins) || json.user.coins || 0,
            isDoubleExp: Boolean(json.isDoubleExp),
            newlyUnlockedFrame: json.newlyUnlockedFrame || null,
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

  const recordWatchDuration = async (
    minutes: number,
    meta?: { title?: string }
  ): Promise<WatchHistoryReward> => {
    const emptyReward: WatchHistoryReward = {
      expGained: 0,
      dailyBonusGained: 0,
      streak: user?.watchStreak || 1,
      levelUp: false,
      newLevel: user?.level || 1,
      coinsGained: 0,
      newCoins: user?.coins || 0,
      isDoubleExp: false,
    };
    const token = getToken();
    if (!token) return emptyReward;
    try {
      const resp = await fetch('/api/user/watch-duration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          minutes: Math.max(1, Math.round(minutes || 1)),
          title: meta?.title || 'Anime',
        }),
      });
      const json = await resp.json();
      if (resp.ok && json.user) {
        setUser(json.user);
        return {
          expGained: Number(json.expGained) || 0,
          dailyBonusGained: 0,
          streak: json.user.watchStreak || 1,
          levelUp: Boolean(json.levelUp),
          newLevel: Number(json.newLevel) || json.user.level || 1,
          coinsGained: Number(json.coinsGained) || 0,
          newCoins: Number(json.newCoins) || json.user.coins || 0,
          isDoubleExp: Boolean(json.isDoubleExp),
        };
      }
    } catch {
      // Ignore transient network error
    }
    return emptyReward;
  };

  const applyUserSnapshot = useCallback(
    (nextUser: UserProfile) => {
      if (nextUser && nextUser.uid) {
        setUser(nextUser);
      }
    },
    [setUser]
  );

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
          window.dispatchEvent(new CustomEvent('zonestream:bookmarks-changed'));
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
    window.dispatchEvent(new CustomEvent('zonestream:bookmarks-changed'));
    return !exists;
  };

  const toggleEpisodeBookmark = async (
    item: Omit<EpisodeBookmarkItem, 'addedAt'>
  ): Promise<boolean> => {
    const token = getToken();
    if (token) {
      try {
        const resp = await fetch('/api/user/episode-bookmark', {
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

    const currentEps = guestData.episodeBookmarks || [];
    const exists = currentEps.some((b) => b.episodeId === item.episodeId);
    const nextEps = exists
      ? currentEps.filter((b) => b.episodeId !== item.episodeId)
      : [{ ...item, addedAt: new Date().toISOString() }, ...currentEps];
    const next = { ...guestData, episodeBookmarks: nextEps };
    setGuestData(next);
    writeGuestData(next);
    return !exists;
  };

  const getLocalHistory = () => (user ? user.watchHistory : guestData.history);
  const getLocalBookmarks = () => (user ? user.bookmarks : guestData.bookmarks);
  const getLocalEpisodeBookmarks = () =>
    user ? user.episodeBookmarks || [] : guestData.episodeBookmarks || [];

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
        recordWatchDuration,
        applyUserSnapshot,
        toggleBookmark,
        toggleEpisodeBookmark,
        getLocalHistory,
        getLocalBookmarks,
        getLocalEpisodeBookmarks,
        lastClanInviteResult,
        clearLastClanInviteResult,
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
