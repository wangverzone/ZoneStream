import crypto from 'crypto';
import { Router } from 'express';
import mongoose, { Schema } from 'mongoose';
import { requireAuth, verifyAuthToken, type AuthenticatedRequest } from '../auth.ts';
import { applyExpAndLevelRewards, recordCoinLedgerEntry } from '../coins.ts';
import {
  connectDB,
  findUserByUid,
  getJakartaDateString,
  isDbMongoConnected,
  readFallbackJson,
  sanitizeUser,
  updateUserByUid,
  writeFallbackJson,
} from '../db.ts';
import { createNotification } from '../notifications.ts';
import {
  broadcastNobarEvent,
  broadcastSystemEvent,
  getNobarOnlineCount,
} from '../wsChat.ts';

const router = Router();

// ============================================================================
// SCHEMAS & PERSISTENCE HELPERS (MongoDB + JSON Fallback)
// ============================================================================

export interface BroadcastAnnouncement {
  id: string;
  title: string;
  message: string;
  category: 'event' | 'promo' | 'info' | 'giftcode';
  redeemCode?: string;
  isActive: boolean;
  createdByUid: string;
  createdByName: string;
  createdAt: string;
}

export interface RedeemCodeRecord {
  code: string;
  description: string;
  coins: number;
  exp: number;
  vipDays: number;
  maxClaims: number;
  claimedBy: string[];
  isActive: boolean;
  createdByUid: string;
  createdAt: string;
}

export interface NobarChatMessage {
  id: string;
  uid: string;
  username: string;
  name: string;
  photoUrl: string;
  role: 'member' | 'founder';
  isPremium: boolean;
  activeBadge: string;
  activeBorder: string;
  statusEmoji: string;
  level: number;
  text: string;
  createdAt: string;
}

export interface NobarParticipant {
  uid: string;
  username: string;
  name: string;
  photoUrl: string;
  role: 'member' | 'founder';
  isPremium: boolean;
  activeBadge: string;
  activeBorder: string;
  statusEmoji: string;
  level: number;
  joinedAt: string;
}

export interface NobarRoomRecord {
  roomId: string;
  title: string;
  seriesTitle: string;
  episodeId: string;
  mediaType: 'anime' | 'donghua';
  poster: string;
  hostUid: string;
  hostName: string;
  hostPhotoUrl: string;
  hostBorder: string;
  hostBadge: string;
  clanTag?: string;
  isPlaying: boolean;
  currentTime: number;
  messages: NobarChatMessage[];
  participants: NobarParticipant[];
  updatedAt: string;
  createdAt: string;
}

interface AppKVDoc {
  key: string;
  value: any;
  updatedAt: Date;
}

const AppKVSchema = new Schema<AppKVDoc>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, default: {} },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

const AppKVModel =
  (mongoose.models.AppKV as mongoose.Model<AppKVDoc>) ||
  mongoose.model<AppKVDoc>('AppKV', AppKVSchema);

async function loadKV<T>(key: string, fallbackFile: string, defaultVal: T): Promise<T> {
  await connectDB();
  if (isDbMongoConnected()) {
    try {
      const doc = await AppKVModel.findOne({ key }).lean();
      if (doc && doc.value !== undefined && doc.value !== null) {
        return doc.value as T;
      }
    } catch {
      // Fallback to local JSON
    }
  }
  return readFallbackJson<T>(fallbackFile, defaultVal);
}

