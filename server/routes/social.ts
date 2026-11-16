import { Router } from 'express';
import { verifyAuthToken, requireAuth, type AuthenticatedRequest } from '../auth.ts';
import {
  connectDB,
  findUserByUid,
  findUsersByUids,
  isDbMongoConnected,
  readFallbackJson,
  readFallbackUsers,
  sanitizeUser,
  searchCommunityUsers,
  toCommunityUserSummary,
  touchUserLastActive,
  updateUserByUid,
  writeFallbackJson,
} from '../db.ts';
import { FriendshipModel, type IFriendship } from '../models/Friendship.ts';
import { ChatMessageModel, type IChatMessage } from '../models/ChatMessage.ts';
import { GroupChatModel, type IGroupChat } from '../models/GroupChat.ts';
import { GroupMessageModel, type IGroupMessage } from '../models/GroupMessage.ts';
import { GlobalMessageModel, type IGlobalMessage } from '../models/GlobalMessage.ts';
import { ClanModel, type IClan } from '../models/Clan.ts';
import { UserModel, type IUser } from '../models/User.ts';

const router = Router();

interface StoredFriendship extends IFriendship {
  _id: string;
}

interface StoredMessage extends IChatMessage {
  _id: string;
  createdAt: Date;
}

function makePairKey(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join(':');
}

function extractViewerUid(req: AuthenticatedRequest): string {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return '';
  const payload = verifyAuthToken(token);
  return payload?.uid || '';
}

async function getRelationshipStatus(
  viewerUid: string,
  targetUid: string
): Promise<'self' | 'friend' | 'pending_sent' | 'pending_received' | 'none'> {
  if (!viewerUid) return 'none';
  if (viewerUid === targetUid) return 'self';

  const pairKey = makePairKey(viewerUid, targetUid);
  await connectDB();

  let doc: IFriendship | null = null;
  if (isDbMongoConnected()) {
    const found = await FriendshipModel.findOne({ pairKey });
    doc = found ? found.toObject() : null;
  } else {
    const all = readFallbackJson<StoredFriendship[]>('friendships-v1.json', []);
    doc = all.find((f) => f.pairKey === pairKey) || null;
  }

  if (!doc) return 'none';
  if (doc.status === 'accepted') return 'friend';
  if (doc.requesterUid === viewerUid) return 'pending_sent';
  return 'pending_received';
}

// GET /api/social/users?q=... — Search community users by UID/username/name (requires login & non-empty query for privacy)
router.get('/users', async (req: AuthenticatedRequest, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 20));
    const viewerUid = extractViewerUid(req);

    // Privacy protection: only logged-in users can search, and empty queries never dump member lists
    if (!viewerUid) {
      return res.json({ ok: true, users: [], requiresAuth: true });
    }

    void touchUserLastActive(viewerUid);

    if (!q) {
      return res.json({ ok: true, users: [] });
    }

    const users = await searchCommunityUsers(q, limit);
    const pairMap = new Map<string, IFriendship>();

    if (viewerUid && users.length > 0) {
      await connectDB();
      if (isDbMongoConnected()) {
        const docs = await FriendshipModel.find({
          $or: [{ requesterUid: viewerUid }, { recipientUid: viewerUid }],
        });
        for (const d of docs) {
          pairMap.set(d.pairKey, d.toObject());
        }
      } else {
        const all = readFallbackJson<StoredFriendship[]>('friendships-v1.json', []);
        for (const f of all) {
          if (f.requesterUid === viewerUid || f.recipientUid === viewerUid) {
            pairMap.set(f.pairKey, f);
          }
        }
      }
    }

    const list = users.map((u) => {
      const summary = toCommunityUserSummary(u);
      let relationship: 'self' | 'friend' | 'pending_sent' | 'pending_received' | 'none' = 'none';
      if (viewerUid) {
        if (viewerUid === summary.uid) {
          relationship = 'self';
        } else {
          const rel = pairMap.get(makePairKey(viewerUid, summary.uid));
          if (rel) {
            relationship =
              rel.status === 'accepted'
                ? 'friend'
                : rel.requesterUid === viewerUid
                ? 'pending_sent'
                : 'pending_received';
          }
        }
      }
      return { ...summary, relationship };
    });

    return res.json({ ok: true, users: list });
  } catch (err) {
    console.error('[Social Search Users Error]', err);
    return res.status(500).json({ error: 'Gagal mencari pengguna komunitas' });
  }
});

async function getAllUsersSafe(): Promise<IUser[]> {
  await connectDB();
  if (isDbMongoConnected()) {
    const docs = await UserModel.find({}).lean();
    return docs as unknown as IUser[];
  }
  return Object.values(readFallbackUsers());
}

async function getAllClansRaw(): Promise<IClan[]> {
  await connectDB();
  if (isDbMongoConnected()) {
    const docs = await ClanModel.find({}).lean();
    return docs.map((d: any) => ({ ...d, _id: String(d._id) }));
  }
  return readFallbackJson<IClan[]>('clans-v1.json', []);
}

interface UserClanMeta {
  tag: string;
  name: string;
  level: number;
  isLeader: boolean;
  clanRank: number;
}

interface UserRankMeta {
  charismaRank: number;
  watchRank: number;
  levelRank: number;
  topRank: number | null;
  topCategory: 'charisma' | 'watchtime' | 'level' | null;
}

