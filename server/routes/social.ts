import { Router } from 'express';
import { verifyAuthToken, requireAuth, type AuthenticatedRequest } from '../auth.ts';
import {
  connectDB,
  findUserByUid,
  findUsersByUids,
  isDbMongoConnected,
  readFallbackJson,
  sanitizeUser,
  searchCommunityUsers,
  toCommunityUserSummary,
  touchUserLastActive,
  writeFallbackJson,
} from '../db.ts';
import { FriendshipModel, type IFriendship } from '../models/Friendship.ts';
import { ChatMessageModel, type IChatMessage } from '../models/ChatMessage.ts';

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

// GET /api/social/users?q=... — Search ALL community users (distinct from Anime/Donghua catalog search)
router.get('/users', async (req: AuthenticatedRequest, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30));
    const viewerUid = extractViewerUid(req);

    if (viewerUid) {
      void touchUserLastActive(viewerUid);
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

    return res.json({
      ok: true,
      profile: {
        ...summary,
        friendsCount,
        relationship,
        bookmarks: (pub.bookmarks || []).slice(0, 12),
        recentHistory: (pub.watchHistory || []).slice(0, 8),
      },
    });
  } catch (err) {
    console.error('[Social Public Profile Error]', err);
    return res.status(500).json({ error: 'Gagal memuat profil pengguna' });
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

export default router;