async function saveKV<T>(key: string, fallbackFile: string, value: T): Promise<void> {
  writeFallbackJson(fallbackFile, value);
  await connectDB();
  if (isDbMongoConnected()) {
    try {
      await AppKVModel.findOneAndUpdate(
        { key },
        { $set: { value, updatedAt: new Date() } },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.warn('[AppKV save warning]:', (err as Error).message);
    }
  }
}

function getIsoWeekKey(): string {
  const today = getJakartaDateString(0);
  const d = new Date(`${today}T00:00:00Z`);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ============================================================================
// DEFAULT SEED DATA FOR BROADCAST (#5) & REDEEM CODES (#6)
// ============================================================================

const DEFAULT_BROADCASTS: BroadcastAnnouncement[] = [
  {
    id: 'bcast_welcome_gift',
    title: 'EVENT SPESIAL ZONESTREAM',
    message:
      'Gunakan kode redeem ZONESTREAMBERKAH untuk klaim hadiah +100 Koin, +200 EXP & +1 Hari VIP Gratis! Selesaikan juga Misi Harian & Nobar bareng teman!',
    category: 'giftcode',
    redeemCode: 'ZONESTREAMBERKAH',
    isActive: true,
    createdByUid: '00000',
    createdByName: 'VerzonFounder',
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_REDEEM_CODES: RedeemCodeRecord[] = [
  {
    code: 'ZONESTREAMBERKAH',
    description: 'Hadiah Spesial Founder: +100 Koin, +200 EXP & 1 Hari VIP Gratis',
    coins: 100,
    exp: 200,
    vipDays: 1,
    maxClaims: 500,
    claimedBy: [],
    isActive: true,
    createdByUid: '00000',
    createdAt: new Date().toISOString(),
  },
  {
    code: 'VERZONFOUNDER',
    description: 'Bonus Komunitas ZoneStream: +150 Koin & +300 EXP',
    coins: 150,
    exp: 300,
    vipDays: 0,
    maxClaims: 300,
    claimedBy: [],
    isActive: true,
    createdByUid: '00000',
    createdAt: new Date().toISOString(),
  },
];

async function getBroadcastList(): Promise<BroadcastAnnouncement[]> {
  const list = await loadKV<BroadcastAnnouncement[]>(
    'founder_broadcasts_v1',
    'founder-broadcasts-v1.json',
    DEFAULT_BROADCASTS
  );
  if (!Array.isArray(list) || list.length === 0) {
    await saveKV('founder_broadcasts_v1', 'founder-broadcasts-v1.json', DEFAULT_BROADCASTS);
    return DEFAULT_BROADCASTS;
  }
  return list;
}

async function getRedeemCodeList(): Promise<RedeemCodeRecord[]> {
  const list = await loadKV<RedeemCodeRecord[]>(
    'redeem_codes_v1',
    'redeem-codes-v1.json',
    DEFAULT_REDEEM_CODES
  );
  if (!Array.isArray(list) || list.length === 0) {
    await saveKV('redeem_codes_v1', 'redeem-codes-v1.json', DEFAULT_REDEEM_CODES);
    return DEFAULT_REDEEM_CODES;
  }
  return list;
}

// ============================================================================
// #5: BROADCAST PENGUMUMAN FOUNDER (REAL-TIME RUNNING TEXT / BANNER)
// ============================================================================

router.get('/broadcast', async (_req, res) => {
  try {
    const list = await getBroadcastList();
    const active = list.filter((b) => b.isActive);
    return res.json({ ok: true, broadcasts: active, allBroadcasts: list });
  } catch (err) {
    console.error('[Broadcast GET Error]', err);
    return res.status(500).json({ error: 'Gagal memuat pengumuman.' });
  }
});

router.post('/broadcast', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const caller = await findUserByUid(req.authUser!.uid);
    if (!caller || (caller.role !== 'founder' && caller.email.toLowerCase() !== 'wanglin72kk@gmail.com')) {
      return res.status(403).json({ error: 'Hanya Founder yang dapat mengirim Broadcast Pengumuman.' });
    }

    const { title, message, category, redeemCode, isActive } = req.body || {};
    const cleanMessage = String(message || '').trim().slice(0, 350);
    if (!cleanMessage) {
      return res.status(400).json({ error: 'Isi pesan pengumuman tidak boleh kosong.' });
    }

    const cleanTitle = String(title || 'PENGUMUMAN FOUNDER').trim().slice(0, 80);
    const validCategories = ['event', 'promo', 'info', 'giftcode'] as const;
    const cleanCategory = validCategories.includes(category) ? category : 'info';
    const cleanRedeem = String(redeemCode || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);

    const list = await getBroadcastList();
    const newItem: BroadcastAnnouncement = {
      id: `bcast_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
      title: cleanTitle,
      message: cleanMessage,
      category: cleanCategory,
      redeemCode: cleanRedeem || undefined,
      isActive: isActive !== false,
      createdByUid: caller.uid,
      createdByName: caller.name || 'VerzonFounder',
      createdAt: new Date().toISOString(),
    };

    const updated = [newItem, ...list].slice(0, 15);
    await saveKV('founder_broadcasts_v1', 'founder-broadcasts-v1.json', updated);

    const active = updated.filter((b) => b.isActive);
    broadcastSystemEvent({
      type: 'broadcast:updated',
      broadcasts: active,
    });

    return res.json({
      ok: true,
      broadcast: newItem,
      broadcasts: active,
      allBroadcasts: updated,
    });
  } catch (err) {
    console.error('[Broadcast POST Error]', err);
    return res.status(500).json({ error: 'Gagal menyimpan pengumuman Founder.' });
  }
});

router.delete('/broadcast/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const caller = await findUserByUid(req.authUser!.uid);
    if (!caller || (caller.role !== 'founder' && caller.email.toLowerCase() !== 'wanglin72kk@gmail.com')) {
      return res.status(403).json({ error: 'Hanya Founder yang dapat menghapus pengumuman.' });
    }

    const targetId = String(req.params.id || '').trim();
    const list = await getBroadcastList();
    const updated = list.filter((b) => b.id !== targetId);
    await saveKV('founder_broadcasts_v1', 'founder-broadcasts-v1.json', updated);

    const active = updated.filter((b) => b.isActive);
    broadcastSystemEvent({
      type: 'broadcast:updated',
      broadcasts: active,
    });

    return res.json({ ok: true, broadcasts: active, allBroadcasts: updated });
  } catch (err) {
    console.error('[Broadcast DELETE Error]', err);
    return res.status(500).json({ error: 'Gagal menghapus pengumuman.' });
  }
});

// ============================================================================
// #6: KODE REDEEM (GIFT CODE) DARI FOUNDER
// ============================================================================

router.get('/redeem/codes', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const caller = await findUserByUid(req.authUser!.uid);
    const isFounder =
      caller && (caller.role === 'founder' || caller.email.toLowerCase() === 'wanglin72kk@gmail.com');
    const codes = await getRedeemCodeList();

    if (isFounder) {
      return res.json({ ok: true, codes });
    }

    // Regular users see public summary without full claimedBy list
    const publicCodes = codes
      .filter((c) => c.isActive && c.claimedBy.length < c.maxClaims)
      .map((c) => ({
        code: c.code,
        description: c.description,
        coins: c.coins,
        exp: c.exp,
        vipDays: c.vipDays,
        maxClaims: c.maxClaims,
        claimedCount: c.claimedBy.length,
        alreadyClaimed: caller ? c.claimedBy.includes(caller.uid) : false,
      }));
    return res.json({ ok: true, codes: publicCodes });
  } catch (err) {
    console.error('[Redeem Codes GET Error]', err);
    return res.status(500).json({ error: 'Gagal memuat daftar kode redeem.' });
  }
});

router.post('/redeem/codes', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const caller = await findUserByUid(req.authUser!.uid);
    if (!caller || (caller.role !== 'founder' && caller.email.toLowerCase() !== 'wanglin72kk@gmail.com')) {
      return res.status(403).json({ error: 'Hanya Founder yang dapat membuat Kode Redeem.' });
    }

    const { code, description, coins, exp, vipDays, maxClaims, alsoBroadcast } = req.body || {};
    const cleanCode = String(code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);

    if (!cleanCode || cleanCode.length < 3) {
      return res.status(400).json({ error: 'Kode Redeem minimal 3 karakter huruf/angka.' });
    }

    const rewardCoins = Math.max(0, Math.min(100000, Math.floor(Number(coins) || 0)));
    const rewardExp = Math.max(0, Math.min(100000, Math.floor(Number(exp) || 0)));
    const rewardVipDays = Math.max(0, Math.min(365, Math.floor(Number(vipDays) || 0)));
    const quota = Math.max(1, Math.min(10000, Math.floor(Number(maxClaims) || 100)));

    if (rewardCoins === 0 && rewardExp === 0 && rewardVipDays === 0) {
      return res.status(400).json({ error: 'Minimal harus ada hadiah Koin, EXP, atau Hari VIP.' });
    }

    const parts: string[] = [];
    if (rewardCoins > 0) parts.push(`+${rewardCoins} Koin`);
    if (rewardExp > 0) parts.push(`+${rewardExp} EXP`);
    if (rewardVipDays > 0) parts.push(`+${rewardVipDays} Hari VIP`);

    const cleanDesc =
      String(description || '').trim().slice(0, 140) ||
      `Hadiah Kode Redeem: ${parts.join(', ')}`;

    const codes = await getRedeemCodeList();
    const existingIdx = codes.findIndex((c) => c.code === cleanCode);
    const record: RedeemCodeRecord = {
      code: cleanCode,
      description: cleanDesc,
      coins: rewardCoins,
      exp: rewardExp,
      vipDays: rewardVipDays,
      maxClaims: quota,
      claimedBy: existingIdx >= 0 ? codes[existingIdx].claimedBy : [],
      isActive: true,
      createdByUid: caller.uid,
      createdAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      codes[existingIdx] = record;
    } else {
      codes.unshift(record);
    }

    await saveKV('redeem_codes_v1', 'redeem-codes-v1.json', codes);

    if (alsoBroadcast) {
      const bList = await getBroadcastList();
      const bItem: BroadcastAnnouncement = {
        id: `bcast_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
        title: `KODE REDEEM BARU: ${cleanCode}`,
        message: `${cleanDesc} (Kuota terbatas ${quota} klaim! Klik tombol Klaim sekarang!)`,
        category: 'giftcode',
        redeemCode: cleanCode,
        isActive: true,
        createdByUid: caller.uid,
        createdByName: caller.name || 'VerzonFounder',
        createdAt: new Date().toISOString(),
      };
      const updatedB = [bItem, ...bList].slice(0, 15);
      await saveKV('founder_broadcasts_v1', 'founder-broadcasts-v1.json', updatedB);
      broadcastSystemEvent({
        type: 'broadcast:updated',
        broadcasts: updatedB.filter((b) => b.isActive),
      });
    }

    return res.json({ ok: true, code: record, codes });
  } catch (err) {
    console.error('[Redeem Code Create Error]', err);
    return res.status(500).json({ error: 'Gagal membuat Kode Redeem.' });
  }
});

router.delete('/redeem/codes/:code', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const caller = await findUserByUid(req.authUser!.uid);
    if (!caller || (caller.role !== 'founder' && caller.email.toLowerCase() !== 'wanglin72kk@gmail.com')) {
      return res.status(403).json({ error: 'Hanya Founder yang dapat menghapus Kode Redeem.' });
    }
    const targetCode = String(req.params.code || '').trim().toUpperCase();
    const codes = await getRedeemCodeList();
    const updated = codes.filter((c) => c.code !== targetCode);
    await saveKV('redeem_codes_v1', 'redeem-codes-v1.json', updated);
    return res.json({ ok: true, codes: updated });
  } catch (err) {
    console.error('[Redeem Code Delete Error]', err);
    return res.status(500).json({ error: 'Gagal menghapus Kode Redeem.' });
  }
});

