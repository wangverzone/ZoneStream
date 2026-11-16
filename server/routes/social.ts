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
import { createNotification } from '../notifications.ts';
import { getClanActivitiesRaw, recordClanActivity } from '../clanActivity.ts';

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

const CLAN_INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateClanInviteCode(existingCodes?: Set<string>): string {
  for (let attempt = 0; attempt < 25; attempt++) {
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += CLAN_INVITE_ALPHABET.charAt(Math.floor(Math.random() * CLAN_INVITE_ALPHABET.length));
    }
    if (!existingCodes || !existingCodes.has(code)) {
      if (existingCodes) existingCodes.add(code);
      return code;
    }
  }
  return `ZN${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

async function getAllClansRaw(): Promise<IClan[]> {
  await connectDB();
  if (isDbMongoConnected()) {
    const docs = await ClanModel.find({}).lean();
    const list = docs.map((d: any) => ({ ...d, _id: String(d._id) }));
    const existingCodes = new Set<string>(
      list.map((c: any) => String(c.inviteCode || '').trim().toUpperCase()).filter(Boolean)
    );
    const missing = list.filter((c: any) => !c.inviteCode);
    if (missing.length > 0) {
      await Promise.all(
        missing.map(async (c: any) => {
          const code = generateClanInviteCode(existingCodes);
          c.inviteCode = code;
          await ClanModel.updateOne({ clanId: c.clanId }, { $set: { inviteCode: code } }).catch(() => {});
        })
      );
    }
    return list;
  }
  const list = readFallbackJson<IClan[]>('clans-v1.json', []);
  const existingCodes = new Set<string>(
    list.map((c) => String(c.inviteCode || '').trim().toUpperCase()).filter(Boolean)
  );
  let changed = false;
  for (const c of list) {
    if (!c.inviteCode) {
      c.inviteCode = generateClanInviteCode(existingCodes);
      changed = true;
    }
  }
  if (changed) {
    writeFallbackJson('clans-v1.json', list);
  }
  return list;
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

    const meUser = await findUserByUid(meUid).catch(() => null);
    await createNotification({
      uid: targetUid,
      type: 'friend_request',
      title: 'Permintaan Pertemanan Baru',
      message: `${meUser?.name || 'Seseorang'} ingin berteman denganmu di ZoneStream.`,
      link: `/u/${encodeURIComponent(meUid)}`,
      actorUid: meUid,
      actorName: meUser?.name || '',
      actorPhoto: meUser?.photoUrl || '',
      dedupeKey: `fr_req:${pairKey}:${meUid}`,
    });

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

    const meUser = await findUserByUid(meUid).catch(() => null);
    await createNotification({
      uid: targetUid,
      type: 'friend_accept',
      title: 'Permintaan Teman Diterima',
      message: `${meUser?.name || 'Pengguna'} menerima permintaan pertemananmu!`,
      link: `/u/${encodeURIComponent(meUid)}`,
      actorUid: meUid,
      actorName: meUser?.name || '',
      actorPhoto: meUser?.photoUrl || '',
      dedupeKey: `fr_acc:${pairKey}`,
    });

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
    const mediaUrl = String(req.body?.mediaUrl || '').trim();
    const mediaType = String(req.body?.mediaType || '').trim();
    const sticker = String(req.body?.sticker || '').trim();
    const replyToId = String(req.body?.replyToId || '').trim();
    const replySenderName = String(req.body?.replySenderName || '').trim().slice(0, 40);
    const replyText = String(req.body?.replyText || '').trim().slice(0, 140);

    if (!peerUid || peerUid === meUid) {
      return res.status(400).json({ error: 'Penerima pesan tidak valid.' });
    }
    if (!text && !sticker && !mediaUrl) {
      return res.status(400).json({ error: 'Pesan, foto, atau stiker tidak boleh kosong.' });
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
        mediaUrl,
        mediaType,
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
        mediaUrl,
        mediaType,
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
      const isSenderFounder = sender?.role === 'founder';
      const isSenderPremium = Boolean(sender?.isPremium || isSenderFounder);
      const rawSenderBadge = sender?.activeBadge || (isSenderFounder ? 'Verified Founder' : 'Member');
      const safeSenderBadge =
        !isSenderFounder && String(rawSenderBadge).trim().toLowerCase() === 'verified founder'
          ? isSenderPremium
            ? 'Verified VIP'
            : 'Member'
          : rawSenderBadge;
      return {
        ...m,
        channel: normalizeGlobalChannel(m.channel),
        senderName: sender?.name || m.senderName || 'User',
        senderUsername: sender?.username || '',
        senderPhoto: sender?.photoUrl || m.senderPhoto || '',
        senderRole: sender?.role || 'member',
        senderIsPremium: isSenderPremium,
        senderBadge: safeSenderBadge,
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

// Helper to find if user is already a member or leader of any clan (strict 1 clan per user)
async function findUserActiveClan(uid: string): Promise<IClan | null> {
  if (!uid) return null;
  const clans = await getAllClansRaw();
  return (
    clans.find(
      (c) =>
        c.leaderUid === uid ||
        (Array.isArray(c.members) && c.members.includes(uid))
    ) || null
  );
}

async function removeUserPendingRequestsEverywhere(uid: string, exceptClanId?: string) {
  if (!uid) return;
  if (isDbMongoConnected()) {
    const query: any = exceptClanId ? { clanId: { $ne: exceptClanId } } : {};
    await ClanModel.updateMany(query, {
      $pull: { pendingRequests: { uid } },
    }).catch(() => {});
  } else {
    const all = readFallbackJson<any[]>('clans-v1.json', []);
    let changed = false;
    for (const c of all) {
      if (exceptClanId && c.clanId === exceptClanId) continue;
      if (Array.isArray(c.pendingRequests) && c.pendingRequests.some((r: any) => r.uid === uid)) {
        c.pendingRequests = c.pendingRequests.filter((r: any) => r.uid !== uid);
        changed = true;
      }
    }
    if (changed) writeFallbackJson('clans-v1.json', all);
  }
}

// Helper to enrich clans in real-time from member stats (Level, Charisma/Likes, Episodes Watched)
function enrichClansRealtime(clansRaw: any[], users: IUser[], viewerUid = '') {
  const userMap = new Map(users.map((u) => [u.uid, toCommunityUserSummary(u)]));

  return clansRaw
    .map((c) => {
      const memberIds: string[] = Array.isArray(c.members) ? Array.from(new Set(c.members)) : [];
      if (c.leaderUid && !memberIds.includes(c.leaderUid)) {
        memberIds.unshift(c.leaderUid);
      }

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

      const rawPending: Array<{ uid: string; requestedAt: string }> = Array.isArray(c.pendingRequests)
        ? c.pendingRequests.filter((r: any) => r?.uid && !memberIds.includes(r.uid))
        : [];
      const isLeaderViewer = Boolean(viewerUid && c.leaderUid === viewerUid);
      const enrichedPending = isLeaderViewer
        ? rawPending.map((r) => {
            const reqUser = userMap.get(r.uid);
            return {
              uid: r.uid,
              requestedAt: r.requestedAt || new Date().toISOString(),
              name: reqUser?.name || `User ${r.uid}`,
              username: reqUser?.username || '',
              photoUrl: reqUser?.photoUrl || '',
              level: reqUser?.level || 1,
              role: reqUser?.role || 'member',
              isPremium: Boolean(reqUser?.isPremium),
              activeBadge: reqUser?.activeBadge || 'Member',
            };
          })
        : [];

      const leader = userMap.get(c.leaderUid);
      const computedLevel = Math.max(1, totalLevel || c.level || 1);
      const realtimeScore = computedLevel * 10 + totalCharisma * 5 + episodesWatched * 3;
      const maxMem = c.maxMembers || 50;
      const computedStatus = memberIds.length >= maxMem ? 'Penuh' : 'Persetujuan';
      const isMemberViewer = Boolean(viewerUid && (c.leaderUid === viewerUid || memberIds.includes(viewerUid)));

      return {
        ...c,
        inviteCode: isMemberViewer ? c.inviteCode || '' : undefined,
        status: computedStatus,
        leaderName: leader?.name || c.leaderName || 'Leader',
        leaderPhoto: leader?.photoUrl || '',
        avatarUrl: c.avatarUrl || leader?.photoUrl || '',
        level: computedLevel,
        charisma: totalCharisma,
        episodesWatched,
        members: memberIds,
        membersCount: memberIds.length,
        maxMembers: maxMem,
        memberAvatars: memberProfiles.slice(0, 5),
        pendingCount: rawPending.length,
        hasPendingRequest: Boolean(viewerUid && rawPending.some((r) => r.uid === viewerUid)),
        pendingRequests: enrichedPending,
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
    const clans = enrichClansRealtime(clansRaw, users, viewerUid);
    return res.json({ ok: true, clans });
  } catch (err) {
    console.error('[Social Clans List Error]', err);
    return res.status(500).json({ error: 'Gagal memuat klan' });
  }
});

// POST /api/social/clans/create — Create clan (max 1 clan per user enforced)
router.post('/clans/create', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    await connectDB();

    const existingClan = await findUserActiveClan(meUid);
    if (existingClan) {
      return res.status(400).json({
        error: `Kamu sudah tergabung di klan [${existingClan.tag}] ${existingClan.name}. Setiap user hanya bisa bergabung maksimal 1 klan! Keluar terlebih dahulu jika ingin membuat klan baru.`,
      });
    }

    const creator = await findUserByUid(meUid);
    const creatorSummary = creator ? toCommunityUserSummary(creator) : null;
    const meName = creatorSummary?.name || req.authUser!.username || 'Wibu';
    const { name, tag, description } = req.body;
    if (!name || !tag) {
      return res.status(400).json({ error: 'Nama dan Tag Klan wajib diisi' });
    }

    const allExistingClans = await getAllClansRaw();
    const existingInviteCodes = new Set<string>(
      allExistingClans.map((c) => String(c.inviteCode || '').trim().toUpperCase()).filter(Boolean)
    );
    const inviteCode = generateClanInviteCode(existingInviteCodes);

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
        pendingRequests: [],
        status: 'Persetujuan',
        inviteCode,
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
        pendingRequests: [],
        maxMembers: 50,
        status: 'Persetujuan',
        inviteCode,
        createdAt: new Date().toISOString(),
      };
      all.push(created);
      writeFallbackJson('clans-v1.json', all);
    }

    await removeUserPendingRequestsEverywhere(meUid, clanId);

    void recordClanActivity({
      clanId,
      actorUid: meUid,
      actorName: meName,
      actorPhoto: creatorSummary?.photoUrl || '',
      type: 'member_join',
      title: `Mendirikan Klan [${created.tag}]`,
      detail: `${meName} menjadi Ketua Klan pertama`,
    });

    return res.status(201).json({
      ok: true,
      clan: created,
      message: 'Klan berhasil dibuat & otomatis masuk peringkat Top Klan real-time!',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal membuat klan' });
  }
});

// POST /api/social/clans/join — Request to join clan (requires real-time Leader ACC + max 1 clan per user)
router.post('/clans/join', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const { clanId } = req.body;
    if (!clanId) return res.status(400).json({ error: 'Clan ID diperlukan' });

    await connectDB();

    const existingClan = await findUserActiveClan(meUid);
    if (existingClan) {
      if (existingClan.clanId === clanId) {
        return res.status(400).json({ error: 'Kamu sudah menjadi anggota klan ini.' });
      }
      return res.status(400).json({
        error: `Kamu sudah tergabung di klan [${existingClan.tag}] ${existingClan.name}. Setiap user hanya bisa bergabung di 1 klan saja!`,
      });
    }

    const nowIso = new Date().toISOString();

    if (isDbMongoConnected()) {
      const clan = await ClanModel.findOne({ clanId });
      if (!clan) return res.status(404).json({ error: 'Klan tidak ditemukan' });
      if (clan.members.length >= (clan.maxMembers || 50)) {
        return res.status(400).json({ error: 'Klan sudah penuh.' });
      }
      const pending = Array.isArray(clan.pendingRequests) ? clan.pendingRequests : [];
      if (pending.some((r: any) => r.uid === meUid)) {
        return res.json({
          ok: true,
          status: 'pending',
          message: 'Permintaan gabung sudah dikirim. Menunggu ACC ketua klan secara real-time.',
        });
      }
      clan.pendingRequests = [...pending, { uid: meUid, requestedAt: nowIso }];
      await clan.save();
    } else {
      const all = readFallbackJson<any[]>('clans-v1.json', []);
      const found = all.find((c) => c.clanId === clanId);
      if (!found) return res.status(404).json({ error: 'Klan tidak ditemukan' });
      if ((found.members?.length || 0) >= (found.maxMembers || 50)) {
        return res.status(400).json({ error: 'Klan sudah penuh.' });
      }
      const pending = Array.isArray(found.pendingRequests) ? found.pendingRequests : [];
      if (!pending.some((r: any) => r.uid === meUid)) {
        found.pendingRequests = [...pending, { uid: meUid, requestedAt: nowIso }];
        writeFallbackJson('clans-v1.json', all);
      }
    }

    return res.json({
      ok: true,
      status: 'pending',
      message: 'Permintaan gabung dikirim! Menunggu ACC dari ketua klan secara real-time.',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal mengirim permintaan gabung klan' });
  }
});

// POST /api/social/clans/cancel-request — Cancel pending join request
router.post('/clans/cancel-request', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const { clanId } = req.body;
    if (!clanId) return res.status(400).json({ error: 'Clan ID diperlukan' });

    await connectDB();
    if (isDbMongoConnected()) {
      await ClanModel.updateOne(
        { clanId },
        { $pull: { pendingRequests: { uid: meUid } } }
      );
    } else {
      const all = readFallbackJson<any[]>('clans-v1.json', []);
      const found = all.find((c) => c.clanId === clanId);
      if (found && Array.isArray(found.pendingRequests)) {
        found.pendingRequests = found.pendingRequests.filter((r: any) => r.uid !== meUid);
        writeFallbackJson('clans-v1.json', all);
      }
    }

    return res.json({ ok: true, message: 'Permintaan gabung dibatalkan.' });
  } catch {
    return res.status(500).json({ error: 'Gagal membatalkan permintaan gabung' });
  }
});

// POST /api/social/clans/review — Leader approves (ACC) or rejects join request in real-time
router.post('/clans/review', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const { clanId, targetUid, action } = req.body || {};
    const cleanTargetUid = String(targetUid || '').trim();
    if (!clanId || !cleanTargetUid || (action !== 'accept' && action !== 'reject')) {
      return res.status(400).json({ error: 'Parameter persetujuan klan tidak valid.' });
    }

    await connectDB();

    if (isDbMongoConnected()) {
      const clan = await ClanModel.findOne({ clanId });
      if (!clan) return res.status(404).json({ error: 'Klan tidak ditemukan' });
      if (clan.leaderUid !== meUid) {
        return res.status(403).json({ error: 'Hanya ketua klan yang dapat ACC atau menolak pendaftar.' });
      }

      clan.pendingRequests = (Array.isArray(clan.pendingRequests) ? clan.pendingRequests : []).filter(
        (r: any) => r.uid !== cleanTargetUid
      );

      if (action === 'accept') {
        const targetExisting = await findUserActiveClan(cleanTargetUid);
        if (targetExisting && targetExisting.clanId !== clanId) {
          await clan.save();
          return res.status(400).json({
            error: `User ini sudah tergabung di klan [${targetExisting.tag}] ${targetExisting.name} (maksimal 1 klan per user).`,
          });
        }
        if (clan.members.length >= (clan.maxMembers || 50)) {
          await clan.save();
          return res.status(400).json({ error: 'Klan sudah penuh.' });
        }
        if (!clan.members.includes(cleanTargetUid)) {
          clan.members.push(cleanTargetUid);
        }
        await clan.save();
        await removeUserPendingRequestsEverywhere(cleanTargetUid);
      } else {
        await clan.save();
      }
    } else {
      const all = readFallbackJson<any[]>('clans-v1.json', []);
      const found = all.find((c) => c.clanId === clanId);
      if (!found) return res.status(404).json({ error: 'Klan tidak ditemukan' });
      if (found.leaderUid !== meUid) {
        return res.status(403).json({ error: 'Hanya ketua klan yang dapat ACC atau menolak pendaftar.' });
      }

      found.pendingRequests = (Array.isArray(found.pendingRequests) ? found.pendingRequests : []).filter(
        (r: any) => r.uid !== cleanTargetUid
      );

      if (action === 'accept') {
        const targetExisting = all.find(
          (c) =>
            c.clanId !== clanId &&
            (c.leaderUid === cleanTargetUid || (Array.isArray(c.members) && c.members.includes(cleanTargetUid)))
        );
        if (targetExisting) {
          writeFallbackJson('clans-v1.json', all);
          return res.status(400).json({
            error: `User ini sudah tergabung di klan [${targetExisting.tag}] ${targetExisting.name} (maksimal 1 klan per user).`,
          });
        }
        if ((found.members?.length || 0) >= (found.maxMembers || 50)) {
          writeFallbackJson('clans-v1.json', all);
          return res.status(400).json({ error: 'Klan sudah penuh.' });
        }
        if (!found.members.includes(cleanTargetUid)) {
          found.members.push(cleanTargetUid);
        }
        for (const c of all) {
          if (Array.isArray(c.pendingRequests)) {
            c.pendingRequests = c.pendingRequests.filter((r: any) => r.uid !== cleanTargetUid);
          }
        }
      }
      writeFallbackJson('clans-v1.json', all);
    }

    if (action === 'accept') {
      const joinedUser = await findUserByUid(cleanTargetUid);
      void recordClanActivity({
        clanId,
        actorUid: cleanTargetUid,
        actorName: joinedUser?.name || joinedUser?.username || `User ${cleanTargetUid}`,
        actorPhoto: joinedUser?.photoUrl || '',
        type: 'member_join',
        title: 'Bergabung ke Klan (ACC Ketua)',
        detail: 'Pengajuan gabung diterima oleh ketua klan',
      });
    }

    await createNotification({
      uid: cleanTargetUid,
      type: 'clan_review',
      title: action === 'accept' ? 'Permintaan Klan Di-ACC!' : 'Permintaan Gabung Klan Ditolak',
      message:
        action === 'accept'
          ? 'Ketua klan telah menerima permintaanmu. Kamu resmi bergabung ke klan!'
          : 'Permintaan bergabung ke klan belum disetujui ketua klan.',
      link: '/leaderboard',
      actorUid: meUid,
    });

    return res.json({
      ok: true,
      action,
      message:
        action === 'accept'
          ? 'Permintaan diterima (ACC)! Anggota baru resmi bergabung ke klan.'
          : 'Permintaan gabung ditolak.',
    });
  } catch (err) {
    console.error('[Clan Review Error]', err);
    return res.status(500).json({ error: 'Gagal memproses persetujuan klan' });
  }
});

// POST /api/social/clans/leave — Leave clan (if leader leaves, transfers leadership or disbands empty clan)
router.post('/clans/leave', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const { clanId } = req.body;
    if (!clanId) return res.status(400).json({ error: 'Clan ID diperlukan' });

    await connectDB();
    if (isDbMongoConnected()) {
      const clan = await ClanModel.findOne({ clanId });
      if (clan) {
        const remaining = clan.members.filter((id: string) => id !== meUid);
        if (clan.leaderUid === meUid) {
          if (remaining.length === 0) {
            await ClanModel.deleteOne({ clanId });
          } else {
            const nextLeaderUid = remaining[0];
            const nextLeader = await findUserByUid(nextLeaderUid);
            clan.leaderUid = nextLeaderUid;
            clan.leaderName = nextLeader?.name || nextLeader?.username || 'Ketua Klan';
            clan.members = remaining;
            await clan.save();
          }
        } else {
          clan.members = remaining;
          await clan.save();
        }
      }
    } else {
      let all = readFallbackJson<any[]>('clans-v1.json', []);
      const found = all.find((c) => c.clanId === clanId);
      if (found) {
        const remaining = (found.members || []).filter((id: string) => id !== meUid);
        if (found.leaderUid === meUid) {
          if (remaining.length === 0) {
            all = all.filter((c) => c.clanId !== clanId);
          } else {
            const nextLeaderUid = remaining[0];
            const nextLeader = await findUserByUid(nextLeaderUid);
            found.leaderUid = nextLeaderUid;
            found.leaderName = nextLeader?.name || nextLeader?.username || 'Ketua Klan';
            found.members = remaining;
          }
        } else {
          found.members = remaining;
        }
        writeFallbackJson('clans-v1.json', all);
      }
    }

    return res.json({ ok: true, message: 'Berhasil keluar dari klan.' });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal keluar klan' });
  }
});

// GET /api/social/clans/invite/:code — Public clan invite preview lookup
router.get('/clans/invite/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (!code) {
      return res.status(400).json({ error: 'Kode rekrutmen klan tidak valid.' });
    }

    const [clansRaw, users] = await Promise.all([getAllClansRaw(), getAllUsersSafe()]);
    const targetRaw = clansRaw.find(
      (c) => String(c.inviteCode || '').trim().toUpperCase() === code
    );
    if (!targetRaw) {
      return res.status(404).json({
        error: 'Kode rekrutmen klan tidak ditemukan atau sudah diganti oleh ketua klan.',
      });
    }

    const enrichedList = enrichClansRealtime([targetRaw], users, targetRaw.leaderUid);
    const clan = enrichedList[0];
    return res.json({
      ok: true,
      clan: {
        clanId: clan.clanId,
        name: clan.name,
        tag: clan.tag,
        description: clan.description || '',
        avatarUrl: clan.avatarUrl || '',
        leaderUid: clan.leaderUid,
        leaderName: clan.leaderName,
        leaderPhoto: clan.leaderPhoto || '',
        level: clan.level || 1,
        charisma: clan.charisma || 0,
        membersCount: clan.membersCount || 1,
        maxMembers: clan.maxMembers || 50,
        status: clan.status,
        inviteCode: targetRaw.inviteCode || code,
      },
    });
  } catch (err) {
    console.error('[Clan Invite Lookup Error]', err);
    return res.status(500).json({ error: 'Gagal memuat detail undangan klan' });
  }
});

// POST /api/social/clans/invite/regenerate — Leader regenerates a new random recruit code
router.post('/clans/invite/regenerate', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const { clanId } = req.body || {};
    if (!clanId) return res.status(400).json({ error: 'Clan ID diperlukan' });

    const allClans = await getAllClansRaw();
    const existingCodes = new Set<string>(
      allClans.map((c) => String(c.inviteCode || '').trim().toUpperCase()).filter(Boolean)
    );
    const nextCode = generateClanInviteCode(existingCodes);

    if (isDbMongoConnected()) {
      const clan = await ClanModel.findOne({ clanId });
      if (!clan) return res.status(404).json({ error: 'Klan tidak ditemukan' });
      if (clan.leaderUid !== meUid) {
        return res.status(403).json({ error: 'Hanya ketua klan yang dapat mengacak kode undangan baru.' });
      }
      clan.inviteCode = nextCode;
      await clan.save();
    } else {
      const all = readFallbackJson<any[]>('clans-v1.json', []);
      const found = all.find((c) => c.clanId === clanId);
      if (!found) return res.status(404).json({ error: 'Klan tidak ditemukan' });
      if (found.leaderUid !== meUid) {
        return res.status(403).json({ error: 'Hanya ketua klan yang dapat mengacak kode undangan baru.' });
      }
      found.inviteCode = nextCode;
      writeFallbackJson('clans-v1.json', all);
    }

    return res.json({
      ok: true,
      inviteCode: nextCode,
      message: 'Kode rekrutmen acak baru berhasil dibuat! Link lama otomatis nonaktif.',
    });
  } catch (err) {
    console.error('[Clan Invite Regenerate Error]', err);
    return res.status(500).json({ error: 'Gagal mengacak kode rekrutmen baru' });
  }
});

// POST /api/social/clans/join-invite — Auto-join a clan immediately via valid random invite code/link
router.post('/clans/join-invite', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const rawCode = String(req.body?.inviteCode || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (!rawCode) {
      return res.status(400).json({ error: 'Kode rekrutmen klan wajib diisi.' });
    }

    await connectDB();
    const allClans = await getAllClansRaw();
    const targetClan = allClans.find(
      (c) => String(c.inviteCode || '').trim().toUpperCase() === rawCode
    );
    if (!targetClan) {
      return res.status(404).json({
        error: 'Kode rekrutmen klan tidak ditemukan atau sudah kedaluwarsa.',
      });
    }

    const existingClan = await findUserActiveClan(meUid);
    if (existingClan) {
      if (existingClan.clanId === targetClan.clanId) {
        return res.json({
          ok: true,
          alreadyMember: true,
          clan: {
            clanId: targetClan.clanId,
            name: targetClan.name,
            tag: targetClan.tag,
            leaderName: targetClan.leaderName,
            membersCount: targetClan.members?.length || 1,
            maxMembers: targetClan.maxMembers || 50,
            inviteCode: targetClan.inviteCode || rawCode,
          },
          message: `Kamu sudah menjadi anggota klan [${targetClan.tag}] ${targetClan.name}!`,
        });
      }
      return res.status(400).json({
        error: `Kamu sudah tergabung di klan [${existingClan.tag}] ${existingClan.name}. Setiap user hanya bisa bergabung di 1 klan saja!`,
      });
    }

    let updatedMembersCount = (targetClan.members?.length || 1) + 1;

    if (isDbMongoConnected()) {
      const doc = await ClanModel.findOne({ clanId: targetClan.clanId });
      if (!doc) return res.status(404).json({ error: 'Klan tidak ditemukan' });
      const currentMembers = Array.isArray(doc.members) ? doc.members : [];
      if (currentMembers.length >= (doc.maxMembers || 50)) {
        return res.status(400).json({ error: `Klan [${doc.tag}] ${doc.name} sudah penuh.` });
      }
      if (!currentMembers.includes(meUid)) {
        doc.members = [...currentMembers, meUid];
      }
      doc.pendingRequests = (Array.isArray(doc.pendingRequests) ? doc.pendingRequests : []).filter(
        (r: any) => r.uid !== meUid
      );
      updatedMembersCount = doc.members.length;
      await doc.save();
    } else {
      const all = readFallbackJson<any[]>('clans-v1.json', []);
      const found = all.find((c) => c.clanId === targetClan.clanId);
      if (!found) return res.status(404).json({ error: 'Klan tidak ditemukan' });
      const currentMembers = Array.isArray(found.members) ? found.members : [];
      if (currentMembers.length >= (found.maxMembers || 50)) {
        return res.status(400).json({ error: `Klan [${found.tag}] ${found.name} sudah penuh.` });
      }
      if (!currentMembers.includes(meUid)) {
        found.members = [...currentMembers, meUid];
      }
      found.pendingRequests = (Array.isArray(found.pendingRequests) ? found.pendingRequests : []).filter(
        (r: any) => r.uid !== meUid
      );
      updatedMembersCount = found.members.length;
      writeFallbackJson('clans-v1.json', all);
    }

    await removeUserPendingRequestsEverywhere(meUid);

    const joiner = await findUserByUid(meUid);
    const joinerName = joiner?.name || req.authUser!.username || `User ${meUid}`;
    void recordClanActivity({
      clanId: targetClan.clanId,
      actorUid: meUid,
      actorName: joinerName,
      actorPhoto: joiner?.photoUrl || '',
      type: 'member_join',
      title: 'Bergabung via Link Rekrut',
      detail: `${joinerName} langsung bergabung dengan kode undangan acak`,
    });

    if (targetClan.leaderUid && targetClan.leaderUid !== meUid) {
      await createNotification({
        uid: targetClan.leaderUid,
        type: 'clan_review',
        title: 'Anggota Baru Gabung via Rekrut!',
        message: `${joinerName} baru saja otomatis bergabung ke [${targetClan.tag}] ${targetClan.name} lewat kode/link rekrutmen.`,
        link: '/leaderboard?tab=clans',
        actorUid: meUid,
      });
    }

    return res.json({
      ok: true,
      alreadyMember: false,
      clan: {
        clanId: targetClan.clanId,
        name: targetClan.name,
        tag: targetClan.tag,
        leaderName: targetClan.leaderName,
        membersCount: updatedMembersCount,
        maxMembers: targetClan.maxMembers || 50,
        inviteCode: targetClan.inviteCode || rawCode,
      },
      message: `Selamat! Kamu otomatis bergabung ke klan [${targetClan.tag}] ${targetClan.name}!`,
    });
  } catch (err) {
    console.error('[Clan Invite Auto-Join Error]', err);
    return res.status(500).json({ error: 'Gagal memproses undangan gabung klan' });
  }
});

// GET /api/social/clans/:clanId/activity — Real-time Clan Activity Feed + Most Active Members ranking
router.get('/clans/:clanId/activity', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const clanId = String(req.params.clanId || '').trim();
    const filter = String(req.query.filter || 'all').trim();
    if (!clanId) return res.status(400).json({ error: 'Clan ID diperlukan' });

    const [clansRaw, users] = await Promise.all([getAllClansRaw(), getAllUsersSafe()]);
    const clan = clansRaw.find((c) => c.clanId === clanId);
    if (!clan) return res.status(404).json({ error: 'Klan tidak ditemukan' });

    const memberIds: string[] = Array.from(
      new Set([clan.leaderUid, ...(Array.isArray(clan.members) ? clan.members : [])].filter(Boolean))
    );
    const isAuthorized =
      req.authUser!.role === 'founder' || memberIds.includes(meUid);
    if (!isAuthorized) {
      return res.status(403).json({
        error: 'Hanya anggota dan ketua klan yang dapat melihat Clan Activity Feed.',
      });
    }

    const userMap = new Map<string, IUser>(users.map((u) => [u.uid, u]));
    const allActivities = await getClanActivitiesRaw(clanId, 80);

    // Count missions & level-ups per member from real activity history
    const memberStatsMap = new Map<string, { missionsCompleted: number; levelUps: number; latestActivityAt: string }>();
    for (const uid of memberIds) {
      memberStatsMap.set(uid, { missionsCompleted: 0, levelUps: 0, latestActivityAt: '' });
    }
    for (const act of allActivities) {
      const stats = memberStatsMap.get(act.actorUid) || {
        missionsCompleted: 0,
        levelUps: 0,
        latestActivityAt: '',
      };
      if (act.type === 'level_up') stats.levelUps += 1;
      if (act.type === 'mission_complete') stats.missionsCompleted += 1;
      if (!stats.latestActivityAt || act.createdAt > stats.latestActivityAt) {
        stats.latestActivityAt = act.createdAt;
      }
      memberStatsMap.set(act.actorUid, stats);
    }

    const enrichedActivities = allActivities
      .filter((act) => filter === 'all' || act.type === filter)
      .slice(0, 50)
      .map((act) => {
        const u = userMap.get(act.actorUid);
        const summary = u ? toCommunityUserSummary(u) : null;
        return {
          ...act,
          actorName: summary?.name || act.actorName,
          actorPhoto: summary?.photoUrl || act.actorPhoto || '',
          actorLevel: summary?.role === 'founder' ? 999999 : summary?.level || act.newLevel || 1,
          actorRole: summary?.role || 'member',
          isLeader: act.actorUid === clan.leaderUid,
        };
      });

    const rawRoleMap: Record<string, string> =
      clan.memberRoles && typeof clan.memberRoles === 'object' ? (clan.memberRoles as any) : {};
    const nowMs = Date.now();

    const mostActiveMembers = memberIds
      .map((uid) => {
        const rawUser = userMap.get(uid);
        const summary = rawUser ? toCommunityUserSummary(rawUser) : null;
        const stats = memberStatsMap.get(uid) || {
          missionsCompleted: 0,
          levelUps: 0,
          latestActivityAt: '',
        };
        const episodesWatched = summary?.totalEpisodesWatched || 0;
        const watchStreak = Number(rawUser?.watchStreak || 0);
        const dailyEpisodes = Number(rawUser?.dailyEpisodesWatched || 0);
        const activityScore =
          stats.levelUps * 8 +
          stats.missionsCompleted * 4 +
          watchStreak * 3 +
          Math.min(episodesWatched, 400);

        const isLeader = uid === clan.leaderUid;
        const assignedRole = rawRoleMap[uid];
        const clanRole: 'leader' | 'co_leader' | 'elder' | 'member' = isLeader
          ? 'leader'
          : assignedRole === 'co_leader' || assignedRole === 'elder'
          ? assignedRole
          : 'member';

        const lastActiveIso =
          stats.latestActivityAt ||
          (rawUser?.lastActiveAt ? new Date(rawUser.lastActiveAt).toISOString() : '') ||
          (rawUser?.lastLoginAt ? new Date(rawUser.lastLoginAt).toISOString() : '');
        const lastActiveMs = lastActiveIso ? new Date(lastActiveIso).getTime() : 0;
        const isOnline = Boolean(summary?.isOnline || (lastActiveMs > 0 && nowMs - lastActiveMs < 3 * 60 * 1000));
        const inactiveDays = lastActiveMs > 0 ? Math.floor((nowMs - lastActiveMs) / 86_400_000) : 99;
        const isInactive = !isLeader && !isOnline && (inactiveDays >= 3 || (episodesWatched === 0 && stats.missionsCompleted === 0));

        return {
          uid,
          name: summary?.name || (isLeader ? clan.leaderName : `User ${uid}`),
          photoUrl: summary?.photoUrl || '',
          level: summary?.role === 'founder' ? 999999 : summary?.level || 1,
          role: summary?.role || 'member',
          clanRole,
          isLeader,
          isOnline,
          isInactive,
          inactiveDays: lastActiveMs > 0 ? inactiveDays : null,
          episodesWatched,
          dailyEpisodes,
          watchStreak,
          missionsCompleted: stats.missionsCompleted,
          levelUps: stats.levelUps,
          latestActivityAt: lastActiveIso,
          activityScore,
        };
      })
      .sort(
        (a, b) =>
          b.activityScore - a.activityScore ||
          b.episodesWatched - a.episodesWatched ||
          b.level - a.level
      );

    return res.json({
      ok: true,
      clanId,
      activities: enrichedActivities,
      mostActiveMembers,
      totalCount: allActivities.length,
    });
  } catch (err) {
    console.error('[Clan Activity Feed Error]', err);
    return res.status(500).json({ error: 'Gagal memuat Clan Activity Feed' });
  }
});

const CLAN_ROLE_LABELS: Record<'leader' | 'co_leader' | 'elder' | 'member', string> = {
  leader: 'Ketua Klan',
  co_leader: 'Wakil Ketua (Co-Leader)',
  elder: 'Tetua Klan (Elder)',
  member: 'Anggota',
};

// POST /api/social/clans/promote — Leader assigns clan role or transfers leadership in real-time
router.post('/clans/promote', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const { clanId, targetUid, newRole } = req.body || {};
    const cleanTargetUid = String(targetUid || '').trim();
    const cleanRole = String(newRole || '').trim() as 'leader' | 'co_leader' | 'elder' | 'member';

    if (
      !clanId ||
      !cleanTargetUid ||
      !['leader', 'co_leader', 'elder', 'member'].includes(cleanRole)
    ) {
      return res.status(400).json({ error: 'Parameter promosi jabatan klan tidak valid.' });
    }

    if (cleanTargetUid === meUid) {
      return res.status(400).json({ error: 'Tidak dapat mengubah jabatan diri sendiri.' });
    }

    await connectDB();
    const targetUser = await findUserByUid(cleanTargetUid);
    const targetName = targetUser?.name || targetUser?.username || `User ${cleanTargetUid}`;
    let clanTag = '';
    let clanName = '';

    if (isDbMongoConnected()) {
      const clan = await ClanModel.findOne({ clanId });
      if (!clan) return res.status(404).json({ error: 'Klan tidak ditemukan' });
      if (clan.leaderUid !== meUid) {
        return res.status(403).json({ error: 'Hanya Ketua Klan yang dapat mengatur promosi jabatan.' });
      }
      if (!clan.members.includes(cleanTargetUid)) {
        return res.status(400).json({ error: 'Pengguna tersebut bukan anggota klan ini.' });
      }

      clanTag = clan.tag;
      clanName = clan.name;
      const roles: Record<string, any> =
        clan.memberRoles && typeof clan.memberRoles === 'object' ? { ...clan.memberRoles } : {};

      if (cleanRole === 'leader') {
        roles[meUid] = 'co_leader';
        roles[cleanTargetUid] = 'leader';
        clan.leaderUid = cleanTargetUid;
        clan.leaderName = targetName;
      } else {
        roles[cleanTargetUid] = cleanRole;
      }
      clan.memberRoles = roles;
      clan.markModified('memberRoles');
      await clan.save();
    } else {
      const all = readFallbackJson<any[]>('clans-v1.json', []);
      const found = all.find((c) => c.clanId === clanId);
      if (!found) return res.status(404).json({ error: 'Klan tidak ditemukan' });
      if (found.leaderUid !== meUid) {
        return res.status(403).json({ error: 'Hanya Ketua Klan yang dapat mengatur promosi jabatan.' });
      }
      if (!Array.isArray(found.members) || !found.members.includes(cleanTargetUid)) {
        return res.status(400).json({ error: 'Pengguna tersebut bukan anggota klan ini.' });
      }

      clanTag = found.tag;
      clanName = found.name;
      const roles: Record<string, any> =
        found.memberRoles && typeof found.memberRoles === 'object' ? { ...found.memberRoles } : {};

      if (cleanRole === 'leader') {
        roles[meUid] = 'co_leader';
        roles[cleanTargetUid] = 'leader';
        found.leaderUid = cleanTargetUid;
        found.leaderName = targetName;
      } else {
        roles[cleanTargetUid] = cleanRole;
      }
      found.memberRoles = roles;
      writeFallbackJson('clans-v1.json', all);
    }

    const roleLabel = CLAN_ROLE_LABELS[cleanRole];
    void recordClanActivity({
      clanId,
      actorUid: cleanTargetUid,
      actorName: targetName,
      actorPhoto: targetUser?.photoUrl || '',
      type: 'role_change',
      title: `Jabatan Klan: ${roleLabel}`,
      detail: `${targetName} diangkat menjadi ${roleLabel} di [${clanTag}] ${clanName}`,
    });

    await createNotification({
      uid: cleanTargetUid,
      type: 'clan_review',
      title: `Promosi Jabatan Klan [${clanTag}]`,
      message: `Jabatanmu di klan [${clanTag}] ${clanName} kini diperbarui menjadi ${roleLabel}!`,
      link: '/leaderboard?tab=clans',
      actorUid: meUid,
    });

    return res.json({
      ok: true,
      targetUid: cleanTargetUid,
      newRole: cleanRole,
      message: `Jabatan ${targetName} berhasil diperbarui menjadi ${roleLabel}!`,
    });
  } catch (err) {
    console.error('[Clan Promote Error]', err);
    return res.status(500).json({ error: 'Gagal memperbarui jabatan anggota klan' });
  }
});

// POST /api/social/clans/kick — Leader (or Co-Leader for regular members) kicks a member in real-time
router.post('/clans/kick', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const meUid = req.authUser!.uid;
    const { clanId, targetUid, reason } = req.body || {};
    const cleanTargetUid = String(targetUid || '').trim();

    if (!clanId || !cleanTargetUid) {
      return res.status(400).json({ error: 'Clan ID dan UID anggota wajib diisi.' });
    }
    if (cleanTargetUid === meUid) {
      return res.status(400).json({ error: 'Gunakan tombol Keluar Klan untuk keluar sendiri.' });
    }

    await connectDB();
    const targetUser = await findUserByUid(cleanTargetUid);
    const targetName = targetUser?.name || targetUser?.username || `User ${cleanTargetUid}`;
    let clanTag = '';
    let clanName = '';

    if (isDbMongoConnected()) {
      const clan = await ClanModel.findOne({ clanId });
      if (!clan) return res.status(404).json({ error: 'Klan tidak ditemukan' });

      const roles: Record<string, any> =
        clan.memberRoles && typeof clan.memberRoles === 'object' ? { ...clan.memberRoles } : {};
      const isLeader = clan.leaderUid === meUid;
      const isCoLeader = roles[meUid] === 'co_leader';
      const targetRole = cleanTargetUid === clan.leaderUid ? 'leader' : roles[cleanTargetUid] || 'member';

      if (!isLeader && !(isCoLeader && (targetRole === 'member' || targetRole === 'elder'))) {
        return res.status(403).json({
          error: 'Hanya Ketua Klan atau Wakil Ketua yang dapat mengeluarkan anggota.',
        });
      }
      if (cleanTargetUid === clan.leaderUid) {
        return res.status(400).json({ error: 'Ketua Klan tidak dapat dikeluarkan.' });
      }
      if (!clan.members.includes(cleanTargetUid)) {
        return res.status(404).json({ error: 'Angguna tidak ditemukan di dalam klan.' });
      }

      clanTag = clan.tag;
      clanName = clan.name;
      clan.members = clan.members.filter((id: string) => id !== cleanTargetUid);
      delete roles[cleanTargetUid];
      clan.memberRoles = roles;
      clan.markModified('memberRoles');
      await clan.save();
    } else {
      const all = readFallbackJson<any[]>('clans-v1.json', []);
      const found = all.find((c) => c.clanId === clanId);
      if (!found) return res.status(404).json({ error: 'Klan tidak ditemukan' });

      const roles: Record<string, any> =
        found.memberRoles && typeof found.memberRoles === 'object' ? { ...found.memberRoles } : {};
      const isLeader = found.leaderUid === meUid;
      const isCoLeader = roles[meUid] === 'co_leader';
      const targetRole = cleanTargetUid === found.leaderUid ? 'leader' : roles[cleanTargetUid] || 'member';

      if (!isLeader && !(isCoLeader && (targetRole === 'member' || targetRole === 'elder'))) {
        return res.status(403).json({
          error: 'Hanya Ketua Klan atau Wakil Ketua yang dapat mengeluarkan anggota.',
        });
      }
      if (cleanTargetUid === found.leaderUid) {
        return res.status(400).json({ error: 'Ketua Klan tidak dapat dikeluarkan.' });
      }
      if (!Array.isArray(found.members) || !found.members.includes(cleanTargetUid)) {
        return res.status(404).json({ error: 'Anggota tidak ditemukan di dalam klan.' });
      }

      clanTag = found.tag;
      clanName = found.name;
      found.members = found.members.filter((id: string) => id !== cleanTargetUid);
      delete roles[cleanTargetUid];
      found.memberRoles = roles;
      writeFallbackJson('clans-v1.json', all);
    }

    const cleanReason = String(reason || 'Tidak aktif / evaluasi manajemen klan').trim().slice(0, 120);
    void recordClanActivity({
      clanId,
      actorUid: cleanTargetUid,
      actorName: targetName,
      actorPhoto: targetUser?.photoUrl || '',
      type: 'member_kick',
      title: 'Dikeluarkan dari Klan',
      detail: `${targetName} dikeluarkan (${cleanReason})`,
    });

    await createNotification({
      uid: cleanTargetUid,
      type: 'clan_review',
      title: `Dikeluarkan dari Klan [${clanTag}]`,
      message: `Kamu telah dikeluarkan dari klan [${clanTag}] ${clanName}. Alasan: ${cleanReason}`,
      link: '/leaderboard?tab=clans',
      actorUid: meUid,
    });

    return res.json({
      ok: true,
      targetUid: cleanTargetUid,
      message: `${targetName} berhasil dikeluarkan dari klan secara real-time.`,
    });
  } catch (err) {
    console.error('[Clan Kick Error]', err);
    return res.status(500).json({ error: 'Gagal mengeluarkan anggota dari klan' });
  }
});

// POST /api/social/charisma/boost — Charisma now comes strictly from likes by other users
router.post('/charisma/boost', requireAuth, async (_req: AuthenticatedRequest, res) => {
  return res.status(403).json({
    error: 'Charisma hanya bertambah saat pengguna lain menyukai profil Anda.',
  });
});

export default router;

