import crypto from 'crypto';
import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../auth.ts';
import {
  connectDB,
  findUserByUid,
  readFallbackJson,
  sanitizeUser,
  updateUserByUid,
  writeFallbackJson,
} from '../db.ts';
import { TransactionModel, type ITransaction } from '../models/Transaction.ts';

const router = Router();

const PAKASIR_SLUG = (process.env.PAKASIR_SLUG || 'zhuuzemx').trim();
const PAKASIR_API_KEY = (
  process.env.PAKASIR_API_KEY || 'Ymr5gFRKYo7LwNwWt9V47rSCnwGMAyNI'
).trim();
const PAKASIR_WEBHOOK_SECRET = (
  process.env.PAKASIR_WEBHOOK_SECRET || 'b24465c06e491e4035aae8a9ca57b7f1'
).trim();

const TX_FALLBACK_FILE = 'transactions-v1.json';
const activeActivationLocks = new Set<string>();

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
    tagline: 'Bebas iklan 100%, Lencana Verified, Emoji Eksklusif & 2x EXP Nonton selama 30 hari penuh.',
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

function readFallbackTxMap(): Record<string, ITransaction> {
  return readFallbackJson<Record<string, ITransaction>>(TX_FALLBACK_FILE, {});
}

function writeFallbackTxMap(map: Record<string, ITransaction>) {
  writeFallbackJson(TX_FALLBACK_FILE, map);
}

async function getTransactionByOrderId(orderId: string): Promise<ITransaction | null> {
  const mongoOk = await connectDB();
  if (mongoOk) {
    const doc = await TransactionModel.findOne({ orderId }).lean();
    return doc ? (doc as ITransaction) : null;
  }
  const map = readFallbackTxMap();
  return map[orderId] || null;
}

async function saveNewTransaction(tx: ITransaction): Promise<void> {
  const mongoOk = await connectDB();
  if (mongoOk) {
    await TransactionModel.create(tx);
  } else {
    const map = readFallbackTxMap();
    map[tx.orderId] = tx;
    writeFallbackTxMap(map);
  }
}

async function markTransactionTerminalStatus(
  orderId: string,
  status: 'expired' | 'failed'
): Promise<void> {
  const mongoOk = await connectDB();
  if (mongoOk) {
    await TransactionModel.updateOne(
      { orderId, status: 'pending' },
      { $set: { status } }
    );
  } else {
    const map = readFallbackTxMap();
    if (map[orderId] && map[orderId].status === 'pending') {
      map[orderId].status = status;
      writeFallbackTxMap(map);
    }
  }
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
  if (activeActivationLocks.has(tx.orderId)) {
    return findUserByUid(tx.uid);
  }
  activeActivationLocks.add(tx.orderId);

  try {
    const now = new Date();
    const paidAtIso = now.toISOString();
    const finalTxnId = txnIdFromGateway || tx.txnId || tx.orderId;
    const mongoOk = await connectDB();
    let claimed = false;

    if (mongoOk) {
      const updatedDoc = await TransactionModel.findOneAndUpdate(
        { orderId: tx.orderId, status: { $ne: 'paid' } },
        {
          $set: {
            status: 'paid',
            txnId: finalTxnId,
            paidAt: paidAtIso,
          },
        },
        { new: true }
      );
      claimed = Boolean(updatedDoc);
    } else {
      const map = readFallbackTxMap();
      const existing = map[tx.orderId];
      if (existing && existing.status !== 'paid') {
        existing.status = 'paid';
        existing.txnId = finalTxnId;
        existing.paidAt = paidAtIso;
        writeFallbackTxMap(map);
        claimed = true;
      }
    }

    if (!claimed) {
      return findUserByUid(tx.uid);
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
        activeBadge:
          current.activeBadge === 'Member' || !current.activeBadge
            ? 'Verified VIP'
            : current.activeBadge,
        activeBorder: current.activeBorder === 'classic' ? 'gold' : current.activeBorder,
        level: nextLevel,
        exp: nextExp,
      };
    });

    return updatedUser;
  } finally {
    activeActivationLocks.delete(tx.orderId);
  }
}

interface PakasirDetailResult {
  ok: boolean;
  remoteStatus: string;
  remoteAmount: number;
  remoteOrderId: string;
  txnId: string;
  message?: string;
}