router.post('/redeem', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const rawCode = String(req.body?.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');

    if (!rawCode) {
      return res.status(400).json({ error: 'Masukkan Kode Redeem terlebih dahulu.' });
    }

    const user = await findUserByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }

    const codes = await getRedeemCodeList();
    const codeRecord = codes.find((c) => c.code === rawCode && c.isActive);
    if (!codeRecord) {
      return res.status(404).json({ error: 'Kode Redeem tidak ditemukan atau sudah tidak aktif.' });
    }

    if (codeRecord.claimedBy.includes(uid)) {
      return res.status(400).json({ error: 'Kamu sudah pernah mengklaim Kode Redeem ini sebelumnya.' });
    }

    if (codeRecord.claimedBy.length >= codeRecord.maxClaims) {
      return res.status(400).json({ error: 'Kuota Kode Redeem ini sudah habis diklaim.' });
    }

    codeRecord.claimedBy.push(uid);
    await saveKV('redeem_codes_v1', 'redeem-codes-v1.json', codes);

    // Calculate new EXP, Level & Coins
    const expProgression = applyExpAndLevelRewards(user, codeRecord.exp);
    const totalAddedCoins = codeRecord.coins + expProgression.coinsGained;
    const nextCoins =
      user.role === 'founder'
        ? Math.max(50000, (user.coins ?? 50000) + totalAddedCoins)
        : Math.max(0, (user.coins ?? 0) + totalAddedCoins);
    const nextTotalEarned =
      user.role === 'founder'
        ? Math.max(nextCoins, (user.totalCoinsEarned ?? 50000) + totalAddedCoins)
        : Math.max(nextCoins, (user.totalCoinsEarned ?? 0) + totalAddedCoins);

    const updates: Partial<typeof user> = {
      level: expProgression.nextLevel,
      exp: expProgression.nextExp,
      coins: nextCoins,
      totalCoinsEarned: nextTotalEarned,
    };

    if (codeRecord.vipDays > 0 && user.role !== 'founder') {
      const currentExpiryMs =
        user.isPremium && user.premiumExpiryDate
          ? Math.max(Date.now(), new Date(user.premiumExpiryDate).getTime())
          : Date.now();
      const nextExpiry = new Date(currentExpiryMs + codeRecord.vipDays * 86_400_000).toISOString();
      updates.isPremium = true;
      updates.isVerified = true;
      updates.premiumExpiryDate = nextExpiry;
      updates.premiumPlan = user.premiumPlan || `Gift Code VIP (${codeRecord.vipDays} Hari)`;
      if (!user.activeBadge || user.activeBadge === 'Member') {
        updates.activeBadge = 'Verified VIP';
      }
    }

    const updatedUser = await updateUserByUid(uid, (u) => ({ ...u, ...updates }));
    const sanitized = sanitizeUser(updatedUser || { ...user, ...updates });

    if (totalAddedCoins > 0) {
      await recordCoinLedgerEntry({
        uid,
        type: 'daily_checkin',
        amount: totalAddedCoins,
        balanceAfter: nextCoins,
        requestId: `redeem_${rawCode}_${uid}`,
        note: `Klaim Kode Redeem ${rawCode} (+${codeRecord.coins} Koin${
          expProgression.coinsGained > 0 ? ` & +${expProgression.coinsGained} Koin Naik Level` : ''
        })`,
      });
    }

    const rewardSummaryParts: string[] = [];
    if (codeRecord.coins > 0) rewardSummaryParts.push(`+${codeRecord.coins} Koin`);
    if (codeRecord.exp > 0) rewardSummaryParts.push(`+${codeRecord.exp} EXP`);
    if (codeRecord.vipDays > 0) rewardSummaryParts.push(`+${codeRecord.vipDays} Hari VIP`);

    void createNotification({
      uid,
      type: 'system',
      title: `Kode Redeem ${rawCode} Berhasil Diklaim!`,
      message: `Selamat! Kamu mendapatkan ${rewardSummaryParts.join(', ')} dari Kode Redeem Founder.`,
      link: '/profile',
    });

    return res.json({
      ok: true,
      code: rawCode,
      reward: {
        coins: codeRecord.coins,
        levelUpCoins: expProgression.coinsGained,
        exp: codeRecord.exp,
        vipDays: codeRecord.vipDays,
        levelUp: expProgression.levelUp,
        newLevel: expProgression.nextLevel,
      },
      message: `Berhasil klaim ${rawCode}! Kamu mendapat ${rewardSummaryParts.join(', ')}.`,
      user: sanitized,
    });
  } catch (err) {
    console.error('[Redeem Claim Error]', err);
    return res.status(500).json({ error: 'Terjadi kesalahan saat mengklaim Kode Redeem.' });
  }
});

// ============================================================================
// #3: MISI HARIAN & MINGGUAN (DAILY & WEEKLY QUESTS) BERHADIAH KOIN & EXP
// ============================================================================

export interface QuestSpec {
  id: string;
  period: 'daily' | 'weekly';
  title: string;
  description: string;
  target: number;
  rewardCoins: number;
  rewardExp: number;
  actionLink: string;
  actionLabel: string;
}

const QUEST_CATALOG: QuestSpec[] = [
  {
    id: 'daily_checkin',
    period: 'daily',
    title: 'Absen Harian Hari Ini',
    description: 'Lakukan Daily Check-In di halaman Profil untuk menjaga streak harianmu.',
    target: 1,
    rewardCoins: 30,
    rewardExp: 60,
    actionLink: '/profile',
    actionLabel: 'Ke Profil',
  },
  {
    id: 'daily_watch_1',
    period: 'daily',
    title: 'Tonton 1 Episode Anime / Donghua',
    description: 'Mulai tonton minimal 1 episode anime atau donghua favoritmu hari ini.',
    target: 1,
    rewardCoins: 35,
    rewardExp: 80,
    actionLink: '/',
    actionLabel: 'Tonton Sekarang',
  },
  {
    id: 'daily_watch_3',
    period: 'daily',
    title: 'Maraton 3 Episode Hari Ini',
    description: 'Selesaikan menonton 3 episode dalam satu hari untuk bonus maraton.',
    target: 3,
    rewardCoins: 75,
    rewardExp: 160,
    actionLink: '/',
    actionLabel: 'Lanjut Nonton',
  },
  {
    id: 'daily_social',
    period: 'daily',
    title: 'Aktif di Komunitas / Nobar',
    description: 'Tulis komentar episode, ikut Nobar, atau beri Like ke sesama member.',
    target: 1,
    rewardCoins: 30,
    rewardExp: 70,
    actionLink: '/leaderboard',
    actionLabel: 'Buka Komunitas',
  },
  {
    id: 'weekly_streak_3',
    period: 'weekly',
    title: 'Pertahankan 3 Hari Watch Streak',
    description: 'Jaga rekor nonton berturut-turut minimal 3 hari untuk klaim peti mingguan.',
    target: 3,
    rewardCoins: 150,
    rewardExp: 300,
    actionLink: '/profile',
    actionLabel: 'Cek Streak',
  },
];

