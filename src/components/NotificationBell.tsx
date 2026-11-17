import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  CornerDownRight,
  Heart,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tv,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { resolveFallbackPosterUrl } from './MediaCard';
import type { MediaCardItem, UserNotificationItem, UserNotificationType } from '../types';
import { useAppLanguage } from '../utils/language';
import { playSoundEffect } from '../utils/soundEffects';
import {
  FAVORITE_BOOKMARKS_CHANGED_EVENT,
  markAllFirestoreEpisodeAlertsAsRead,
  markFirestoreEpisodeAlertAsRead,
  subscribeToFirestoreEpisodeAlerts,
  syncFavoriteEpisodesWithFirestore,
} from '../utils/firestoreEpisodeAlerts';

const STREAM_SEEN_KEY = 'zonestream_seen_stream_notifs_v3';
const STREAM_INIT_KEY = 'zonestream_seen_stream_init_v3';

// Shared in-memory cache so header & page bells don't duplicate /api/stream/home calls
let sharedLatestEpisodes: MediaCardItem[] = [];
let sharedStreamFetchedAt = 0;
let sharedStreamPromise: Promise<MediaCardItem[]> | null = null;

async function fetchSharedLatestEpisodes(force = false): Promise<MediaCardItem[]> {
  const now = Date.now();
  if (!force && sharedLatestEpisodes.length > 0 && now - sharedStreamFetchedAt < 45_000) {
    return sharedLatestEpisodes;
  }
  if (!force && sharedStreamPromise) {
    return sharedStreamPromise;
  }
  const url = force ? '/api/stream/home?refresh=1' : '/api/stream/home';
  sharedStreamPromise = fetch(url)
    .then((r) => r.json())
    .then((json) => {
      if (json?.ok && Array.isArray(json.latestEpisodes)) {
        sharedLatestEpisodes = json.latestEpisodes.slice(0, 14);
        sharedStreamFetchedAt = Date.now();
      }
      return sharedLatestEpisodes;
    })
    .catch(() => sharedLatestEpisodes)
    .finally(() => {
      sharedStreamPromise = null;
    });
  return sharedStreamPromise;
}

function getSessionToken(): string {
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

function formatRelativeTime(iso: string, isEn: boolean): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return isEn ? 'Just now' : 'Baru saja';
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return isEn ? `${mins}m ago` : `${mins} mnt lalu`;
  }
  if (diffSec < 86400) {
    const hrs = Math.floor(diffSec / 3600);
    return isEn ? `${hrs}h ago` : `${hrs} jam lalu`;
  }
  const days = Math.floor(diffSec / 86400);
  return isEn ? `${days}d ago` : `${days} hari lalu`;
}

function getNotificationIcon(type: UserNotificationType) {
  switch (type) {
    case 'favorite_episode':
      return {
        Icon: Tv,
        bg: 'bg-[#E84A18]/15 text-[#E84A18] border-[#E84A18]/30',
      };
    case 'comment_reply':
      return {
        Icon: CornerDownRight,
        bg: 'bg-sky-500/15 text-sky-500 border-sky-500/30',
      };
    case 'comment_like':
      return {
        Icon: Heart,
        bg: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
      };
    case 'friend_request':
      return {
        Icon: UserPlus,
        bg: 'bg-violet-500/15 text-violet-500 border-violet-500/30',
      };
    case 'friend_accept':
      return {
        Icon: UserCheck,
        bg: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
      };
    case 'clan_review':
      return {
        Icon: ShieldCheck,
        bg: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
      };
    default:
      return {
        Icon: Sparkles,
        bg: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
      };
  }
}

