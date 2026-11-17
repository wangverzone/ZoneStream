import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { hashPassword } from './auth.ts';
import { setCachedBanEntry, clearBanCache } from './banCache.ts';
import { UserModel, type IUser, type PublicUser } from './models/User.ts';
import { VerificationCodeModel, type OtpPurpose } from './models/VerificationCode.ts';

import { TransactionModel } from './models/Transaction.ts';
import { CommentModel } from './models/Comment.ts';

let isMongoConnected = false;
let connectPromise: Promise<boolean> | null = null;
let founderSeeded = false;

const FOUNDER_UID = '00000';
const FOUNDER_USERNAME = 'verzonfounder';
const FOUNDER_EMAIL = 'wanglin72kk@gmail.com';

// DAFTAR EMAIL YANG OTOMATIS JADI PREM / VIP (Tambahkan email lain di sini jika ingin otomatis VIP)
export const AUTO_VIP_WHITELIST = [
  'akunresspakistan@gmail.com',
  'wanglin72kk@gmail.com',
];

const DEFAULT_MONGODB_URI =
  'mongodb+srv://wanglin72kk_db_user:VerzonStream123@cluster0.yczwtmm.mongodb.net/verzon-strem?retryWrites=true&w=majority';

export function upgradeImageToHd(url?: string): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:image/')) return raw;
  // Upgrade Google User Content avatars from s96-c to s512-c HD
  if (raw.includes('googleusercontent.com')) {
    return raw.replace(/=s\d+(-c)?/g, '=s512-c');
  }
  return raw;
}

const memoryCodes = new Map<
  string,
  { email: string; uid?: string; purpose: string; code: string; expiresAt: number }
>();