function computeQuestProgressForUser(pub: ReturnType<typeof sanitizeUser>) {
  const todayStr = getJakartaDateString(0);
  const checkedInToday =
    Array.isArray(pub.checkInDates) && pub.checkInDates.includes(todayStr)
      ? 1
      : pub.lastCheckInAt &&
        Date.now() - new Date(pub.lastCheckInAt).getTime() < 20 * 3600 * 1000
      ? 1
      : 0;

  const watchedTodayFromHistory = Array.isArray(pub.watchHistory)
    ? pub.watchHistory.filter((h) => String(h.updatedAt || '').slice(0, 10) === todayStr).length
    : 0;
  const episodesToday = Math.max(Number(pub.dailyEpisodesWatched || 0), watchedTodayFromHistory);

  const socialProgress =
    (pub.totalCommentsCount || 0) > 0 ||
    (pub.totalGiftsSent || 0) > 0 ||
    (pub.charisma || 0) > 0 ||
    episodesToday >= 1
      ? 1
      : 0;

  const streakProgress = Math.max(Number(pub.watchStreak || 0), Number(pub.checkInStreak || 0));

  return {
    daily_checkin: Math.min(1, checkedInToday),
    daily_watch_1: Math.min(1, episodesToday),
    daily_watch_3: Math.min(3, episodesToday),
    daily_social: Math.min(1, socialProgress),
    weekly_streak_3: Math.min(3, streakProgress),
  } as Record<string, number>;
}

router.get('/quests', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const user = await findUserByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }
    const pub = sanitizeUser(user);
    const claimsMap = await loadKV<Record<string, string[]>>(
      'user_quest_claims_v1',
      'user-quest-claims-v1.json',
      {}
    );
    const userClaims = new Set(Array.isArray(claimsMap[uid]) ? claimsMap[uid] : []);
    const todayStr = getJakartaDateString(0);
    const weekStr = getIsoWeekKey();
    const progressMap = computeQuestProgressForUser(pub);

    const quests = QUEST_CATALOG.map((q) => {
      const claimKey = `${q.period === 'daily' ? todayStr : weekStr}:${q.id}`;
      const current = Math.min(q.target, progressMap[q.id] ?? 0);
      const completed = current >= q.target;
      const claimed = userClaims.has(claimKey);
      return {
        ...q,
        progress: current,
        completed,
        claimed,
      };
    });

    return res.json({
      ok: true,
      today: todayStr,
      week: weekStr,
      quests,
    });
  } catch (err) {
    console.error('[Quests GET Error]', err);
    return res.status(500).json({ error: 'Gagal memuat Misi Harian.' });
  }
});

router.post('/quests/claim', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const questId = String(req.body?.questId || '').trim();
    const quest = QUEST_CATALOG.find((q) => q.id === questId);
    if (!quest) {
      return res.status(404).json({ error: 'Misi tidak ditemukan.' });
    }

    const user = await findUserByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }
    const pub = sanitizeUser(user);
    const progressMap = computeQuestProgressForUser(pub);
    const currentProgress = progressMap[quest.id] ?? 0;

    if (currentProgress < quest.target) {
      return res.status(400).json({
        error: `Misi belum selesai (${currentProgress}/${quest.target}). Selesaikan targetnya terlebih dahulu!`,
      });
    }

    const todayStr = getJakartaDateString(0);
    const weekStr = getIsoWeekKey();
    const claimKey = `${quest.period === 'daily' ? todayStr : weekStr}:${quest.id}`;

    const claimsMap = await loadKV<Record<string, string[]>>(
      'user_quest_claims_v1',
      'user-quest-claims-v1.json',
      {}
    );
    const userClaims = Array.isArray(claimsMap[uid]) ? claimsMap[uid] : [];
    if (userClaims.includes(claimKey)) {
      return res.status(400).json({ error: 'Hadiah misi ini sudah kamu klaim hari ini.' });
    }

    claimsMap[uid] = [...userClaims.slice(-60), claimKey];
    await saveKV('user_quest_claims_v1', 'user-quest-claims-v1.json', claimsMap);

    const expProgression = applyExpAndLevelRewards(user, quest.rewardExp);
    const totalCoinsAdded = quest.rewardCoins + expProgression.coinsGained;
    const nextCoins =
      user.role === 'founder'
        ? Math.max(50000, (user.coins ?? 50000) + totalCoinsAdded)
        : Math.max(0, (user.coins ?? 0) + totalCoinsAdded);
    const nextTotalEarned =
      user.role === 'founder'
        ? Math.max(nextCoins, (user.totalCoinsEarned ?? 50000) + totalCoinsAdded)
        : Math.max(nextCoins, (user.totalCoinsEarned ?? 0) + totalCoinsAdded);

    const updatedUser = await updateUserByUid(uid, (u) => ({
      ...u,
      level: expProgression.nextLevel,
      exp: expProgression.nextExp,
      coins: nextCoins,
      totalCoinsEarned: nextTotalEarned,
    }));
    const sanitized = sanitizeUser(updatedUser || user);

    await recordCoinLedgerEntry({
      uid,
      type: 'daily_checkin',
      amount: totalCoinsAdded,
      balanceAfter: nextCoins,
      requestId: `quest_${claimKey}_${uid}`,
      note: `Hadiah Misi "${quest.title}" (+${quest.rewardCoins} Koin & +${quest.rewardExp} EXP)`,
    });

    return res.json({
      ok: true,
      questId: quest.id,
      rewardCoins: quest.rewardCoins,
      rewardExp: quest.rewardExp,
      levelUp: expProgression.levelUp,
      newLevel: expProgression.nextLevel,
      message: `Misi "${quest.title}" selesai! +${quest.rewardCoins} Koin & +${quest.rewardExp} EXP berhasil diklaim!`,
      user: sanitized,
    });
  } catch (err) {
    console.error('[Quest Claim Error]', err);
    return res.status(500).json({ error: 'Gagal mengklaim hadiah misi.' });
  }
});

// ============================================================================
// #4: TOKO KOIN (COIN SHOP) — TUKAR KOIN JADI VIP, BOOSTER EXP, ATAU BINGKAI 3D
// ============================================================================

export interface CoinShopItem {
  id: string;
  category: 'vip' | 'exp' | 'frame';
  name: string;
  description: string;
  coinCost: number;
  vipDays?: number;
  bonusExp?: number;
  frameId?: string;
  badgeTag?: string;
}

