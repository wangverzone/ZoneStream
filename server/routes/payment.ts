import crypto from 'crypto';
import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../auth.ts';
import { connectDB, findUserByUid, sanitizeUser, updateUserByUid } from '../db.ts';
import { TransactionModel, type ITransaction } from '../models/Transaction.ts';

const router = Router();

const PAKASIR_SLUG = (process.env.PAKASIR_SLUG || 'zhuuzemx').trim();
const PAKASIR_API_KEY = (
  process.env.PAKASIR_API_KEY || 'Ymr5gFRKYo7LwNwWt9V47rSCnwGMAyNI'
).trim();
const PAKASIR_WEBHOOK_SECRET = (
  process.env.PAKASIR_WEBHOOK_SECRET || 'b24465c06e491e4035aae8a9ca57b7f1'
).trim();

export interface PremiumPackageSpec {
  id: string;
  name: string;
  amount: number;
  durationDays: number;
  bonusExp: number;
  tagline: string;
  popular?: boolean;
}

export const PREMIUM_PACKAGES: PremiumPackageSpec[] = [
  {
    id: 'vip_15k',
    name: 'VIP Bulanan 30 Hari',
    amount: 15000,
    durationDays: 30,
    bonusExp: 300,
    tagline: 'Bebas iklan 10s, Lencana VIP, Emoji Eksklusif & 2x EXP Nonton selama 30 hari penuh.',
  },
  {
    id: 'vip_20k',
    name: 'VIP Pro 60 Hari',
    amount: 20000,
    durationDays: 60,
    bonusExp: 500,
    tagline: 'Paket terlaris 60 hari penuh tanpa iklan + Bonus +500 EXP & 2x EXP Harian.',
    popular: true,
  },
  {
    id: 'vip_30k',
    name: 'VIP Immortal 365 Hari',
    amount: 30000,
    durationDays: 365,
    bonusExp: 1000,
    tagline: 'Akses VIP 1 tahun penuh (365 hari) + Bonus +1.000 EXP langsung & 2x EXP Nonton.',
  },
];

const memoryTransactions = new Map<string, ITransaction>();

const getExpNeeded = (level: number) => Math.max(100, level * 200);

function resolvePackage(amountInput: unknown, planIdInput?: unknown): PremiumPackageSpec {
  const planId = String(planIdInput || '').trim();
  const byId = PREMIUM_PACKAGES.find((p) => p.id === planId);
  if (byId) return byId;

  const numAmount = Number(amountInput);
  const byAmount = PREMIUM_PACKAGES.find((p) => p.amount === numAmount);
  if (byAmount) return byAmount;

  if (numAmount >= 30000) return PREMIUM_PACKAGES[2];
  if (numAmount >= 20000) return PREMIUM_PACKAGES[1];
  return PREMIUM_PACKAGES[0];
}

function constantTimeMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyWebhookSignature(req: any): boolean {
  const secret = PAKASIR_WEBHOOK_SECRET;
  const headerSecret = String(
    req.headers['x-secret'] ||
      req.headers['x-webhook-secret'] ||
      req.headers['x-pakasir-secret'] ||
      ''
  ).trim();
  if (headerSecret && constantTimeMatch(headerSecret, secret)) {
    return true;
  }

  const authHeader = String(req.headers.authorization || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    if (constantTimeMatch(bearerToken, secret)) {
      return true;
    }
  }

  const sigHeader = String(
    req.headers['x-pakasir-signature'] ||
      req.headers['x-signature'] ||
      req.body?.signature ||
      req.body?.secret ||
      ''
  ).trim();

  if (sigHeader) {
    if (constantTimeMatch(sigHeader, secret)) return true;

    const rawJson = JSON.stringify(req.body || {});
    const hmacJson = crypto.createHmac('sha256', secret).update(rawJson).digest('hex');
    if (constantTimeMatch(sigHeader.toLowerCase(), hmacJson.toLowerCase())) return true;

    const { order_id = '', amount = '', status = '' } = req.body || {};
    const hmacParts = crypto
      .createHmac('sha256', secret)
      .update(`${order_id}${amount}${status}`)
      .digest('hex');
    if (constantTimeMatch(sigHeader.toLowerCase(), hmacParts.toLowerCase())) return true;
  }

  return false;
}

