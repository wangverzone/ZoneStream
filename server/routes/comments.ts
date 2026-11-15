import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../auth.ts';
import { connectDB, findUserByUid } from '../db.ts';
import { CommentModel } from '../models/Comment.ts';
import { UserModel } from '../models/User.ts';

const router = Router();

const VIP_TOKEN_REGEX = /\[vip:[a-z0-9_-]+\]/i;

const memoryComments: Array<any> = [];

// GET /api/comments?mediaKey=donghua:renegade-immortal&sort=latest|popular
router.get('/', async (req, res) => {
  try {
    const mediaKey = String(req.query.mediaKey || '').trim();
    const sort = String(req.query.sort || 'latest').toLowerCase();
    if (!mediaKey) {
      return res.status(400).json({ error: 'mediaKey wajib diisi' });
    }

    const mongoOk = await connectDB();
    let rawComments: any[] = [];

    if (mongoOk) {
      rawComments = await CommentModel.find({ mediaKey })
        .sort({ pinned: -1, createdAt: -1 })
        .limit(120)
        .lean();

      // Enrich live user metadata so badges, borders, levels, and avatars stay current
      const uids = Array.from(new Set(rawComments.map((c) => c.uid).filter(Boolean)));
      if (uids.length > 0) {
        const users = await UserModel.find({ uid: { $in: uids } })
          .select('uid name photoUrl role isPremium isVerified activeBadge activeBorder profileTheme statusEmoji level')
          .lean();
        const userMap = new Map(users.map((u: any) => [u.uid, u]));
        rawComments = rawComments.map((c) => {
          const live = userMap.get(c.uid);
          if (!live) return c;
          return {
            ...c,
            authorName: live.name || c.authorName,
            authorPhoto: live.photoUrl ?? c.authorPhoto,
            authorRole: live.role || c.authorRole,
            authorIsPremium: Boolean(live.isPremium || live.isVerified || live.role === 'founder'),
            authorBadge: live.activeBadge || c.authorBadge,
            authorBorder: live.activeBorder || c.authorBorder,
            authorTheme: live.profileTheme || c.authorTheme || 'default',
            authorStatusEmoji: live.statusEmoji || c.authorStatusEmoji || '',
            authorLevel: live.level || c.authorLevel,
          };
        });
      }
    } else {
      rawComments = memoryComments.filter((c) => c.mediaKey === mediaKey);
    }

    if (sort === 'popular') {
      rawComments.sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
        return (b.likes?.length || 0) - (a.likes?.length || 0);
      });
    }

    const normalized = rawComments.map((c) => ({
      _id: String(c._id),
      mediaKey: c.mediaKey,
      mediaTitle: c.mediaTitle || '',
      episodeTitle: c.episodeTitle || '',
      parentId: c.parentId || '',
      uid: c.uid,
      authorName: c.authorName,
      authorPhoto: c.authorPhoto || '',
      authorRole: c.authorRole || 'member',
      authorIsPremium: Boolean(c.authorIsPremium),
      authorBadge: c.authorBadge || 'Member',
      authorBorder: c.authorBorder || 'classic',
      authorTheme: c.authorTheme || 'default',
      authorStatusEmoji: c.authorStatusEmoji || '',
      authorLevel: c.authorLevel || 1,
      text: c.text || '',
      sticker: c.sticker || '',
      likes: Array.isArray(c.likes) ? c.likes : [],
      pinned: Boolean(c.pinned),
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
    }));

    return res.json({ ok: true, comments: normalized });
  } catch (err) {
    console.error('[Comments GET Error]', err);
    return res.status(500).json({ error: 'Gagal memuat komentar' });
  }
});