function buildCommunityRankingMeta(usersRaw: IUser[], clansRaw: IClan[]) {
  const summaries = usersRaw.map((u) => toCommunityUserSummary(u));
  const sortedClans = enrichClansRealtime(clansRaw, usersRaw);
  const clanMetaMap = new Map<string, UserClanMeta>();

  sortedClans.forEach((c: any, idx: number) => {
    const clanRank = idx + 1;
    const members: string[] = Array.isArray(c.members) ? c.members : [];
    for (const mUid of members) {
      const isLeader = c.leaderUid === mUid;
      const prev = clanMetaMap.get(mUid);
      // Prioritize a clan the user actually leads, otherwise keep first clan
      if (!prev || (isLeader && !prev.isLeader)) {
        clanMetaMap.set(mUid, {
          tag: c.tag,
          name: c.name,
          level: c.level || 1,
          isLeader,
          clanRank,
        });
      }
    }
    if (c.leaderUid && !clanMetaMap.get(c.leaderUid)?.isLeader) {
      clanMetaMap.set(c.leaderUid, {
        tag: c.tag,
        name: c.name,
        level: c.level || 1,
        isLeader: true,
        clanRank,
      });
    }
  });

  const charismaSorted = [...summaries].sort(
    (a, b) =>
      (b.charisma ?? 0) - (a.charisma ?? 0) ||
      (b.level || 1) - (a.level || 1) ||
      (b.totalEpisodesWatched || 0) - (a.totalEpisodesWatched || 0)
  );
  const watchSorted = [...summaries].sort(
    (a, b) =>
      (b.totalEpisodesWatched || 0) - (a.totalEpisodesWatched || 0) ||
      (b.level || 1) - (a.level || 1) ||
      (b.charisma ?? 0) - (a.charisma ?? 0)
  );
  const levelSorted = [...summaries].sort(
    (a, b) =>
      (b.level || 1) - (a.level || 1) ||
      (b.exp || 0) - (a.exp || 0) ||
      (b.totalEpisodesWatched || 0) - (a.totalEpisodesWatched || 0)
  );

  const charismaRankMap = new Map<string, number>();
  charismaSorted.forEach((u, i) => charismaRankMap.set(u.uid, i + 1));

  const watchRankMap = new Map<string, number>();
  watchSorted.forEach((u, i) => watchRankMap.set(u.uid, i + 1));

  const levelRankMap = new Map<string, number>();
  levelSorted.forEach((u, i) => levelRankMap.set(u.uid, i + 1));

  const rankMetaMap = new Map<string, UserRankMeta>();
  for (const s of summaries) {
    const cRank = charismaRankMap.get(s.uid) || 999;
    const wRank = watchRankMap.get(s.uid) || 999;
    const lRank = levelRankMap.get(s.uid) || 999;

    const candidates: Array<{ rank: number; cat: 'charisma' | 'watchtime' | 'level' }> = [];
    if ((s.charisma ?? 0) > 0 && cRank <= 10) {
      candidates.push({ rank: cRank, cat: 'charisma' });
    }
    if ((s.totalEpisodesWatched || 0) > 0 && wRank <= 10) {
      candidates.push({ rank: wRank, cat: 'watchtime' });
    }
    if (lRank <= 10) {
      candidates.push({ rank: lRank, cat: 'level' });
    }

    candidates.sort((a, b) => a.rank - b.rank);
    const best = candidates[0] || null;

    rankMetaMap.set(s.uid, {
      charismaRank: cRank,
      watchRank: wRank,
      levelRank: lRank,
      topRank: best ? best.rank : null,
      topCategory: best ? best.cat : null,
    });
  }

  return { summaries, clanMetaMap, rankMetaMap };
}

// GET /api/social/leaderboard — Real-time public rankings of genuine users (NO BOTS)
router.get('/leaderboard', async (req: AuthenticatedRequest, res) => {
  try {
    const viewerUid = extractViewerUid(req);
    if (viewerUid) {
      void touchUserLastActive(viewerUid);
    }

    const [allUsers, allClans] = await Promise.all([getAllUsersSafe(), getAllClansRaw()]);
    const { summaries, clanMetaMap, rankMetaMap } = buildCommunityRankingMeta(allUsers, allClans);

    const users = summaries.map((summary) => {
      const clanMeta = clanMetaMap.get(summary.uid);
      const rankMeta = rankMetaMap.get(summary.uid);
      return {
        ...summary,
        clan: clanMeta?.tag || '',
        clanName: clanMeta?.name || '',
        clanRank: clanMeta?.clanRank || null,
        isClanLeader: Boolean(clanMeta?.isLeader),
        charismaRank: rankMeta?.charismaRank || 999,
        watchRank: rankMeta?.watchRank || 999,
        levelRank: rankMeta?.levelRank || 999,
        topRank: rankMeta?.topRank || null,
        topCategory: rankMeta?.topCategory || null,
      };
    });

    return res.json({ ok: true, users });
  } catch (err) {
    console.error('[Social Leaderboard Error]', err);
    return res.status(500).json({ error: 'Gagal memuat leaderboard pengguna' });
  }
});

// GET /api/social/profile/:uid — Public profile view for ANY user (including VerzonFounder UID 00000)
router.get('/profile/:uid', async (req: AuthenticatedRequest, res) => {
  try {
    const targetUid = String(req.params.uid || '').trim();
    const viewerUid = extractViewerUid(req);
    if (viewerUid) {
      void touchUserLastActive(viewerUid);
    }

    const target = await findUserByUid(targetUid);
    if (!target) {
      return res.status(404).json({ error: 'Profil pengguna tidak ditemukan.' });
    }

    const pub = sanitizeUser(target);
    const summary = toCommunityUserSummary(target);
    const relationship = await getRelationshipStatus(viewerUid, targetUid);

    let friendsCount = 0;
    await connectDB();
    if (isDbMongoConnected()) {
      friendsCount = await FriendshipModel.countDocuments({
        status: 'accepted',
        $or: [{ requesterUid: targetUid }, { recipientUid: targetUid }],
      });
    } else {
      const all = readFallbackJson<StoredFriendship[]>('friendships-v1.json', []);
      friendsCount = all.filter(
        (f) => f.status === 'accepted' && (f.requesterUid === targetUid || f.recipientUid === targetUid)
      ).length;
    }

    const likedBy = Array.isArray(target.likedBy) ? target.likedBy : [];
    const hasLiked = Boolean(viewerUid && likedBy.includes(viewerUid));

    return res.json({
      ok: true,
      profile: {
        ...summary,
        friendsCount,
        relationship,
        charisma: pub.charisma ?? 0,
        hasLiked,
        bookmarks: (pub.bookmarks || []).slice(0, 12),
        recentHistory: (pub.watchHistory || []).slice(0, 8),
      },
    });
  } catch (err) {
    console.error('[Social Public Profile Error]', err);
    return res.status(500).json({ error: 'Gagal memuat profil pengguna' });
  }
});

// POST /api/social/profile/:uid/like — Real user-to-user like/unlike to update Charisma in real time
router.post('/profile/:uid/like', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const viewerUid = req.authUser!.uid;
    const targetUid = String(req.params.uid || '').trim();
    if (!targetUid) {
      return res.status(400).json({ error: 'Target profil tidak valid.' });
    }
    if (viewerUid === targetUid) {
      return res.status(400).json({ error: 'Tidak dapat menyukai profil sendiri. Biarkan user lain yang menyukaimu!' });
    }

    let liked = false;
    let finalCharisma = 0;

    const updated = await updateUserByUid(targetUid, (current) => {
      const prevLikedBy = Array.isArray(current.likedBy) ? [...current.likedBy] : [];
      const alreadyLiked = prevLikedBy.includes(viewerUid);
      const nextLikedBy = alreadyLiked
        ? prevLikedBy.filter((id) => id !== viewerUid)
        : [...prevLikedBy, viewerUid];
      liked = !alreadyLiked;

      const isTargetFounder =
        String(current.email || '').toLowerCase() === 'wanglin72kk@gmail.com' ||
        current.role === 'founder';
      finalCharisma = isTargetFounder ? 9999 + nextLikedBy.length : nextLikedBy.length;

      return {
        ...current,
        likedBy: nextLikedBy,
        charisma: finalCharisma,
      };
    });

    if (!updated) {
      return res.status(404).json({ error: 'Profil tidak ditemukan' });
    }

    return res.json({
      ok: true,
      charisma: finalCharisma,
      liked,
      message: liked
        ? 'Berhasil menyukai profil (+1 Charisma ♥)!'
        : 'Suka pada profil dibatalkan.',
    });
  } catch (err) {
    console.error('[Profile Like Error]', err);
    return res.status(500).json({ error: 'Gagal menyukai profil' });
  }
});

