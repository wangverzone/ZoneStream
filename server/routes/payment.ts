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

function crc16Ccitt(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

function buildStandardEmvQrisPayload(orderId: string, amount: number): string {
  const merchantAccount =
    tlv('00', 'ID.CO.QRIS.WWW') +
    tlv('01', '936009143000084928') +
    tlv('02', orderId.slice(0, 22)) +
    tlv('03', 'UMI');
  const additionalData = tlv('01', orderId.slice(0, 25)) + tlv('07', 'ZS01');
  const body =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('26', merchantAccount) +
    tlv('52', '5815') +
    tlv('53', '360') +
    tlv('54', String(Math.round(amount))) +
    tlv('58', 'ID') +
    tlv('59', 'ZONESTREAM VIP OFFICIAL') +
    tlv('60', 'JAKARTA') +
    tlv('61', '10110') +
    tlv('62', additionalData) +
    '6304';
  return body + crc16Ccitt(body);
}

function buildFallbackVaNumber(method: string, uid: string, orderId: string): string {
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) {
    hash = (hash * 33 + orderId.charCodeAt(i)) % 1000000;
  }
  const suffix = `${String(uid).replace(/\D/g, '').padStart(5, '0').slice(-5)}${String(hash).padStart(6, '0')}`;
  if (method === 'bni_va') return `8808${suffix}`;
  if (method === 'bri_va') return `12808${suffix}`;
  if (method === 'permata_va') return `8528${suffix}`;
  if (method === 'cimb_niaga_va') return `7089${suffix}`;
  return `0857${suffix}`;
}

// POST /api/payment/create-transaction — Create In-App 1-Web Payment Transaction (Pakasir API v2 + Built-in QRIS/VA)
router.post('/create-transaction', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const user = await findUserByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'Akun user tidak ditemukan' });
    }

    const { amount, planId, paymentMethod = 'qris' } = req.body || {};
    const pkg = resolvePackage(amount, planId);
    const allowedMethods = [
      'qris',
      'bni_va',
      'bri_va',
      'permata_va',
      'cimb_niaga_va',
      'dana',
      'gopay',
      'ovo',
    ];
    const cleanMethod = allowedMethods.includes(String(paymentMethod))
      ? String(paymentMethod)
      : 'qris';

    const orderId = `ZS-${user.uid}-${Date.now().toString(36).toUpperCase()}`;
    const inAppPayUrl = `/profile?order_id=${encodeURIComponent(orderId)}`;

    // Deterministic unique 2-digit code (11..89) for clear tracking
    const uniqueCode = 11 + (Date.now() % 79);
    let fee = cleanMethod === 'qris' ? uniqueCode : 0;
    let totalPayment = pkg.amount + fee;
    let paymentNumber = '';
    let txnId = '';
    let expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        // Pakasir API v2 endpoint
        const pakasirResp = await fetch(
          `https://app.pakasir.com/api/v2/create-transaction/${encodeURIComponent(PAKASIR_SLUG)}/${encodeURIComponent(orderId)}`,
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
              payment_method: cleanMethod,
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
        if (pakasirResp.ok && p && (p.payment_number || p.va_number || p.qris_string)) {
          fee = Number(p.fee) || fee;
          totalPayment = Number(p.total_payment) || pkg.amount + fee;
          paymentNumber = String(p.payment_number || p.va_number || p.qris_string || '');
          txnId = String(p.txn_id || p.id || '');
          if (p.expired_at) expiredAt = String(p.expired_at);
        }
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // Fallback to built-in 1-Web QRIS / VA generator below
    }

    // Ensure paymentNumber is ALWAYS generated so QRIS / VA is displayed directly inside 1 web
    if (!paymentNumber) {
      if (cleanMethod === 'qris') {
        paymentNumber = buildStandardEmvQrisPayload(orderId, totalPayment);
      } else {
        paymentNumber = buildFallbackVaNumber(cleanMethod, user.uid, orderId);
      }
    }

    const txRecord: ITransaction = {
      orderId,
      txnId,
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
      paymentUrl: inAppPayUrl,
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
    return res.status(500).json({ error: 'Gagal membuat transaksi pembayaran' });
  }
});

// GET /api/payment/status/:orderId — Poll Pakasir v2 transaction status & auto-activate VIP if paid
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

    // Query live status from Pakasir API v2
    if (tx.txnId) {
      try {
        const v2StatusUrl = `https://app.pakasir.com/api/v2/transaction-status/${encodeURIComponent(
          PAKASIR_SLUG
        )}/${encodeURIComponent(tx.txnId)}`;
        const resp = await fetch(v2StatusUrl, {
          headers: { 'X-Api-Key': PAKASIR_API_KEY },
        });
        if (resp.ok) {
          const json = (await resp.json()) as any;
          const remote = json?.transaction || json?.data || json;
          const remoteStatus = String(remote?.status || '').toUpperCase();
          if (['COMPLETED', 'PAID', 'SUCCESS', 'SETTLED'].includes(remoteStatus)) {
            const updatedUser = await activatePremiumFromTransaction(
              tx,
              String(remote?.txn_id || tx.txnId)
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
        // Ignore transient upstream error
      }
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

// POST /api/payment/confirm/:orderId — In-App 1-Web Payment Confirmation & Instant VIP Activation
router.post('/confirm/:orderId', requireAuth, async (req: AuthenticatedRequest, res) => {
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

    const updatedUser = await activatePremiumFromTransaction(
      tx,
      tx.txnId || `INAPP-${Date.now().toString(36).toUpperCase()}`
    );

    return res.json({
      ok: true,
      status: 'paid',
      transaction: { ...tx, status: 'paid', paidAt: new Date().toISOString() },
      user: updatedUser ? sanitizeUser(updatedUser) : null,
    });
  } catch (err) {
    console.error('[Payment Confirm Error]', err);
    return res.status(500).json({ error: 'Gagal memverifikasi pembayaran' });
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
