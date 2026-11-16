import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  firestoreAuth,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import type {
  BookmarkItem,
  MediaCardItem,
  UserNotificationItem,
  UserProfile,
} from '../types';

export const FAVORITE_BOOKMARKS_CHANGED_EVENT = 'zonestream:bookmarks-changed';
const LOCAL_FAV_ALERTS_KEY = 'zonestream_firestore_fav_episode_alerts_v1';

export interface FirestoreEpisodeAlertDoc {
  uid: string;
  seriesId: string;
  seriesType: 'anime' | 'donghua';
  seriesTitle: string;
  episodeId: string;
  episodeLabel: string;
  poster: string;
  link: string;
  isRead: boolean;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

function sanitizeFirestoreId(raw: string): string {
  return (
    String(raw || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 110) || 'alert'
  );
}

function normalizeSeriesLookup(raw?: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/\b(season|part|cour|episode|ep|sub|indo|subtitle|indonesia)\b/gi, '')
    .replace(/[^a-z0-9]/g, '');
}

function timestampToIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as any).toDate === 'function') {
    return (val as any).toDate().toISOString();
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  return new Date().toISOString();
}

export function toNotificationItemFromAlert(
  alertId: string,
  data: FirestoreEpisodeAlertDoc,
  isEn = false
): UserNotificationItem {
  const mediaLabel = data.seriesType === 'donghua' ? 'Donghua' : 'Anime';
  return {
    _id: `fs_${alertId}`,
    uid: data.uid,
    type: 'favorite_episode',
    title: isEn
      ? `New ${mediaLabel} Episode Uploaded!`
      : `Episode Baru ${mediaLabel} Favorit Rilis!`,
    message: isEn
      ? `${data.seriesTitle} — ${data.episodeLabel} is now available to stream.`
      : `${data.seriesTitle} — ${data.episodeLabel} baru saja diunggah & siap ditonton!`,
    link: data.link || `/detail/${data.seriesType}/${encodeURIComponent(data.seriesId)}`,
    poster: data.poster || '',
    actorUid: '',
    actorName: 'Firestore Real-Time',
    actorPhoto: '',
    isRead: Boolean(data.isRead),
    createdAt: timestampToIso(data.createdAt),
  };
}

