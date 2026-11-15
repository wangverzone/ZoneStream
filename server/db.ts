import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { hashPassword } from './auth.ts';
import { IUser, PublicUser, UserModel } from './models/User.ts';
import { VerificationCodeModel, type OtpPurpose } from './models/VerificationCode.ts';

import { TransactionModel } from './models/Transaction.ts';
import { CommentModel } from './models/Comment.ts';

let isMongoConnected = false;
let connectPromise: Promise<boolean> | null = null;
let founderSeeded = false;

const FOUNDER_UID = '00000';
const FOUNDER_USERNAME = 'verzonfounder';
const FOUNDER_EMAIL = 'wanglin72kk@gmail.com';
const DEFAULT_MONGODB_URI =
  'mongodb+srv://wanglin72kk_db_user:VerzonStream123@cluster0.yczwtmm.mongodb.net/verzon-strem?retryWrites=true&w=majority';

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

const readFallbackUsers = (): Record<string, IUser> => {
  try {
    const file = getFallbackFilePath();
    if (!fs.existsSync(file)) return {};
    const raw = fs.readFileSync(file, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeFallbackUsers = (users: Record<string, IUser>) => {
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

export function sanitizeUser(user: IUser): PublicUser {
  const { passwordHash: _removed, ...pub } = user;
  if (
    pub.role !== 'founder' &&
    pub.isPremium &&
    pub.premiumExpiryDate &&
    new Date(pub.premiumExpiryDate).getTime() < Date.now()
  ) {
    return {
      ...pub,
      isPremium: false,
    };
  }
  return pub;
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
    isPremium: true,
    isVerified: true,
    premiumPlan: 'Founder Lifetime',
    premiumExpiryDate: '',
    activeBadge: 'Verified Founder',
    activeBorder: 'rainbow-prism',
    profileTheme: 'sovereign-gold',
    statusEmoji: 'infinity-dao',
    lastWatchDate: '',
    watchStreak: 1,
    dailyEpisodesWatched: 0,
    totalEpisodesWatched: 0,
    watchHistory: [],
    bookmarks: [],
  };
}

async function ensureFounderFallback() {
  founderSeeded = true;
  const store = readFallbackUsers();
  if (store['4167293'] && !store[FOUNDER_UID]) {
    store[FOUNDER_UID] = {
      ...store['4167293'],
      uid: FOUNDER_UID,
      level: 999999,
      exp: 0,
      profileTheme: store['4167293'].profileTheme || 'sovereign-gold',
      statusEmoji: store['4167293'].statusEmoji || 'infinity-dao',
    };
    delete store['4167293'];
    writeFallbackUsers(store);
  } else if (!store[FOUNDER_UID]) {
    store[FOUNDER_UID] = buildFounderPayload();
    writeFallbackUsers(store);
  }
}

export async function ensureFounderAccount() {
  if (founderSeeded) return;
  founderSeeded = true;
  try {
    await UserModel.collection.dropIndex('firebaseUid_1').catch(() => {});
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
        console.log('[DB] Migrated VerzonFounder to UID 00000 & unlimited level.');
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
    isPremium: false,
    isVerified: false,
    premiumPlan: '',
    premiumExpiryDate: '',
    activeBadge: 'Member',
    activeBorder: 'classic',
    profileTheme: 'default',
    statusEmoji: '',
    lastWatchDate: '',
    watchStreak: 0,
    dailyEpisodesWatched: 0,
    totalEpisodesWatched: 0,
    watchHistory: [],
    bookmarks: [],
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
    isPremium: false,
    isVerified: false,
    premiumPlan: '',
    premiumExpiryDate: '',
    activeBadge: 'Member',
    activeBorder: 'classic',
    profileTheme: 'default',
    statusEmoji: '',
    lastWatchDate: '',
    watchStreak: 0,
    dailyEpisodesWatched: 0,
    totalEpisodesWatched: 0,
    watchHistory: [],
    bookmarks: [],
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
    isPremium: Boolean(pub.isPremium || pub.role === 'founder'),
    isVerified: Boolean(pub.isVerified || pub.isPremium || pub.role === 'founder'),
    activeBadge: pub.activeBadge || (pub.role === 'founder' ? 'Verified Founder' : 'Member'),
    activeBorder: pub.activeBorder || 'classic',
    profileTheme: pub.profileTheme || 'default',
    statusEmoji: pub.statusEmoji || '',
    watchStreak: pub.watchStreak || 0,
    totalEpisodesWatched: pub.totalEpisodesWatched || 0,
    bookmarksCount: Array.isArray(pub.bookmarks) ? pub.bookmarks.length : 0,
    lastActiveAt: pub.lastActiveAt ? new Date(pub.lastActiveAt).toISOString() : '',
    isOnline,
  };
}

export async function searchCommunityUsers(query: string, limit = 30): Promise<IUser[]> {
  const mongoOk = await connectDB();
  const cleanQ = query.trim();

  if (mongoOk) {
    if (!cleanQ) {
      const docs = await UserModel.find({})
        .sort({ role: 1, isPremium: -1, level: -1, lastActiveAt: -1 })
        .limit(limit);
      // Put founder first cleanly
      return docs
        .map((d) => d.toObject())
        .sort((a, b) => (a.role === 'founder' ? -1 : b.role === 'founder' ? 1 : (b.level || 1) - (a.level || 1)));
    }
    const escaped = cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    const docs = await UserModel.find({
      $or: [{ name: rx }, { username: rx }, { uid: rx }],
    })
      .sort({ isPremium: -1, level: -1 })
      .limit(limit);
    return docs.map((d) => d.toObject());
  }

  const all = Object.values(readFallbackUsers());
  const filtered = cleanQ
    ? all.filter((u) => {
        const lq = cleanQ.toLowerCase();
        return (
          u.name.toLowerCase().includes(lq) ||
          u.username.toLowerCase().includes(lq) ||
          u.uid.toLowerCase().includes(lq)
        );
      })
    : all;

  return filtered
    .sort((a, b) => (a.role === 'founder' ? -1 : b.role === 'founder' ? 1 : (b.level || 1) - (a.level || 1)))
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