const COIN_SHOP_CATALOG: CoinShopItem[] = [
  {
    id: 'shop_vip_1d',
    category: 'vip',
    name: 'VIP Trial 1 Hari',
    description: 'Aktifkan status Verified VIP, bebas iklan 100% & 2x EXP Nonton selama 24 jam.',
    coinCost: 250,
    vipDays: 1,
    bonusExp: 50,
    badgeTag: 'Hemat',
  },
  {
    id: 'shop_vip_3d',
    category: 'vip',
    name: 'VIP Pass 3 Hari',
    description: 'Nikmati 3 hari penuh Verified VIP tanpa iklan + bonus langsung +150 EXP.',
    coinCost: 650,
    vipDays: 3,
    bonusExp: 150,
    badgeTag: 'Terlaris',
  },
  {
    id: 'shop_vip_7d',
    category: 'vip',
    name: 'VIP Pass 7 Hari',
    description: 'Paket seminggu penuh Verified VIP bebas iklan + bonus langsung +350 EXP.',
    coinCost: 1400,
    vipDays: 7,
    bonusExp: 350,
    badgeTag: 'Sultan',
  },
  {
    id: 'shop_exp_500',
    category: 'exp',
    name: 'Booster +500 EXP Instan',
    description: 'Suntikan +500 EXP langsung ke akunmu untuk mempercepat naik Level & Rank.',
    coinCost: 150,
    bonusExp: 500,
  },
  {
    id: 'shop_exp_1500',
    category: 'exp',
    name: 'Mega Booster +1.500 EXP',
    description: 'Langsung tambah +1.500 EXP instan untuk melesat di Papan Peringkat Top Level.',
    coinCost: 400,
    bonusExp: 1500,
    badgeTag: 'Cepat Naik Lv',
  },
  {
    id: 'shop_frame_ember',
    category: 'frame',
    name: 'Bingkai 3D Ember Pulse',
    description: 'Buka permanen & langsung pasang bingkai avatar 3D berefek kobaran api.',
    coinCost: 300,
    frameId: 'streak-ember',
  },
  {
    id: 'shop_frame_aurora',
    category: 'frame',
    name: 'Bingkai 3D Aurora Prism',
    description: 'Buka permanen & langsung pasang bingkai 3D kristal aurora neon.',
    coinCost: 550,
    frameId: 'streak-aurora',
    badgeTag: 'Populer',
  },
  {
    id: 'shop_frame_celestial',
    category: 'frame',
    name: 'Bingkai 3D Celestial Orbit',
    description: 'Buka permanen & langsung pasang cincin kosmik 3D berputar dengan bintang.',
    coinCost: 900,
    frameId: 'streak-celestial',
  },
  {
    id: 'shop_frame_eternal',
    category: 'frame',
    name: 'Bingkai 3D Eternal Phoenix',
    description: 'Bingkai kasta tertinggi berefek mahkota Phoenix 3D emas membara.',
    coinCost: 1500,
    frameId: 'streak-eternal',
    badgeTag: 'Mythic 3D',
  },
];

router.get('/shop', async (req: AuthenticatedRequest, res) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const payload = token ? verifyAuthToken(token) : null;
    const user = payload?.uid ? await findUserByUid(payload.uid) : null;
    const pub = user ? sanitizeUser(user) : null;

    return res.json({
      ok: true,
      items: COIN_SHOP_CATALOG,
      coins: pub?.coins ?? 0,
      unlockedFrames: pub?.unlockedStreakFrames ?? [],
      activeBorder: pub?.activeBorder ?? 'classic',
    });
  } catch (err) {
    console.error('[Shop GET Error]', err);
    return res.status(500).json({ error: 'Gagal memuat Toko Koin.' });
  }
});

router.post('/shop/buy', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const itemId = String(req.body?.itemId || '').trim();
    const item = COIN_SHOP_CATALOG.find((i) => i.id === itemId);
    if (!item) {
      return res.status(404).json({ error: 'Item tidak ditemukan di Toko Koin.' });
    }

    const user = await findUserByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }
    const pub = sanitizeUser(user);
    const currentCoins = pub.coins ?? 0;

    if (user.role !== 'founder' && currentCoins < item.coinCost) {
      return res.status(400).json({
        error: `Koin kamu belum cukup (${currentCoins} / ${item.coinCost} Koin). Selesaikan Misi Harian atau Check-in dulu!`,
      });
    }

    if (item.category === 'frame' && item.frameId) {
      const owned = new Set(Array.isArray(pub.unlockedStreakFrames) ? pub.unlockedStreakFrames : []);
      if (owned.has(item.frameId)) {
        // Already unlocked — just equip it without charging coins!
        const equippedUser = await updateUserByUid(uid, (u) => ({
          ...u,
          activeBorder: item.frameId!,
        }));
        return res.json({
          ok: true,
          message: `Bingkai "${item.name}" sudah kamu miliki dan langsung dipasang ke profilmu!`,
          user: sanitizeUser(equippedUser || user),
        });
      }
    }

    const coinsAfterCost =
      user.role === 'founder' ? Math.max(50000, currentCoins) : Math.max(0, currentCoins - item.coinCost);
    const expProgression = applyExpAndLevelRewards(
      { ...user, coins: coinsAfterCost },
      item.bonusExp || 0
    );
    const finalCoins =
      user.role === 'founder'
        ? Math.max(50000, coinsAfterCost + expProgression.coinsGained)
        : coinsAfterCost + expProgression.coinsGained;

    const updates: Partial<typeof user> = {
      coins: finalCoins,
      totalCoinsSpent: Math.max(0, (user.totalCoinsSpent ?? 0) + item.coinCost),
      level: expProgression.nextLevel,
      exp: expProgression.nextExp,
      totalCoinsEarned: expProgression.nextTotalCoinsEarned,
    };

    if (item.vipDays && item.vipDays > 0 && user.role !== 'founder') {
      const baseMs =
        user.isPremium && user.premiumExpiryDate
          ? Math.max(Date.now(), new Date(user.premiumExpiryDate).getTime())
          : Date.now();
      updates.isPremium = true;
      updates.isVerified = true;
      updates.premiumExpiryDate = new Date(baseMs + item.vipDays * 86_400_000).toISOString();
      updates.premiumPlan = `${item.name} (Toko Koin)`;
      if (!user.activeBadge || user.activeBadge === 'Member') {
        updates.activeBadge = 'Verified VIP';
      }
    }

    if (item.frameId) {
      const nextFrames = Array.from(
        new Set([...(Array.isArray(user.unlockedStreakFrames) ? user.unlockedStreakFrames : []), item.frameId])
      );
      updates.unlockedStreakFrames = nextFrames;
      updates.activeBorder = item.frameId;
    }

    const updatedUser = await updateUserByUid(uid, (u) => ({ ...u, ...updates }));
    const sanitized = sanitizeUser(updatedUser || { ...user, ...updates });

    await recordCoinLedgerEntry({
      uid,
      type: 'self_redeem',
      amount: -item.coinCost,
      balanceAfter: finalCoins,
      requestId: `shop_${item.id}_${Date.now()}`,
      note: `Pembelian Toko Koin: ${item.name}`,
    });

    return res.json({
      ok: true,
      item,
      message: `Berhasil membeli "${item.name}"!`,
      user: sanitized,
    });
  } catch (err) {
    console.error('[Shop Buy Error]', err);
    return res.status(500).json({ error: 'Gagal memproses pembelian di Toko Koin.' });
  }
});

// ============================================================================
// #2: NOBAR (WATCH PARTY) REAL-TIME BARENG TEMAN / GUILD
// ============================================================================

async function getNobarRoomsMap(): Promise<Record<string, NobarRoomRecord>> {
  return loadKV<Record<string, NobarRoomRecord>>('nobar_rooms_v1', 'nobar-rooms-v1.json', {});
}