// POST /api/comments — Post a comment or reply (Premium/Founder exclusive emojis & stickers enforced)
router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const user = await findUserByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'Akun tidak ditemukan' });
    }

    const { mediaKey, mediaTitle, episodeTitle, parentId, text, sticker } = req.body || {};
    const cleanMediaKey = String(mediaKey || '').trim();
    const cleanText = String(text || '').trim().slice(0, 800);
    const cleanSticker = String(sticker || '').trim().slice(0, 40);

    if (!cleanMediaKey) {
      return res.status(400).json({ error: 'Target mediaKey tidak valid' });
    }
    if (!cleanText && !cleanSticker) {
      return res.status(400).json({ error: 'Komentar atau stiker tidak boleh kosong.' });
    }

    const hasVipPrivilege = Boolean(user.isPremium || user.isVerified || user.role === 'founder');
    const usesVipToken = VIP_TOKEN_REGEX.test(cleanText) || Boolean(cleanSticker);

    if (usesVipToken && !hasVipPrivilege) {
      return res.status(403).json({
        error:
          'Emoji & Stiker eksklusif hanya tersedia untuk akun Premium & Founder! Upgrade ke Premium terlebih dahulu.',
      });
    }

    const payload = {
      mediaKey: cleanMediaKey,
      mediaTitle: String(mediaTitle || '').slice(0, 120),
      episodeTitle: String(episodeTitle || '').slice(0, 120),
      parentId: String(parentId || '').trim(),
      uid: user.uid,
      authorName: user.name,
      authorPhoto: user.photoUrl || '',
      authorRole: user.role,
      authorIsPremium: hasVipPrivilege,
      authorBadge: user.activeBadge || (hasVipPrivilege ? 'Verified' : 'Member'),
      authorBorder: user.activeBorder || 'classic',
      authorTheme: user.profileTheme || 'default',
      authorStatusEmoji: hasVipPrivilege ? user.statusEmoji || '' : '',
      authorLevel: user.level || 1,
      text: cleanText,
      sticker: cleanSticker,
      likes: [] as string[],
      pinned: false,
    };

    const mongoOk = await connectDB();
    if (mongoOk) {
      const created = await CommentModel.create(payload);
      const obj = created.toObject();
      return res.status(201).json({
        ok: true,
        comment: {
          ...obj,
          _id: String(obj._id),
          createdAt: obj.createdAt
            ? new Date(obj.createdAt).toISOString()
            : new Date().toISOString(),
        },
      });
    }

    const memDoc = {
      ...payload,
      _id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    memoryComments.unshift(memDoc);
    return res.status(201).json({ ok: true, comment: memDoc });
  } catch (err) {
    console.error('[Comments POST Error]', err);
    return res.status(500).json({ error: 'Gagal mengirim komentar' });
  }
});

// POST /api/comments/:id/like — Toggle like on a comment
router.post('/:id/like', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const commentId = req.params.id;
    const mongoOk = await connectDB();

    if (mongoOk) {
      const doc = await CommentModel.findById(commentId);
      if (!doc) return res.status(404).json({ error: 'Komentar tidak ditemukan' });
      const exists = doc.likes.includes(uid);
      doc.likes = exists ? doc.likes.filter((id) => id !== uid) : [...doc.likes, uid];
      await doc.save();
      return res.json({ ok: true, likes: doc.likes });
    }

    const item = memoryComments.find((c) => c._id === commentId);
    if (!item) return res.status(404).json({ error: 'Komentar tidak ditemukan' });
    const exists = item.likes.includes(uid);
    item.likes = exists ? item.likes.filter((id: string) => id !== uid) : [...item.likes, uid];
    return res.json({ ok: true, likes: item.likes });
  } catch (err) {
    console.error('[Comments Like Error]', err);
    return res.status(500).json({ error: 'Gagal menyukai komentar' });
  }
});

// POST /api/comments/:id/pin — Pin / Unpin comment (Founder only)
router.post('/:id/pin', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.authUser?.role !== 'founder') {
      return res.status(403).json({ error: 'Hanya VerzonFounder yang dapat menyematkan komentar.' });
    }
    const commentId = req.params.id;
    const mongoOk = await connectDB();

    if (mongoOk) {
      const doc = await CommentModel.findById(commentId);
      if (!doc) return res.status(404).json({ error: 'Komentar tidak ditemukan' });
      doc.pinned = !doc.pinned;
      await doc.save();
      return res.json({ ok: true, pinned: doc.pinned });
    }

    const item = memoryComments.find((c) => c._id === commentId);
    if (!item) return res.status(404).json({ error: 'Komentar tidak ditemukan' });
    item.pinned = !item.pinned;
    return res.json({ ok: true, pinned: item.pinned });
  } catch (err) {
    console.error('[Comments Pin Error]', err);
    return res.status(500).json({ error: 'Gagal menyematkan komentar' });
  }
});

// DELETE /api/comments/:id — Author or Founder can delete
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const isFounder = req.authUser?.role === 'founder';
    const commentId = req.params.id;
    const mongoOk = await connectDB();

    if (mongoOk) {
      const doc = await CommentModel.findById(commentId);
      if (!doc) return res.status(404).json({ error: 'Komentar tidak ditemukan' });
      if (doc.uid !== uid && !isFounder) {
        return res.status(403).json({ error: 'Tidak memiliki izin menghapus komentar ini.' });
      }
      await CommentModel.deleteMany({ $or: [{ _id: doc._id }, { parentId: String(doc._id) }] });
      return res.json({ ok: true });
    }

    const idx = memoryComments.findIndex((c) => c._id === commentId);
    if (idx === -1) return res.status(404).json({ error: 'Komentar tidak ditemukan' });
    if (memoryComments[idx].uid !== uid && !isFounder) {
      return res.status(403).json({ error: 'Tidak memiliki izin menghapus komentar ini.' });
    }
    memoryComments.splice(idx, 1);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[Comments Delete Error]', err);
    return res.status(500).json({ error: 'Gagal menghapus komentar' });
  }
});

export default router;