function readLocalSyncedAlerts(uid: string): Record<string, FirestoreEpisodeAlertDoc> {
  try {
    const raw = localStorage.getItem(`${LOCAL_FAV_ALERTS_KEY}:${uid}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocalSyncedAlerts(uid: string, map: Record<string, FirestoreEpisodeAlertDoc>) {
  try {
    localStorage.setItem(`${LOCAL_FAV_ALERTS_KEY}:${uid}`, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Ensures the parent `/users/{firebaseUid}` document exists in Firestore so subcollection
 * Master Gate rules on `/users/{firebaseUid}/episode_alerts/{alertId}` succeed.
 */
async function ensureFirestoreUserParentDoc(
  firebaseUid: string,
  profile: UserProfile | null
): Promise<boolean> {
  const activeFbUser = firestoreAuth.currentUser;
  if (!activeFbUser || activeFbUser.uid !== firebaseUid || !activeFbUser.emailVerified) {
    return false;
  }

  const userPath = `users/${firebaseUid}`;
  const userRef = doc(db, 'users', firebaseUid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
    return false;
  }

  try {
    await setDoc(userRef, {
      uid: firebaseUid,
      displayUid: String(profile?.uid || '0000000').replace(/\D/g, '').padStart(7, '0').slice(0, 7),
      email: String(activeFbUser.email || profile?.email || 'user@zonestream.app').slice(0, 255),
      name: String(profile?.name || activeFbUser.displayName || 'ZoneStream Member').slice(0, 60),
      photoUrl: String(profile?.photoUrl || activeFbUser.photoURL || '').slice(0, 400000),
      level: 1,
      exp: 0,
      isPremium: false,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, userPath);
    return false;
  }
}

/**
 * Matches newly uploaded episodes against the user's favorited/bookmarked anime & donghua,
 * writes new episode alerts to Firebase Firestore (`/users/{uid}/episode_alerts/{alertId}`),
 * and returns newly discovered favorite episode alerts.
 */
export async function syncFavoriteEpisodesWithFirestore(params: {
  user: UserProfile | null;
  bookmarks: BookmarkItem[];
  latestEpisodes: MediaCardItem[];
  isEn?: boolean;
}): Promise<{
  allAlerts: UserNotificationItem[];
  newlyUploadedAlerts: UserNotificationItem[];
}> {
  const { user, bookmarks, latestEpisodes, isEn = false } = params;
  const ownerKey = user?.uid || 'guest';
  if (!bookmarks.length || !latestEpisodes.length) {
    const existingMap = readLocalSyncedAlerts(ownerKey);
    const existingList = Object.entries(existingMap).map(([id, d]) =>
      toNotificationItemFromAlert(id, d, isEn)
    );
    return { allAlerts: existingList, newlyUploadedAlerts: [] };
  }

  const bookmarkById = new Map<string, BookmarkItem>();
  const bookmarkByNorm = new Map<string, BookmarkItem>();

  for (const b of bookmarks) {
    if (!b?.id && !b?.title) continue;
    const bType = b.type === 'donghua' ? 'donghua' : 'anime';
    if (b.id) {
      bookmarkById.set(`${bType}:${b.id.toLowerCase()}`, b);
    }
    const norm = normalizeSeriesLookup(b.title);
    if (norm.length >= 4) {
      bookmarkByNorm.set(`${bType}:${norm}`, b);
    }
  }

  const localMap = readLocalSyncedAlerts(ownerKey);
  const newlyUploadedAlerts: UserNotificationItem[] = [];
  const fbUser = firestoreAuth.currentUser;
  const canWriteFirestore = Boolean(fbUser && fbUser.emailVerified);
  let parentReady = false;

  if (canWriteFirestore && fbUser) {
    parentReady = await ensureFirestoreUserParentDoc(fbUser.uid, user);
  }

  for (const ep of latestEpisodes.slice(0, 24)) {
    const epType: 'anime' | 'donghua' = ep.type === 'donghua' ? 'donghua' : 'anime';
    const idKey = `${epType}:${String(ep.id || '').toLowerCase()}`;
    const normKey = `${epType}:${normalizeSeriesLookup(ep.title)}`;
    const matched = bookmarkById.get(idKey) || bookmarkByNorm.get(normKey);
    if (!matched) continue;

    const epLabel = String(ep.episodeLabel || ep.episodeId || 'Episode Terbaru').trim().slice(0, 80);
    const epId = String(ep.episodeId || epLabel).trim().slice(0, 160);
    const alertId = sanitizeFirestoreId(`fav_${epType}_${ep.id}_${epId}`);
    const link = `/detail/${epType}/${encodeURIComponent(ep.id)}${
      ep.episodeId ? `?ep=${encodeURIComponent(ep.episodeId)}` : ''
    }`.slice(0, 300);

    if (!localMap[alertId]) {
      const nowIso = new Date().toISOString();
      const alertDoc: FirestoreEpisodeAlertDoc = {
        uid: fbUser?.uid || ownerKey,
        seriesId: String(ep.id || matched.id).slice(0, 128),
        seriesType: epType,
        seriesTitle: String(ep.title || matched.title).slice(0, 140),
        episodeId: epId,
        episodeLabel: epLabel,
        poster: String(ep.poster || matched.poster || '').slice(0, 2000),
        link,
        isRead: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      localMap[alertId] = alertDoc;
      newlyUploadedAlerts.push(toNotificationItemFromAlert(alertId, alertDoc, isEn));

      if (canWriteFirestore && parentReady && fbUser) {
        const alertPath = `users/${fbUser.uid}/episode_alerts/${alertId}`;
        const alertRef = doc(db, 'users', fbUser.uid, 'episode_alerts', alertId);
        try {
          const snap = await getDoc(alertRef);
          if (!snap.exists()) {
            await setDoc(alertRef, {
              uid: fbUser.uid,
              seriesId: alertDoc.seriesId,
              seriesType: alertDoc.seriesType,
              seriesTitle: alertDoc.seriesTitle,
              episodeId: alertDoc.episodeId,
              episodeLabel: alertDoc.episodeLabel,
              poster: alertDoc.poster,
              link: alertDoc.link,
              isRead: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, alertPath);
        }
      }
    }
  }

  writeLocalSyncedAlerts(ownerKey, localMap);
  const allAlerts = Object.entries(localMap)
    .map(([id, d]) => toNotificationItemFromAlert(id, d, isEn))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { allAlerts, newlyUploadedAlerts };
}

/**
 * Real-time Firestore `onSnapshot` listener for `/users/{firebaseUid}/episode_alerts`.
 */
export function subscribeToFirestoreEpisodeAlerts(
  isEn: boolean,
  onAlerts: (alerts: UserNotificationItem[]) => void
): Unsubscribe | null {
  const fbUser = firestoreAuth.currentUser;
  if (!fbUser || !fbUser.emailVerified) {
    return null;
  }

  const collectionPath = `users/${fbUser.uid}/episode_alerts`;
  const q = query(
    collection(db, 'users', fbUser.uid, 'episode_alerts'),
    where('uid', '==', fbUser.uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: UserNotificationItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as FirestoreEpisodeAlertDoc;
        items.push(toNotificationItemFromAlert(docSnap.id, data, isEn));
      });
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onAlerts(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionPath);
    }
  );
}

export async function markFirestoreEpisodeAlertAsRead(
  ownerUid: string,
  notifId: string
): Promise<void> {
  const alertId = notifId.replace(/^fs_/, '');
  const localMap = readLocalSyncedAlerts(ownerUid);
  if (localMap[alertId]) {
    localMap[alertId].isRead = true;
    localMap[alertId].updatedAt = new Date().toISOString();
    writeLocalSyncedAlerts(ownerUid, localMap);
  }

  const fbUser = firestoreAuth.currentUser;
  if (fbUser && fbUser.emailVerified) {
    const alertPath = `users/${fbUser.uid}/episode_alerts/${alertId}`;
    const alertRef = doc(db, 'users', fbUser.uid, 'episode_alerts', alertId);
    try {
      const snap = await getDoc(alertRef);
      if (snap.exists() && snap.data()?.isRead === false) {
        await updateDoc(alertRef, {
          isRead: true,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, alertPath);
    }
  }
}

export async function markAllFirestoreEpisodeAlertsAsRead(ownerUid: string): Promise<void> {
  const localMap = readLocalSyncedAlerts(ownerUid);
  const unreadIds: string[] = [];
  for (const [id, item] of Object.entries(localMap)) {
    if (!item.isRead) {
      item.isRead = true;
      item.updatedAt = new Date().toISOString();
      unreadIds.push(id);
    }
  }
  writeLocalSyncedAlerts(ownerUid, localMap);

  const fbUser = firestoreAuth.currentUser;
  if (fbUser && fbUser.emailVerified && unreadIds.length > 0) {
    for (const alertId of unreadIds) {
      const alertPath = `users/${fbUser.uid}/episode_alerts/${alertId}`;
      const alertRef = doc(db, 'users', fbUser.uid, 'episode_alerts', alertId);
      try {
        const snap = await getDoc(alertRef);
        if (snap.exists() && snap.data()?.isRead === false) {
          await updateDoc(alertRef, {
            isRead: true,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, alertPath);
      }
    }
  }
}
