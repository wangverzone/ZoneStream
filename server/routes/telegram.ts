import { Router } from 'express';
import { connectDB, isDbMongoConnected, readFallbackUsers, writeFallbackUsers } from '../db.ts';
import { UserModel } from '../models/User.ts';

const router = Router();
const HARDCODED_BOT_TOKEN = '9294356380:AAEPgCONMN3Rb3mge0ZMm0BYBqiteY-hEOs';

async function handleTelegramMessage(message: any) {
  if (!message || !message.text) return;
  const chatId = message.chat.id;
  const text = String(message.text).trim();
  const botToken = process.env.TELEGRAM_BOT_TOKEN || HARDCODED_BOT_TOKEN;

  const sendTgMessage = async (msg: string) => {
    if (!botToken) return;
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
      });
    } catch {
      // Ignore tg api error
    }
  };

  if (text.startsWith('/start') || text.startsWith('/help')) {
    await sendTgMessage(
      `🤖 *ZoneStream VIP Bot*\n\nKetik \`/vip email@gmail.com\` atau \`/vip UID\` untuk langsung mengaktifkan status *VIP Premium 1 Tahun* secara otomatis ke akun ZoneStream Anda!`
    );
    return;
  }

  if (text.startsWith('/vip') || text.startsWith('/prem')) {
    const parts = text.split(/\s+/);
    const queryKey = parts[1]?.trim().toLowerCase();

    if (!queryKey) {
      await sendTgMessage('❌ Format salah. Gunakan contoh: `/vip akunresspakistan@gmail.com` atau `/vip 1234567`');
      return;
    }

    await connectDB();
    const oneYearExpiry = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    let updated = false;
    let matchedIdentifier = queryKey;

    if (isDbMongoConnected()) {
      const userDoc = await UserModel.findOne({
        $or: [{ email: queryKey }, { uid: queryKey }, { username: queryKey }],
      });
      if (userDoc) {
        userDoc.isPremium = true;
        userDoc.isVerified = true;
        userDoc.premiumPlan = 'VIP 1 Tahun (Telegram Bot)';
        userDoc.premiumExpiryDate = oneYearExpiry;
        userDoc.activeBadge = 'Verified VIP';
        await userDoc.save();
        matchedIdentifier = userDoc.email || userDoc.uid;
        updated = true;
      }
    }

    // Also update fallback store
    const store = readFallbackUsers();
    for (const u of Object.values(store)) {
      if (
        (u.email && u.email.toLowerCase() === queryKey) ||
        u.uid === queryKey ||
        (u.username && u.username.toLowerCase() === queryKey)
      ) {
        u.isPremium = true;
        u.isVerified = true;
        u.premiumPlan = 'VIP 1 Tahun (Telegram Bot)';
        u.premiumExpiryDate = oneYearExpiry;
        u.activeBadge = 'Verified VIP';
        matchedIdentifier = u.email || u.uid;
        updated = true;
      }
    }
    writeFallbackUsers(store);

    if (updated) {
      await sendTgMessage(
        `🎉 *SUKSES!*\n\nAkun dengan identitas *${matchedIdentifier}* telah berhasil diaktifkan menjadi **VIP Premium 1 Tahun** secara otomatis! Silakan refresh web ZoneStream Anda.`
      );
    } else {
      await sendTgMessage(
        `⚠️ Akun dengan Email/UID *${queryKey}* belum terdaftar di ZoneStream. Silakan daftar akun terlebih dahulu di web ZoneStream sebelum menggunakan bot ini.`
      );
    }
  }
}

// POST /api/telegram/webhook
router.post('/webhook', async (req, res) => {
  try {
    const update = req.body;
    const message = update?.message || update?.edited_message;
    await handleTelegramMessage(message);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[Telegram Webhook Error]', err);
    return res.status(500).json({ error: 'Webhook error' });
  }
});

// Start background Telegram Long Polling loop so bot responds instantly without requiring webhook configuration
let pollingOffset = 0;
let isPollingStarted = false;

function startTelegramPolling() {
  if (isPollingStarted) return;
  isPollingStarted = true;

  const botToken = process.env.TELEGRAM_BOT_TOKEN || HARDCODED_BOT_TOKEN;
  if (!botToken) return;

  setInterval(async () => {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?offset=${pollingOffset}&timeout=5`);
      if (!resp.ok) return;
      const data = (await resp.json()) as any;
      if (data && data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          pollingOffset = update.update_id + 1;
          const message = update.message || update.edited_message;
          if (message) {
            await handleTelegramMessage(message);
          }
        }
      }
    } catch {
      // Suppress polling network blips
    }
  }, 3000);
}

startTelegramPolling();

export default router;