async function activatePremiumFromTransaction(
  tx: ITransaction,
  txnIdFromGateway?: string
) {
  const alreadyPaid = tx.status === 'paid';
  const now = new Date();

  const mongoOk = await connectDB();
  if (mongoOk) {
    const doc = await TransactionModel.findOne({ orderId: tx.orderId });
    if (doc && doc.status !== 'paid') {
      doc.status = 'paid';
      doc.txnId = txnIdFromGateway || doc.txnId || '';
      doc.paidAt = now.toISOString();
      await doc.save();
    }
  } else {
    const mem = memoryTransactions.get(tx.orderId);
    if (mem) {
      mem.status = 'paid';
      mem.txnId = txnIdFromGateway || mem.txnId || '';
      mem.paidAt = now.toISOString();
    }
  }

  if (alreadyPaid) {
    const existing = await findUserByUid(tx.uid);
    return existing;
  }

  const updatedUser = await updateUserByUid(tx.uid, (current) => {
    const currentExpiryMs = current.premiumExpiryDate
      ? new Date(current.premiumExpiryDate).getTime()
      : 0;
    const baseMs = currentExpiryMs > now.getTime() ? currentExpiryMs : now.getTime();
    const newExpiryIso = new Date(
      baseMs + tx.durationDays * 24 * 60 * 60 * 1000
    ).toISOString();

    let nextExp = (current.exp || 0) + (tx.bonusExp || 0);
    let nextLevel = current.level || 1;
    while (nextExp >= getExpNeeded(nextLevel)) {
      nextExp -= getExpNeeded(nextLevel);
      nextLevel += 1;
    }

    return {
      ...current,
      isPremium: true,
      isVerified: true,
      premiumPlan: tx.planName,
      premiumExpiryDate: newExpiryIso,
      activeBadge: current.activeBadge === 'Member' ? 'Verified' : current.activeBadge,
      activeBorder: current.activeBorder === 'classic' ? 'gold' : current.activeBorder,
      level: nextLevel,
      exp: nextExp,
    };
  });

  return updatedUser;
}

// GET /api/payment/packages — Public package list (15k / 20k / 30k)
router.get('/packages', (_req, res) => {
  return res.json({
    ok: true,
    packages: PREMIUM_PACKAGES,
  });
});

// POST /api/payment/create-transaction — Create Pakasir payment transaction (QRIS / VA)
router.post('/create-transaction', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const user = await findUserByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'Akun user tidak ditemukan' });
    }

    const { amount, planId, paymentMethod = 'qris' } = req.body || {};
    const pkg = resolvePackage(amount, planId);
    const allowedMethods = ['qris', 'bni_va', 'bri_va', 'permata_va', 'cimb_niaga_va'];
    const cleanMethod = allowedMethods.includes(String(paymentMethod))
      ? String(paymentMethod)
      : 'qris';

    const orderId = `ZS-${user.uid}-${Date.now().toString(36).toUpperCase()}`;
    const pakasirPayUrl = `https://app.pakasir.com/pay/${PAKASIR_SLUG}/${pkg.amount}?order_id=${encodeURIComponent(orderId)}`;

    let fee = 0;
    let totalPayment = pkg.amount;
    let paymentNumber = '';
    let expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const pakasirResp = await fetch(
          `https://app.pakasir.com/api/transactioncreate/${cleanMethod}`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': PAKASIR_API_KEY,
            },
            body: JSON.stringify({
              project: PAKASIR_SLUG,
              order_id: orderId,
              amount: pkg.amount,
              api_key: PAKASIR_API_KEY,
            }),
          }
        );

        const rawText = await pakasirResp.text();
        let pakasirJson: any = {};
        try {
          pakasirJson = JSON.parse(rawText);
        } catch {
          pakasirJson = {};
        }

        const p = pakasirJson?.payment || pakasirJson?.data || pakasirJson;
        if (pakasirResp.ok && p) {
          fee = Number(p.fee) || 0;
          totalPayment = Number(p.total_payment) || pkg.amount + fee;
          paymentNumber = String(p.payment_number || p.va_number || p.qris_string || '');
          if (p.expired_at) expiredAt = String(p.expired_at);
        } else {
          console.warn(
            '[Pakasir Create Notice]',
            pakasirResp.status,
            rawText.slice(0, 220)
          );
        }
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      console.warn('[Pakasir Fetch Notice]', (err as Error).message);
    }

    const txRecord: ITransaction = {
      orderId,
      txnId: '',
      uid: user.uid,
      userEmail: user.email,
      userName: user.name,
      planId: pkg.id,
      planName: pkg.name,
      durationDays: pkg.durationDays,
      bonusExp: pkg.bonusExp,
      amount: pkg.amount,
      fee,
      totalPayment,
      paymentMethod: cleanMethod,
      paymentNumber,
      paymentUrl: pakasirPayUrl,
      status: 'pending',
      expiredAt,
    };

    const mongoOk = await connectDB();
    if (mongoOk) {
      await TransactionModel.create(txRecord);
    } else {
      memoryTransactions.set(orderId, txRecord);
    }

    return res.status(201).json({
      ok: true,
      transaction: txRecord,
    });
  } catch (err) {
    console.error('[Payment Create Error]', err);
    return res.status(500).json({ error: 'Gagal membuat transaksi pembayaran Pakasir' });
  }
});

