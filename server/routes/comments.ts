import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../auth.ts';
import { connectDB, findUserByUid, sanitizeUser, updateUserByUid } from '../db.ts';
import { CommentModel } from '../models/Comment.ts';
import { UserModel } from '../models/User.ts';
import { createNotification } from '../notifications.ts';

const getExpNeededForLevel = (level: number) => Math.max(100, level * 200);

const router = Router();

function buildMediaNotificationLink(mediaKey: string): string {
  const idx = mediaKey.indexOf(':');
  if (idx <= 0) return '/';
  const type = mediaKey.slice(0, idx);
  const id = mediaKey.slice(idx + 1);
  if ((type === 'anime' || type === 'donghua') && id) {
    return `/detail/${type}/${encodeURIComponent(id)}`;
  }
  return '/';
}

const VIP_TOKEN_REGEX = /\[vip:[a-z0-9_-]+\]/i;

const memoryComments: Array<any> = [];
let globalSamplePurged = false;

function detectRequestCountry(req: any): string {
  const raw =
    req.body?.countryCode ||
    req.headers?.['x-client-country'] ||
    req.headers?.['x-vercel-ip-country'] ||
    req.headers?.['cf-ipcountry'] ||
    '';
  const clean = String(raw || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(clean) && clean !== 'XX') {
    return clean;
  }
  return 'ID';
}

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
      // Purge all previously seeded sample/bot comments globally so 100% of comments come strictly from real registered users
      if (!globalSamplePurged) {
        globalSamplePurged = true;
        await CommentModel.deleteMany({
          $or: [
            { uid: { $in: ['5017224', '7729104', '8812301'] } },
            {
              authorName: {
                $in: ['Calista', 'Rizky Pratama', "亗CHEN NAN 千丁' 爪尺ㄒㄥ表"],
              },
            },
            {
              uid: '00000',
              text: 'Kualitas server HD sudah dioptimalkan penuh. Selamat menonton dan tulis pendapat kalian di bawah!',
            },
          ],
        }).catch(() => {});
      }

      rawComments = await CommentModel.find({ mediaKey })
        .sort({ pinned: -1, createdAt: -1 })
        .limit(150)
        .lean();

      // Enrich live user metadata and strictly verify the commenter is a real registered account in UserModel
      const uids = Array.from(new Set(rawComments.map((c) => c.uid).filter(Boolean)));
      if (uids.length > 0) {
        const users = await UserModel.find({ uid: { $in: uids } })
          .select(
            'uid name photoUrl bannerUrl role isPremium isVerified activeBadge activeBorder profileTheme statusEmoji countryCode level'
          )
          .lean();
        const userMap = new Map(users.map((u: any) => [u.uid, u]));

        // Filter out any comment whose author UID does not exist in UserModel (prevents any ghost/sample comments)
        rawComments = rawComments
          .filter((c) => userMap.has(c.uid))
          .map((c) => {
            const live = userMap.get(c.uid)!;
            const liveIsFounder = live.role === 'founder';
            const liveIsPremium = Boolean(
              live.isPremium || live.isVerified || liveIsFounder
            );
            const rawBadge = live.activeBadge || c.authorBadge || (liveIsPremium ? 'Verified VIP' : 'Member');
            const safeBadge =
              !liveIsFounder && String(rawBadge).trim().toLowerCase() === 'verified founder'
                ? liveIsPremium
                  ? 'Verified VIP'
                  : 'Member'
                : rawBadge;
            return {
              ...c,
              authorName: live.name || c.authorName,
              authorPhoto: live.photoUrl || c.authorPhoto,
              authorBanner: live.bannerUrl || c.authorBanner || '',
              authorRole: live.role || c.authorRole,
              authorIsPremium: liveIsPremium,
              authorBadge: safeBadge,
              authorBorder: live.activeBorder || c.authorBorder,
              authorTheme: live.profileTheme || c.authorTheme || 'default',
              authorStatusEmoji: live.statusEmoji || c.authorStatusEmoji || '',
              authorCountry: (live.countryCode || c.authorCountry || 'ID').toUpperCase(),
              authorLevel: live.level || c.authorLevel,
            };
          });
      } else {
        rawComments = [];
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
      authorBanner: c.authorBanner || '',
      authorRole: c.authorRole || 'member',
      authorIsPremium: Boolean(c.authorIsPremium),
      authorBadge: c.authorBadge || 'Member',
      authorBorder: c.authorBorder || 'classic',
      authorTheme: c.authorTheme || 'default',
      authorStatusEmoji: c.authorStatusEmoji || '',
      authorCountry: (c.authorCountry || 'ID').toUpperCase(),
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

    const countryCode = (user.countryCode || detectRequestCountry(req) || 'ID').toUpperCase();

    const payload = {
      mediaKey: cleanMediaKey,
      mediaTitle: String(mediaTitle || '').slice(0, 120),
      episodeTitle: String(episodeTitle || '').slice(0, 120),
      parentId: String(parentId || '').trim(),
      uid: user.uid,
      authorName: user.name,
      authorPhoto: user.photoUrl || '',
      authorBanner: hasVipPrivilege ? user.bannerUrl || '' : '',
      authorRole: user.role,
      authorIsPremium: hasVipPrivilege,
      authorBadge:
        user.role !== 'founder' &&
        String(user.activeBadge || '').trim().toLowerCase() === 'verified founder'
          ? hasVipPrivilege
            ? 'Verified VIP'
            : 'Member'
          : user.activeBadge || (hasVipPrivilege ? 'Verified VIP' : 'Member'),
      authorBorder: user.activeBorder || 'classic',
      authorTheme: user.profileTheme || 'default',
      authorStatusEmoji: hasVipPrivilege ? user.statusEmoji || '' : '',
      authorCountry: countryCode,
      authorLevel: user.level || 1,
      text: cleanText,
      sticker: cleanSticker,
      likes: [] as string[],
      pinned: false,
    };

    const mongoOk = await connectDB();
    const notifyReplyTarget = async () => {
      if (!payload.parentId) return;
      try {
        let parentDoc: any = null;
        if (mongoOk) {
          parentDoc = await CommentModel.findById(payload.parentId).select('uid mediaTitle').lean();
        } else {
          parentDoc = memoryComments.find((c) => c._id === payload.parentId);
        }
        if (parentDoc?.uid && parentDoc.uid !== user.uid) {
          const snippet = (cleanText || (cleanSticker ? '[Mengirim stiker]' : '')).slice(0, 90);
          const titleLabel = payload.mediaTitle || parentDoc.mediaTitle || 'episode ini';
          await createNotification({
            uid: parentDoc.uid,
            type: 'comment_reply',
            title: `${user.name} membalas komentarmu`,
            message: `Di ${titleLabel}: "${snippet}"`,
            link: buildMediaNotificationLink(cleanMediaKey),
            actorUid: user.uid,
            actorName: user.name,
            actorPhoto: user.photoUrl || '',
          });
        }
      } catch (notifyErr) {
        console.warn('[Comment Reply Notify Notice]', (notifyErr as Error).message);
      }
    };

    // Award Comment EXP (+25 base, +50 for VIP/Founder) & increment totalCommentsCount
    let expGained = 0;
    let levelUp = false;
    let finalLevel = user.level || 1;
    let finalCommentsCount = (user.totalCommentsCount || 0) + 1;

    const updatedUser = await updateUserByUid(user.uid, (current) => {
      const multiplier = hasVipPrivilege ? 2 : 1;
      expGained = 25 * multiplier;
      let nextExp = (current.exp || 0) + expGained;
      let nextLevel = current.level || 1;
      if (current.role === 'founder') {
        nextLevel = 999999;
        nextExp = 0;
        levelUp = false;
      } else {
        while (nextExp >= getExpNeededForLevel(nextLevel)) {
          nextExp -= getExpNeededForLevel(nextLevel);
          nextLevel += 1;
          levelUp = true;
        }
      }
      finalLevel = nextLevel;
      finalCommentsCount = Math.max(1, (current.totalCommentsCount || 0) + 1);
      return {
        ...current,
        level: nextLevel,
        exp: nextExp,
        totalCommentsCount: finalCommentsCount,
      };
    });

    payload.authorLevel = finalLevel;

    const expReward = {
      expGained,
      levelUp,
      newLevel: finalLevel,
      totalCommentsCount: finalCommentsCount,
      isDoubleExp: hasVipPrivilege,
    };

    if (mongoOk) {
      const created = await CommentModel.create(payload);
      await notifyReplyTarget();
      const obj = created.toObject();
      return res.status(201).json({
        ok: true,
        expReward,
        user: updatedUser ? sanitizeUser(updatedUser) : undefined,
        comment: {
          ...obj,
          authorLevel: finalLevel,
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
    await notifyReplyTarget();
    return res.status(201).json({
      ok: true,
      expReward,
      user: updatedUser ? sanitizeUser(updatedUser) : undefined,
      comment: memDoc,
    });
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
      if (!exists && doc.uid && doc.uid !== uid) {
        const liker = await findUserByUid(uid).catch(() => null);
        await createNotification({
          uid: doc.uid,
          type: 'comment_like',
          title: `${liker?.name || 'Seseorang'} menyukai komentarmu`,
          message: `Di ${doc.mediaTitle || 'komentar episode'}: "${(doc.text || '[Stiker]').slice(0, 75)}"`,
          link: buildMediaNotificationLink(doc.mediaKey),
          actorUid: uid,
          actorName: liker?.name || '',
          actorPhoto: liker?.photoUrl || '',
          dedupeKey: `clike:${commentId}:${uid}`,
        });
      }
      return res.json({ ok: true, likes: doc.likes });
    }

    const item = memoryComments.find((c) => c._id === commentId);
    if (!item) return res.status(404).json({ error: 'Komentar tidak ditemukan' });
    const exists = item.likes.includes(uid);
    item.likes = exists ? item.likes.filter((id: string) => id !== uid) : [...item.likes, uid];
    if (!exists && item.uid && item.uid !== uid) {
      const liker = await findUserByUid(uid).catch(() => null);
      await createNotification({
        uid: item.uid,
        type: 'comment_like',
        title: `${liker?.name || 'Seseorang'} menyukai komentarmu`,
        message: `Di ${item.mediaTitle || 'komentar episode'}: "${(item.text || '[Stiker]').slice(0, 75)}"`,
        link: buildMediaNotificationLink(item.mediaKey),
        actorUid: uid,
        actorName: liker?.name || '',
        actorPhoto: liker?.photoUrl || '',
        dedupeKey: `clike:${commentId}:${uid}`,
      });
    }
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
