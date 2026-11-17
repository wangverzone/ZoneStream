import crypto from 'crypto';
import {
  connectDB,
  findUserByIdentifier,
  findUserByUid,
  getJakartaDateString,
  isDbMongoConnected,
  readFallbackJson,
  readFallbackUsers,
  sanitizeUser,
  toCommunityUserSummary,
  updateUserByUid,
  writeFallbackJson,
  writeFallbackUsers,
} from './db.ts';
import {
  CoinTransactionModel,
  type CoinTxType,
  type ICoinTransaction,
} from './models/CoinTransaction.ts';
import { UserModel, type IUser } from './models/User.ts';
import { createNotification } from './notifications.ts';

export interface CoinPremiumPackageSpec {
  id: string;
  name: string;
  coinCost: number;
  durationDays: number;
  bonusExp: number;
  badgeTag?: string;
  description: string;
}

export const COIN_PREMIUM_PACKAGES: readonly CoinPremiumPackageSpec[] = Object.freeze([
  {
    id: 'prem_1d',
    name: 'VIP Express 1 Hari',
    coinCost: 1000,
    durationDays: 1,
    bonusExp: 50,
    description: 'Aktifkan status Verified VIP, bebas iklan & 2× EXP selama 24 jam penuh.',
  },
  {
    id: 'prem_3d',
    name: 'VIP Squad 3 Hari',
    coinCost: 3000,
    durationDays: 3,
    bonusExp: 150,
    badgeTag: 'Populer',
    description: 'Bagikan atau aktifkan 3 hari penuh Verified VIP + bonus +150 EXP.',
  },
  {
    id: 'prem_7d',
    name: 'VIP Weekly 7 Hari',
    coinCost: 6500,
    durationDays: 7,
    bonusExp: 400,
    badgeTag: 'Hemat 500',
    description: 'Akses VIP 1 minggu penuh dengan harga hemat 500 Koin +400 EXP.',
  },
  {
    id: 'prem_14d',
    name: 'VIP Sovereign 14 Hari',
    coinCost: 12500,
    durationDays: 14,
    bonusExp: 800,
    badgeTag: 'Hemat 1.500',
    description: 'Akses VIP 2 minggu penuh +800 EXP dan semua dekorasi profil.',
  },
  {
    id: 'prem_30d',
    name: 'VIP Emperor 30 Hari',
    coinCost: 25000,
    durationDays: 30,
    bonusExp: 1800,
    badgeTag: 'Hemat 5.000',
    description: 'Paket VIP 1 bulan penuh paling hemat +1.800 EXP langsung.',
  },
]);

const COIN_LEDGER_FALLBACK_FILE = 'coin-ledger-v1.json';
const coinUserMutexSet = new Set<string>();
const idempotencyCache = new Map<string, { expiresAt: number; result: any }>();
const giftRateWindow = new Map<string, number[]>();
const checkInRateWindow = new Map<string, number[]>();
const watchDurationCooldown = new Map<string, number>();
const commentExpState = new Map<string, { lastAt: number; lastText: string; dayStr: string; dayCount: number }>();

export function getExpNeededForLevel(level: number): number {
  return Math.max(100, Math.max(1, Number(level) || 1) * 200);
}

/**
 * Deterministic server-authoritative coins earned when reaching `reachedLevel`.
 * - Lv 2: 350 | Lv 3: 400 | Lv 4: 450 (Total 1.200 -> enough for 1d Prem!)
 * - Lv 5: 500 + 250 milestone = 750 | Lv 6: 550 | Lv 7: 600 (Total 3.100 -> enough for 3d Prem!)
 */
export function getCoinsForLevel(reachedLevel: number): { base: number; milestoneBonus: number; total: number } {
  const lvl = Math.max(2, Math.floor(reachedLevel));
  const base = Math.min(2000, 250 + lvl * 50);
  const milestoneBonus = lvl % 5 === 0 ? 250 : 0;
  return { base, milestoneBonus, total: base + milestoneBonus };
}

export function calculateBackfillCoinsForLevel(currentLevel: number): number {
  const safeLvl = Math.min(100, Math.max(1, Math.floor(Number(currentLevel) || 1)));
  let total = 0;
  for (let lv = 2; lv <= safeLvl; lv++) {
    total += getCoinsForLevel(lv).total;
  }
  return total;
}

