import {
  connectDB,
  isDbMongoConnected,
  readFallbackJson,
  writeFallbackJson,
} from './db.ts';
import {
  NotificationModel,
  type INotification,
  type NotificationType,
} from './models/Notification.ts';
import type { IUser } from './models/User.ts';

export interface CreateNotificationInput {
  uid: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  poster?: string;
  actorUid?: string;
  actorName?: string;
  actorPhoto?: string;
  dedupeKey?: string;
}

export interface SerializedNotification {
  _id: string;
  uid: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  poster: string;
  actorUid: string;
  actorName: string;
  actorPhoto: string;
  isRead: boolean;
  createdAt: string;
}

export interface LatestEpisodeSnapshotItem {
  id: string;
  episodeId?: string;
  type: 'anime' | 'donghua';
  title: string;
  episodeLabel?: string;
  poster?: string;
}

interface StoredNotification extends Omit<INotification, 'createdAt'> {
  _id: string;
  createdAt: Date | string;
}

const FALLBACK_FILE = 'notifications-v1.json';
const MAX_PER_USER = 60;

function serialize(doc: any): SerializedNotification {
  return {
    _id: String(doc._id || ''),
    uid: String(doc.uid || ''),
    type: (doc.type || 'system') as NotificationType,
    title: String(doc.title || ''),
    message: String(doc.message || ''),
    link: String(doc.link || '/'),
    poster: String(doc.poster || ''),
    actorUid: String(doc.actorUid || ''),
    actorName: String(doc.actorName || ''),
    actorPhoto: String(doc.actorPhoto || ''),
    isRead: Boolean(doc.isRead),
    createdAt: doc.createdAt
      ? new Date(doc.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

function normalizeLookup(raw?: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/\b(season|part|cour|episode|ep|sub|indo|subtitle|indonesia)\b/gi, '')
    .replace(/[^a-z0-9]/g, '');
}

export async function createNotification(
  input: CreateNotificationInput
): Promise<SerializedNotification | null> {
  const cleanUid = String(input.uid || '').trim();
  if (!cleanUid) return null;

  const dedupeKey = String(input.dedupeKey || '').trim().slice(0, 180);
  const payload: INotification = {
    uid: cleanUid,
    type: input.type,
    title: String(input.title || '').trim().slice(0, 140),
    message: String(input.message || '').trim().slice(0, 360),
    link: String(input.link || '/').trim() || '/',
    poster: String(input.poster || '').trim(),
    actorUid: String(input.actorUid || '').trim(),
    actorName: String(input.actorName || '').trim().slice(0, 80),
    actorPhoto: String(input.actorPhoto || '').trim(),
    dedupeKey,
    isRead: false,
  };

  if (!payload.title || !payload.message) return null;

  try {
    await connectDB();

    if (isDbMongoConnected()) {
      if (dedupeKey) {
        const existing = await NotificationModel.findOne({ uid: cleanUid, dedupeKey }).lean();
        if (existing) {
          return serialize(existing);
        }
      }
      const created = await NotificationModel.create(payload);
      return serialize(created.toObject());
    }

    const all = readFallbackJson<StoredNotification[]>(FALLBACK_FILE, []);
    if (dedupeKey) {
      const existing = all.find((n) => n.uid === cleanUid && n.dedupeKey === dedupeKey);
      if (existing) {
        return serialize(existing);
      }
    }

    const memDoc: StoredNotification = {
      ...payload,
      _id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    all.unshift(memDoc);

    // Keep storage bounded per user
    const counts = new Map<string, number>();
    const bounded = all.filter((item) => {
      const c = (counts.get(item.uid) || 0) + 1;
      counts.set(item.uid, c);
      return c <= MAX_PER_USER;
    });
    writeFallbackJson(FALLBACK_FILE, bounded);
    return serialize(memDoc);
  } catch (err) {
    console.warn('[Notification Create Notice]', (err as Error).message);
    return null;
  }
}

export async function syncFavoriteEpisodeNotifications(
  user: IUser,
  latestEpisodes: LatestEpisodeSnapshotItem[]
): Promise<void> {
  try {
    const bookmarks = Array.isArray(user.bookmarks) ? user.bookmarks : [];
    if (bookmarks.length === 0 || latestEpisodes.length === 0) return;

    const bookmarkById = new Map<string, { id: string; type: string; title: string; poster: string }>();
    const bookmarkByNorm = new Map<string, { id: string; type: string; title: string; poster: string }>();

    for (const b of bookmarks) {
      if (!b?.id && !b?.title) continue;
      const entry = {
        id: String(b.id || ''),
        type: String(b.type || 'anime'),
        title: String(b.title || ''),
        poster: String(b.poster || ''),
      };
      if (entry.id) bookmarkById.set(`${entry.type}:${entry.id.toLowerCase()}`, entry);
      const norm = normalizeLookup(entry.title);
      if (norm.length >= 4) bookmarkByNorm.set(`${entry.type}:${norm}`, entry);
    }

    for (const ep of latestEpisodes.slice(0, 24)) {
      const idKey = `${ep.type}:${String(ep.id || '').toLowerCase()}`;
      const normKey = `${ep.type}:${normalizeLookup(ep.title)}`;
      const matched = bookmarkById.get(idKey) || bookmarkByNorm.get(normKey);
      if (!matched) continue;

      const epTag = String(ep.episodeLabel || ep.episodeId || 'Terbaru').trim();
      const dedupeKey = `fav_ep:${ep.type}:${ep.id}:${epTag.toLowerCase()}`;
      const link = `/detail/${ep.type}/${encodeURIComponent(ep.id)}${
        ep.episodeId ? `?ep=${encodeURIComponent(ep.episodeId)}` : ''
      }`;

      await createNotification({
        uid: user.uid,
        type: 'favorite_episode',
        title: `Episode baru ${ep.type === 'donghua' ? 'Donghua' : 'Anime'} favorit rilis!`,
        message: `${ep.title} — ${epTag} sudah tayang sekarang.`,
        link,
        poster: ep.poster || matched.poster || '',
        dedupeKey,
      });
    }
  } catch (err) {
    console.warn('[Favorite Episode Notification Sync Notice]', (err as Error).message);
  }
}

export async function getUserNotifications(
  uid: string,
  limit = 30
): Promise<{ notifications: SerializedNotification[]; unreadCount: number }> {
  await connectDB();

  if (isDbMongoConnected()) {
    const [docs, unreadCount] = await Promise.all([
      NotificationModel.find({ uid }).sort({ createdAt: -1 }).limit(limit).lean(),
      NotificationModel.countDocuments({ uid, isRead: false }),
    ]);
    return {
      notifications: docs.map(serialize),
      unreadCount,
    };
  }

  const all = readFallbackJson<StoredNotification[]>(FALLBACK_FILE, []);
  const mine = all
    .filter((n) => n.uid === uid)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    notifications: mine.slice(0, limit).map(serialize),
    unreadCount: mine.filter((n) => !n.isRead).length,
  };
}

export async function markNotificationRead(uid: string, notificationId: string): Promise<number> {
  await connectDB();

  if (isDbMongoConnected()) {
    await NotificationModel.updateOne(
      { _id: notificationId, uid },
      { $set: { isRead: true } }
    ).catch(() => {});
    return NotificationModel.countDocuments({ uid, isRead: false });
  }

  const all = readFallbackJson<StoredNotification[]>(FALLBACK_FILE, []);
  let changed = false;
  for (const item of all) {
    if (item.uid === uid && item._id === notificationId && !item.isRead) {
      item.isRead = true;
      changed = true;
    }
  }
  if (changed) writeFallbackJson(FALLBACK_FILE, all);
  return all.filter((n) => n.uid === uid && !n.isRead).length;
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  await connectDB();

  if (isDbMongoConnected()) {
    await NotificationModel.updateMany({ uid, isRead: false }, { $set: { isRead: true } });
    return;
  }

  const all = readFallbackJson<StoredNotification[]>(FALLBACK_FILE, []);
  let changed = false;
  for (const item of all) {
    if (item.uid === uid && !item.isRead) {
      item.isRead = true;
      changed = true;
    }
  }
  if (changed) writeFallbackJson(FALLBACK_FILE, all);
}