// GET /api/payment/status/:orderId — Poll Pakasir transaction status & auto-activate VIP if paid
router.get('/status/:orderId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const orderId = String(req.params.orderId || '').trim();
    if (!orderId) {
      return res.status(400).json({ error: 'orderId tidak valid' });
    }

    const mongoOk = await connectDB();
    let tx: ITransaction | null = null;
    if (mongoOk) {
      const doc = await TransactionModel.findOne({ orderId }).lean();
      if (doc) tx = doc as ITransaction;
    } else {
      tx = memoryTransactions.get(orderId) || null;
    }

    if (!tx || tx.uid !== uid) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }

    if (tx.status === 'paid') {
      const user = await findUserByUid(uid);
      return res.json({
        ok: true,
        status: 'paid',
        transaction: tx,
        user: user ? sanitizeUser(user) : null,
      });
    }

    // Query live status from Pakasir API
    try {
      const detailUrl = `https://app.pakasir.com/api/transactiondetail?project=${encodeURIComponent(
        PAKASIR_SLUG
      )}&amount=${tx.amount}&order_id=${encodeURIComponent(orderId)}&api_key=${encodeURIComponent(
        PAKASIR_API_KEY
      )}`;
      const resp = await fetch(detailUrl, {
        headers: { 'X-Api-Key': PAKASIR_API_KEY },
      });
      if (resp.ok) {
        const json = (await resp.json()) as any;
        const remote = json?.transaction || json?.data || json;
        const remoteStatus = String(remote?.status || '').toUpperCase();
        if (['COMPLETED', 'PAID', 'SUCCESS', 'SETTLED'].includes(remoteStatus)) {
          const updatedUser = await activatePremiumFromTransaction(
            tx,
            String(remote?.txn_id || '')
          );
          return res.json({
            ok: true,
            status: 'paid',
            transaction: { ...tx, status: 'paid' },
            user: updatedUser ? sanitizeUser(updatedUser) : null,
          });
        }
      }
    } catch {
      // Return current pending status on transient upstream failure
    }

    return res.json({
      ok: true,
      status: tx.status,
      transaction: tx,
    });
  } catch (err) {
    console.error('[Payment Status Error]', err);
    return res.status(500).json({ error: 'Gagal memeriksa status transaksi' });
  }
});

// OPTIONS /api/payment/webhook — Public CORS preflight
router.options('/webhook', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  return res.sendStatus(204);
});

// POST /api/payment/webhook — Public Pakasir Webhook (verifies signature & activates Premium automatically)
router.post('/webhook', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  try {
    if (!verifyWebhookSignature(req)) {
      return res.status(403).json({ error: 'Invalid webhook signature / secret' });
    }

    const body = req.body || {};
    const orderId = String(body.order_id || body.orderId || '').trim();
    const txnId = String(body.txn_id || body.txnId || '').trim();
    const rawStatus = String(body.status || '').toUpperCase().trim();
    const amount = Number(body.amount || 0);

    if (!orderId) {
      return res.status(400).json({ error: 'order_id wajib ada di payload webhook' });
    }

    const isSuccessStatus = ['PAID', 'SUCCESS', 'COMPLETED', 'SETTLED'].includes(rawStatus);
    if (!isSuccessStatus) {
      return res.status(200).json({ ok: true, ignored: true, status: rawStatus });
    }

    const mongoOk = await connectDB();
    let tx: ITransaction | null = null;
    if (mongoOk) {
      const doc = await TransactionModel.findOne({ orderId }).lean();
      if (doc) tx = doc as ITransaction;
    } else {
      tx = memoryTransactions.get(orderId) || null;
    }

    // Fallback: if transaction created externally via Pakasir Pay link with ZS-<uid>-... order_id
    if (!tx && orderId.startsWith('ZS-')) {
      const parts = orderId.split('-');
      const extractedUid = parts[1];
      if (extractedUid) {
        const matchedUser = await findUserByUid(extractedUid);
        if (matchedUser) {
          const pkg = resolvePackage(amount);
          const syntheticTx: ITransaction = {
            orderId,
            txnId,
            uid: matchedUser.uid,
            userEmail: matchedUser.email,
            userName: matchedUser.name,
            planId: pkg.id,
            planName: pkg.name,
            durationDays: pkg.durationDays,
            bonusExp: pkg.bonusExp,
            amount: amount || pkg.amount,
            fee: 0,
            totalPayment: amount || pkg.amount,
            paymentMethod: String(body.payment_method || 'qris'),
            paymentNumber: '',
            paymentUrl: `https://app.pakasir.com/pay/${PAKASIR_SLUG}/${amount || pkg.amount}?order_id=${encodeURIComponent(orderId)}`,
            status: 'pending',
          };
          if (mongoOk) {
            await TransactionModel.create(syntheticTx).catch(() => {});
          } else {
            memoryTransactions.set(orderId, syntheticTx);
          }
          tx = syntheticTx;
        }
      }
    }

    if (!tx) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan untuk order_id ini' });
    }

    if (amount > 0 && tx.amount > 0 && amount < tx.amount) {
      return res.status(400).json({ error: 'Nominal pembayaran tidak sesuai paket' });
    }

    const updatedUser = await activatePremiumFromTransaction(tx, txnId);
    return res.status(200).json({
      ok: true,
      status: 'paid',
      orderId,
      uid: tx.uid,
      isPremium: Boolean(updatedUser?.isPremium),
      premiumExpiryDate: updatedUser?.premiumExpiryDate || null,
    });
  } catch (err) {
    console.error('[Payment Webhook Error]', err);
    return res.status(500).json({ error: 'Gagal memproses webhook Pakasir' });
  }
});

export default router;