async function saveNobarRoomsMap(map: Record<string, NobarRoomRecord>): Promise<void> {
  await saveKV('nobar_rooms_v1', 'nobar-rooms-v1.json', map);
}

router.get('/nobar/rooms', async (_req, res) => {
  try {
    const map = await getNobarRoomsMap();
    const now = Date.now();
    const rooms = Object.values(map)
      .filter((r) => now - new Date(r.updatedAt).getTime() < 12 * 3600 * 1000)
      .map((r) => {
        const wsCount = getNobarOnlineCount(r.roomId);
        return {
          ...r,
          onlineCount: Math.max(wsCount, r.participants?.length || 1),
          messagesCount: r.messages?.length || 0,
          messages: (r.messages || []).slice(-15),
        };
      })
      .sort((a, b) => b.onlineCount - a.onlineCount || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return res.json({ ok: true, rooms });
  } catch (err) {
    console.error('[Nobar Rooms GET Error]', err);
    return res.status(500).json({ error: 'Gagal memuat daftar Room Nobar.' });
  }
});

router.get('/nobar/room/:roomId', async (req: AuthenticatedRequest, res) => {
  try {
    const roomId = String(req.params.roomId || '').trim().slice(0, 120);
    if (!roomId) {
      return res.status(400).json({ error: 'Room ID tidak valid.' });
    }

    const map = await getNobarRoomsMap();
    let room = map[roomId];

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const payload = token ? verifyAuthToken(token) : null;
    const viewer = payload?.uid ? await findUserByUid(payload.uid) : null;
    const pubViewer = viewer ? sanitizeUser(viewer) : null;

    if (!room) {
      const seriesTitle = String(req.query.seriesTitle || 'Watch Party ZoneStream').trim();
      const episodeId = String(req.query.episodeId || roomId).trim();
      const mediaType = req.query.mediaType === 'anime' ? 'anime' : 'donghua';
      const poster = String(req.query.poster || '').trim();

      room = {
        roomId,
        title: `Nobar ${seriesTitle}`,
        seriesTitle,
        episodeId,
        mediaType,
        poster,
        hostUid: pubViewer?.uid || '00000',
        hostName: pubViewer?.name || 'VerzonFounder',
        hostPhotoUrl: pubViewer?.photoUrl || '',
        hostBorder: pubViewer?.activeBorder || 'lightning-aura',
        hostBadge: pubViewer?.activeBadge || 'Verified Founder',
        isPlaying: true,
        currentTime: 0,
        messages: [
          {
            id: `welcome_${roomId}`,
            uid: '00000',
            username: 'verzonfounder',
            name: 'VerzonFounder',
            photoUrl: '',
            role: 'founder',
            isPremium: true,
            activeBadge: 'Verified Founder',
            activeBorder: 'lightning-aura',
            statusEmoji: '👑',
            level: 999999,
            text: `Selamat datang di Room Nobar "${seriesTitle}"! Gunakan tombol Sinkronkan Waktu agar detik videomu sama persis dengan teman-teman di room ini.`,
            createdAt: new Date().toISOString(),
          },
        ],
        participants: pubViewer
          ? [
              {
                uid: pubViewer.uid,
                username: pubViewer.username,
                name: pubViewer.name,
                photoUrl: pubViewer.photoUrl,
                role: pubViewer.role,
                isPremium: pubViewer.isPremium,
                activeBadge: pubViewer.activeBadge,
                activeBorder: pubViewer.activeBorder,
                statusEmoji: pubViewer.statusEmoji,
                level: pubViewer.level,
                joinedAt: new Date().toISOString(),
              },
            ]
          : [],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      map[roomId] = room;
      await saveNobarRoomsMap(map);
    } else if (pubViewer) {
      const existingIdx = room.participants.findIndex((p) => p.uid === pubViewer.uid);
      const participantEntry: NobarParticipant = {
        uid: pubViewer.uid,
        username: pubViewer.username,
        name: pubViewer.name,
        photoUrl: pubViewer.photoUrl,
        role: pubViewer.role,
        isPremium: pubViewer.isPremium,
        activeBadge: pubViewer.activeBadge,
        activeBorder: pubViewer.activeBorder,
        statusEmoji: pubViewer.statusEmoji,
        level: pubViewer.level,
        joinedAt: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        room.participants[existingIdx] = participantEntry;
      } else {
        room.participants = [...room.participants.slice(-29), participantEntry];
      }
      room.updatedAt = new Date().toISOString();
      map[roomId] = room;
      await saveNobarRoomsMap(map);

      broadcastNobarEvent(roomId, {
        type: 'nobar:participants',
        participants: room.participants,
        onlineCount: Math.max(getNobarOnlineCount(roomId), room.participants.length),
      });
    }

    const wsCount = getNobarOnlineCount(roomId);
    return res.json({
      ok: true,
      room: {
        ...room,
        onlineCount: Math.max(wsCount, room.participants.length || 1),
      },
    });
  } catch (err) {
    console.error('[Nobar Room GET Error]', err);
    return res.status(500).json({ error: 'Gagal memuat Room Nobar.' });
  }
});

router.post('/nobar/rooms', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const user = await findUserByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }
    const pub = sanitizeUser(user);

    const { roomId: rawRoomId, title, seriesTitle, episodeId, mediaType, poster, clanTag } = req.body || {};
    const cleanEpisodeId = String(episodeId || '').trim();
    if (!cleanEpisodeId) {
      return res.status(400).json({ error: 'Episode untuk Room Nobar wajib dipilih.' });
    }

    const roomId =
      String(rawRoomId || '').trim() ||
      `room_${cleanEpisodeId.slice(0, 40)}_${uid.slice(0, 6)}`;
    const cleanSeries = String(seriesTitle || 'Watch Party ZoneStream').trim().slice(0, 100);
    const cleanTitle = String(title || `Nobar ${cleanSeries} bareng ${pub.name}`).trim().slice(0, 90);

    const map = await getNobarRoomsMap();
    const existing = map[roomId];

    const hostParticipant: NobarParticipant = {
      uid: pub.uid,
      username: pub.username,
      name: pub.name,
      photoUrl: pub.photoUrl,
      role: pub.role,
      isPremium: pub.isPremium,
      activeBadge: pub.activeBadge,
      activeBorder: pub.activeBorder,
      statusEmoji: pub.statusEmoji,
      level: pub.level,
      joinedAt: new Date().toISOString(),
    };

    const room: NobarRoomRecord = {
      roomId,
      title: cleanTitle,
      seriesTitle: cleanSeries,
      episodeId: cleanEpisodeId,
      mediaType: mediaType === 'anime' ? 'anime' : 'donghua',
      poster: String(poster || existing?.poster || '').trim(),
      hostUid: pub.uid,
      hostName: pub.name,
      hostPhotoUrl: pub.photoUrl,
      hostBorder: pub.activeBorder,
      hostBadge: pub.activeBadge,
      clanTag: clanTag ? String(clanTag).trim().slice(0, 12) : existing?.clanTag,
      isPlaying: true,
      currentTime: existing?.currentTime || 0,
      messages: existing?.messages || [
        {
          id: `host_${Date.now()}`,
          uid: pub.uid,
          username: pub.username,
          name: pub.name,
          photoUrl: pub.photoUrl,
          role: pub.role,
          isPremium: pub.isPremium,
          activeBadge: pub.activeBadge,
          activeBorder: pub.activeBorder,
          statusEmoji: pub.statusEmoji,
          level: pub.level,
          text: `${pub.name} membuka Room Nobar "${cleanTitle}"! Ayo bergabung dan nonton bareng!`,
          createdAt: new Date().toISOString(),
        },
      ],
      participants: existing
        ? [hostParticipant, ...existing.participants.filter((p) => p.uid !== pub.uid)].slice(0, 30)
        : [hostParticipant],
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    map[roomId] = room;
    await saveNobarRoomsMap(map);

    broadcastSystemEvent({
      type: 'nobar:rooms_updated',
      room: {
        ...room,
        onlineCount: Math.max(getNobarOnlineCount(roomId), room.participants.length),
      },
    });

    return res.json({
      ok: true,
      room: {
        ...room,
        onlineCount: Math.max(getNobarOnlineCount(roomId), room.participants.length),
      },
    });
  } catch (err) {
    console.error('[Nobar Create Room Error]', err);
    return res.status(500).json({ error: 'Gagal membuat Room Nobar.' });
  }
});