// GET /api/social/friends — List friends, incoming requests, and outgoing requests
router.get('/friends', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    void touchUserLastActive(meUid);
    await connectDB();

    let rows: IFriendship[] = [];
    if (isDbMongoConnected()) {
      const docs = await FriendshipModel.find({
        $or: [{ requesterUid: meUid }, { recipientUid: meUid }],
      }).sort({ updatedAt: -1 });
      rows = docs.map((d) => d.toObject());
    } else {
      const all = readFallbackJson<StoredFriendship[]>('friendships-v1.json', []);
      rows = all.filter((f) => f.requesterUid === meUid || f.recipientUid === meUid);
    }

    const peerUids = rows.map((r) => (r.requesterUid === meUid ? r.recipientUid : r.requesterUid));
    const peerUsers = await findUsersByUids(peerUids);
    const peerMap = new Map(peerUsers.map((u) => [u.uid, toCommunityUserSummary(u)]));

    const friends: any[] = [];
    const incomingRequests: any[] = [];
    const outgoingRequests: any[] = [];

    for (const r of rows) {
      const peerUid = r.requesterUid === meUid ? r.recipientUid : r.requesterUid;
      const peer = peerMap.get(peerUid);
      if (!peer) continue;

      if (r.status === 'accepted') {
        friends.push({ ...peer, relationship: 'friend' });
      } else if (r.recipientUid === meUid) {
        incomingRequests.push({ ...peer, relationship: 'pending_received' });
      } else {
        outgoingRequests.push({ ...peer, relationship: 'pending_sent' });
      }
    }

    return res.json({
      ok: true,
      friends,
      incomingRequests,
      outgoingRequests,
    });
  } catch (err) {
    console.error('[Social Friends List Error]', err);
    return res.status(500).json({ error: 'Gagal memuat daftar teman' });
  }
});

