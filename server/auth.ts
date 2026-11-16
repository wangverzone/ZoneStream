import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import type { Request, Response, NextFunction } from 'express';
import { getCachedBanEntry, setCachedBanEntry } from './banCache.ts';
import { UserModel } from './models/User.ts';

const TOKEN_SECRET =
  process.env.AUTH_SECRET || process.env.JWT_SECRET || 'verzon-donghive-hmac-secret-2026';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export interface TokenPayload {
  uid: string;
  username: string;
  role: 'member' | 'founder';
  exp: number;
}

export function signAuthToken(payload: Omit<TokenPayload, 'exp'>): string {
  const fullPayload: TokenPayload = {
    ...payload,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyAuthToken(token: string): TokenPayload | null {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expectedSig = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(data)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as TokenPayload;
    if (!decoded.uid || Date.now() > decoded.exp) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  authUser?: TokenPayload;
}

function readFallbackBanRecord(
  uid: string
): { role: 'member' | 'founder'; isBanned: boolean; banReason: string } | null {
  try {
    const isVercel = Boolean(process.env.VERCEL);
    const dir = isVercel ? '/tmp/zonestream-data' : path.resolve(process.cwd(), '.data');
    const file = path.join(dir, 'users-v2.json');
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw) return null;
    const store = JSON.parse(raw) as Record<
      string,
      { role?: string; isBanned?: boolean; banReason?: string }
    >;
    const found = store[uid];
    if (!found) return null;
    return {
      role: found.role === 'founder' ? 'founder' : 'member',
      isBanned: Boolean(found.isBanned),
      banReason: String(found.banReason || ''),
    };
  } catch {
    return null;
  }
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan masuk terlebih dahulu.' });
  }
  const token = header.slice(7).trim();
  const decoded = verifyAuthToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Sesi kedaluwarsa atau tidak valid.' });
  }

  let banEntry = getCachedBanEntry(decoded.uid);
  if (!banEntry) {
    try {
      if (mongoose.connection.readyState === 1) {
        const doc = await UserModel.findOne({ uid: decoded.uid })
          .select('role isBanned banReason')
          .lean();
        if (doc) {
          setCachedBanEntry(decoded.uid, {
            role: doc.role === 'founder' ? 'founder' : 'member',
            isBanned: Boolean(doc.isBanned),
            banReason: doc.banReason || '',
          });
          banEntry = getCachedBanEntry(decoded.uid, 60_000);
        }
      } else {
        const fb = readFallbackBanRecord(decoded.uid);
        if (fb) {
          setCachedBanEntry(decoded.uid, fb);
          banEntry = getCachedBanEntry(decoded.uid, 60_000);
        }
      }
    } catch {
      // Non-fatal fallback; route handlers still load user
    }
  }

  if (banEntry && banEntry.isBanned && banEntry.role !== 'founder') {
    const reasonSuffix = banEntry.banReason ? ` (${banEntry.banReason})` : '';
    return res.status(403).json({
      error: `Akun Anda telah dibanned oleh Founder${reasonSuffix}.`,
      banned: true,
      banReason: banEntry.banReason,
    });
  }

  req.authUser = decoded;
  return next();
}