export function applyExpAndLevelRewards(
  current: Pick<IUser, 'role' | 'level' | 'exp' | 'coins' | 'totalCoinsEarned'>,
  rawExpToAdd: number
): {
  nextLevel: number;
  nextExp: number;
  levelUp: boolean;
  levelsGained: number;
  coinsGained: number;
  nextCoins: number;
  nextTotalCoinsEarned: number;
} {
  const expToAdd = Math.max(0, Math.floor(Number(rawExpToAdd) || 0));
  const currentCoins = Math.max(0, Math.floor(Number(current.coins || 0)));
  const currentTotalEarned = Math.max(currentCoins, Math.floor(Number(current.totalCoinsEarned || 0)));

  if (current.role === 'founder') {
    return {
      nextLevel: 999999,
      nextExp: 0,
      levelUp: false,
      levelsGained: 0,
      coinsGained: 0,
      nextCoins: Math.max(50000, currentCoins),
      nextTotalCoinsEarned: Math.max(50000, currentTotalEarned),
    };
  }

  let nextLevel = Math.max(1, Math.floor(Number(current.level) || 1));
  let nextExp = Math.max(0, Math.floor(Number(current.exp) || 0)) + expToAdd;
  let levelsGained = 0;
  let coinsGained = 0;

  while (nextExp >= getExpNeededForLevel(nextLevel)) {
    nextExp -= getExpNeededForLevel(nextLevel);
    nextLevel += 1;
    levelsGained += 1;
    coinsGained += getCoinsForLevel(nextLevel).total;
  }

  return {
    nextLevel,
    nextExp,
    levelUp: levelsGained > 0,
    levelsGained,
    coinsGained,
    nextCoins: currentCoins + coinsGained,
    nextTotalCoinsEarned: currentTotalEarned + coinsGained,
  };
}

/**
 * Anti-farming guard for /api/user/watch-duration (legitimate frontend sends 1 min every 60s).
 * Rejects rapid automated bursts faster than 45s.
 */
export function tryClaimWatchDurationWindow(uid: string): boolean {
  const now = Date.now();
  const prev = watchDurationCooldown.get(uid) || 0;
  if (now - prev < 45_000) {
    return false;
  }
  watchDurationCooldown.set(uid, now);
  return true;
}

/**
 * Anti-spam guard for comment EXP/Coin rewards.
 * Prevents duplicate-text spam or rapid comment bursts from farming level-up coins.
 */
export function tryClaimCommentExpWindow(uid: string, normalizedText: string): boolean {
  const now = Date.now();
  const today = new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const state = commentExpState.get(uid);

  if (state) {
    if (now - state.lastAt < 10_000) return false;
    if (normalizedText && state.lastText === normalizedText && now - state.lastAt < 180_000) {
      return false;
    }
    const dayCount = state.dayStr === today ? state.dayCount : 0;
    if (dayCount >= 30) return false;
    commentExpState.set(uid, {
      lastAt: now,
      lastText: normalizedText || state.lastText,
      dayStr: today,
      dayCount: dayCount + 1,
    });
    return true;
  }

  commentExpState.set(uid, {
    lastAt: now,
    lastText: normalizedText,
    dayStr: today,
    dayCount: 1,
  });
  return true;
}