export function NotificationBell({
  compact = false,
  className = '',
}: {
  compact?: boolean;
  className?: string;
}) {
  const { user, getLocalBookmarks } = useAuth();
  const { lang } = useAppLanguage();
  const navigate = useNavigate();
  const isEn = lang === 'en';

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'activity' | 'releases'>('activity');
  const [notifications, setNotifications] = useState<UserNotificationItem[]>([]);
  const [firestoreAlerts, setFirestoreAlerts] = useState<UserNotificationItem[]>([]);
  const [liveEpisodeToast, setLiveEpisodeToast] = useState<UserNotificationItem | null>(null);
  const [unreadActivityCount, setUnreadActivityCount] = useState(0);
  const [latestReleases, setLatestReleases] = useState<MediaCardItem[]>(() => sharedLatestEpisodes);
  const [seenReleaseIds, setSeenReleaseIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STREAM_SEEN_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const seenNotifIdsRef = useRef<{ uid: string; ids: Set<string> } | null>(null);

  const loadPersonalNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadActivityCount(0);
      seenNotifIdsRef.current = null;
      return;
    }
    const token = getSessionToken();
    if (!token) return;
    try {
      const res = await fetch('/api/user/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.ok && Array.isArray(json.notifications)) {
        const incoming: UserNotificationItem[] = json.notifications;
        const tracker = seenNotifIdsRef.current;
        if (!tracker || tracker.uid !== user.uid) {
          seenNotifIdsRef.current = {
            uid: user.uid,
            ids: new Set(incoming.map((n) => n._id)),
          };
        } else {
          let hasNewUnread = false;
          for (const n of incoming) {
            if (!tracker.ids.has(n._id)) {
              tracker.ids.add(n._id);
              if (!n.isRead) {
                hasNewUnread = true;
              }
            }
          }
          if (hasNewUnread) {
            playSoundEffect('notification');
          }
        }
        setNotifications(incoming);
        setUnreadActivityCount(Number(json.unreadCount) || 0);
      }
    } catch {
      // Ignore transient poll errors
    }
  }, [user?.uid]);

  const loadStreamReleases = useCallback(async (force = false) => {
    const items = await fetchSharedLatestEpisodes(force);
    setLatestReleases(items);
  }, []);

  const refreshAll = useCallback(
    async (force = false) => {
      setSyncing(true);
      await Promise.all([loadStreamReleases(force), loadPersonalNotifications()]);
      setSyncing(false);
    },
    [loadPersonalNotifications, loadStreamReleases]
  );

  // Subscribe to Firebase Firestore real-time favorite episode alerts (`/users/{uid}/episode_alerts`)
  useEffect(() => {
    const unsub = subscribeToFirestoreEpisodeAlerts(isEn, (incomingFsAlerts) => {
      setFirestoreAlerts(incomingFsAlerts);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [user?.uid, isEn]);

  // Sync favorited anime/donghua bookmarks with newly uploaded episodes in Firebase Firestore
  const runFirestoreFavoriteSync = useCallback(async () => {
    const bookmarks = getLocalBookmarks();
    if (!bookmarks.length || !latestReleases.length) return;
    try {
      const { allAlerts, newlyUploadedAlerts } = await syncFavoriteEpisodesWithFirestore({
        user,
        bookmarks,
        latestEpisodes: latestReleases,
        isEn,
      });
      setFirestoreAlerts((prev) => (prev.length >= allAlerts.length ? prev : allAlerts));
      if (newlyUploadedAlerts.length > 0 && !compact) {
        playSoundEffect('notification');
        setLiveEpisodeToast(newlyUploadedAlerts[0]);
      }
    } catch {
      // Ignore transient Firestore sync errors
    }
  }, [user, getLocalBookmarks, latestReleases, isEn, compact]);

  useEffect(() => {
    void runFirestoreFavoriteSync();
  }, [runFirestoreFavoriteSync, user?.bookmarks?.length]);

  useEffect(() => {
    const onBookmarksChanged = () => {
      void runFirestoreFavoriteSync();
      void loadPersonalNotifications();
    };
    window.addEventListener(FAVORITE_BOOKMARKS_CHANGED_EVENT, onBookmarksChanged);
    return () => {
      window.removeEventListener(FAVORITE_BOOKMARKS_CHANGED_EVENT, onBookmarksChanged);
    };
  }, [runFirestoreFavoriteSync, loadPersonalNotifications]);

  useEffect(() => {
    if (!liveEpisodeToast) return;
    const t = setTimeout(() => setLiveEpisodeToast(null), 7000);
    return () => clearTimeout(t);
  }, [liveEpisodeToast]);

  // Initial sync & live background polling
  useEffect(() => {
    loadStreamReleases(false);
    loadPersonalNotifications();

    const interval = setInterval(() => {
      loadPersonalNotifications();
      loadStreamReleases(true);
    }, 15_000);

    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        loadPersonalNotifications();
      }
    };
    window.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadPersonalNotifications, loadStreamReleases]);

  // Seed seen live releases once so only newly arrived releases show as unread
  const releaseItems = useMemo(
    () =>
      latestReleases.slice(0, 12).map((ep) => ({
        ...ep,
        notifKey: `${ep.type}:${ep.id}:${ep.episodeId || ep.episodeLabel || 'latest'}`,
      })),
    [latestReleases]
  );

  useEffect(() => {
    if (releaseItems.length === 0) return;
    try {
      const initialized = localStorage.getItem(STREAM_INIT_KEY);
      if (!initialized) {
        const olderKeys = releaseItems.slice(2).map((x) => x.notifKey);
        localStorage.setItem(STREAM_INIT_KEY, '1');
        localStorage.setItem(STREAM_SEEN_KEY, JSON.stringify(olderKeys));
        setSeenReleaseIds(olderKeys);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [releaseItems]);

  const unreadReleaseCount = useMemo(() => {
    const seen = new Set(seenReleaseIds);
    return releaseItems.filter((item) => !seen.has(item.notifKey)).length;
  }, [releaseItems, seenReleaseIds]);

  const mergedNotifications = useMemo(() => {
    const byLink = new Map<string, UserNotificationItem>();
    for (const fsItem of firestoreAlerts) {
      byLink.set(fsItem.link || fsItem._id, fsItem);
    }
    for (const item of notifications) {
      const key = item.type === 'favorite_episode' ? item.link || item._id : item._id;
      if (!byLink.has(key)) {
        byLink.set(key, item);
      } else if (item.isRead) {
        const existing = byLink.get(key)!;
        byLink.set(key, { ...existing, isRead: true });
      }
    }
    return Array.from(byLink.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [firestoreAlerts, notifications]);

  const unreadMergedActivityCount = useMemo(
    () => mergedNotifications.filter((n) => !n.isRead).length,
    [mergedNotifications]
  );

  const totalUnread = Math.max(unreadActivityCount, unreadMergedActivityCount) + unreadReleaseCount;

  const markReleasesAsRead = useCallback(
    (keysToMark?: string[]) => {
      const target = keysToMark || releaseItems.map((x) => x.notifKey);
      setSeenReleaseIds((prev) => {
        const merged = Array.from(new Set([...prev, ...target])).slice(-200);
        try {
          localStorage.setItem(STREAM_SEEN_KEY, JSON.stringify(merged));
        } catch {
          // Ignore storage quota
        }
        return merged;
      });
    },
    [releaseItems]
  );

  const handleMarkSingleRead = async (item: UserNotificationItem) => {
    if (!item.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n._id === item._id || n.link === item.link ? { ...n, isRead: true } : n))
      );
      setFirestoreAlerts((prev) =>
        prev.map((n) => (n._id === item._id || n.link === item.link ? { ...n, isRead: true } : n))
      );
      setUnreadActivityCount((c) => Math.max(0, c - 1));
      void markFirestoreEpisodeAlertAsRead(user?.uid || 'guest', item._id).catch(() => {});
      const token = getSessionToken();
      if (token && !item._id.startsWith('fs_')) {
        fetch(`/api/user/notifications/${encodeURIComponent(item._id)}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    }
    setOpen(false);
    navigate(item.link || '/');
  };

  const handleMarkAllRead = async () => {
    markReleasesAsRead();
    setFirestoreAlerts((prev) => prev.map((n) => ({ ...n, isRead: true })));
    void markAllFirestoreEpisodeAlertsAsRead(user?.uid || 'guest').catch(() => {});
    if (user && (unreadActivityCount > 0 || unreadMergedActivityCount > 0)) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadActivityCount(0);
      const token = getSessionToken();
      if (token) {
        fetch('/api/user/notifications/read-all', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    }
  };

  // Close dropdown on click outside or Escape
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const handleToggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      refreshAll(false).finally(() => setLoading(false));
      if (!user && unreadActivityCount === 0) {
        setActiveTab('releases');
      } else if (unreadActivityCount > 0 || notifications.length > 0) {
        setActiveTab('activity');
      }
      if (unreadReleaseCount > 0 && activeTab === 'releases') {
        markReleasesAsRead();
      }
    }
  };

  return (
    <div ref={containerRef} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={handleToggleOpen}
        aria-label={isEn ? 'Notifications' : 'Notifikasi'}
        aria-expanded={open}
        title={isEn ? 'Notifications' : 'Notifikasi'}
        className={`relative flex items-center justify-center rounded-full border transition-colors ${
          compact ? 'w-11 h-11' : 'w-11 h-11'
        } ${
          open
            ? 'bg-[#2E90FA]/20 border-[#2E90FA]/50 text-[#2E90FA]'
            : 'bg-[#252833] hover:bg-[#2E3240] border-white/[0.08] text-white'
        }`}
      >
        <Bell className="w-5 h-5" />
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center font-mono-tabular shadow">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={isEn ? 'Recent Notifications' : 'Notifikasi Terbaru'}
          className="absolute right-0 top-12 z-[70] w-[min(calc(100vw-1.5rem),23.5rem)] rounded-2xl bg-white dark:bg-[#13151E] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden"
        >
          {/* Dropdown Header */}
          <div className="flex items-center justify-between gap-2 px-3.5 py-3 border-b border-slate-100 dark:border-white/[0.07]">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-[#E84A18] shrink-0" />
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                  {isEn ? 'Notifications' : 'Notifikasi'}
                </span>
                {totalUnread > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-[#E84A18]/15 text-[#E84A18] text-[10px] font-extrabold font-mono-tabular">
                    {totalUnread}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5 truncate">
                {isEn
                  ? 'Favorite episodes, replies & live releases'
                  : 'Episode favorit, balasan komentar & rilis baru'}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {totalUnread > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  title={isEn ? 'Mark all as read' : 'Tandai semua dibaca'}
                  className="h-7 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-[10px] font-bold text-slate-700 dark:text-gray-200 inline-flex items-center gap-1 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden xs:inline">{isEn ? 'Read all' : 'Baca semua'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => refreshAll(true)}
                disabled={syncing}
                title={isEn ? 'Refresh notifications' : 'Perbarui notifikasi'}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-[#E84A18] transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={isEn ? 'Close notifications' : 'Tutup notifikasi'}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabs: Activity vs Live Releases */}
          <div className="grid grid-cols-2 gap-1.5 p-2 bg-slate-50 dark:bg-[#0E1017] border-b border-slate-100 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              className={`h-8 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'activity'
                  ? 'bg-white dark:bg-[#1B1F2E] text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-white/10'
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{isEn ? 'For You' : 'Untukmu'}</span>
              {unreadActivityCount > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded bg-[#E84A18] text-white text-[10px] font-extrabold flex items-center justify-center font-mono-tabular">
                  {unreadActivityCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('releases');
                if (unreadReleaseCount > 0) markReleasesAsRead();
              }}
              className={`h-8 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'releases'
                  ? 'bg-white dark:bg-[#1B1F2E] text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-white/10'
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>{isEn ? 'New Releases' : 'Rilis Baru'}</span>
              {unreadReleaseCount > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded bg-emerald-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center font-mono-tabular">
                  {unreadReleaseCount}
                </span>
              )}
            </button>
          </div>

          {/* Notification Items List */}
          <div className="max-h-80 overflow-y-auto p-2 space-y-1.5">
            {activeTab === 'activity' ? (
              !user && mergedNotifications.length === 0 ? (
                <div className="py-6 px-4 text-center">
                  <div className="w-10 h-10 rounded-xl bg-[#E84A18]/15 border border-[#E84A18]/30 text-[#E84A18] flex items-center justify-center mx-auto mb-2.5">
                    <Bell className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {isEn ? 'Sign in for personal notifications' : 'Masuk untuk notifikasi pribadimu'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-1 leading-relaxed">
                    {isEn
                      ? 'Get notified when new episodes of your bookmarked anime drop or when someone replies to your comment.'
                      : 'Dapatkan info saat episode baru anime favoritmu rilis atau ada yang membalas komentarmu.'}
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <Link
                      to="/profile"
                      onClick={() => setOpen(false)}
                      className="px-3.5 py-2 rounded-xl bg-[#E84A18] hover:bg-[#d13f11] text-white text-xs font-bold transition-colors"
                    >
                      {isEn ? 'Sign In' : 'Masuk Akun'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setActiveTab('releases')}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-gray-200 text-xs font-semibold transition-colors"
                    >
                      {isEn ? 'View Releases' : 'Lihat Rilis'}
                    </button>
                  </div>
                </div>
              ) : loading && mergedNotifications.length === 0 ? (
                <div className="space-y-2 p-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-14 rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse"
                    />
                  ))}
                </div>
              ) : mergedNotifications.length === 0 ? (
                <div className="py-6 px-4 text-center">
                  <p className="text-xs font-bold text-slate-800 dark:text-gray-100">
                    {isEn ? 'No personal notifications yet' : 'Belum ada notifikasi pribadi'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-1 leading-relaxed">
                    {isEn
                      ? 'Bookmark your favorite anime/donghua or join discussions in comments to receive updates here.'
                      : 'Simpan anime/donghua ke Watchlist atau ikuti diskusi komentar agar pembaruan muncul di sini.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('releases');
                      if (unreadReleaseCount > 0) markReleasesAsRead();
                    }}
                    className="mt-3 px-3.5 py-1.5 rounded-xl bg-[#E84A18]/15 hover:bg-[#E84A18]/25 text-[#E84A18] text-xs font-bold transition-colors"
                  >
                    {isEn ? 'Check New Episodes' : 'Cek Episode Baru'}
                  </button>
                </div>
              ) : (
                mergedNotifications.map((item) => {
                  const { Icon, bg } = getNotificationIcon(item.type);
                  const thumb = item.poster || item.actorPhoto;
                  return (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => handleMarkSingleRead(item)}
                      className={`w-full text-left flex items-start gap-2.5 p-2 rounded-xl transition-colors border ${
                        item.isRead
                          ? 'border-transparent hover:bg-slate-100 dark:hover:bg-white/5'
                          : 'bg-[#E84A18]/[0.06] dark:bg-[#E84A18]/[0.09] border-[#E84A18]/20 hover:bg-[#E84A18]/[0.11]'
                      }`}
                    >
                      {thumb ? (
                        <div className="relative shrink-0">
                          <img
                            src={resolveFallbackPosterUrl(thumb, 0) || thumb}
                            alt=""
                            className="w-10 h-10 rounded-xl object-cover bg-slate-200 dark:bg-[#1F222C]"
                          />
                          <span
                            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-md border flex items-center justify-center bg-white dark:bg-[#13151E] ${bg}`}
                          >
                            <Icon className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      ) : (
                        <span
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${bg}`}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug line-clamp-1">
                            {item.title}
                          </p>
                          {!item.isRead && (
                            <span className="w-2 h-2 rounded-full bg-[#E84A18] shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-gray-300 mt-0.5 line-clamp-2 leading-snug">
                          {item.message}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <p className="text-[10px] text-slate-400 dark:text-gray-500 font-medium">
                            {formatRelativeTime(item.createdAt, isEn)}
                          </p>
                          {item.type === 'favorite_episode' && (
                            <span className="px-1.5 py-0.2 rounded bg-[#E84A18]/15 text-[#E84A18] text-[9px] font-bold">
                              Favorit
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )
            ) : releaseItems.length === 0 ? (
              <div className="py-6 px-4 text-center text-xs text-slate-500 dark:text-gray-400">
                {isEn ? 'Syncing latest episodes...' : 'Menyinkronkan episode terbaru...'}
              </div>
            ) : (
              releaseItems.map((ep, idx) => (
                <Link
                  key={`live-notif-${ep.type}-${ep.id}-${idx}`}
                  to={`/detail/${ep.type}/${encodeURIComponent(ep.id)}${
                    ep.episodeId ? `?ep=${encodeURIComponent(ep.episodeId)}` : ''
                  }`}
                  state={{ poster: ep.poster, seriesTitle: ep.title }}
                  onClick={() => {
                    markReleasesAsRead([ep.notifKey]);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                  <img
                    src={resolveFallbackPosterUrl(ep.poster, 0) || ep.poster}
                    alt={ep.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-10 h-12 rounded-lg object-cover shrink-0 bg-slate-200 dark:bg-[#1F222C]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {ep.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-[#E84A18] font-bold truncate">
                        {ep.episodeLabel} · {ep.type === 'donghua' ? 'Donghua' : 'Anime'}
                      </span>
                      {idx < 3 && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold uppercase shrink-0">
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}

      {/* Real-Time Favorite Anime Episode Upload Toast Alert */}
      {liveEpisodeToast && !compact && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 z-[90] w-[min(calc(100vw-2rem),22rem)] rounded-2xl bg-white dark:bg-[#141722] border border-[#E84A18]/40 shadow-2xl p-3 flex items-start gap-3">
          {liveEpisodeToast.poster ? (
            <img
              src={resolveFallbackPosterUrl(liveEpisodeToast.poster, 0) || liveEpisodeToast.poster}
              alt=""
              className="w-11 h-14 rounded-xl object-cover shrink-0 bg-slate-200 dark:bg-[#1F222C]"
            />
          ) : (
            <span className="w-10 h-10 rounded-xl bg-[#E84A18]/15 text-[#E84A18] flex items-center justify-center shrink-0">
              <Tv className="w-5 h-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#E84A18]">
                {isEn ? 'Favorite Anime Alert' : 'Notifikasi Anime Favorit'}
              </span>
              <button
                type="button"
                onClick={() => setLiveEpisodeToast(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                aria-label="Tutup"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 mt-0.5 leading-snug">
              {liveEpisodeToast.message}
            </p>
            <button
              type="button"
              onClick={() => {
                const target = liveEpisodeToast;
                setLiveEpisodeToast(null);
                void handleMarkSingleRead(target);
              }}
              className="mt-2 px-3 py-1 rounded-lg bg-[#E84A18] hover:bg-[#d13f11] text-white text-[11px] font-bold transition-colors"
            >
              {isEn ? 'Watch Now' : 'Tonton Sekarang'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