async function queryPakasirTransactionDetail(
  orderId: string,
  amount: number
): Promise<PakasirDetailResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const detailUrl = `https://app.pakasir.com/api/transactiondetail?project=${encodeURIComponent(
      PAKASIR_SLUG
    )}&amount=${encodeURIComponent(String(Math.round(amount)))}&order_id=${encodeURIComponent(
      orderId
    )}&api_key=${encodeURIComponent(PAKASIR_API_KEY)}`;

    const resp = await fetch(detailUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    const rawText = await resp.text();
    let json: any = {};
    try {
      json = JSON.parse(rawText);
    } catch {
      json = {};
    }

    const remote = json?.transaction || json?.data || null;
    if (!resp.ok || !remote) {
      return {
        ok: false,
        remoteStatus: 'pending',
        remoteAmount: 0,
        remoteOrderId: orderId,
        txnId: '',
        message: json?.message || json?.error || `HTTP ${resp.status}`,
      };
    }

    return {
      ok: true,
      remoteStatus: String(remote.status || 'pending').toLowerCase().trim(),
      remoteAmount: Number(remote.amount ?? amount) || 0,
      remoteOrderId: String(remote.order_id || orderId).trim(),
      txnId: String(remote.completed_at || remote.txn_id || orderId).trim(),
    };
  } catch (err: any) {
    return {
      ok: false,
      remoteStatus: 'pending',
      remoteAmount: 0,
      remoteOrderId: orderId,
      txnId: '',
      message: err?.message || 'Timeout menghubungi server Pakasir',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function verifyAndSyncPakasirTransaction(tx: ITransaction) {
  if (tx.status === 'paid') {
    const user = await findUserByUid(tx.uid);
    return {
      paid: true,
      status: 'paid' as const,
      transaction: tx,
      user,
      error: null,
    };
  }

  const detail = await queryPakasirTransactionDetail(tx.orderId, tx.amount);

  if (detail.ok) {
    const isCompleted = ['completed', 'paid', 'success', 'settled'].includes(detail.remoteStatus);
    const matchesOrder = detail.remoteOrderId === tx.orderId;
    const matchesAmount = detail.remoteAmount >= tx.amount;

    if (isCompleted && matchesOrder && matchesAmount) {
      const updatedUser = await activatePremiumFromTransaction(tx, detail.txnId);
      return {
        paid: true,
        status: 'paid' as const,
        transaction: { ...tx, status: 'paid' as const, paidAt: new Date().toISOString() },
        user: updatedUser,
        error: null,
      };
    }

    if (['expired', 'cancelled', 'canceled', 'failed'].includes(detail.remoteStatus)) {
      const terminal = detail.remoteStatus === 'failed' ? 'failed' : 'expired';
      await markTransactionTerminalStatus(tx.orderId, terminal);
      return {
        paid: false,
        status: terminal,
        transaction: { ...tx, status: terminal },
        user: null,
        error: 'Tagihan ini sudah kedaluwarsa atau dibatalkan di Pakasir. Silakan buat transaksi baru.',
      };
    }
  }

  if (tx.expiredAt && new Date(tx.expiredAt).getTime() < Date.now()) {
    await markTransactionTerminalStatus(tx.orderId, 'expired');
    return {
      paid: false,
      status: 'expired' as const,
      transaction: { ...tx, status: 'expired' as const },
      user: null,
      error: 'Tagihan pembayaran sudah kedaluwarsa. Silakan buat transaksi baru.',
    };
  }

  return {
    paid: false,
    status: 'pending' as const,
    transaction: tx,
    user: null,
    error:
      'Pembayaran belum terdeteksi masuk di sistem Pakasir. Pastikan kamu sudah selesai transfer sesuai nominal, lalu tunggu beberapa detik.',
  };
}

// GET /api/payment/packages — Public package list (15k / 20k / 30k)
router.get('/packages', (_req, res) => {
  return res.json({
    ok: true,
    packages: PREMIUM_PACKAGES,
  });
});

// POST /api/payment/create-transaction — Create genuine Pakasir transaction (NO fake QRIS/VA)
router.post('/create-transaction', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const user = await findUserByUid(uid);
    if (!user) {
      return res.status(404).json({ error: 'Akun user tidak ditemukan' });
    }

    const { amount, planId, paymentMethod = 'qris' } = req.body || {};
    const pkg = resolvePackage(amount, planId);
    const requestedMethod = String(paymentMethod || 'qris').trim().toLowerCase();

    // Map e-wallet choices (DANA/GoPay/OVO) to Pakasir QRIS since Pakasir QRIS supports all e-wallets natively
    const pakasirMethodMap: Record<string, string> = {
      qris: 'qris',
      dana: 'qris',
      gopay: 'qris',
      ovo: 'qris',
      bni_va: 'bni_va',
      bri_va: 'bri_va',
      permata_va: 'permata_va',
      cimb_niaga_va: 'cimb_niaga_va',
      maybank_va: 'maybank_va',
      bnc_va: 'bnc_va',
      sampoerna_va: 'sampoerna_va',
      artha_graha_va: 'artha_graha_va',
      atm_bersama_va: 'atm_bersama_va',
    };
    const cleanMethod = pakasirMethodMap[requestedMethod] || 'qris';

    const orderId = `ZS-${user.uid}-${Date.now().toString(36).toUpperCase()}`;
    const pakasirCheckoutUrl = `https://app.pakasir.com/pay/${encodeURIComponent(
      PAKASIR_SLUG
    )}/${pkg.amount}?order_id=${encodeURIComponent(orderId)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    let pakasirJson: any = {};
    let pakasirOk = false;
    let pakasirStatus = 0;

    try {
      const pakasirResp = await fetch(
        `https://app.pakasir.com/api/transactioncreate/${encodeURIComponent(cleanMethod)}`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            project: PAKASIR_SLUG,
            order_id: orderId,
            amount: pkg.amount,
            api_key: PAKASIR_API_KEY,
          }),
        }
      );

      pakasirStatus = pakasirResp.status;
      pakasirOk = pakasirResp.ok;
      const rawText = await pakasirResp.text();
      try {
        pakasirJson = JSON.parse(rawText);
      } catch {
        pakasirJson = { message: rawText };
      }
    } finally {
      clearTimeout(timer);
    }

    const p = pakasirJson?.payment || pakasirJson?.data || pakasirJson;
    const paymentNumber = String(p?.payment_number || p?.va_number || p?.qris_string || '').trim();

    if (!pakasirOk || !paymentNumber) {
      console.error('[Pakasir Create Error]', {
        status: pakasirStatus,
        method: cleanMethod,
        response: pakasirJson,
      });
      return res.status(502).json({
        error:
          pakasirJson?.message ||
          pakasirJson?.error ||
          'Gateway Pakasir gagal membuat kode pembayaran. Silakan pilih QRIS atau coba beberapa saat lagi.',
      });
    }

    const fee = Number(p.fee) || 0;
    const totalPayment = Number(p.total_payment) || pkg.amount + fee;
    const expiredAt = p.expired_at
      ? String(p.expired_at)
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const txRecord: ITransaction = {
      orderId,
      txnId: String(p.txn_id || p.id || orderId),
      uid: user.uid,
      userEmail: user.email,
      userName: user.name,
      planId: pkg.id,
      planName: pkg.name,
      durationDays: pkg.durationDays,
      bonusExp: pkg.bonusExp,
      amount: Number(p.amount) || pkg.amount,
      fee,
      totalPayment,
      paymentMethod: cleanMethod,
      paymentNumber,
      paymentUrl: pakasirCheckoutUrl,
      status: 'pending',
      expiredAt,
    };

    await saveNewTransaction(txRecord);

    return res.status(201).json({
      ok: true,
      transaction: txRecord,
    });
  } catch (err) {
    console.error('[Payment Create Error]', err);
    return res.status(500).json({ error: 'Gagal menghubungi gateway pembayaran Pakasir' });
  }
});