// POST /api/social/friends/request — Send friend request (or auto-accept mutual)
router.post('/friends/request', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const targetUid = String(req.body?.targetUid || '').trim();
    if (!targetUid || targetUid === meUid) {
      return res.status(400).json({ error: 'Target pengguna tidak valid.' });
    }

    const target = await findUserByUid(targetUid);
    if (!target) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    const pairKey = makePairKey(meUid, targetUid);
    await connectDB();

    if (isDbMongoConnected()) {
      const existing = await FriendshipModel.findOne({ pairKey });
      if (existing) {
        if (existing.status === 'accepted') {
          return res.json({ ok: true, relationship: 'friend', message: 'Kalian sudah berteman.' });
        }
        if (existing.recipientUid === meUid) {
          existing.status = 'accepted';
          await existing.save();
          return res.json({ ok: true, relationship: 'friend', message: 'Permintaan teman diterima!' });
        }
        return res.json({
          ok: true,
          relationship: 'pending_sent',
          message: 'Permintaan pertemanan sudah dikirim.',
        });
      }
      await FriendshipModel.create({
        pairKey,
        requesterUid: meUid,
        recipientUid: targetUid,
        status: 'pending',
      });
    } else {
      const all = readFallbackJson<StoredFriendship[]>('friendships-v1.json', []);
      const idx = all.findIndex((f) => f.pairKey === pairKey);
      if (idx >= 0) {
        if (all[idx].status === 'accepted') {
          return res.json({ ok: true, relationship: 'friend', message: 'Kalian sudah berteman.' });
        }
        if (all[idx].recipientUid === meUid) {
          all[idx].status = 'accepted';
          all[idx].updatedAt = new Date();
          writeFallbackJson('friendships-v1.json', all);
          return res.json({ ok: true, relationship: 'friend', message: 'Permintaan teman diterima!' });
        }
        return res.json({
          ok: true,
          relationship: 'pending_sent',
          message: 'Permintaan pertemanan sudah dikirim.',
        });
      }
      all.push({
        _id: `fr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        pairKey,
        requesterUid: meUid,
        recipientUid: targetUid,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      writeFallbackJson('friendships-v1.json', all);
    }

    return res.json({
      ok: true,
      relationship: 'pending_sent',
      message: `Permintaan teman dikirim ke ${target.name}.`,
    });
  } catch (err) {
    console.error('[Social Friend Request Error]', err);
    return res.status(500).json({ error: 'Gagal mengirim permintaan pertemanan' });
  }
});

// POST /api/social/friends/accept — Accept incoming friend request
router.post('/friends/accept', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const targetUid = String(req.body?.targetUid || '').trim();
    if (!targetUid) {
      return res.status(400).json({ error: 'Target pengguna tidak valid.' });
    }

    const pairKey = makePairKey(meUid, targetUid);
    await connectDB();

    if (isDbMongoConnected()) {
      const existing = await FriendshipModel.findOne({ pairKey });
      if (!existing) {
        return res.status(404).json({ error: 'Permintaan pertemanan tidak ditemukan.' });
      }
      existing.status = 'accepted';
      await existing.save();
    } else {
      const all = readFallbackJson<StoredFriendship[]>('friendships-v1.json', []);
      const idx = all.findIndex((f) => f.pairKey === pairKey);
      if (idx < 0) {
        return res.status(404).json({ error: 'Permintaan pertemanan tidak ditemukan.' });
      }
      all[idx].status = 'accepted';
      all[idx].updatedAt = new Date();
      writeFallbackJson('friendships-v1.json', all);
    }

    return res.json({ ok: true, relationship: 'friend', message: 'Sekarang kalian berteman!' });
  } catch (err) {
    console.error('[Social Friend Accept Error]', err);
    return res.status(500).json({ error: 'Gagal menerima permintaan teman' });
  }
});

// POST /api/social/friends/remove — Unfriend, reject, or cancel request
router.post('/friends/remove', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const targetUid = String(req.body?.targetUid || '').trim();
    if (!targetUid) {
      return res.status(400).json({ error: 'Target pengguna tidak valid.' });
    }

    const pairKey = makePairKey(meUid, targetUid);
    await connectDB();

    if (isDbMongoConnected()) {
      await FriendshipModel.deleteOne({ pairKey });
    } else {
      const all = readFallbackJson<StoredFriendship[]>('friendships-v1.json', []);
      writeFallbackJson(
        'friendships-v1.json',
        all.filter((f) => f.pairKey !== pairKey)
      );
    }

    return res.json({ ok: true, relationship: 'none', message: 'Status pertemanan dihapus.' });
  } catch (err) {
    console.error('[Social Friend Remove Error]', err);
    return res.status(500).json({ error: 'Gagal memperbarui status pertemanan' });
  }
});

// GET /api/social/conversations — WhatsApp-style inbox of recent chats & unread counts
router.get('/conversations', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    void touchUserLastActive(meUid);
    await connectDB();

    let allMsgs: any[] = [];
    let friendRows: IFriendship[] = [];

    if (isDbMongoConnected()) {
      const [msgs, frs] = await Promise.all([
        ChatMessageModel.find({
          $or: [{ senderUid: meUid }, { recipientUid: meUid }],
        })
          .sort({ createdAt: -1 })
          .limit(400),
        FriendshipModel.find({
          status: 'accepted',
          $or: [{ requesterUid: meUid }, { recipientUid: meUid }],
        }),
      ]);
      allMsgs = msgs.map((m) => m.toObject());
      friendRows = frs.map((f) => f.toObject());
    } else {
      const msgs = readFallbackJson<StoredMessage[]>('messages-v1.json', []);
      allMsgs = msgs
        .filter((m) => m.senderUid === meUid || m.recipientUid === meUid)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const frs = readFallbackJson<StoredFriendship[]>('friendships-v1.json', []);
      friendRows = frs.filter(
        (f) => f.status === 'accepted' && (f.requesterUid === meUid || f.recipientUid === meUid)
      );
    }

    const convoMap = new Map<
      string,
      {
        peerUid: string;
        lastMessage: any | null;
        unreadCount: number;
      }
    >();

    for (const msg of allMsgs) {
      const peerUid = msg.senderUid === meUid ? msg.recipientUid : msg.senderUid;
      if (!peerUid || peerUid === meUid) continue;
      let entry = convoMap.get(peerUid);
      if (!entry) {
        entry = { peerUid, lastMessage: msg, unreadCount: 0 };
        convoMap.set(peerUid, entry);
      }
      if (msg.recipientUid === meUid && !msg.readAt) {
        entry.unreadCount += 1;
      }
    }

    for (const fr of friendRows) {
      const peerUid = fr.requesterUid === meUid ? fr.recipientUid : fr.requesterUid;
      if (!convoMap.has(peerUid)) {
        convoMap.set(peerUid, { peerUid, lastMessage: null, unreadCount: 0 });
      }
    }

    const peerUsers = await findUsersByUids(Array.from(convoMap.keys()));
    const peerLookup = new Map(peerUsers.map((u) => [u.uid, toCommunityUserSummary(u)]));

    let totalUnread = 0;
    const conversations = Array.from(convoMap.values())
      .map((entry) => {
        const peer = peerLookup.get(entry.peerUid);
        if (!peer) return null;
        totalUnread += entry.unreadCount;
        return {
          peer,
          unreadCount: entry.unreadCount,
          lastMessage: entry.lastMessage
            ? {
                _id: String(entry.lastMessage._id),
                senderUid: entry.lastMessage.senderUid,
                text: entry.lastMessage.text || '',
                sticker: entry.lastMessage.sticker || '',
                readAt: entry.lastMessage.readAt || null,
                createdAt: entry.lastMessage.createdAt,
              }
            : null,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const ta = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const tb = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return tb - ta;
      });

    return res.json({ ok: true, conversations, totalUnread });
  } catch (err) {
    console.error('[Social Conversations Error]', err);
    return res.status(500).json({ error: 'Gagal memuat daftar obrolan' });
  }
});

// GET /api/social/messages/:peerUid — Load thread + mark incoming messages as read (✓✓ blue ticks)
router.get('/messages/:peerUid', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const peerUid = String(req.params.peerUid || '').trim();
    if (!peerUid || peerUid === meUid) {
      return res.status(400).json({ error: 'Tujuan obrolan tidak valid.' });
    }

    void touchUserLastActive(meUid);
    const peerUser = await findUserByUid(peerUid);
    if (!peerUser) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    const conversationId = makePairKey(meUid, peerUid);
    const relationship = await getRelationshipStatus(meUid, peerUid);
    await connectDB();

    let messages: any[] = [];
    const now = new Date();

    if (isDbMongoConnected()) {
      await ChatMessageModel.updateMany(
        { conversationId, senderUid: peerUid, recipientUid: meUid, readAt: null },
        { $set: { readAt: now } }
      );
      const docs = await ChatMessageModel.find({ conversationId })
        .sort({ createdAt: 1 })
        .limit(150);
      messages = docs.map((d) => ({
        ...d.toObject(),
        _id: String(d._id),
      }));
    } else {
      const all = readFallbackJson<StoredMessage[]>('messages-v1.json', []);
      let changed = false;
      for (const m of all) {
        if (m.conversationId === conversationId && m.senderUid === peerUid && m.recipientUid === meUid && !m.readAt) {
          m.readAt = now;
          changed = true;
        }
      }
      if (changed) writeFallbackJson('messages-v1.json', all);
      messages = all
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(-150);
    }

    return res.json({
      ok: true,
      peer: toCommunityUserSummary(peerUser),
      relationship,
      messages,
    });
  } catch (err) {
    console.error('[Social Messages Load Error]', err);
    return res.status(500).json({ error: 'Gagal memuat riwayat pesan' });
  }
});

// POST /api/social/messages/:peerUid — Send message / VIP sticker / reply in WhatsApp chat
router.post('/messages/:peerUid', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const peerUid = String(req.params.peerUid || '').trim();
    const text = String(req.body?.text || '').trim().slice(0, 1200);
    const sticker = String(req.body?.sticker || '').trim();
    const replyToId = String(req.body?.replyToId || '').trim();
    const replySenderName = String(req.body?.replySenderName || '').trim().slice(0, 40);
    const replyText = String(req.body?.replyText || '').trim().slice(0, 140);

    if (!peerUid || peerUid === meUid) {
      return res.status(400).json({ error: 'Penerima pesan tidak valid.' });
    }
    if (!text && !sticker) {
      return res.status(400).json({ error: 'Pesan atau stiker tidak boleh kosong.' });
    }

    const [sender, peer] = await Promise.all([findUserByUid(meUid), findUserByUid(peerUid)]);
    if (!sender || !peer) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    const canUseVipSticker = Boolean(sender.isPremium || sender.role === 'founder');
    const cleanSticker = sticker && canUseVipSticker ? sticker : '';
    const conversationId = makePairKey(meUid, peerUid);
    void touchUserLastActive(meUid);

    await connectDB();
    let created: any;

    if (isDbMongoConnected()) {
      const doc = await ChatMessageModel.create({
        conversationId,
        senderUid: meUid,
        recipientUid: peerUid,
        text,
        sticker: cleanSticker,
        replyToId,
        replySenderName,
        replyText,
        readAt: null,
      });
      created = { ...doc.toObject(), _id: String(doc._id) };
    } else {
      const all = readFallbackJson<StoredMessage[]>('messages-v1.json', []);
      created = {
        _id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        conversationId,
        senderUid: meUid,
        recipientUid: peerUid,
        text,
        sticker: cleanSticker,
        replyToId,
        replySenderName,
        replyText,
        readAt: null,
        createdAt: new Date(),
      };
      all.push(created);
      writeFallbackJson('messages-v1.json', all);
    }

    return res.status(201).json({ ok: true, message: created });
  } catch (err) {
    console.error('[Social Message Send Error]', err);
    return res.status(500).json({ error: 'Gagal mengirim pesan' });
  }
});

// DELETE /api/social/messages/:messageId — Delete own message
router.delete('/messages/:messageId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const messageId = String(req.params.messageId || '').trim();
    await connectDB();

    if (isDbMongoConnected()) {
      const msg = await ChatMessageModel.findById(messageId);
      if (!msg) return res.status(404).json({ error: 'Pesan tidak ditemukan' });
      if (msg.senderUid !== meUid && req.authUser!.role !== 'founder') {
        return res.status(403).json({ error: 'Hanya dapat menghapus pesan sendiri' });
      }
      await ChatMessageModel.deleteOne({ _id: messageId });
    } else {
      const all = readFallbackJson<StoredMessage[]>('messages-v1.json', []);
      const found = all.find((m) => m._id === messageId);
      if (!found) return res.status(404).json({ error: 'Pesan tidak ditemukan' });
      if (found.senderUid !== meUid && req.authUser!.role !== 'founder') {
        return res.status(403).json({ error: 'Hanya dapat menghapus pesan sendiri' });
      }
      writeFallbackJson(
        'messages-v1.json',
        all.filter((m) => m._id !== messageId)
      );
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[Social Message Delete Error]', err);
    return res.status(500).json({ error: 'Gagal menghapus pesan' });
  }
});

interface StoredGroupChat extends IGroupChat {
  _id: string;
}

interface StoredGroupMessage extends IGroupMessage {
  _id: string;
  createdAt: Date;
}

// GET /api/social/groups — List groups user belongs to
router.get('/groups', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    void touchUserLastActive(meUid);
    await connectDB();

    let groups: any[] = [];
    if (isDbMongoConnected()) {
      const docs = await GroupChatModel.find({ members: meUid }).sort({ createdAt: -1 });
      groups = docs.map((d) => ({ ...d.toObject(), _id: String(d._id) }));
    } else {
      const all = readFallbackJson<StoredGroupChat[]>('groups-v1.json', []);
      groups = all.filter((g) => g.members?.includes(meUid));
    }

    return res.json({ ok: true, groups });
  } catch (err) {
    console.error('[Social Groups List Error]', err);
    return res.status(500).json({ error: 'Gagal memuat daftar grup' });
  }
});

// POST /api/social/groups/create — Create new WhatsApp-style group
router.post('/groups/create', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const name = String(req.body?.name || '').trim().slice(0, 50);
    const description = String(req.body?.description || '').trim().slice(0, 200);
    const avatarUrl = String(req.body?.avatarUrl || '').trim();
    const invitedUids = Array.isArray(req.body?.members) ? req.body.members : [];

    if (!name) {
      return res.status(400).json({ error: 'Nama grup wajib diisi.' });
    }

    const members = Array.from(new Set([meUid, ...invitedUids]));
    const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    void touchUserLastActive(meUid);
    await connectDB();

    let created: any;
    if (isDbMongoConnected()) {
      const doc = await GroupChatModel.create({
        groupId,
        name,
        description,
        avatarUrl,
        creatorUid: meUid,
        members,
      });
      created = { ...doc.toObject(), _id: String(doc._id) };
    } else {
      const all = readFallbackJson<StoredGroupChat[]>('groups-v1.json', []);
      created = {
        _id: `g_${Date.now()}`,
        groupId,
        name,
        description,
        avatarUrl,
        creatorUid: meUid,
        members,
        createdAt: new Date(),
      };
      all.push(created);
      writeFallbackJson('groups-v1.json', all);
    }

    return res.status(201).json({ ok: true, group: created });
  } catch (err) {
    console.error('[Social Group Create Error]', err);
    return res.status(500).json({ error: 'Gagal membuat grup baru' });
  }
});

// POST /api/social/groups/:groupId/invite — Add/invite friend to group by UID (requires member/admin approval or adds to pending/members)
router.post('/groups/:groupId/invite', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const groupId = String(req.params.groupId || '').trim();
    const targetUid = String(req.body?.targetUid || '').trim();
    if (!targetUid) {
      return res.status(400).json({ error: 'UID anggota wajib diisi.' });
    }

    const targetUser = await findUserByUid(targetUid);
    if (!targetUser) {
      return res.status(404).json({ error: 'Pengguna dengan UID tersebut tidak ditemukan.' });
    }

    await connectDB();
    if (isDbMongoConnected()) {
      const group = await GroupChatModel.findOne({ groupId });
      if (!group) return res.status(404).json({ error: 'Grup tidak ditemukan.' });
      if (!group.members.includes(meUid) && req.authUser!.role !== 'founder') {
        return res.status(403).json({ error: 'Anda bukan anggota grup.' });
      }
      if (group.members.includes(targetUid)) {
        return res.json({ ok: true, message: `${targetUser.name} sudah ada di dalam grup.` });
      }
      if (!group.pendingMembers) group.pendingMembers = [];
      if (!group.pendingMembers.includes(targetUid)) {
        group.pendingMembers.push(targetUid);
      }
      // For immediate convenience or approval flow: if creator or founder invites, or require agreement
      if (!group.members.includes(targetUid)) {
        group.members.push(targetUid); // Auto-add upon UID invite with consent
      }
      await group.save();
    } else {
      const all = readFallbackJson<StoredGroupChat[]>('groups-v1.json', []);
      const found = all.find((g) => g.groupId === groupId);
      if (!found) return res.status(404).json({ error: 'Grup tidak ditemukan.' });
      if (!found.members.includes(targetUid)) {
        found.members.push(targetUid);
      }
      writeFallbackJson('groups-v1.json', all);
    }

    return res.json({ ok: true, message: `Berhasil menambahkan ${targetUser.name} (${targetUid}) ke grup!` });
  } catch (err) {
    console.error('[Social Group Invite Error]', err);
    return res.status(500).json({ error: 'Gagal menambahkan anggota ke grup' });
  }
});

// POST /api/social/groups/:groupId/avatar — Change group profile picture
router.post('/groups/:groupId/avatar', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const groupId = String(req.params.groupId || '').trim();
    const avatarUrl = String(req.body?.avatarUrl || '').trim();
    await connectDB();

    if (isDbMongoConnected()) {
      const group = await GroupChatModel.findOne({ groupId });
      if (!group) return res.status(404).json({ error: 'Grup tidak ditemukan.' });
      if (!group.members.includes(meUid) && req.authUser!.role !== 'founder') {
        return res.status(403).json({ error: 'Anda bukan anggota grup ini.' });
      }
      group.avatarUrl = avatarUrl;
      await group.save();
    } else {
      const all = readFallbackJson<StoredGroupChat[]>('groups-v1.json', []);
      const found = all.find((g) => g.groupId === groupId);
      if (!found) return res.status(404).json({ error: 'Grup tidak ditemukan.' });
      found.avatarUrl = avatarUrl;
      writeFallbackJson('groups-v1.json', all);
    }

    return res.json({ ok: true, avatarUrl });
  } catch (err) {
    console.error('[Social Group Avatar Error]', err);
    return res.status(500).json({ error: 'Gagal mengubah foto profil grup' });
  }
});

// GET /api/social/groups/:groupId/messages — Get messages for group
router.get('/groups/:groupId/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const groupId = String(req.params.groupId || '').trim();
    void touchUserLastActive(meUid);
    await connectDB();

    let group: any = null;
    let messages: any[] = [];

    if (isDbMongoConnected()) {
      group = await GroupChatModel.findOne({ groupId });
      if (!group) return res.status(404).json({ error: 'Grup tidak ditemukan.' });
      if (!group.members.includes(meUid) && req.authUser!.role !== 'founder') {
        return res.status(403).json({ error: 'Anda bukan anggota grup ini.' });
      }
      const docs = await GroupMessageModel.find({ groupId }).sort({ createdAt: 1 }).limit(200);
      messages = docs.map((d) => ({ ...d.toObject(), _id: String(d._id) }));
      group = group.toObject();
    } else {
      const allGroups = readFallbackJson<StoredGroupChat[]>('groups-v1.json', []);
      group = allGroups.find((g) => g.groupId === groupId);
      if (!group) return res.status(404).json({ error: 'Grup tidak ditemukan.' });
      if (!group.members.includes(meUid) && req.authUser!.role !== 'founder') {
        return res.status(403).json({ error: 'Anda bukan anggota grup ini.' });
      }
      const allMsgs = readFallbackJson<StoredGroupMessage[]>('group-messages-v1.json', []);
      messages = allMsgs
        .filter((m) => m.groupId === groupId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(-200);
    }

    return res.json({ ok: true, group, messages });
  } catch (err) {
    console.error('[Social Group Messages Error]', err);
    return res.status(500).json({ error: 'Gagal memuat pesan grup' });
  }
});

// POST /api/social/groups/:groupId/messages — Send message, photo, video, VN (audio), or VIP sticker to group
router.post('/groups/:groupId/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const groupId = String(req.params.groupId || '').trim();
    const text = String(req.body?.text || '').trim().slice(0, 1500);
    const mediaUrl = String(req.body?.mediaUrl || '').trim();
    const mediaType = req.body?.mediaType || ''; // 'image' | 'video' | 'audio'
    const sticker = String(req.body?.sticker || '').trim();
    const replyToId = String(req.body?.replyToId || '').trim();
    const replySenderName = String(req.body?.replySenderName || '').trim().slice(0, 40);
    const replyText = String(req.body?.replyText || '').trim().slice(0, 140);

    if (!groupId) {
      return res.status(400).json({ error: 'Grup tidak valid.' });
    }
    if (!text && !mediaUrl && !sticker) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
    }

    const sender = await findUserByUid(meUid);
    if (!sender) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    const canUseVipSticker = Boolean(sender.isPremium || sender.role === 'founder');
    const cleanSticker = sticker && canUseVipSticker ? sticker : '';
    void touchUserLastActive(meUid);
    await connectDB();

    let created: any;
    if (isDbMongoConnected()) {
      const doc = await GroupMessageModel.create({
        groupId,
        senderUid: meUid,
        senderName: sender.name,
        senderPhoto: sender.photoUrl || '',
        text,
        mediaUrl,
        mediaType,
        sticker: cleanSticker,
        replyToId,
        replySenderName,
        replyText,
      });
      created = { ...doc.toObject(), _id: String(doc._id) };
    } else {
      const all = readFallbackJson<StoredGroupMessage[]>('group-messages-v1.json', []);
      created = {
        _id: `gmsg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        groupId,
        senderUid: meUid,
        senderName: sender.name,
        senderPhoto: sender.photoUrl || '',
        text,
        mediaUrl,
        mediaType,
        sticker: cleanSticker,
        replyToId,
        replySenderName,
        replyText,
        createdAt: new Date(),
      };
      all.push(created);
      writeFallbackJson('group-messages-v1.json', all);
    }

    return res.status(201).json({ ok: true, message: created });
  } catch (err) {
    console.error('[Social Group Message Send Error]', err);
    return res.status(500).json({ error: 'Gagal mengirim pesan grup' });
  }
});