const getFallbackFilePath = (): string => {
  const isVercel = Boolean(process.env.VERCEL);
  const dir = isVercel ? '/tmp/zonestream-data' : path.resolve(process.cwd(), '.data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'users-v2.json');
};

export const readFallbackUsers = (): Record<string, IUser> => {
  try {
    const file = getFallbackFilePath();
    if (!fs.existsSync(file)) return {};
    const raw = fs.readFileSync(file, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const writeFallbackUsers = (users: Record<string, IUser>) => {
  try {
    const file = getFallbackFilePath();
    fs.writeFileSync(file, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.error('Fallback store write error:', err);
  }
};

export const generateDisplayUid = (): string => {
  return String(Math.floor(1000000 + Math.random() * 9000000));
};

export const STREAK_FRAME_TIERS = [
  { id: 'streak-ember', minStreak: 3, name: 'Ember Pulse 3D' },
  { id: 'streak-aurora', minStreak: 7, name: 'Aurora Prism 3D' },
  { id: 'streak-celestial', minStreak: 14, name: 'Celestial Orbit 3D' },
  { id: 'streak-eternal', minStreak: 30, name: 'Eternal Phoenix 3D' },
] as const;

export function getJakartaDateString(offsetDays = 0): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000 + offsetDays * 86_400_000);
  return now.toISOString().slice(0, 10);
}

export function sanitizeUser(user: IUser): PublicUser {
  const { passwordHash: _removed, ...pub } = user;
  pub.photoUrl = upgradeImageToHd(pub.photoUrl);
  pub.countryCode = (pub.countryCode || 'ID').toUpperCase();

  const isFounderUser =
    String(pub.email || '').toLowerCase() === 'wanglin72kk@gmail.com' || pub.role === 'founder';

  const isWhitelisted = AUTO_VIP_WHITELIST.map((e) => e.toLowerCase()).includes(
    String(pub.email || '').toLowerCase()
  );

  if (isFounderUser) {
    pub.role = 'founder';
    pub.activeBadge = 'Verified Founder';
    pub.isPremium = true;
    pub.isVerified = true;
    pub.isBanned = false;
    pub.bannedAt = null;
    pub.banReason = '';
    pub.level = 999999;
    pub.charisma = Math.max(9999, Number(pub.charisma ?? 9999));
  } else {
    pub.role = 'member';
    pub.isBanned = Boolean(pub.isBanned);
    pub.banReason = pub.isBanned ? String(pub.banReason || '') : '';
    const hasFounderBadge =
      String(pub.activeBadge || '').trim().toLowerCase() === 'verified founder';
    if (isWhitelisted || pub.isPremium) {
      pub.isPremium = true;
      pub.isVerified = true;
      pub.activeBadge =
        pub.activeBadge && pub.activeBadge !== 'Member' && !hasFounderBadge
          ? pub.activeBadge
          : 'Verified VIP';
    } else if (hasFounderBadge || !pub.activeBadge) {
      pub.activeBadge = 'Member';
    }
    pub.level = Math.max(1, Number(pub.level) || 1);
    pub.charisma = Math.max(0, Number(pub.charisma ?? 0));
  }

  // Normalize Daily Watch Streak & Earned Animated Profile Frames
  const todayStr = getJakartaDateString(0);
  const yesterdayStr = getJakartaDateString(-1);
  const storedDates = Array.isArray(pub.streakDates)
    ? pub.streakDates.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
    : [];
  if (pub.lastWatchDate && /^\d{4}-\d{2}-\d{2}$/.test(pub.lastWatchDate) && !storedDates.includes(pub.lastWatchDate)) {
    storedDates.push(pub.lastWatchDate);
  }
  storedDates.sort();
  pub.streakDates = Array.from(new Set(storedDates)).slice(-30);

  const rawStreak = Math.max(0, Number(pub.watchStreak || 0));
  const isStreakActive = Boolean(
    pub.lastWatchDate && (pub.lastWatchDate === todayStr || pub.lastWatchDate === yesterdayStr)
  );
  pub.watchStreak = isStreakActive ? Math.max(1, rawStreak) : 0;
  pub.dailyEpisodesWatched = pub.lastWatchDate === todayStr ? Math.max(0, Number(pub.dailyEpisodesWatched || 0)) : 0;
  pub.longestStreak = Math.max(Number(pub.longestStreak || 0), rawStreak, pub.watchStreak);

  const unlockedSet = new Set(Array.isArray(pub.unlockedStreakFrames) ? pub.unlockedStreakFrames : []);
  for (const tier of STREAK_FRAME_TIERS) {
    if (isFounderUser || pub.longestStreak >= tier.minStreak) {
      unlockedSet.add(tier.id);
    }
  }
  pub.unlockedStreakFrames = Array.from(unlockedSet);

  const episodesCount = Math.max(
    Number(pub.totalEpisodesWatched || 0),
    Array.isArray(pub.watchHistory) ? pub.watchHistory.length : 0
  );
  pub.totalEpisodesWatched = episodesCount;
  pub.totalWatchMinutes = Math.max(
    Number(pub.totalWatchMinutes || 0),
    episodesCount * 18
  );
  pub.totalCommentsCount = Math.max(0, Number(pub.totalCommentsCount || 0));

  if (isFounderUser) {
    pub.coins = Math.max(50000, Math.floor(Number(pub.coins ?? 50000)));
    pub.totalCoinsEarned = Math.max(pub.coins, Math.floor(Number(pub.totalCoinsEarned ?? pub.coins)));
  } else {
    pub.coins = Math.max(0, Math.floor(Number(pub.coins ?? 0)));
    pub.totalCoinsEarned = Math.max(pub.coins, Math.floor(Number(pub.totalCoinsEarned ?? pub.coins)));
  }
  pub.totalCoinsSpent = Math.max(0, Math.floor(Number(pub.totalCoinsSpent ?? 0)));
  pub.totalGiftsSent = Math.max(0, Math.floor(Number(pub.totalGiftsSent ?? 0)));
  pub.totalGiftsReceived = Math.max(0, Math.floor(Number(pub.totalGiftsReceived ?? 0)));

  // Normalize Daily Check-in Streak (valid if claimed within the last 48h, 24h cooldown + 24h grace window)
  const rawLastCheckIn = typeof pub.lastCheckInAt === 'string' ? pub.lastCheckInAt.trim() : '';
  const lastCheckInMs = rawLastCheckIn ? new Date(rawLastCheckIn).getTime() : 0;
  const checkInElapsed = lastCheckInMs && !Number.isNaN(lastCheckInMs) ? Date.now() - lastCheckInMs : Infinity;
  const rawCheckInStreak = Math.max(0, Math.floor(Number(pub.checkInStreak ?? 0)));
  pub.lastCheckInAt = rawLastCheckIn && !Number.isNaN(lastCheckInMs) ? rawLastCheckIn : '';
  pub.checkInStreak = checkInElapsed <= 48 * 3600 * 1000 ? Math.max(1, rawCheckInStreak) : 0;
  pub.longestCheckInStreak = Math.max(
    0,
    Math.floor(Number(pub.longestCheckInStreak ?? 0)),
    rawCheckInStreak,
    pub.checkInStreak
  );
  pub.totalCheckIns = Math.max(0, Math.floor(Number(pub.totalCheckIns ?? 0)));
  pub.checkInDates = Array.isArray(pub.checkInDates)
    ? Array.from(
        new Set(
          pub.checkInDates.filter(
            (d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
          )
        )
      )
        .sort()
        .slice(-30)
    : [];

  const lastActiveMs = pub.lastActiveAt ? new Date(pub.lastActiveAt).getTime() : 0;
  const computedOnline = lastActiveMs > 0 && Date.now() - lastActiveMs < 3 * 60 * 1000;
  const dbSyncedAt = new Date().toISOString();

  if (
    pub.role !== 'founder' &&
    !isWhitelisted &&
    pub.isPremium &&
    pub.premiumExpiryDate &&
    new Date(pub.premiumExpiryDate).getTime() < Date.now()
  ) {
    return {
      ...pub,
      isPremium: false,
      isOnline: computedOnline,
      dbSyncedAt,
    };
  }
  return {
    ...pub,
    profileBgColor: typeof pub.profileBgColor === 'string' ? pub.profileBgColor : '',
    isOnline: computedOnline,
    dbSyncedAt,
  };
}

export async function connectDB(): Promise<boolean> {
  if (isMongoConnected && mongoose.connection.readyState === 1) {
    if (!founderSeeded) await ensureFounderAccount();
    return true;
  }

  if (connectPromise) {
    return connectPromise;
  }

  const uri = (process.env.MONGODB_URI || DEFAULT_MONGODB_URI).trim();
  if (!uri) {
    if (!founderSeeded) await ensureFounderFallback();
    return false;
  }

  connectPromise = (async () => {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 7000,
      });
      isMongoConnected = true;
      console.log('[DB] Connected to MongoDB:', mongoose.connection.name);
      await ensureFounderAccount();
      return true;
    } catch (err) {
      console.warn('[DB] MongoDB connection failed, using local fallback:', (err as Error).message);
      isMongoConnected = false;
      await ensureFounderFallback();
      return false;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

function buildFounderPayload(): IUser {
  const founderPass = process.env.FOUNDER_PASSWORD?.trim() || 'VerzonStream123';
  return {
    uid: FOUNDER_UID,
    username: FOUNDER_USERNAME,
    email: FOUNDER_EMAIL,
    passwordHash: hashPassword(founderPass),
    name: 'VerzonFounder',
    bio: 'Founder & Creator of ZoneStream',
    role: 'founder',
    photoUrl: '',
    bannerUrl: '',
    level: 999999,
    exp: 0,
    coins: 50000,
    totalCoinsEarned: 50000,
    totalCoinsSpent: 0,
    totalGiftsSent: 0,
    totalGiftsReceived: 0,
    lastCheckInAt: '',
    checkInStreak: 0,
    longestCheckInStreak: 0,
    totalCheckIns: 0,
    checkInDates: [],
    charisma: 9999,
    likedBy: [],
    isPremium: true,
    isVerified: true,
    premiumPlan: 'Founder Lifetime',
    premiumExpiryDate: '',
    activeBadge: 'Verified Founder',
    activeBorder: 'lightning-aura',
    profileTheme: 'sovereign-gold',
    profileBgColor: '',
    statusEmoji: 'infinity-dao',
    countryCode: 'ID',
    lastWatchDate: '',
    watchStreak: 1,
    longestStreak: 30,
    streakDates: [],
    unlockedStreakFrames: ['streak-ember', 'streak-aurora', 'streak-celestial', 'streak-eternal'],
    dailyEpisodesWatched: 0,
    totalEpisodesWatched: 0,
    watchHistory: [],
    bookmarks: [],
    episodeBookmarks: [],
  };
}

async function ensureFounderFallback() {
  founderSeeded = true;
  const store = readFallbackUsers();
  const oneYearExpiry = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
  for (const u of Object.values(store)) {
    const emailLower = String(u.email || '').toLowerCase();
    if (emailLower === 'wanglin72kk@gmail.com' || u.role === 'founder') {
      u.role = 'founder';
      u.isPremium = true;
      u.isVerified = true;
      u.level = 999999;
      u.charisma = Math.max(9999, Number(u.charisma ?? 9999));
      u.activeBadge = 'Verified Founder';
    } else {
      const hasFounderBadge =
        String(u.activeBadge || '').trim().toLowerCase() === 'verified founder';
      if (hasFounderBadge) {
        u.activeBadge = u.isPremium || u.isVerified ? 'Verified VIP' : 'Member';
      }
      if (emailLower === 'akunresspakistan@gmail.com') {
        u.isPremium = true;
        u.isVerified = true;
        if ((u.level || 1) >= 9000) {
          u.level = 1;
          u.exp = 0;
        }
        u.premiumPlan = u.premiumPlan || 'VIP 1 Tahun';
        u.premiumExpiryDate = u.premiumExpiryDate || oneYearExpiry;
        u.activeBadge =
          u.activeBadge &&
          u.activeBadge !== 'Member' &&
          u.activeBadge.toLowerCase() !== 'verified founder'
            ? u.activeBadge
            : 'Verified VIP';
      }
      // Ensure non-founder users without real likes from other users have charisma = 0
      if (!Array.isArray(u.likedBy) || u.likedBy.length === 0) {
        u.charisma = 0;
      }
    }
  }

  if (store['4167293'] && !store[FOUNDER_UID]) {
    store[FOUNDER_UID] = {
      ...store['4167293'],
      uid: FOUNDER_UID,
      role: 'founder',
      level: 999999,
      exp: 0,
      charisma: 9999,
      activeBadge: 'Verified Founder',
      activeBorder:
        !store['4167293'].activeBorder || store['4167293'].activeBorder === 'classic'
          ? 'lightning-aura'
          : store['4167293'].activeBorder,
      profileTheme: store['4167293'].profileTheme || 'sovereign-gold',
      statusEmoji: store['4167293'].statusEmoji || 'infinity-dao',
    };
    delete store['4167293'];
    writeFallbackUsers(store);
  } else if (!store[FOUNDER_UID]) {
    const payload = buildFounderPayload();
    payload.level = 999999;
    payload.charisma = 9999;
    store[FOUNDER_UID] = payload;
    writeFallbackUsers(store);
  } else {
    writeFallbackUsers(store);
  }
}

export async function ensureFounderAccount() {
  if (founderSeeded) return;
  founderSeeded = true;
  try {
    await UserModel.collection.dropIndex('firebaseUid_1').catch(() => {});

    // Zero out legacy default charisma (1200 / 38500 / auto-boosted) for non-founders who have no real likes yet
    await UserModel.updateMany(
      {
        role: { $ne: 'founder' },
        email: { $ne: FOUNDER_EMAIL },
        $or: [{ likedBy: { $exists: false } }, { likedBy: { $size: 0 } }],
        charisma: { $ne: 0 },
      },
      { $set: { charisma: 0 } }
    ).catch(() => {});

    // Strip exclusive 'Verified Founder' badge from any non-founder accounts in DB
    await UserModel.updateMany(
      {
        role: { $ne: 'founder' },
        email: { $ne: FOUNDER_EMAIL },
        activeBadge: /^verified founder$/i,
        isPremium: true,
      },
      { $set: { activeBadge: 'Verified VIP' } }
    ).catch(() => {});
    await UserModel.updateMany(
      {
        role: { $ne: 'founder' },
        email: { $ne: FOUNDER_EMAIL },
        activeBadge: /^verified founder$/i,
        isPremium: { $ne: true },
      },
      { $set: { activeBadge: 'Member' } }
    ).catch(() => {});

    const pakistanUser = await UserModel.findOne({ email: 'akunresspakistan@gmail.com' });
    if (pakistanUser) {
      pakistanUser.isPremium = true;
      pakistanUser.isVerified = true;
      if ((pakistanUser.level || 1) >= 9000) {
        pakistanUser.level = 1;
        pakistanUser.exp = 0;
      }
      if (!Array.isArray(pakistanUser.likedBy) || pakistanUser.likedBy.length === 0) {
        pakistanUser.charisma = 0;
      }
      pakistanUser.premiumPlan = pakistanUser.premiumPlan || 'VIP 1 Tahun';
      pakistanUser.premiumExpiryDate =
        pakistanUser.premiumExpiryDate ||
        new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
      pakistanUser.activeBadge =
        pakistanUser.activeBadge &&
        pakistanUser.activeBadge !== 'Member' &&
        pakistanUser.activeBadge.toLowerCase() !== 'verified founder'
          ? pakistanUser.activeBadge
          : 'Verified VIP';
      await pakistanUser.save();
    }

    const founderUser = await UserModel.findOne({ email: 'wanglin72kk@gmail.com' });
    if (founderUser) {
      founderUser.role = 'founder';
      founderUser.isPremium = true;
      founderUser.isVerified = true;
      founderUser.level = 999999;
      founderUser.charisma = Math.max(9999, Number(founderUser.charisma ?? 9999));
      founderUser.coins = Math.max(50000, Number(founderUser.coins ?? 50000));
      founderUser.totalCoinsEarned = Math.max(founderUser.coins, Number(founderUser.totalCoinsEarned ?? founderUser.coins));
      founderUser.activeBadge = 'Verified Founder';
      await founderUser.save();
    }

    // One-time safe coin backfill for existing members who already leveled up before Coins launched
    const legacyLeveledUsers = await UserModel.find({
      role: { $ne: 'founder' },
      level: { $gte: 2 },
      coins: { $exists: false },
    }).limit(200);
    for (const lu of legacyLeveledUsers) {
      const safeLv = Math.min(100, Math.max(2, Number(lu.level) || 2));
      let total = 0;
      for (let lv = 2; lv <= safeLv; lv++) {
        const base = Math.min(2000, 250 + lv * 50);
        const bonus = lv % 5 === 0 ? 250 : 0;
        total += base + bonus;
      }
      lu.coins = total;
      lu.totalCoinsEarned = total;
      await lu.save().catch(() => {});
    }

    const existing = await UserModel.findOne({
      $or: [{ username: FOUNDER_USERNAME }, { uid: FOUNDER_UID }, { uid: '4167293' }],
    });
    if (!existing) {
      await UserModel.create(buildFounderPayload());
      console.log('[DB] Seeded exclusive VerzonFounder account (UID 00000).');
    } else {
      let dirty = false;
      const oldUid = existing.uid;
      if (existing.uid !== FOUNDER_UID) {
        existing.uid = FOUNDER_UID;
        dirty = true;
      }
      if (existing.email !== FOUNDER_EMAIL) {
        existing.email = FOUNDER_EMAIL;
        dirty = true;
      }
      if (existing.role !== 'founder') {
        existing.role = 'founder';
        dirty = true;
      }
      if (!existing.isVerified) {
        existing.isVerified = true;
        dirty = true;
      }
      if ((existing.level || 0) < 999999) {
        existing.level = 999999;
        existing.exp = 0;
        dirty = true;
      }
      if (!existing.activeBorder || existing.activeBorder === 'classic') {
        existing.activeBorder = 'lightning-aura';
        dirty = true;
      }
      if (!existing.profileTheme || existing.profileTheme === 'default') {
        existing.profileTheme = 'sovereign-gold';
        dirty = true;
      }
      if (!existing.statusEmoji) {
        existing.statusEmoji = 'infinity-dao';
        dirty = true;
      }
      if (dirty) {
        await existing.save();
        if (oldUid && oldUid !== FOUNDER_UID) {
          await CommentModel.updateMany({ uid: oldUid }, { $set: { uid: FOUNDER_UID, authorLevel: 999999 } }).catch(() => {});
          await TransactionModel.updateMany({ uid: oldUid }, { $set: { uid: FOUNDER_UID } }).catch(() => {});
        }
        console.log('[DB] Migrated VerzonFounder to UID 00000 & 3D decoration.');
      }
    }
  } catch (err) {
    console.warn('[DB] Founder seed notice:', (err as Error).message);
  }
}

export async function findUserByIdentifier(identifier: string): Promise<IUser | null> {
  const normalized = identifier.trim().toLowerCase();
  const mongoOk = await connectDB();
  if (mongoOk) {
    const doc = await UserModel.findOne({
      $or: [{ username: normalized }, { email: normalized }, { uid: normalized }],
    });
    return doc ? doc.toObject() : null;
  }
  const store = readFallbackUsers();
  return (
    Object.values(store).find(
      (u) =>
        u.username.toLowerCase() === normalized ||
        u.email.toLowerCase() === normalized ||
        u.uid === normalized
    ) || null
  );
}

export async function findUserByUid(uid: string): Promise<IUser | null> {
  const mongoOk = await connectDB();
  if (mongoOk) {
    const doc = await UserModel.findOne({ uid });
    return doc ? doc.toObject() : null;
  }
  const store = readFallbackUsers();
  return store[uid] || null;
}

export async function createMemberUser(payload: {
  username: string;
  email: string;
  name: string;
  password: string;
}): Promise<IUser> {
  const mongoOk = await connectDB();
  const newUser: IUser = {
    uid: generateDisplayUid(),
    username: payload.username.toLowerCase().trim(),
    email: payload.email.toLowerCase().trim(),
    passwordHash: hashPassword(payload.password),
    name: payload.name.trim(),
    bio: '',
    role: 'member',
    photoUrl: '',
    bannerUrl: '',
    level: 1,
    exp: 25,
    coins: 0,
    totalCoinsEarned: 0,
    totalCoinsSpent: 0,
    totalGiftsSent: 0,
    totalGiftsReceived: 0,
    lastCheckInAt: '',
    checkInStreak: 0,
    longestCheckInStreak: 0,
    totalCheckIns: 0,
    checkInDates: [],
    charisma: 0,
    likedBy: [],
    isPremium: false,
    isVerified: false,
    premiumPlan: '',
    premiumExpiryDate: '',
    activeBadge: 'Member',
    activeBorder: 'classic',
    profileTheme: 'default',
    profileBgColor: '',
    statusEmoji: '',
    lastWatchDate: '',
    watchStreak: 0,
    longestStreak: 0,
    streakDates: [],
    unlockedStreakFrames: [],
    dailyEpisodesWatched: 0,
    totalEpisodesWatched: 0,
    watchHistory: [],
    bookmarks: [],
    episodeBookmarks: [],
  };

  if (mongoOk) {
    const created = await UserModel.create(newUser);
    return created.toObject();
  }

  const store = readFallbackUsers();
  store[newUser.uid] = newUser;
  writeFallbackUsers(store);
  return newUser;
}

export async function updateUserByUid(
  uid: string,
  updater: (user: IUser) => IUser
): Promise<IUser | null> {
  const mongoOk = await connectDB();
  if (mongoOk) {
    const doc = await UserModel.findOne({ uid });
    if (!doc) return null;
    const updated = updater(doc.toObject());
    Object.assign(doc, updated);
    doc.markModified('watchHistory');
    doc.markModified('bookmarks');
    doc.markModified('streakDates');
    doc.markModified('unlockedStreakFrames');
    doc.markModified('checkInDates');
    await doc.save();
    return doc.toObject();
  }

  const store = readFallbackUsers();
  const current = store[uid];
  if (!current) return null;
  const updated = updater(current);
  store[uid] = updated;
  writeFallbackUsers(store);
  return updated;
}

export async function findOrCreateGoogleUser(params: {
  email: string;
  name?: string;
  photoUrl?: string;
}): Promise<IUser> {
  const cleanEmail = params.email.trim().toLowerCase();
  const mongoOk = await connectDB();

  if (cleanEmail === FOUNDER_EMAIL) {
    const founder = await findUserByIdentifier(FOUNDER_USERNAME);
    if (founder) {
      if (!founder.photoUrl && params.photoUrl) {
        const updated = await updateUserByUid(founder.uid, (cur) => ({
          ...cur,
          photoUrl: params.photoUrl || cur.photoUrl,
        }));
        if (updated) return updated;
      }
      return founder;
    }
  }

  const existing = await findUserByIdentifier(cleanEmail);
  if (existing) {
    if (!existing.photoUrl && params.photoUrl) {
      const updated = await updateUserByUid(existing.uid, (cur) => ({
        ...cur,
        photoUrl: params.photoUrl || cur.photoUrl,
      }));
      if (updated) return updated;
    }
    return existing;
  }

  const baseHandle = cleanEmail
    .split('@')[0]
    .replace(/[^a-z0-9_]/gi, '')
    .toLowerCase()
    .slice(0, 14) || 'member';
  const uniqueSuffix = Math.floor(100 + Math.random() * 900);
  const username =
    baseHandle === FOUNDER_USERNAME ? `member_${uniqueSuffix}` : `${baseHandle}_${uniqueSuffix}`;

  const newUser: IUser = {
    uid: generateDisplayUid(),
    username,
    email: cleanEmail,
    passwordHash: hashPassword(`gauth_${Date.now()}_${Math.random()}`),
    name: (params.name || baseHandle).trim().slice(0, 40),
    bio: '',
    role: 'member',
    photoUrl: params.photoUrl || '',
    bannerUrl: '',
    level: 1,
    exp: 25,
    coins: 0,
    totalCoinsEarned: 0,
    totalCoinsSpent: 0,
    totalGiftsSent: 0,
    totalGiftsReceived: 0,
    lastCheckInAt: '',
    checkInStreak: 0,
    longestCheckInStreak: 0,
    totalCheckIns: 0,
    checkInDates: [],
    charisma: 0,
    likedBy: [],
    isPremium: false,
    isVerified: false,
    premiumPlan: '',
    premiumExpiryDate: '',
    activeBadge: 'Member',
    activeBorder: 'classic',
    profileTheme: 'default',
    profileBgColor: '',
    statusEmoji: '',
    lastWatchDate: '',
    watchStreak: 0,
    longestStreak: 0,
    streakDates: [],
    unlockedStreakFrames: [],
    dailyEpisodesWatched: 0,
    totalEpisodesWatched: 0,
    watchHistory: [],
    bookmarks: [],
    episodeBookmarks: [],
  };

  if (mongoOk) {
    const created = await UserModel.create(newUser);
    return created.toObject();
  }

  const store = readFallbackUsers();
  store[newUser.uid] = newUser;
  writeFallbackUsers(store);
  return newUser;
}

export async function saveOtpCode(params: {
  email: string;
  uid?: string;
  purpose: OtpPurpose;
  code: string;
}) {
  const normalizedEmail = params.email.trim().toLowerCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const mongoOk = await connectDB();

  if (mongoOk) {
    await VerificationCodeModel.deleteMany({
      email: normalizedEmail,
      purpose: params.purpose,
    });
    await VerificationCodeModel.create({
      email: normalizedEmail,
      uid: params.uid || '',
      purpose: params.purpose,
      code: params.code,
      expiresAt,
    });
    return;
  }

  memoryCodes.set(`${params.purpose}:${normalizedEmail}`, {
    email: normalizedEmail,
    uid: params.uid,
    purpose: params.purpose,
    code: params.code,
    expiresAt: expiresAt.getTime(),
  });
}

export async function verifyAndConsumeOtpCode(params: {
  email: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<boolean> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const cleanCode = params.code.trim();
  const mongoOk = await connectDB();

  if (mongoOk) {
    const doc = await VerificationCodeModel.findOne({
      email: normalizedEmail,
      purpose: params.purpose,
      code: cleanCode,
      expiresAt: { $gt: new Date() },
    });
    if (!doc) return false;
    await VerificationCodeModel.deleteOne({ _id: doc._id });
    return true;
  }

  const key = `${params.purpose}:${normalizedEmail}`;
  const entry = memoryCodes.get(key);
  if (!entry || entry.code !== cleanCode || Date.now() > entry.expiresAt) {
    return false;
  }
  memoryCodes.delete(key);
  return true;
}

export function isDbMongoConnected(): boolean {
  return isMongoConnected && mongoose.connection.readyState === 1;
}

export async function touchUserLastActive(uid: string): Promise<void> {
  if (!uid) return;
  const now = new Date();
  try {
    if (isDbMongoConnected()) {
      await UserModel.updateOne({ uid }, { $set: { lastActiveAt: now } });
    } else {
      const store = readFallbackUsers();
      if (store[uid]) {
        store[uid].lastActiveAt = now;
        writeFallbackUsers(store);
      }
    }
  } catch {
    // Non-fatal heartbeat
  }
}

export async function setUserOnlinePresence(uid: string, online: boolean): Promise<IUser | null> {
  if (!uid) return null;
  const targetDate = online ? new Date() : new Date(Date.now() - 10 * 60 * 1000);
  return updateUserByUid(uid, (cur) => ({
    ...cur,
    lastActiveAt: targetDate,
  }));
}

export async function touchUserLogin(uid: string): Promise<void> {
  if (!uid) return;
  const now = new Date();
  try {
    if (isDbMongoConnected()) {
      await UserModel.updateOne({ uid }, { $set: { lastLoginAt: now, lastActiveAt: now } });
    } else {
      const store = readFallbackUsers();
      if (store[uid]) {
        store[uid].lastLoginAt = now;
        store[uid].lastActiveAt = now;
        writeFallbackUsers(store);
      }
    }
  } catch {
    // Non-fatal login touch
  }
}

export async function listAllUsersForFounder(): Promise<IUser[]> {
  const mongoOk = await connectDB();
  if (mongoOk) {
    const docs = await UserModel.find({})
      .sort({ lastLoginAt: -1, lastActiveAt: -1, createdAt: -1 })
      .lean();
    return docs as IUser[];
  }
  const all = Object.values(readFallbackUsers());
  return all.sort((a, b) => {
    const aMs = new Date(a.lastLoginAt || a.lastActiveAt || a.createdAt || 0).getTime();
    const bMs = new Date(b.lastLoginAt || b.lastActiveAt || b.createdAt || 0).getTime();
    return bMs - aMs;
  });
}

export async function setUserBanStatus(
  targetUid: string,
  banned: boolean,
  reason = ''
): Promise<{ user: IUser | null; blockedFounder?: boolean }> {
  const cleanUid = String(targetUid || '').trim();
  const cleanReason = String(reason || '').trim().slice(0, 160);
  if (!cleanUid) return { user: null };

  const target = await findUserByUid(cleanUid);
  if (!target) return { user: null };

  const isTargetFounder =
    target.role === 'founder' ||
    target.uid === FOUNDER_UID ||
    String(target.email || '').toLowerCase() === FOUNDER_EMAIL;
  if (isTargetFounder) {
    return { user: target, blockedFounder: true };
  }

  const now = new Date();
  const updated = await updateUserByUid(cleanUid, (cur) => ({
    ...cur,
    isBanned: banned,
    bannedAt: banned ? now : null,
    banReason: banned ? cleanReason : '',
  }));

  setCachedBanEntry(cleanUid, {
    role: 'member',
    isBanned: banned,
    banReason: banned ? cleanReason : '',
  });

  return { user: updated };
}

export async function setAllUsersBanStatus(
  banned: boolean,
  reason = ''
): Promise<number> {
  const cleanReason = String(reason || '').trim().slice(0, 160);
  const mongoOk = await connectDB();
  const now = new Date();
  let affected = 0;

  if (mongoOk) {
    const res = await UserModel.updateMany(
      {
        role: { $ne: 'founder' },
        uid: { $ne: FOUNDER_UID },
        email: { $ne: FOUNDER_EMAIL },
      },
      {
        $set: {
          isBanned: banned,
          bannedAt: banned ? now : null,
          banReason: banned ? cleanReason : '',
        },
      }
    );
    affected = Number(res.modifiedCount || res.matchedCount || 0);
  } else {
    const store = readFallbackUsers();
    for (const u of Object.values(store)) {
      const isFounder =
        u.role === 'founder' ||
        u.uid === FOUNDER_UID ||
        String(u.email || '').toLowerCase() === FOUNDER_EMAIL;
      if (!isFounder) {
        u.isBanned = banned;
        u.bannedAt = banned ? now : null;
        u.banReason = banned ? cleanReason : '';
        affected += 1;
      }
    }
    writeFallbackUsers(store);
  }

  clearBanCache();
  return affected;
}

export function toCommunityUserSummary(user: IUser) {
  const pub = sanitizeUser(user);
  const lastActiveMs = pub.lastActiveAt ? new Date(pub.lastActiveAt).getTime() : 0;
  const isOnline = lastActiveMs > 0 && Date.now() - lastActiveMs < 3 * 60 * 1000;
  return {
    uid: pub.uid,
    username: pub.username,
    name: pub.name,
    bio: pub.bio || '',
    role: pub.role,
    photoUrl: pub.photoUrl || '',
    bannerUrl: pub.bannerUrl || '',
    level: pub.role === 'founder' ? 999999 : pub.level || 1,
    exp: pub.exp || 0,
    charisma: pub.role === 'founder' ? Math.max(9999, Number(pub.charisma ?? 9999)) : Number(pub.charisma ?? 0),
    isPremium: Boolean(pub.isPremium || pub.role === 'founder'),
    isVerified: Boolean(pub.isVerified || pub.isPremium || pub.role === 'founder'),
    activeBadge: pub.activeBadge || (pub.role === 'founder' ? 'Verified Founder' : 'Member'),
    activeBorder: pub.activeBorder || 'classic',
    profileTheme: pub.profileTheme || 'default',
    profileBgColor: pub.profileBgColor || '',
    statusEmoji: pub.statusEmoji || '',
    countryCode: (pub.countryCode || 'ID').toUpperCase(),
    watchStreak: pub.watchStreak || 0,
    totalEpisodesWatched: pub.totalEpisodesWatched || 0,
    totalWatchMinutes: pub.totalWatchMinutes || 0,
    totalCommentsCount: pub.totalCommentsCount || 0,
    bookmarksCount: Array.isArray(pub.bookmarks) ? pub.bookmarks.length : 0,
    lastActiveAt: pub.lastActiveAt ? new Date(pub.lastActiveAt).toISOString() : '',
    isOnline,
  };
}

export async function searchCommunityUsers(query: string, limit = 20): Promise<IUser[]> {
  const mongoOk = await connectDB();
  const cleanQ = query
    .trim()
    .replace(/^@+/, '')
    .replace(/^uid:\s*/i, '')
    .trim();

  // Privacy: never return all members when query is empty
  if (!cleanQ) {
    return [];
  }

  if (mongoOk) {
    const escaped = cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    const docs = await UserModel.find({
      $or: [{ uid: rx }, { username: rx }, { name: rx }],
    })
      .sort({ isPremium: -1, level: -1 })
      .limit(limit);
    return docs
      .map((d) => d.toObject())
      .sort((a, b) =>
        a.uid === cleanQ || a.username.toLowerCase() === cleanQ.toLowerCase()
          ? -1
          : b.uid === cleanQ || b.username.toLowerCase() === cleanQ.toLowerCase()
          ? 1
          : 0
      );
  }

  const all = Object.values(readFallbackUsers());
  const lq = cleanQ.toLowerCase();
  const filtered = all.filter(
    (u) =>
      u.uid.toLowerCase().includes(lq) ||
      u.username.toLowerCase().includes(lq) ||
      u.name.toLowerCase().includes(lq)
  );

  return filtered
    .sort((a, b) =>
      a.uid.toLowerCase() === lq || a.username.toLowerCase() === lq
        ? -1
        : b.uid.toLowerCase() === lq || b.username.toLowerCase() === lq
        ? 1
        : 0
    )
    .slice(0, limit);
}

export async function findUsersByUids(uids: string[]): Promise<IUser[]> {
  const unique = Array.from(new Set(uids.filter(Boolean)));
  if (unique.length === 0) return [];
  const mongoOk = await connectDB();
  if (mongoOk) {
    const docs = await UserModel.find({ uid: { $in: unique } });
    return docs.map((d) => d.toObject());
  }
  const store = readFallbackUsers();
  return unique.map((u) => store[u]).filter(Boolean);
}

const getSocialFallbackPath = (name: string): string => {
  const isVercel = Boolean(process.env.VERCEL);
  const dir = isVercel ? '/tmp/zonestream-data' : path.resolve(process.cwd(), '.data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, name);
};

export function readFallbackJson<T>(fileName: string, fallback: T): T {
  try {
    const file = getSocialFallbackPath(fileName);
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeFallbackJson<T>(fileName: string, data: T): void {
  try {
    const file = getSocialFallbackPath(fileName);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // Non-fatal fallback write error
  }
}