router.post('/nobar/room/:roomId/sync', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const roomId = String(req.params.roomId || '').trim();
    const map = await getNobarRoomsMap();
    const room = map[roomId];
    if (!room) {
      return res.status(404).json({ error: 'Room Nobar tidak ditemukan.' });
    }

    const user = await findUserByUid(uid);
    const senderName = user?.name || req.authUser!.username;
    const isPlaying = req.body?.isPlaying !== undefined ? Boolean(req.body.isPlaying) : room.isPlaying;
    const currentTime = Math.max(0, Math.floor(Number(req.body?.currentTime ?? room.currentTime) || 0));

    room.isPlaying = isPlaying;
    room.currentTime = currentTime;
    if (req.body?.episodeId) room.episodeId = String(req.body.episodeId).trim();
    if (req.body?.seriesTitle) room.seriesTitle = String(req.body.seriesTitle).trim();
    room.updatedAt = new Date().toISOString();

    map[roomId] = room;
    await saveNobarRoomsMap(map);

    broadcastNobarEvent(roomId, {
      type: 'nobar:sync',
      senderUid: uid,
      senderName,
      isPlaying: room.isPlaying,
      currentTime: room.currentTime,
      episodeId: room.episodeId,
      mediaType: room.mediaType,
      seriesTitle: room.seriesTitle,
      updatedAt: room.updatedAt,
    });

    return res.json({ ok: true, room });
  } catch (err) {
    console.error('[Nobar Sync Error]', err);
    return res.status(500).json({ error: 'Gagal menyinkronkan waktu Nobar.' });
  }
});

router.post('/nobar/room/:roomId/chat', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const roomId = String(req.params.roomId || '').trim();
    const text = String(req.body?.text || '').trim().slice(0, 400);
    if (!text) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
    }

    const user = await findUserByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }
    const pub = sanitizeUser(user);

    const map = await getNobarRoomsMap();
    const room = map[roomId];
    if (!room) {
      return res.status(404).json({ error: 'Room Nobar tidak ditemukan.' });
    }

    const msg: NobarChatMessage = {
      id: `nmsg_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
      uid: pub.uid,
      username: pub.username,
      name: pub.name,
      photoUrl: pub.photoUrl,
      role: pub.role,
      isPremium: pub.isPremium,
      activeBadge: pub.activeBadge,
      activeBorder: pub.activeBorder,
      statusEmoji: pub.statusEmoji,
      level: pub.level,
      text,
      createdAt: new Date().toISOString(),
    };

    room.messages = [...(room.messages || []).slice(-59), msg];
    if (!room.participants.some((p) => p.uid === pub.uid)) {
      room.participants = [
        ...room.participants.slice(-29),
        {
          uid: pub.uid,
          username: pub.username,
          name: pub.name,
          photoUrl: pub.photoUrl,
          role: pub.role,
          isPremium: pub.isPremium,
          activeBadge: pub.activeBadge,
          activeBorder: pub.activeBorder,
          statusEmoji: pub.statusEmoji,
          level: pub.level,
          joinedAt: new Date().toISOString(),
        },
      ];
    }
    room.updatedAt = new Date().toISOString();
    map[roomId] = room;
    await saveNobarRoomsMap(map);

    broadcastNobarEvent(roomId, {
      type: 'nobar:chat',
      message: msg,
      participants: room.participants,
      onlineCount: Math.max(getNobarOnlineCount(roomId), room.participants.length),
    });

    return res.json({ ok: true, message: msg, room });
  } catch (err) {
    console.error('[Nobar Chat POST Error]', err);
    return res.status(500).json({ error: 'Gagal mengirim pesan Nobar.' });
  }
});

// ============================================================================
// #1: LIVE DANMAKU (BULLET COMMENTS DI LAYAR VIDEO SEPERTI BSTATION)
// ============================================================================

export interface DanmakuItem {
  id: string;
  episodeId: string;
  uid: string;
  name: string;
  photoUrl: string;
  role: 'member' | 'founder';
  isPremium: boolean;
  activeBadge: string;
  text: string;
  color: string;
  lane: number;
  createdAt: string;
}

const DEFAULT_DANMAKU_TEMPLATES = [
  { text: '🔥 Animasi episode ini keren parah!', color: '#FACC15', lane: 0 },
  { text: '👑 Hadir nonton di ZoneStream kualitas HD!', color: '#38BDF8', lane: 1 },
  { text: '⚡ Gass terus jangan kasih kendor!', color: '#FFFFFF', lane: 2 },
  { text: '❤️ Jangan lupa klaim Misi Harian & Kode Redeem guys!', color: '#FB7185', lane: 3 },
  { text: '✨ Subtitle & servernya lancar jaya!', color: '#34D399', lane: 1 },
];

router.get('/danmaku/:episodeId', async (req, res) => {
  try {
    const episodeId = String(req.params.episodeId || '').trim().slice(0, 120);
    if (!episodeId) {
      return res.json({ ok: true, items: [] });
    }
    const map = await loadKV<Record<string, DanmakuItem[]>>(
      'danmaku_episodes_v1',
      'danmaku-episodes-v1.json',
      {}
    );
    let items = map[episodeId];
    if (!Array.isArray(items) || items.length === 0) {
      items = DEFAULT_DANMAKU_TEMPLATES.map((tpl, idx) => ({
        id: `seed_${episodeId}_${idx}`,
        episodeId,
        uid: '00000',
        name: idx === 0 ? 'VerzonFounder' : `Member #${idx + 1}`,
        photoUrl: '',
        role: idx === 0 ? 'founder' : 'member',
        isPremium: idx <= 1,
        activeBadge: idx === 0 ? 'Verified Founder' : idx === 1 ? 'Verified VIP' : 'Member',
        text: tpl.text,
        color: tpl.color,
        lane: tpl.lane,
        createdAt: new Date().toISOString(),
      }));
    }
    return res.json({ ok: true, items: items.slice(-60) });
  } catch (err) {
    console.error('[Danmaku GET Error]', err);
    return res.status(500).json({ error: 'Gagal memuat Danmaku.' });
  }
});