interface StoredGlobalMessage extends IGlobalMessage {
  _id: string;
  createdAt: Date | string;
}

const ALLOWED_GLOBAL_CHANNELS = new Set(['ch1', 'ch2', 'ch3', 'rekrut']);

function normalizeGlobalChannel(raw: unknown): string {
  const clean = String(raw || 'ch1').trim().toLowerCase();
  return ALLOWED_GLOBAL_CHANNELS.has(clean) ? clean : 'ch1';
}

// GET /api/social/global-messages — Persistent Global Chat accessible to ALL users & newly logged-in accounts
router.get('/global-messages', async (req: AuthenticatedRequest, res) => {
  try {
    const channel = normalizeGlobalChannel(req.query.channel);
    const viewerUid = extractViewerUid(req);
    if (viewerUid) {
      void touchUserLastActive(viewerUid);
    }

    await connectDB();
    let rawMessages: any[] = [];
    if (isDbMongoConnected()) {
      const filter = channel === 'ch1' ? { $or: [{ channel: 'ch1' }, { channel: { $exists: false } }, { channel: '' }] } : { channel };
      const docs = await GlobalMessageModel.find(filter).sort({ createdAt: 1 }).limit(120);
      rawMessages = docs.map((d) => ({ ...d.toObject(), _id: String(d._id) }));
    } else {
      const all = readFallbackJson<StoredGlobalMessage[]>('global-messages-v1.json', []);
      rawMessages = all
        .filter((m) => normalizeGlobalChannel(m.channel) === channel)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(-120);
    }

    const [allUsers, allClans] = await Promise.all([getAllUsersSafe(), getAllClansRaw()]);
    const { summaries, clanMetaMap, rankMetaMap } = buildCommunityRankingMeta(allUsers, allClans);
    const userMap = new Map(summaries.map((s) => [s.uid, s]));

    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    let onlineCount = allUsers.filter(
      (u) => u.lastActiveAt && new Date(u.lastActiveAt).getTime() >= fiveMinAgo
    ).length;
    if (viewerUid && onlineCount < 1) onlineCount = 1;

    const messages = rawMessages.map((m) => {
      const sender = userMap.get(m.senderUid);
      const clanMeta = clanMetaMap.get(m.senderUid) || null;
      const rankMeta = rankMetaMap.get(m.senderUid);
      return {
        ...m,
        channel: normalizeGlobalChannel(m.channel),
        senderName: sender?.name || m.senderName || 'User',
        senderUsername: sender?.username || '',
        senderPhoto: sender?.photoUrl || m.senderPhoto || '',
        senderRole: sender?.role || 'member',
        senderIsPremium: Boolean(sender?.isPremium || sender?.role === 'founder'),
        senderBadge: sender?.activeBadge || 'Member',
        senderBorder: sender?.activeBorder || 'classic',
        senderStatusEmoji: sender?.statusEmoji || '',
        senderLevel: sender?.level || 1,
        senderCharisma: sender?.charisma ?? 0,
        senderClan: clanMeta,
        senderTopRank: rankMeta?.topRank ?? null,
        senderTopCategory: rankMeta?.topCategory ?? null,
      };
    });

    return res.json({ ok: true, channel, onlineCount, messages });
  } catch (err) {
    console.error('[Global Chat Load Error]', err);
    return res.status(500).json({ error: 'Gagal memuat Global Chat' });
  }
});

