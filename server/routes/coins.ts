import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../auth.ts';
import {
  COIN_PREMIUM_PACKAGES,
  computeDailyCheckInStatus,
  executeDailyCheckIn,
  executeSecureCoinPremiumGift,
  getCoinLedgerForUser,
  getCoinsForLevel,
  recordCoinLedgerEntry,
} from '../coins.ts';
import { findUserByUid, sanitizeUser } from '../db.ts';

const router = Router();

// GET /api/coins/packages — Public catalog of coin-to-premium exchange/gift tiers
router.get('/packages', (_req, res) => {
  return res.json({
    ok: true,
    packages: COIN_PREMIUM_PACKAGES,
    levelRewardExample: {
      lv2: getCoinsForLevel(2).total,
      lv3: getCoinsForLevel(3).total,
      lv4: getCoinsForLevel(4).total,
      lv5: getCoinsForLevel(5).total,
      milestoneBonusEvery5Levels: 250,
    },
  });
});

// GET /api/coins/check-in-status — Authenticated user's 24-hour Daily Check-in state & reward ladder
router.get('/check-in-status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const user = await findUserByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }
    const status = computeDailyCheckInStatus(user);
    return res.json({
      ok: true,
      ...status,
      coins: sanitizeUser(user).coins ?? 0,
    });
  } catch (err) {
    console.error('[Check-in Status Error]', err);
    return res.status(500).json({ error: 'Gagal memuat status Daily Check-in.' });
  }
});

// POST /api/coins/check-in — Claim 24-hour Daily Check-in bonus coins & increment streak
router.post('/check-in', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const result = await executeDailyCheckIn(uid);
    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        error: result.error,
        nextCheckInAt: result.nextCheckInAt,
        remainingMs: result.remainingMs,
        streak: result.streak,
        longestStreak: result.longestStreak,
        totalCheckIns: result.totalCheckIns,
        cycleDay: result.cycleDay,
      });
    }
    return res.json(result);
  } catch (err) {
    console.error('[Daily Check-in Error]', err);
    return res.status(500).json({ error: 'Terjadi kesalahan saat memproses Daily Check-in.' });
  }
});

// GET /api/coins/history — Authenticated user's coin balance & immutable audit ledger
router.get('/history', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const user = await findUserByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }
    const pub = sanitizeUser(user);
    let history = await getCoinLedgerForUser(uid, 100);

    // Ensure backfilled leveled members see their initial earned coin record in history
    if (
      history.length === 0 &&
      pub.role !== 'founder' &&
      (pub.totalCoinsEarned ?? 0) > 0
    ) {
      await recordCoinLedgerEntry({
        uid,
        type: 'level_up',
        amount: pub.totalCoinsEarned ?? 0,
        balanceAfter: pub.coins ?? pub.totalCoinsEarned ?? 0,
        requestId: `initial_sync_${uid}`,
        note: `Reward Koin akumulasi pencapaian Level ${pub.level}`,
      });
      history = await getCoinLedgerForUser(uid, 100);
    }

    return res.json({
      ok: true,
      coins: pub.coins ?? 0,
      totalCoinsEarned: pub.totalCoinsEarned ?? 0,
      totalCoinsSpent: pub.totalCoinsSpent ?? 0,
      totalGiftsSent: pub.totalGiftsSent ?? 0,
      totalGiftsReceived: pub.totalGiftsReceived ?? 0,
      history,
    });
  } catch (err) {
    console.error('[Coins History Error]', err);
    return res.status(500).json({ error: 'Gagal memuat riwayat koin.' });
  }
});

// POST /api/coins/gift-premium — Gift Premium to another member or redeem for self using Coins
router.post('/gift-premium', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const senderUid = req.authUser!.uid;
    const { packageId, targetUid, requestId, giftMessage } = req.body || {};

    if (!packageId || typeof packageId !== 'string') {
      return res.status(400).json({ error: 'Pilih paket Premium terlebih dahulu.' });
    }

    const result = await executeSecureCoinPremiumGift({
      senderUid,
      targetUid: targetUid ? String(targetUid) : senderUid,
      packageId,
      requestId: requestId ? String(requestId) : undefined,
      giftMessage: giftMessage ? String(giftMessage) : undefined,
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({
      ok: true,
      txId: result.txId,
      isSelfRedeem: result.isSelfRedeem,
      package: result.package,
      newExpiryDate: result.newExpiryDate,
      user: result.sender,
      recipient: result.recipient,
    });
  } catch (err) {
    console.error('[Gift Premium Error]', err);
    return res.status(500).json({ error: 'Terjadi kesalahan saat memproses Bagi Premium.' });
  }
});

export default router;