export async function recordCoinLedgerEntry(input: {
  uid: string;
  type: CoinTxType;
  amount: number;
  balanceAfter: number;
  peerUid?: string;
  peerName?: string;
  peerUsername?: string;
  packageId?: string;
  durationDays?: number;
  note: string;
  requestId?: string;
}): Promise<ICoinTransaction | null> {
  const txId = `ctx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const entry: ICoinTransaction = {
    txId,
    uid: String(input.uid || ''),
    type: input.type,
    amount: Math.round(Number(input.amount) || 0),
    balanceAfter: Math.max(0, Math.round(Number(input.balanceAfter) || 0)),
    peerUid: String(input.peerUid || ''),
    peerName: String(input.peerName || '').slice(0, 60),
    peerUsername: String(input.peerUsername || '').slice(0, 40),
    packageId: String(input.packageId || ''),
    durationDays: Math.max(0, Math.round(Number(input.durationDays) || 0)),
    note: String(input.note || '').slice(0, 260),
    requestId: String(input.requestId || '').slice(0, 80),
  };

  try {
    await connectDB();
    if (isDbMongoConnected()) {
      const created = await CoinTransactionModel.create(entry);
      return created.toObject();
    }
    const list = readFallbackJson<Array<ICoinTransaction & { createdAt: string }>>(
      COIN_LEDGER_FALLBACK_FILE,
      []
    );
    const stored = { ...entry, createdAt: new Date().toISOString() };
    list.unshift(stored);
    writeFallbackJson(COIN_LEDGER_FALLBACK_FILE, list.slice(0, 500));
    return stored;
  } catch (err) {
    console.warn('[Coin Ledger Record Notice]', (err as Error).message);
    return null;
  }
}

export async function getCoinLedgerForUser(uid: string, limit = 30) {
  await connectDB();
  if (isDbMongoConnected()) {
    const docs = await CoinTransactionModel.find({ uid })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return docs.map((d: any) => ({
      txId: d.txId,
      uid: d.uid,
      type: d.type,
      amount: Number(d.amount) || 0,
      balanceAfter: Number(d.balanceAfter) || 0,
      peerUid: d.peerUid || '',
      peerName: d.peerName || '',
      peerUsername: d.peerUsername || '',
      packageId: d.packageId || '',
      durationDays: Number(d.durationDays) || 0,
      note: d.note || '',
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString(),
    }));
  }

  const list = readFallbackJson<Array<ICoinTransaction & { createdAt?: string }>>(
    COIN_LEDGER_FALLBACK_FILE,
    []
  );
  return list
    .filter((item) => item.uid === uid)
    .slice(0, limit)
    .map((d) => ({
      ...d,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString(),
    }));
}

function checkGiftRateLimit(uid: string): boolean {
  const now = Date.now();
  const history = (giftRateWindow.get(uid) || []).filter((ts) => now - ts < 60_000);
  if (history.length >= 5) {
    giftRateWindow.set(uid, history);
    return false;
  }
  history.push(now);
  giftRateWindow.set(uid, history);
  return true;
}

export function resolveCoinPackage(packageId: string): CoinPremiumPackageSpec | null {
  const cleanId = String(packageId || '').trim();
  return COIN_PREMIUM_PACKAGES.find((p) => p.id === cleanId) || null;
}

export interface ExecuteCoinGiftResult {
  ok: boolean;
  status: number;
  error?: string;
  sender?: ReturnType<typeof sanitizeUser>;
  recipient?: ReturnType<typeof toCommunityUserSummary>;
  package?: CoinPremiumPackageSpec;
  isSelfRedeem?: boolean;
  newExpiryDate?: string;
  txId?: string;
}

/**
 * Strict, atomic, race-condition-proof Coin -> Premium Gift/Redeem executor.
 * - Authoritative server pricing (`COIN_PREMIUM_PACKAGES`)
 * - Per-UID mutex + idempotency key deduplication
 * - MongoDB atomic conditional `$gte` + `$inc` deduction (impossible to go negative)
 * - Automatic rollback refund if target activation fails
 */
export async function executeSecureCoinPremiumGift(params: {
  senderUid: string;
  targetUid?: string;
  packageId: string;
  requestId?: string;
  giftMessage?: string;
}): Promise<ExecuteCoinGiftResult> {
  const senderUid = String(params.senderUid || '').trim();
  const cleanTargetUid = String(params.targetUid || senderUid).trim() || senderUid;
  const isSelfRedeem = cleanTargetUid === senderUid;
  const cleanMessage = String(params.giftMessage || '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, 120);
  const requestId = String(params.requestId || '').trim().slice(0, 80);

  const pkg = resolveCoinPackage(params.packageId);
  if (!pkg) {
    return { ok: false, status: 400, error: 'Paket Premium Koin tidak valid.' };
  }

  // Idempotency check (block duplicate double-click / replay requests)
  const idempKey = requestId ? `${senderUid}:${requestId}` : '';
  if (idempKey) {
    const cached = idempotencyCache.get(idempKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
  }

  if (!checkGiftRateLimit(senderUid)) {
    return {
      ok: false,
      status: 429,
      error: 'Terlalu banyak transaksi dalam 1 menit. Tunggu sebentar untuk keamanan akun.',
    };
  }

  if (coinUserMutexSet.has(senderUid)) {
    return {
      ok: false,
      status: 409,
      error: 'Transaksi koin sebelumnya sedang diproses. Mohon tunggu sebentar.',
    };
  }

  coinUserMutexSet.add(senderUid);

  try {
    await connectDB();
    const mongoOk = isDbMongoConnected();

    if (mongoOk && idempKey) {
      const existingTx = await CoinTransactionModel.findOne({
        uid: senderUid,
        requestId,
      }).lean();
      if (existingTx) {
        return {
          ok: false,
          status: 409,
          error: 'Permintaan ini sudah diproses sebelumnya (duplikat ditolak).',
        };
      }
    }

    const senderDoc = await findUserByUid(senderUid);
    if (!senderDoc) {
      return { ok: false, status: 404, error: 'Akun pengirim tidak ditemukan.' };
    }
    if (senderDoc.isBanned && senderDoc.role !== 'founder') {
      return { ok: false, status: 403, error: 'Akun Anda sedang dibatasi dan tidak dapat bertransaksi.' };
    }

    const targetDoc = isSelfRedeem
      ? senderDoc
      : (await findUserByUid(cleanTargetUid)) || (await findUserByIdentifier(cleanTargetUid));
    if (!targetDoc) {
      return { ok: false, status: 404, error: 'Pengguna penerima tidak ditemukan.' };
    }
    const resolvedTargetUid = targetDoc.uid;
    const effectiveSelfRedeem = resolvedTargetUid === senderUid;
    if (targetDoc.isBanned) {
      return { ok: false, status: 400, error: 'Tidak dapat membagikan Premium ke akun yang dibanned.' };
    }
    if (!effectiveSelfRedeem && targetDoc.role === 'founder') {
      return {
        ok: false,
        status: 400,
        error: 'Akun Founder sudah memiliki akses Lifetime VIP. Pilih member lain ya!',
      };
    }
    if (effectiveSelfRedeem && senderDoc.role === 'founder') {
      return {
        ok: false,
        status: 400,
        error: 'Akun Founder sudah memiliki Lifetime VIP. Anda bisa langsung Bagi Prem ke member lain!',
      };
    }

    const currentCoins = Math.max(0, Math.floor(Number(senderDoc.coins || 0)));
    if (currentCoins < pkg.coinCost) {
      return {
        ok: false,
        status: 400,
        error: `Koin tidak cukup! Dibutuhkan ${pkg.coinCost.toLocaleString('id-ID')} Koin (Saldo Anda: ${currentCoins.toLocaleString('id-ID')} Koin).`,
      };
    }

    let deductedSender: IUser | null = null;

    if (mongoOk) {
      // ATOMIC DEDUCTION: coins >= pkg.coinCost checked and decremented in one atomic DB operation
      const updatedDoc = await UserModel.findOneAndUpdate(
        {
          uid: senderUid,
          coins: { $gte: pkg.coinCost },
          isBanned: { $ne: true },
        },
        {
          $inc: {
            coins: -pkg.coinCost,
            totalCoinsSpent: pkg.coinCost,
            totalGiftsSent: effectiveSelfRedeem ? 0 : 1,
          },
        },
        { new: true }
      );
      deductedSender = updatedDoc ? updatedDoc.toObject() : null;
    } else {
      const store = readFallbackUsers();
      const s = store[senderUid];
      if (s && Math.floor(Number(s.coins || 0)) >= pkg.coinCost && !s.isBanned) {
        s.coins = Math.floor(Number(s.coins || 0)) - pkg.coinCost;
        s.totalCoinsSpent = Math.floor(Number(s.totalCoinsSpent || 0)) + pkg.coinCost;
        if (!effectiveSelfRedeem) {
          s.totalGiftsSent = Math.floor(Number(s.totalGiftsSent || 0)) + 1;
        }
        store[senderUid] = s;
        writeFallbackUsers(store);
        deductedSender = s;
      }
    }

    if (!deductedSender) {
      return {
        ok: false,
        status: 400,
        error: 'Saldo Koin tidak mencukupi atau transaksi ditolak oleh validasi keamanan.',
      };
    }

    // Activate or extend target's VIP Premium duration
    let newExpiryIso = '';
    let updatedTarget: IUser | null = null;

    try {
      const nowMs = Date.now();
      updatedTarget = await updateUserByUid(resolvedTargetUid, (current) => {
        const existingExpiryMs = current.premiumExpiryDate
          ? new Date(current.premiumExpiryDate).getTime()
          : 0;
        const baseMs = existingExpiryMs > nowMs ? existingExpiryMs : nowMs;
        newExpiryIso = new Date(baseMs + pkg.durationDays * 24 * 60 * 60 * 1000).toISOString();

        const expRes = applyExpAndLevelRewards(current, pkg.bonusExp);

        return {
          ...current,
          isPremium: true,
          isVerified: true,
          premiumPlan: effectiveSelfRedeem
            ? `${pkg.name} (Tukar Koin)`
            : `${pkg.name} (Gift dari @${deductedSender!.username})`,
          premiumExpiryDate: newExpiryIso,
          activeBadge:
            current.role === 'founder'
              ? 'Verified Founder'
              : !current.activeBadge || current.activeBadge === 'Member'
              ? 'Verified VIP'
              : current.activeBadge,
          activeBorder: current.activeBorder === 'classic' ? 'lightning-aura' : current.activeBorder,
          level: expRes.nextLevel,
          exp: expRes.nextExp,
          coins: expRes.nextCoins,
          totalCoinsEarned: expRes.nextTotalCoinsEarned,
          totalGiftsReceived:
            (current.totalGiftsReceived || 0) + (effectiveSelfRedeem ? 0 : 1),
        };
      });

      if (!updatedTarget) {
        throw new Error('TARGET_UPDATE_FAILED');
      }
    } catch (activateErr) {
      // ROLLBACK REFUND if target activation failed
      if (mongoOk) {
        await UserModel.updateOne(
          { uid: senderUid },
          {
            $inc: {
              coins: pkg.coinCost,
              totalCoinsSpent: -pkg.coinCost,
              totalGiftsSent: effectiveSelfRedeem ? 0 : -1,
            },
          }
        ).catch(() => {});
      } else {
        const store = readFallbackUsers();
        if (store[senderUid]) {
          store[senderUid].coins = Math.floor(Number(store[senderUid].coins || 0)) + pkg.coinCost;
          store[senderUid].totalCoinsSpent = Math.max(
            0,
            Math.floor(Number(store[senderUid].totalCoinsSpent || 0)) - pkg.coinCost
          );
          if (!effectiveSelfRedeem) {
            store[senderUid].totalGiftsSent = Math.max(
              0,
              Math.floor(Number(store[senderUid].totalGiftsSent || 0)) - 1
            );
          }
          writeFallbackUsers(store);
        }
      }

      await recordCoinLedgerEntry({
        uid: senderUid,
        type: 'refund',
        amount: pkg.coinCost,
        balanceAfter: currentCoins,
        peerUid: resolvedTargetUid,
        packageId: pkg.id,
        durationDays: pkg.durationDays,
        note: `Refund otomatis karena gagal mengaktifkan ${pkg.name} untuk UID ${resolvedTargetUid}`,
      });

      console.error('[Coin Gift Rollback]', activateErr);
      return {
        ok: false,
        status: 500,
        error: 'Gagal mengaktifkan Premium penerima. Koin Anda telah dikembalikan 100% secara otomatis.',
      };
    }

    // Re-read fresh sender snapshot (important when self-redeem added bonus EXP or level-up coins!)
    const freshSender = (await findUserByUid(senderUid)) || deductedSender;

    const senderLedger = await recordCoinLedgerEntry({
      uid: senderUid,
      type: effectiveSelfRedeem ? 'self_redeem' : 'gift_sent',
      amount: -pkg.coinCost,
      balanceAfter: Math.max(0, Number(freshSender.coins || 0)),
      peerUid: updatedTarget.uid,
      peerName: updatedTarget.name,
      peerUsername: updatedTarget.username,
      packageId: pkg.id,
      durationDays: pkg.durationDays,
      requestId,
      note: effectiveSelfRedeem
        ? `Tukar ${pkg.coinCost.toLocaleString('id-ID')} Koin untuk ${pkg.durationDays} Hari VIP Premium`
        : `Bagi Prem ${pkg.durationDays} Hari ke @${updatedTarget.username} (${pkg.coinCost.toLocaleString('id-ID')} Koin)`,
    });

    if (!effectiveSelfRedeem) {
      await recordCoinLedgerEntry({
        uid: updatedTarget.uid,
        type: 'gift_received',
        amount: 0,
        balanceAfter: Math.max(0, Number(updatedTarget.coins || 0)),
        peerUid: freshSender.uid,
        peerName: freshSender.name,
        peerUsername: freshSender.username,
        packageId: pkg.id,
        durationDays: pkg.durationDays,
        note: `Menerima Gift ${pkg.durationDays} Hari VIP Premium dari ${freshSender.name} (@${freshSender.username})`,
      });

      await createNotification({
        uid: updatedTarget.uid,
        type: 'system',
        title: `🎁 ${freshSender.name} membagikan ${pkg.durationDays} Hari Premium untukmu!`,
        message: `${
          cleanMessage ? `"${cleanMessage}" · ` : ''
        }Status Verified VIP + Bebas Iklan + 2× EXP & +${pkg.bonusExp} EXP langsung aktif di akunmu!`,
        link: '/profile',
        actorUid: freshSender.uid,
        actorName: freshSender.name,
        actorPhoto: freshSender.photoUrl || '',
      }).catch(() => {});
    } else {
      await createNotification({
        uid: freshSender.uid,
        type: 'system',
        title: `✨ ${pkg.name} Aktif dari Tukar Koin!`,
        message: `${pkg.coinCost.toLocaleString('id-ID')} Koin berhasil ditukar menjadi ${pkg.durationDays} Hari VIP Premium +${pkg.bonusExp} EXP.`,
        link: '/profile',
      }).catch(() => {});
    }

    const finalResult: ExecuteCoinGiftResult = {
      ok: true,
      status: 200,
      sender: sanitizeUser(freshSender),
      recipient: toCommunityUserSummary(updatedTarget),
      package: pkg,
      isSelfRedeem: effectiveSelfRedeem,
      newExpiryDate: newExpiryIso,
      txId: senderLedger?.txId,
    };

    if (idempKey) {
      idempotencyCache.set(idempKey, {
        expiresAt: Date.now() + 60_000,
        result: finalResult,
      });
    }

    return finalResult;
  } finally {
    coinUserMutexSet.delete(senderUid);
  }
}

export interface DailyCheckInTierSpec {
  day: number;
  coins: number;
  bonusExp: number;
  label: string;
  isJackpot?: boolean;
}

export const DAILY_CHECKIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const DAILY_CHECKIN_GRACE_WINDOW_MS = 48 * 60 * 60 * 1000;

export const DAILY_CHECKIN_REWARDS: readonly DailyCheckInTierSpec[] = Object.freeze([
  { day: 1, coins: 50, bonusExp: 15, label: 'Hari 1' },
  { day: 2, coins: 75, bonusExp: 20, label: 'Hari 2' },
  { day: 3, coins: 100, bonusExp: 25, label: 'Hari 3' },
  { day: 4, coins: 125, bonusExp: 30, label: 'Hari 4' },
  { day: 5, coins: 150, bonusExp: 40, label: 'Hari 5' },
  { day: 6, coins: 200, bonusExp: 50, label: 'Hari 6' },
  { day: 7, coins: 400, bonusExp: 100, label: 'Hari 7 · Jackpot', isJackpot: true },
]);

function checkCheckInRateLimit(uid: string): boolean {
  const now = Date.now();
  const history = (checkInRateWindow.get(uid) || []).filter((ts) => now - ts < 60_000);
  if (history.length >= 10) {
    checkInRateWindow.set(uid, history);
    return false;
  }
  history.push(now);
  checkInRateWindow.set(uid, history);
  return true;
}

export interface DailyCheckInStatusSnapshot {
  canClaim: boolean;
  lastCheckInAt: string;
  nextCheckInAt: string;
  remainingMs: number;
  streak: number;
  longestStreak: number;
  totalCheckIns: number;
  cycleDay: number;
  nextCycleDay: number;
  nextReward: DailyCheckInTierSpec;
  rewardsSchedule: readonly DailyCheckInTierSpec[];
}

export function computeDailyCheckInStatus(user: Pick<
  IUser,
  'lastCheckInAt' | 'checkInStreak' | 'longestCheckInStreak' | 'totalCheckIns'
>): DailyCheckInStatusSnapshot {
  const nowMs = Date.now();
  const rawLast = typeof user.lastCheckInAt === 'string' ? user.lastCheckInAt.trim() : '';
  const lastMs = rawLast ? new Date(rawLast).getTime() : 0;
  const hasValidLast = Boolean(rawLast && lastMs > 0 && !Number.isNaN(lastMs));
  const elapsedMs = hasValidLast ? Math.max(0, nowMs - lastMs) : Infinity;

  const canClaim = !hasValidLast || elapsedMs >= DAILY_CHECKIN_COOLDOWN_MS;
  const remainingMs = canClaim ? 0 : Math.max(0, DAILY_CHECKIN_COOLDOWN_MS - elapsedMs);
  const nextCheckInAt = canClaim
    ? ''
    : new Date(lastMs + DAILY_CHECKIN_COOLDOWN_MS).toISOString();

  const rawStreak = Math.max(0, Math.floor(Number(user.checkInStreak || 0)));
  const activeStreak =
    hasValidLast && elapsedMs <= DAILY_CHECKIN_GRACE_WINDOW_MS ? Math.max(1, rawStreak) : 0;
  const longestStreak = Math.max(
    activeStreak,
    Math.floor(Number(user.longestCheckInStreak || 0))
  );
  const totalCheckIns = Math.max(0, Math.floor(Number(user.totalCheckIns || 0)));

  const cycleDay = activeStreak > 0 ? ((activeStreak - 1) % 7) + 1 : 0;
  const nextCycleDay = canClaim ? (activeStreak % 7) + 1 : ((activeStreak % 7) + 1);
  const nextReward = DAILY_CHECKIN_REWARDS[nextCycleDay - 1] || DAILY_CHECKIN_REWARDS[0];

  return {
    canClaim,
    lastCheckInAt: hasValidLast ? rawLast : '',
    nextCheckInAt,
    remainingMs,
    streak: activeStreak,
    longestStreak,
    totalCheckIns,
    cycleDay,
    nextCycleDay,
    nextReward,
    rewardsSchedule: DAILY_CHECKIN_REWARDS,
  };
}

export interface ExecuteDailyCheckInResult {
  ok: boolean;
  status: number;
  error?: string;
  rewardCoins?: number;
  expGained?: number;
  levelUp?: boolean;
  newLevel?: number;
  coinsGainedFromLevelUp?: number;
  streak?: number;
  longestStreak?: number;
  totalCheckIns?: number;
  cycleDay?: number;
  lastCheckInAt?: string;
  nextCheckInAt?: string;
  remainingMs?: number;
  user?: ReturnType<typeof sanitizeUser>;
}

/**
 * Atomic 24-hour Daily Check-in executor:
 * - Per-UID mutex against rapid double-clicks
 * - MongoDB conditional timestamp check (`lastCheckInAt <= cutoffIso`) to prevent concurrent race claims
 * - Continues streak if claimed within 48h of previous claim, resets to Day 1 if missed > 48h
 * - Records immutable CoinTransaction ledger entry ('daily_checkin')
 */
export async function executeDailyCheckIn(uid: string): Promise<ExecuteDailyCheckInResult> {
  const cleanUid = String(uid || '').trim();
  if (!cleanUid) {
    return { ok: false, status: 401, error: 'Sesi pengguna tidak valid.' };
  }

  if (!checkCheckInRateLimit(cleanUid)) {
    return {
      ok: false,
      status: 429,
      error: 'Terlalu banyak percobaan check-in dalam 1 menit. Tunggu sebentar.',
    };
  }

  if (coinUserMutexSet.has(cleanUid)) {
    return {
      ok: false,
      status: 409,
      error: 'Permintaan koin sedang diproses. Mohon tunggu sebentar.',
    };
  }

  coinUserMutexSet.add(cleanUid);

  try {
    await connectDB();
    const mongoOk = isDbMongoConnected();

    const currentUser = await findUserByUid(cleanUid);
    if (!currentUser) {
      return { ok: false, status: 404, error: 'Akun tidak ditemukan.' };
    }
    if (currentUser.isBanned && currentUser.role !== 'founder') {
      return {
        ok: false,
        status: 403,
        error: 'Akun sedang dibatasi dan tidak dapat mengklaim check-in.',
      };
    }

    const preStatus = computeDailyCheckInStatus(currentUser);
    if (!preStatus.canClaim) {
      return {
        ok: false,
        status: 429,
        error: 'Kamu sudah melakukan Daily Check-in hari ini. Tunggu cooldown 24 jam selesai.',
        nextCheckInAt: preStatus.nextCheckInAt,
        remainingMs: preStatus.remainingMs,
        streak: preStatus.streak,
        longestStreak: preStatus.longestStreak,
        totalCheckIns: preStatus.totalCheckIns,
        cycleDay: preStatus.cycleDay,
      };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const cutoffIso = new Date(now.getTime() - DAILY_CHECKIN_COOLDOWN_MS).toISOString();
    const nextCheckInAt = new Date(now.getTime() + DAILY_CHECKIN_COOLDOWN_MS).toISOString();
    const todayWib = getJakartaDateString(0);

    const nextStreak = preStatus.streak > 0 ? preStatus.streak + 1 : 1;
    const cycleDay = ((nextStreak - 1) % 7) + 1;
    const rewardSpec = DAILY_CHECKIN_REWARDS[cycleDay - 1] || DAILY_CHECKIN_REWARDS[0];
    const nextLongestStreak = Math.max(preStatus.longestStreak, nextStreak);
    const nextTotalCheckIns = preStatus.totalCheckIns + 1;

    const expRes = applyExpAndLevelRewards(currentUser, rewardSpec.bonusExp);
    const nextCoins = expRes.nextCoins + rewardSpec.coins;
    const nextTotalCoinsEarned = expRes.nextTotalCoinsEarned + rewardSpec.coins;

    const existingDates = Array.isArray(currentUser.checkInDates)
      ? [...currentUser.checkInDates]
      : [];
    if (!existingDates.includes(todayWib)) {
      existingDates.push(todayWib);
    }
    const nextCheckInDates = Array.from(new Set(existingDates)).sort().slice(-30);

    let savedUser: IUser | null = null;

    if (mongoOk) {
      const updatedDoc = await UserModel.findOneAndUpdate(
        {
          uid: cleanUid,
          isBanned: { $ne: true },
          $or: [
            { lastCheckInAt: { $exists: false } },
            { lastCheckInAt: '' },
            { lastCheckInAt: null },
            { lastCheckInAt: { $lte: cutoffIso } },
          ],
        },
        {
          $set: {
            lastCheckInAt: nowIso,
            checkInStreak: nextStreak,
            longestCheckInStreak: nextLongestStreak,
            totalCheckIns: nextTotalCheckIns,
            checkInDates: nextCheckInDates,
            level: expRes.nextLevel,
            exp: expRes.nextExp,
            coins: nextCoins,
            totalCoinsEarned: nextTotalCoinsEarned,
          },
        },
        { new: true }
      );
      savedUser = updatedDoc ? updatedDoc.toObject() : null;
    } else {
      const store = readFallbackUsers();
      const target = store[cleanUid];
      if (target) {
        const recheck = computeDailyCheckInStatus(target);
        if (recheck.canClaim) {
          target.lastCheckInAt = nowIso;
          target.checkInStreak = nextStreak;
          target.longestCheckInStreak = nextLongestStreak;
          target.totalCheckIns = nextTotalCheckIns;
          target.checkInDates = nextCheckInDates;
          target.level = expRes.nextLevel;
          target.exp = expRes.nextExp;
          target.coins = nextCoins;
          target.totalCoinsEarned = nextTotalCoinsEarned;
          store[cleanUid] = target;
          writeFallbackUsers(store);
          savedUser = target;
        }
      }
    }

    if (!savedUser) {
      return {
        ok: false,
        status: 429,
        error: 'Daily Check-in sudah diklaim pada periode 24 jam ini.',
      };
    }

    await recordCoinLedgerEntry({
      uid: cleanUid,
      type: 'daily_checkin',
      amount: rewardSpec.coins,
      balanceAfter: Math.max(0, Number(savedUser.coins ?? nextCoins) - expRes.coinsGained),
      requestId: `checkin_${cleanUid}_${todayWib}_${nextTotalCheckIns}`,
      note: `Daily Check-in Hari ke-${nextStreak} (Siklus Hari ${cycleDay}/7 · +${rewardSpec.coins} Koin & +${rewardSpec.bonusExp} EXP)`,
    });

    if (expRes.coinsGained > 0) {
      await recordCoinLedgerEntry({
        uid: cleanUid,
        type: 'level_up',
        amount: expRes.coinsGained,
        balanceAfter: Math.max(0, Number(savedUser.coins ?? nextCoins)),
        note: `Naik ke Level ${expRes.nextLevel} dari bonus EXP Daily Check-in`,
      });
    }

    return {
      ok: true,
      status: 200,
      rewardCoins: rewardSpec.coins,
      expGained: rewardSpec.bonusExp,
      levelUp: expRes.levelUp,
      newLevel: expRes.nextLevel,
      coinsGainedFromLevelUp: expRes.coinsGained,
      streak: nextStreak,
      longestStreak: nextLongestStreak,
      totalCheckIns: nextTotalCheckIns,
      cycleDay,
      lastCheckInAt: nowIso,
      nextCheckInAt,
      remainingMs: DAILY_CHECKIN_COOLDOWN_MS,
      user: sanitizeUser(savedUser),
    };
  } finally {
    coinUserMutexSet.delete(cleanUid);
  }
}