// POST /api/social/global-messages — Send message to Global Chat (for ALL logged-in users & new logins)
router.post('/global-messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const channel = normalizeGlobalChannel(req.body?.channel);
    const text = String(req.body?.text || '').trim().slice(0, 1500);
    const mediaUrl = String(req.body?.mediaUrl || '').trim();
    const mediaType = req.body?.mediaType || '';
    const sticker = String(req.body?.sticker || '').trim();
    const replyToId = String(req.body?.replyToId || '').trim();
    const replySenderUid = String(req.body?.replySenderUid || '').trim();
    const replySenderName = String(req.body?.replySenderName || '').trim().slice(0, 40);
    const replySenderIsVerified = Boolean(req.body?.replySenderIsVerified);
    const replyText = String(req.body?.replyText || '').trim().slice(0, 140);

    if (!text && !mediaUrl && !sticker) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
    }

    const [sender, allUsers, allClans] = await Promise.all([
      findUserByUid(meUid),
      getAllUsersSafe(),
      getAllClansRaw(),
    ]);
    if (!sender) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    const { clanMetaMap, rankMetaMap } = buildCommunityRankingMeta(allUsers, allClans);
    const senderSummary = toCommunityUserSummary(sender);
    const senderClan = clanMetaMap.get(meUid) || null;
    const senderRank = rankMetaMap.get(meUid);

    const canUseVipSticker = Boolean(senderSummary.isPremium || senderSummary.role === 'founder');
    const cleanSticker = sticker && canUseVipSticker ? sticker : '';
    void touchUserLastActive(meUid);
    await connectDB();

    let created: any;
    if (isDbMongoConnected()) {
      const doc = await GlobalMessageModel.create({
        channel,
        senderUid: meUid,
        senderName: senderSummary.name,
        senderPhoto: senderSummary.photoUrl || '',
        text,
        mediaUrl,
        mediaType,
        sticker: cleanSticker,
        replyToId,
        replySenderUid,
        replySenderName,
        replySenderIsVerified,
        replyText,
      });
      created = { ...doc.toObject(), _id: String(doc._id) };
    } else {
      const all = readFallbackJson<StoredGlobalMessage[]>('global-messages-v1.json', []);
      created = {
        _id: `global_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        channel,
        senderUid: meUid,
        senderName: senderSummary.name,
        senderPhoto: senderSummary.photoUrl || '',
        text,
        mediaUrl,
        mediaType,
        sticker: cleanSticker,
        replyToId,
        replySenderUid,
        replySenderName,
        replySenderIsVerified,
        replyText,
        createdAt: new Date().toISOString(),
      };
      all.push(created);
      writeFallbackJson('global-messages-v1.json', all.slice(-300));
    }

    return res.status(201).json({
      ok: true,
      message: {
        ...created,
        channel,
        senderUsername: senderSummary.username,
        senderRole: senderSummary.role,
        senderIsPremium: senderSummary.isPremium,
        senderBadge: senderSummary.activeBadge,
        senderBorder: senderSummary.activeBorder,
        senderStatusEmoji: senderSummary.statusEmoji,
        senderLevel: senderSummary.level,
        senderCharisma: senderSummary.charisma ?? 0,
        senderClan,
        senderTopRank: senderRank?.topRank ?? null,
        senderTopCategory: senderRank?.topCategory ?? null,
      },
    });
  } catch (err) {
    console.error('[Global Chat Send Error]', err);
    return res.status(500).json({ error: 'Gagal mengirim pesan Global Chat' });
  }
});

// DELETE /api/social/global-messages/:messageId — Delete own global message (or founder)
router.delete('/global-messages/:messageId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const messageId = String(req.params.messageId || '').trim();
    await connectDB();

    if (isDbMongoConnected()) {
      const msg = await GlobalMessageModel.findById(messageId);
      if (!msg) return res.status(404).json({ error: 'Pesan tidak ditemukan' });
      if (msg.senderUid !== meUid && req.authUser!.role !== 'founder') {
        return res.status(403).json({ error: 'Hanya dapat menghapus pesan sendiri' });
      }
      await GlobalMessageModel.deleteOne({ _id: messageId });
    } else {
      const all = readFallbackJson<StoredGlobalMessage[]>('global-messages-v1.json', []);
      const found = all.find((m) => m._id === messageId);
      if (!found) return res.status(404).json({ error: 'Pesan tidak ditemukan' });
      if (found.senderUid !== meUid && req.authUser!.role !== 'founder') {
        return res.status(403).json({ error: 'Hanya dapat menghapus pesan sendiri' });
      }
      writeFallbackJson(
        'global-messages-v1.json',
        all.filter((m) => m._id !== messageId)
      );
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[Global Chat Delete Error]', err);
    return res.status(500).json({ error: 'Gagal menghapus pesan' });
  }
});

// Helper to enrich clans in real-time from member stats (Level, Charisma/Likes, Episodes Watched)
function enrichClansRealtime(clansRaw: any[], users: IUser[]) {
  const userMap = new Map(users.map((u) => [u.uid, toCommunityUserSummary(u)]));

  return clansRaw
    .map((c) => {
      const memberIds: string[] = Array.isArray(c.members) ? Array.from(new Set(c.members)) : [];
      let totalLevel = 0;
      let totalCharisma = 0;
      let episodesWatched = 0;
      const memberProfiles: any[] = [];

      for (const mUid of memberIds) {
        const m = userMap.get(mUid);
        if (m) {
          totalLevel += m.role === 'founder' ? 9999 : (m.level || 1);
          totalCharisma += m.charisma ?? 0;
          episodesWatched += m.totalEpisodesWatched || 0;
          memberProfiles.push({
            uid: m.uid,
            name: m.name,
            photoUrl: m.photoUrl,
            level: m.level,
            charisma: m.charisma,
          });
        }
      }

      const leader = userMap.get(c.leaderUid);
      const computedLevel = Math.max(1, totalLevel || c.level || 1);
      const realtimeScore = computedLevel * 10 + totalCharisma * 5 + episodesWatched * 3;

      return {
        ...c,
        leaderName: leader?.name || c.leaderName || 'Leader',
        leaderPhoto: leader?.photoUrl || '',
        avatarUrl: c.avatarUrl || leader?.photoUrl || '',
        level: computedLevel,
        charisma: totalCharisma,
        episodesWatched,
        members: memberIds,
        membersCount: memberIds.length,
        maxMembers: c.maxMembers || 50,
        memberAvatars: memberProfiles.slice(0, 5),
        realtimeScore,
      };
    })
    .sort((a, b) => b.realtimeScore - a.realtimeScore || b.level - a.level || b.charisma - a.charisma);
}

// GET /api/social/clans — List real user-created clans ranked dynamically in real time (NO BOTS)
router.get('/clans', async (req: AuthenticatedRequest, res) => {
  try {
    const viewerUid = extractViewerUid(req);
    if (viewerUid) {
      void touchUserLastActive(viewerUid);
    }

    const [clansRaw, users] = await Promise.all([getAllClansRaw(), getAllUsersSafe()]);
    const clans = enrichClansRealtime(clansRaw, users);
    return res.json({ ok: true, clans });
  } catch (err) {
    console.error('[Social Clans List Error]', err);
    return res.status(500).json({ error: 'Gagal memuat klan' });
  }
});

// POST /api/social/clans/create — Create clan & auto-rank by real-time stats
router.post('/clans/create', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const creator = await findUserByUid(meUid);
    const creatorSummary = creator ? toCommunityUserSummary(creator) : null;
    const meName = creatorSummary?.name || req.authUser!.username || 'Wibu';
    const { name, tag, description, status } = req.body;
    if (!name || !tag) {
      return res.status(400).json({ error: 'Nama dan Tag Klan wajib diisi' });
    }

    await connectDB();
    const clanId = `clan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const initialLevel = creatorSummary
      ? creatorSummary.role === 'founder'
        ? 9999
        : Math.max(1, creatorSummary.level || 1)
      : 1;
    let created: any;

    if (isDbMongoConnected()) {
      const doc = await ClanModel.create({
        clanId,
        name: String(name).trim().slice(0, 40),
        tag: String(tag).trim().toUpperCase().slice(0, 6),
        description: String(description || '').trim().slice(0, 200),
        avatarUrl: creatorSummary?.photoUrl || '',
        leaderUid: meUid,
        leaderName: meName,
        level: initialLevel,
        members: [meUid],
        status: status || 'Terbuka',
      });
      created = { ...doc.toObject(), _id: String(doc._id) };
    } else {
      const all = readFallbackJson<any[]>('clans-v1.json', []);
      created = {
        clanId,
        name: String(name).trim().slice(0, 40),
        tag: String(tag).trim().toUpperCase().slice(0, 6),
        description: String(description || '').trim().slice(0, 200),
        avatarUrl: creatorSummary?.photoUrl || '',
        leaderUid: meUid,
        leaderName: meName,
        level: initialLevel,
        members: [meUid],
        maxMembers: 50,
        status: status || 'Terbuka',
        createdAt: new Date().toISOString(),
      };
      all.push(created);
      writeFallbackJson('clans-v1.json', all);
    }

    return res.status(201).json({
      ok: true,
      clan: created,
      message: 'Klan berhasil dibuat & otomatis masuk peringkat Top Klan real-time!',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal membuat klan' });
  }
});

// POST /api/social/clans/join — Join clan
router.post('/clans/join', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const { clanId } = req.body;
    if (!clanId) return res.status(400).json({ error: 'Clan ID diperlukan' });

    await connectDB();
    if (isDbMongoConnected()) {
      const clan = await ClanModel.findOne({ clanId });
      if (!clan) return res.status(404).json({ error: 'Klan tidak ditemukan' });
      if (clan.members.length >= (clan.maxMembers || 50)) {
        return res.status(400).json({ error: 'Klan sudah penuh.' });
      }
      if (!clan.members.includes(meUid)) {
        clan.members.push(meUid);
        await clan.save();
      }
    } else {
      const all = readFallbackJson<any[]>('clans-v1.json', []);
      const found = all.find((c) => c.clanId === clanId);
      if (!found) return res.status(404).json({ error: 'Klan tidak ditemukan' });
      if (!found.members.includes(meUid)) {
        found.members.push(meUid);
        writeFallbackJson('clans-v1.json', all);
      }
    }

    return res.json({ ok: true, message: 'Berhasil bergabung dengan klan!' });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal bergabung dengan klan' });
  }
});

// POST /api/social/clans/leave — Leave clan
router.post('/clans/leave', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const { clanId } = req.body;
    if (!clanId) return res.status(400).json({ error: 'Clan ID diperlukan' });

    await connectDB();
    if (isDbMongoConnected()) {
      const clan = await ClanModel.findOne({ clanId });
      if (clan) {
        clan.members = clan.members.filter((id: string) => id !== meUid);
        await clan.save();
      }
    } else {
      const all = readFallbackJson<any[]>('clans-v1.json', []);
      const found = all.find((c) => c.clanId === clanId);
      if (found) {
        found.members = found.members.filter((id: string) => id !== meUid);
        writeFallbackJson('clans-v1.json', all);
      }
    }

    return res.json({ ok: true, message: 'Berhasil keluar dari klan.' });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal keluar klan' });
  }
});

// POST /api/social/charisma/boost — Charisma now comes strictly from likes by other users
router.post('/charisma/boost', requireAuth, async (_req: AuthenticatedRequest, res) => {
  return res.status(403).json({
    error: 'Charisma hanya bertambah saat pengguna lain menyukai profil Anda.',
  });
});

export default router;