// GET /api/payment/status/:orderId — Poll genuine Pakasir transactiondetail & activate ONLY if completed
router.get('/status/:orderId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const orderId = String(req.params.orderId || '').trim();
    if (!orderId) {
      return res.status(400).json({ error: 'orderId tidak valid' });
    }

    const tx = await getTransactionByOrderId(orderId);
    if (!tx || tx.uid !== uid) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }

    const result = await verifyAndSyncPakasirTransaction(tx);
    return res.json({
      ok: true,
      status: result.status,
      transaction: result.transaction,
      ...(result.user ? { user: sanitizeUser(result.user) } : {}),
    });
  } catch (err) {
    console.error('[Payment Status Error]', err);
    return res.status(500).json({ error: 'Gagal memeriksa status transaksi' });
  }
});

// POST /api/payment/confirm/:orderId — Strictly verify against Pakasir API before activating VIP (NEVER auto-ACC unpaid orders)
router.post('/confirm/:orderId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const orderId = String(req.params.orderId || '').trim();
    if (!orderId) {
      return res.status(400).json({ error: 'orderId tidak valid' });
    }

    const tx = await getTransactionByOrderId(orderId);
    if (!tx || tx.uid !== uid) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }

    const result = await verifyAndSyncPakasirTransaction(tx);
    if (!result.paid) {
      return res.status(402).json({
        ok: false,
        status: result.status,
        transaction: result.transaction,
        error:
          result.error ||
          'Pembayaran belum masuk di Pakasir. Silakan transfer terlebih dahulu sebelum verifikasi.',
      });
    }

    return res.json({
      ok: true,
      status: 'paid',
      transaction: result.transaction,
      user: result.user ? sanitizeUser(result.user) : null,
    });
  } catch (err) {
    console.error('[Payment Confirm Error]', err);
    return res.status(500).json({ error: 'Gagal memverifikasi pembayaran ke Pakasir' });
  }
});