router.post('/danmaku/:episodeId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const episodeId = String(req.params.episodeId || '').trim().slice(0, 120);
    const text = String(req.body?.text || '').trim().slice(0, 90);
    if (!episodeId || !text) {
      return res.status(400).json({ error: 'Teks Danmaku tidak boleh kosong.' });
    }

    const user = await findUserByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }
    const pub = sanitizeUser(user);

    const allowedVipColors = ['#FFFFFF', '#38BDF8', '#FACC15', '#FB7185', '#34D399', '#C084FC', '#FB923C'];
    const requestedColor = String(req.body?.color || '#FFFFFF').trim();
    const finalColor =
      (pub.isPremium || pub.role === 'founder') && allowedVipColors.includes(requestedColor)
        ? requestedColor
        : '#FFFFFF';

    const lane = Math.floor(Math.random() * 4);
    const item: DanmakuItem = {
      id: `dmk_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
      episodeId,
      uid: pub.uid,
      name: pub.name,
      photoUrl: pub.photoUrl,
      role: pub.role,
      isPremium: pub.isPremium,
      activeBadge: pub.activeBadge,
      text,
      color: finalColor,
      lane,
      createdAt: new Date().toISOString(),
    };

    const map = await loadKV<Record<string, DanmakuItem[]>>(
      'danmaku_episodes_v1',
      'danmaku-episodes-v1.json',
      {}
    );
    const prev = Array.isArray(map[episodeId]) ? map[episodeId] : [];
    map[episodeId] = [...prev.slice(-59), item];
    await saveKV('danmaku_episodes_v1', 'danmaku-episodes-v1.json', map);

    broadcastSystemEvent({
      type: 'danmaku:new',
      episodeId,
      item,
    });

    return res.json({ ok: true, item });
  } catch (err) {
    console.error('[Danmaku POST Error]', err);
    return res.status(500).json({ error: 'Gagal mengirim Danmaku.' });
  }
});

// ============================================================================
// #7: PETI HARTA HARIAN (DAILY LUCKY CHEST / GACHA HARTA KARUN)
// ============================================================================

const LUCKY_CHEST_COST_COINS = 50;

router.get('/chest/status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const todayStr = getJakartaDateString(0);
    const chestMap = await loadKV<Record<string, string>>(
      'daily_lucky_chest_v1',
      'daily-lucky-chest-v1.json',
      {}
    );
    const freeAvailableToday = chestMap[uid] !== todayStr;
    return res.json({
      ok: true,
      freeAvailableToday,
      paidCostCoins: LUCKY_CHEST_COST_COINS,
      today: todayStr,
    });
  } catch (err) {
    console.error('[Chest Status Error]', err);
    return res.status(500).json({ error: 'Gagal memuat status Peti Harta.' });
  }
});

router.post('/chest/open', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const user = await findUserByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }
    const pub = sanitizeUser(user);
    const todayStr = getJakartaDateString(0);
    const chestMap = await loadKV<Record<string, string>>(
      'daily_lucky_chest_v1',
      'daily-lucky-chest-v1.json',
      {}
    );
    const isFreeOpen = chestMap[uid] !== todayStr;
    const currentCoins = pub.coins ?? 0;

    if (!isFreeOpen && user.role !== 'founder' && currentCoins < LUCKY_CHEST_COST_COINS) {
      return res.status(400).json({
        error: `Jatah Peti Gratis hari ini sudah dipakai. Kamu butuh ${LUCKY_CHEST_COST_COINS} Koin untuk membuka Peti Tambahan!`,
      });
    }

    if (isFreeOpen) {
      chestMap[uid] = todayStr;
      await saveKV('daily_lucky_chest_v1', 'daily-lucky-chest-v1.json', chestMap);
    }

    const roll = Math.random() * 100;
    let tierName = 'Peti Perunggu';
    let prizeCoins = 40;
    let prizeExp = 80;
    let prizeVipDays = 0;

    if (roll >= 96) {
      tierName = 'JACKPOT PETI MYTHIC';
      prizeCoins = 450;
      prizeExp = 700;
      prizeVipDays = 1;
    } else if (roll >= 85) {
      tierName = 'Peti Berlian';
      prizeCoins = 220;
      prizeExp = 400;
    } else if (roll >= 65) {
      tierName = 'Peti Emas';
      prizeCoins = 120;
      prizeExp = 220;
    } else if (roll >= 38) {
      tierName = 'Peti Perak';
      prizeCoins = 75;
      prizeExp = 140;
    }

    const costDeducted = isFreeOpen ? 0 : LUCKY_CHEST_COST_COINS;
    const coinsAfterCost =
      user.role === 'founder'
        ? Math.max(50000, currentCoins)
        : Math.max(0, currentCoins - costDeducted);
    const expProgression = applyExpAndLevelRewards(
      { ...user, coins: coinsAfterCost },
      prizeExp
    );
    const netAddedCoins = prizeCoins + expProgression.coinsGained;
    const finalCoins =
      user.role === 'founder'
        ? Math.max(50000, coinsAfterCost + netAddedCoins)
        : coinsAfterCost + netAddedCoins;

    const updates: Partial<typeof user> = {
      coins: finalCoins,
      totalCoinsSpent: Math.max(0, (user.totalCoinsSpent ?? 0) + costDeducted),
      totalCoinsEarned: Math.max(finalCoins, (user.totalCoinsEarned ?? 0) + netAddedCoins),
      level: expProgression.nextLevel,
      exp: expProgression.nextExp,
    };

    if (prizeVipDays > 0 && user.role !== 'founder') {
      const baseMs =
        user.isPremium && user.premiumExpiryDate
          ? Math.max(Date.now(), new Date(user.premiumExpiryDate).getTime())
          : Date.now();
      updates.isPremium = true;
      updates.isVerified = true;
      updates.premiumExpiryDate = new Date(baseMs + prizeVipDays * 86_400_000).toISOString();
      if (!user.activeBadge || user.activeBadge === 'Member') {
        updates.activeBadge = 'Verified VIP';
      }
    }

    const updatedUser = await updateUserByUid(uid, (u) => ({ ...u, ...updates }));
    const sanitized = sanitizeUser(updatedUser || { ...user, ...updates });

    await recordCoinLedgerEntry({
      uid,
      type: 'daily_checkin',
      amount: netAddedCoins - costDeducted,
      balanceAfter: finalCoins,
      requestId: `chest_${Date.now()}_${uid}`,
      note: `Buka ${tierName} (+${prizeCoins} Koin & +${prizeExp} EXP${
        prizeVipDays > 0 ? ` + ${prizeVipDays}d VIP` : ''
      })`,
    });

    return res.json({
      ok: true,
      tierName,
      isFreeOpen,
      freeAvailableToday: false,
      reward: {
        coins: prizeCoins,
        exp: prizeExp,
        vipDays: prizeVipDays,
        levelUp: expProgression.levelUp,
        newLevel: expProgression.nextLevel,
      },
      message: `Selamat! Kamu mendapatkan ${tierName}: +${prizeCoins} Koin & +${prizeExp} EXP${
        prizeVipDays > 0 ? ` + ${prizeVipDays} Hari VIP!` : '!'
      }`,
      user: sanitized,
    });
  } catch (err) {
    console.error('[Chest Open Error]', err);
    return res.status(500).json({ error: 'Gagal membuka Peti Harta.' });
  }
});

export default router;