// OPTIONS /api/payment/webhook — Public CORS preflight
router.options('/webhook', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  return res.sendStatus(204);
});

// POST /api/payment/webhook — Public Pakasir Webhook (verifies signature OR server-to-server Pakasir API)
router.post('/webhook', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  try {
    const body = req.body || {};
    const orderId = String(body.order_id || body.orderId || '').trim();
    const txnId = String(body.txn_id || body.txnId || body.completed_at || '').trim();
    const rawStatus = String(body.status || '').toLowerCase().trim();
    const amount = Number(body.amount || 0);

    if (!orderId) {
      return res.status(400).json({ error: 'order_id wajib ada di payload webhook' });
    }

    const isSuccessStatus = ['paid', 'success', 'completed', 'settled'].includes(rawStatus);
    if (!isSuccessStatus) {
      return res.status(200).json({ ok: true, ignored: true, status: rawStatus });
    }

    let tx = await getTransactionByOrderId(orderId);

    // Fallback: if transaction was initiated directly via Pakasir Pay link with ZS-<uid>-... order_id
    if (!tx && orderId.startsWith('ZS-')) {
      const parts = orderId.split('-');
      const extractedUid = parts[1];
      if (extractedUid) {
        const matchedUser = await findUserByUid(extractedUid);
        if (matchedUser) {
          const pkg = resolvePackage(amount);
          const syntheticTx: ITransaction = {
            orderId,
            txnId: txnId || orderId,
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
            paymentUrl: `https://app.pakasir.com/pay/${encodeURIComponent(PAKASIR_SLUG)}/${
              amount || pkg.amount
            }?order_id=${encodeURIComponent(orderId)}`,
            status: 'pending',
          };
          await saveNewTransaction(syntheticTx).catch(() => {});
          tx = syntheticTx;
        }
      }
    }

    if (!tx) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan untuk order_id ini' });
    }

    // Security check: require valid webhook signature OR live confirmation directly from Pakasir transactiondetail API
    const sigValid = verifyWebhookSignature(req);
    const liveDetail = await queryPakasirTransactionDetail(orderId, tx.amount);
    const liveConfirmed =
      liveDetail.ok &&
      liveDetail.remoteOrderId === tx.orderId &&
      liveDetail.remoteAmount >= tx.amount &&
      ['completed', 'paid', 'success', 'settled'].includes(liveDetail.remoteStatus);

    if (!sigValid && !liveConfirmed) {
      return res.status(403).json({
        error: 'Webhook ditolak: tanda tangan tidak valid dan status belum completed di Pakasir.',
      });
    }

    if (amount > 0 && tx.amount > 0 && amount < tx.amount) {
      return res.status(400).json({ error: 'Nominal pembayaran tidak sesuai paket' });
    }

    const updatedUser = await activatePremiumFromTransaction(
      tx,
      liveDetail.txnId || txnId || orderId
    );
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
