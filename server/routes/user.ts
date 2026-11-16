import { Router } from 'express';
import nodemailer from 'nodemailer';
import {
  hashPassword,
  requireAuth,
  signAuthToken,
  verifyPassword,
  type AuthenticatedRequest,
} from '../auth.ts';
import {
  STREAK_FRAME_TIERS,
  createMemberUser,
  findOrCreateGoogleUser,
  findUserByIdentifier,
  findUserByUid,
  getJakartaDateString,
  sanitizeUser,
  saveOtpCode,
  touchUserLastActive,
  updateUserByUid,
  verifyAndConsumeOtpCode,
} from '../db.ts';
import type { BookmarkItem, WatchHistoryItem } from '../models/User.ts';

const router = Router();
const FIREBASE_WEB_API_KEY = 'AIzaSyBPXKFLf1xPdo9H9Bw8w8KAPFGY0dYH-04';

export const getExpNeededForLevel = (level: number) => Math.max(100, level * 200);

function detectRequestCountry(req: any): string {
  const raw =
    req.body?.countryCode ||
    req.headers?.['x-client-country'] ||
    req.headers?.['x-vercel-ip-country'] ||
    req.headers?.['cf-ipcountry'] ||
    '';
  const clean = String(raw || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(clean) && clean !== 'XX') {
    return clean;
  }
  return 'ID';
}

function buildOtpHtml(code: string, purposeLabel: string): string {
  return `<div style="font-family:Arial,sans-serif;background:#0b0c0f;color:#f4f5f7;padding:28px;border-radius:16px;max-width:480px;margin:auto;border:1px solid #262936;">
    <h2 style="color:#E84A18;margin-top:0;font-size:20px;">ZoneStream · Kode Verifikasi Keamanan</h2>
    <p style="font-size:14px;line-height:1.6;color:#d1d5db;">Halo Sobat ZoneStream,<br/>Gunakan kode OTP 6 digit di bawah ini untuk <strong>${purposeLabel}</strong>:</p>
    <div style="margin:18px 0;font-size:32px;font-weight:800;letter-spacing:8px;background:#161820;border:1px solid #E84A18;padding:16px 24px;border-radius:12px;display:inline-block;color:#ffffff;">${code}</div>
    <p style="color:#9ca3af;font-size:12px;margin-top:12px;">Kode berlaku selama <strong>10 menit</strong>. Demi keamanan akun, jangan bagikan kode ini kepada siapa pun.</p>
  </div>`;
}

const DEFAULT_GMAIL_USER = 'wanglin72kk@gmail.com';
const DEFAULT_GMAIL_APP_PASSWORD = 'etjadzxgeerlydae';

async function dispatchEmailCode(
  toEmail: string,
  code: string,
  purposeLabel: string
): Promise<'email' | 'in-app'> {
  const html = buildOtpHtml(code, purposeLabel);
  const subject = `Kode Verifikasi ZoneStream: ${code}`;

  const gmailUser = (process.env.GMAIL_USER || DEFAULT_GMAIL_USER).trim();
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || DEFAULT_GMAIL_APP_PASSWORD)
    .replace(/\s+/g, '')
    .trim();
  const smtpHost = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpUser = process.env.SMTP_USER?.trim() || gmailUser;
  const smtpPass = (process.env.SMTP_PASS || gmailPass).replace(/\s+/g, '').trim();

  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || `ZoneStream <${smtpUser}>`,
        to: toEmail,
        subject,
        html,
      });
      return 'email';
    } catch (err) {
      console.warn('[Gmail/SMTP Dispatch Notice]', (err as Error).message);
    }
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'ZoneStream <onboarding@resend.dev>',
          to: [toEmail],
          subject,
          html,
        }),
      });
      if (resp.ok) return 'email';
    } catch (err) {
      console.warn('[Resend Dispatch Notice]', (err as Error).message);
    }
  }
  return 'in-app';
}

// Login with username/email + password
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/Email dan Password wajib diisi.' });
    }

    const user = await findUserByIdentifier(String(identifier));
    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      return res.status(401).json({ error: 'Username/Email atau Password salah.' });
    }

    const token = signAuthToken({
      uid: user.uid,
      username: user.username,
      role: user.role,
    });

    void touchUserLastActive(user.uid);
    return res.json({ ok: true, token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('[Login Error]', err);
    return res.status(500).json({ error: 'Gagal memproses login' });
  }
});

// Login / Register with Firebase Google Auth ID Token
router.post('/firebase-google', async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'Token Google Firebase tidak ditemukan.' });
    }

    const verifyResp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    const verifyJson = (await verifyResp.json()) as any;
    const fbUser = verifyJson?.users?.[0];
    if (!verifyResp.ok || !fbUser?.email) {
      return res.status(401).json({ error: 'Verifikasi akun Google Firebase gagal.' });
    }

    const user = await findOrCreateGoogleUser({
      email: String(fbUser.email),
      name: fbUser.displayName ? String(fbUser.displayName) : undefined,
      photoUrl: fbUser.photoUrl ? String(fbUser.photoUrl) : undefined,
    });

    const token = signAuthToken({
      uid: user.uid,
      username: user.username,
      role: user.role,
    });

    void touchUserLastActive(user.uid);
    return res.json({ ok: true, token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('[Firebase Google Auth Error]', err);
    return res.status(500).json({ error: 'Gagal memproses login Google' });
  }
});

// Register new Member account with 6-digit Email OTP verification (blocks claiming VerzonFounder)
router.post('/register', async (req, res) => {
  try {
    const { username, email, name, password, code } = req.body || {};
    if (!username || !email || !password || !code) {
      return res
        .status(400)
        .json({ error: 'Username, email, password, dan kode verifikasi 6 digit wajib diisi.' });
    }

    const cleanUsername = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanEmail = String(email).trim().toLowerCase();

    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Username minimal 3 karakter.' });
    }
    if (cleanUsername === 'verzonfounder' || cleanEmail === 'wanglin72kk@gmail.com') {
      return res.status(403).json({
        error: 'Akun VerzonFounder bersifat eksklusif dan hanya dapat diakses oleh pemiliknya.',
      });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter.' });
    }

    const existingUser =
      (await findUserByIdentifier(cleanUsername)) || (await findUserByIdentifier(cleanEmail));
    if (existingUser) {
      return res.status(409).json({ error: 'Username atau Email sudah terdaftar.' });
    }

    const validCode = await verifyAndConsumeOtpCode({
      email: cleanEmail,
      purpose: 'register',
      code: String(code),
    });
    if (!validCode) {
      return res
        .status(400)
        .json({ error: 'Kode verifikasi 6 digit salah atau sudah kedaluwarsa.' });
    }

    const created = await createMemberUser({
      username: cleanUsername,
      email: cleanEmail,
      name: String(name || cleanUsername).trim().slice(0, 40),
      password: String(password),
    });

    const token = signAuthToken({
      uid: created.uid,
      username: created.username,
      role: created.role,
    });

    return res.status(201).json({ ok: true, token, user: sanitizeUser(created) });
  } catch (err) {
    console.error('[Register Error]', err);
    return res.status(500).json({ error: 'Gagal membuat akun baru' });
  }
});

// Send 6-digit OTP verification code (for Register, Change Email, Change Password, or Forgot Password)
router.post('/send-code', async (req, res) => {
  try {
    const { purpose, targetEmail, identifier, email } = req.body || {};
    const validPurposes = ['register', 'change-email', 'change-password', 'forgot-password'];
    if (!validPurposes.includes(purpose)) {
      return res.status(400).json({ error: 'Tujuan kode verifikasi tidak valid.' });
    }

    let resolvedEmail = String(targetEmail || email || '').trim().toLowerCase();
    let uid = '';

    if (purpose === 'register') {
      if (!resolvedEmail || !resolvedEmail.includes('@')) {
        return res.status(400).json({ error: 'Masukkan alamat email yang valid.' });
      }
      if (resolvedEmail === 'wanglin72kk@gmail.com') {
        return res.status(403).json({
          error: 'Email tersebut khusus untuk akun VerzonFounder. Silakan login langsung.',
        });
      }
      const existing = await findUserByIdentifier(resolvedEmail);
      if (existing) {
        return res.status(409).json({ error: 'Email sudah terdaftar. Silakan langsung masuk.' });
      }
    } else if (purpose === 'forgot-password') {
      const user = await findUserByIdentifier(String(identifier || resolvedEmail));
      if (!user) {
        return res.status(404).json({ error: 'Akun dengan email/username tersebut tidak ditemukan.' });
      }
      resolvedEmail = user.email;
      uid = user.uid;
    } else if (purpose === 'change-password') {
      const authHeader = req.headers.authorization || '';
      const user = await findUserByIdentifier(resolvedEmail);
      if (!authHeader.startsWith('Bearer ') && !user) {
        return res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
      }
      if (user) {
        resolvedEmail = user.email;
        uid = user.uid;
      }
    } else if (purpose === 'change-email') {
      if (!resolvedEmail || !resolvedEmail.includes('@')) {
        return res.status(400).json({ error: 'Masukkan alamat email baru yang valid.' });
      }
      const taken = await findUserByIdentifier(resolvedEmail);
      if (taken) {
        return res.status(409).json({ error: 'Email tersebut sudah digunakan akun lain.' });
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await saveOtpCode({
      email: resolvedEmail,
      uid,
      purpose,
      code,
    });

    const purposeText =
      purpose === 'register'
        ? 'Pendaftaran Akun Baru ZoneStream'
        : purpose === 'change-email'
        ? 'Mengubah Email Akun'
        : purpose === 'change-password'
        ? 'Mengubah Password Akun'
        : 'Reset Password Akun';

    const delivery = await dispatchEmailCode(resolvedEmail, code, purposeText);

    return res.json({
      ok: true,
      delivery,
      email: resolvedEmail,
      previewCode: delivery === 'in-app' ? code : undefined,
      message:
        delivery === 'email'
          ? `Kode verifikasi 6 digit telah dikirim ke Gmail ${resolvedEmail}. Cek Kotak Masuk atau folder Spam.`
          : `Pengirim Gmail SMTP/Resend belum aktif di server saat ini. Gunakan kode verifikasi sementara berikut untuk ${resolvedEmail}:`,
    });
  } catch (err) {
    console.error('[Send Code Error]', err);
    return res.status(500).json({ error: 'Gagal mengirim kode verifikasi' });
  }
});

// Verify OTP code & change Email
router.post('/verify-change-email', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const { newEmail, code, currentPassword } = req.body || {};
    const cleanEmail = String(newEmail || '').trim().toLowerCase();

    if (!cleanEmail || !code || !currentPassword) {
      return res.status(400).json({ error: 'Email baru, kode verifikasi, dan password saat ini wajib diisi.' });
    }

    const currentUser = await findUserByUid(uid);
    if (!currentUser || !verifyPassword(String(currentPassword), currentUser.passwordHash)) {
      return res.status(401).json({ error: 'Password saat ini salah.' });
    }

    const validCode = await verifyAndConsumeOtpCode({
      email: cleanEmail,
      purpose: 'change-email',
      code: String(code),
    });
    if (!validCode) {
      return res.status(400).json({ error: 'Kode verifikasi salah atau sudah kedaluwarsa.' });
    }

    const updated = await updateUserByUid(uid, (current) => ({
      ...current,
      email: cleanEmail,
    }));

    return res.json({ ok: true, user: updated ? sanitizeUser(updated) : null });
  } catch (err) {
    console.error('[Verify Change Email Error]', err);
    return res.status(500).json({ error: 'Gagal memperbarui email' });
  }
});

// Verify OTP code & change Password (authenticated)
router.post('/verify-change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const { code, newPassword } = req.body || {};

    if (!code || !newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Kode verifikasi dan password baru (min. 6 karakter) wajib diisi.' });
    }

    const currentUser = await findUserByUid(uid);
    if (!currentUser) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }

    const validCode = await verifyAndConsumeOtpCode({
      email: currentUser.email,
      purpose: 'change-password',
      code: String(code),
    });
    if (!validCode) {
      return res.status(400).json({ error: 'Kode verifikasi salah atau sudah kedaluwarsa.' });
    }

    const updated = await updateUserByUid(uid, (current) => ({
      ...current,
      passwordHash: hashPassword(String(newPassword).trim()),
    }));

    return res.json({ ok: true, user: updated ? sanitizeUser(updated) : null });
  } catch (err) {
    console.error('[Verify Change Password Error]', err);
    return res.status(500).json({ error: 'Gagal mengubah password' });
  }
});

// Reset forgotten password using email OTP code
router.post('/forgot-password', async (req, res) => {
  try {
    const { identifier, code, newPassword } = req.body || {};
    if (!identifier || !code || !newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Email/Username, kode verifikasi, dan password baru (min. 6 karakter) wajib diisi.' });
    }

    const user = await findUserByIdentifier(String(identifier));
    if (!user) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }

    const validCode = await verifyAndConsumeOtpCode({
      email: user.email,
      purpose: 'forgot-password',
      code: String(code),
    });
    if (!validCode) {
      return res.status(400).json({ error: 'Kode verifikasi salah atau sudah kedaluwarsa.' });
    }

    await updateUserByUid(user.uid, (current) => ({
      ...current,
      passwordHash: hashPassword(String(newPassword).trim()),
    }));

    return res.json({ ok: true, message: 'Password berhasil direset. Silakan masuk.' });
  } catch (err) {
    console.error('[Forgot Password Error]', err);
    return res.status(500).json({ error: 'Gagal mereset password' });
  }
});

// Get authenticated user profile
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    let user = await findUserByUid(req.authUser!.uid);
    if (!user) {
      return res.status(404).json({ error: 'Akun tidak ditemukan' });
    }
    const detectedCountry = detectRequestCountry(req);
    if (!user.countryCode && detectedCountry) {
      const updated = await updateUserByUid(user.uid, (cur) => ({
        ...cur,
        countryCode: detectedCountry,
      }));
      if (updated) user = updated;
    }
    void touchUserLastActive(user.uid);
    return res.json({ ok: true, user: sanitizeUser(user) });
  } catch (err) {
    console.error('[User Me Error]', err);
    return res.status(500).json({ error: 'Gagal memuat profil' });
  }
});

// Update profile (Foto Profil, Latar, Tema Discord, Dekorasi Avatar Discord, Lencana Telegram & Emoji Status wajib Premium/Founder)
const FREE_BORDERS = new Set(['none', 'classic']);

router.put('/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const {
      name,
      bio,
      photoUrl,
      bannerUrl,
      activeBorder,
      activeBadge,
      profileTheme,
      statusEmoji,
      countryCode,
    } = req.body || {};

    const existing = await findUserByUid(uid);
    if (!existing) {
      return res.status(404).json({ error: 'Akun tidak ditemukan' });
    }

    const hasPremiumAccess = Boolean(existing.isPremium || existing.role === 'founder');
    const cleanBorder = typeof activeBorder === 'string' ? activeBorder.trim().slice(0, 64) : undefined;
    const cleanTheme = typeof profileTheme === 'string' ? profileTheme.trim().slice(0, 64) : undefined;

    const streakTier = cleanBorder
      ? STREAK_FRAME_TIERS.find((t) => t.id === cleanBorder)
      : undefined;
    const bestStreak = Math.max(existing.longestStreak || 0, existing.watchStreak || 0);
    const hasUnlockedStreakBorder = Boolean(
      streakTier &&
        (existing.role === 'founder' ||
          (existing.unlockedStreakFrames || []).includes(streakTier.id) ||
          bestStreak >= streakTier.minStreak)
    );

    if (streakTier && !hasUnlockedStreakBorder) {
      return res.status(403).json({
        error: `Frame animasi ${streakTier.name} terkunci. Capai ${streakTier.minStreak} hari streak nonton beruntun untuk membukanya!`,
      });
    }

    const tryingPhotoEdit =
      typeof photoUrl === 'string' && photoUrl !== (existing.photoUrl || '');
    const tryingBannerEdit =
      typeof bannerUrl === 'string' && bannerUrl !== (existing.bannerUrl || '');
    const tryingPremiumBorder =
      typeof cleanBorder === 'string' &&
      cleanBorder.length > 0 &&
      !FREE_BORDERS.has(cleanBorder) &&
      !hasUnlockedStreakBorder &&
      cleanBorder !== existing.activeBorder;
    const tryingPremiumTheme =
      typeof cleanTheme === 'string' &&
      cleanTheme !== 'default' &&
      cleanTheme !== (existing.profileTheme || 'default');
    const tryingStatusEmoji =
      typeof statusEmoji === 'string' &&
      statusEmoji !== '' &&
      statusEmoji !== (existing.statusEmoji || '');

    if (
      !hasPremiumAccess &&
      (tryingPhotoEdit ||
        tryingBannerEdit ||
        tryingPremiumBorder ||
        tryingPremiumTheme ||
        tryingStatusEmoji)
    ) {
      return res.status(403).json({
        error:
          'Foto Profil, Latar Belakang, Tema Discord, Dekorasi Avatar 3D, & Emoji Status khusus akun Premium! Upgrade ke Premium terlebih dahulu.',
      });
    }

    const updated = await updateUserByUid(uid, (current) => {
      let nextName = current.name;
      if (typeof name === 'string' && name.trim().length > 0) {
        const candidate = name.trim().slice(0, 50);
        if (candidate.toLowerCase() === 'verzonfounder' && current.role !== 'founder') {
          nextName = current.name;
        } else {
          nextName = candidate;
        }
      }

      const nextBio =
        typeof bio === 'string' ? bio.trim().slice(0, 160) : current.bio || '';

      const nextPhoto =
        hasPremiumAccess && typeof photoUrl === 'string'
          ? photoUrl.slice(0, 6_000_000)
          : current.photoUrl;

      const nextBanner =
        hasPremiumAccess && typeof bannerUrl === 'string'
          ? bannerUrl.slice(0, 6_000_000)
          : current.bannerUrl;

      let nextBorder = current.activeBorder || 'none';
      if (typeof cleanBorder === 'string' && cleanBorder.length > 0) {
        if (hasPremiumAccess || FREE_BORDERS.has(cleanBorder) || hasUnlockedStreakBorder) {
          nextBorder = cleanBorder;
        }
      }

      let nextBadge = current.activeBadge;
      if (typeof activeBadge === 'string') {
        if (hasPremiumAccess) {
          nextBadge = activeBadge.trim().slice(0, 32) || 'Verified VIP';
        } else {
          nextBadge = 'Member';
        }
      }

      let nextTheme = current.profileTheme || 'default';
      if (typeof cleanTheme === 'string' && cleanTheme.length > 0) {
        nextTheme = hasPremiumAccess ? cleanTheme : 'default';
      }

      let nextStatusEmoji = current.statusEmoji || '';
      if (typeof statusEmoji === 'string') {
        nextStatusEmoji = hasPremiumAccess ? statusEmoji.trim().slice(0, 40) : '';
      }

      const cleanCountry =
        typeof countryCode === 'string' && /^[A-Za-z]{2}$/.test(countryCode.trim())
          ? countryCode.trim().toUpperCase()
          : current.countryCode || detectRequestCountry(req);

      return {
        ...current,
        name: nextName,
        bio: nextBio,
        photoUrl: nextPhoto,
        bannerUrl: nextBanner,
        activeBorder: nextBorder,
        activeBadge: nextBadge,
        profileTheme: nextTheme,
        statusEmoji: nextStatusEmoji,
        countryCode: cleanCountry,
      };
    });

    if (!updated) {
      return res.status(404).json({ error: 'Akun tidak ditemukan' });
    }
    return res.json({ ok: true, user: sanitizeUser(updated) });
  } catch (err) {
    console.error('[Profile Update Error]', err);
    return res.status(500).json({ error: 'Gagal memperbarui profil' });
  }
});

// Direct upgrade endpoint locked for members (must checkout via Pakasir /api/payment/create-transaction)
router.post('/upgrade', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.authUser?.role !== 'founder') {
      return res.status(402).json({
        error: 'Silakan selesaikan pembayaran paket VIP via Pakasir untuk mengaktifkan Premium.',
      });
    }
    const uid = req.authUser!.uid;
    const updated = await updateUserByUid(uid, (current) => ({
      ...current,
      isPremium: true,
      isVerified: true,
    }));
    if (!updated) return res.status(404).json({ error: 'Akun tidak ditemukan' });
    return res.json({ ok: true, user: sanitizeUser(updated) });
  } catch (err) {
    console.error('[Upgrade Error]', err);
    return res.status(500).json({ error: 'Gagal memproses upgrade' });
  }
});

// Toggle Premium preview mode (Founder only)
router.post('/toggle-ad-preview', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const updated = await updateUserByUid(uid, (current) => {
      if (current.role !== 'founder') return current;
      return {
        ...current,
        isPremium: !current.isPremium,
      };
    });
    if (!updated) return res.status(404).json({ error: 'Akun tidak ditemukan' });
    return res.json({ ok: true, user: sanitizeUser(updated) });
  } catch {
    return res.status(500).json({ error: 'Gagal mengubah mode preview' });
  }
});

// Record watch history & grant daily watch + episode EXP + Streak Frame rewards
router.post('/history', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const { id, type, title, poster, episodeId, episodeTitle, episodeNumber, progress } =
      req.body || {};

    if (!id || !episodeId || !title) {
      return res.status(400).json({ error: 'Data riwayat tontonan tidak lengkap' });
    }

    const todayStr = getJakartaDateString(0);
    const yesterdayStr = getJakartaDateString(-1);

    let expGained = 0;
    let dailyBonusGained = 0;
    let levelUp = false;
    let finalStreak = 1;
    let finalLongestStreak = 1;
    let finalLevel = 1;
    let isDoubleExp = false;
    let newlyUnlockedFrame: { id: string; name: string; minStreak: number } | null = null;

    const updated = await updateUserByUid(uid, (current) => {
      const hasValidPremium = Boolean(
        current.role === 'founder' ||
          (current.isPremium &&
            (!current.premiumExpiryDate ||
              new Date(current.premiumExpiryDate).getTime() >= Date.now()))
      );
      const multiplier = hasValidPremium ? 2 : 1;
      isDoubleExp = multiplier === 2;

      const alreadyWatchedEpisode = current.watchHistory.some(
        (h: WatchHistoryItem) => h.episodeId === episodeId
      );
      const baseEpisodeExp = (alreadyWatchedEpisode ? 10 : 30) * multiplier;

      const isNewDay = current.lastWatchDate !== todayStr;
      let nextStreak = current.watchStreak || 0;
      let nextDailyCount = current.dailyEpisodesWatched || 0;

      if (isNewDay) {
        nextStreak = current.lastWatchDate === yesterdayStr ? nextStreak + 1 : 1;
        nextDailyCount = 1;
        dailyBonusGained = (nextStreak >= 2 ? 75 : 50) * multiplier;
      } else {
        nextStreak = Math.max(1, nextStreak);
        nextDailyCount = current.lastWatchDate === todayStr ? nextDailyCount + 1 : 1;
      }

      const nextLongestStreak = Math.max(current.longestStreak || 0, nextStreak);
      const existingDates = Array.isArray(current.streakDates) ? [...current.streakDates] : [];
      if (!existingDates.includes(todayStr)) {
        existingDates.push(todayStr);
      }
      const nextStreakDates = Array.from(new Set(existingDates)).sort().slice(-30);

      const prevUnlocked = new Set(Array.isArray(current.unlockedStreakFrames) ? current.unlockedStreakFrames : []);
      const nextUnlocked = new Set(prevUnlocked);
      for (const tier of STREAK_FRAME_TIERS) {
        if (current.role === 'founder' || nextLongestStreak >= tier.minStreak) {
          if (!prevUnlocked.has(tier.id)) {
            newlyUnlockedFrame = { id: tier.id, name: tier.name, minStreak: tier.minStreak };
          }
          nextUnlocked.add(tier.id);
        }
      }

      expGained = baseEpisodeExp + dailyBonusGained;
      let nextExp = current.exp + expGained;
      let nextLevel = current.level;
      if (current.role === 'founder') {
        nextLevel = 999999;
        nextExp = 0;
        levelUp = false;
      } else {
        while (nextExp >= getExpNeededForLevel(nextLevel)) {
          nextExp -= getExpNeededForLevel(nextLevel);
          nextLevel += 1;
          levelUp = true;
        }
      }

      finalStreak = nextStreak;
      finalLongestStreak = nextLongestStreak;
      finalLevel = nextLevel;

      const filtered = current.watchHistory.filter((h: WatchHistoryItem) => h.id !== id);
      const entry: WatchHistoryItem = {
        id: String(id),
        type: type === 'donghua' ? 'donghua' : 'anime',
        title: String(title),
        poster: String(poster || ''),
        episodeId: String(episodeId),
        episodeTitle: String(episodeTitle || `Episode ${episodeNumber || 1}`),
        episodeNumber: String(episodeNumber || '1'),
        progress: Math.min(100, Math.max(5, Number(progress) || 35)),
        updatedAt: new Date().toISOString(),
      };

      const nextActiveBorder =
        newlyUnlockedFrame && (!current.activeBorder || current.activeBorder === 'classic' || current.activeBorder === 'none')
          ? newlyUnlockedFrame.id
          : current.activeBorder;

      return {
        ...current,
        level: nextLevel,
        exp: nextExp,
        activeBorder: nextActiveBorder,
        lastWatchDate: todayStr,
        watchStreak: nextStreak,
        longestStreak: nextLongestStreak,
        streakDates: nextStreakDates,
        unlockedStreakFrames: Array.from(nextUnlocked),
        dailyEpisodesWatched: nextDailyCount,
        totalEpisodesWatched: (current.totalEpisodesWatched || 0) + 1,
        charisma: current.role === 'founder' ? Math.max(9999, current.charisma ?? 9999) : (current.charisma ?? 0),
        watchHistory: [entry, ...filtered].slice(0, 30),
      };
    });

    if (!updated) {
      return res.status(404).json({ error: 'Akun tidak ditemukan' });
    }
    return res.json({
      ok: true,
      expGained,
      dailyBonusGained,
      streak: finalStreak,
      longestStreak: finalLongestStreak,
      levelUp,
      newLevel: finalLevel,
      isDoubleExp,
      newlyUnlockedFrame,
      user: sanitizeUser(updated),
    });
  } catch (err) {
    console.error('[History Error]', err);
    return res.status(500).json({ error: 'Gagal menyimpan history' });
  }
});

// Toggle bookmark
router.post('/bookmark', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const { id, type, title, poster, rating, status } = req.body || {};
    if (!id || !title) {
      return res.status(400).json({ error: 'Data bookmark tidak lengkap' });
    }

    let bookmarked = false;
    const updated = await updateUserByUid(uid, (current) => {
      const exists = current.bookmarks.some(
        (b: BookmarkItem) => b.id === id && b.type === type
      );
      if (exists) {
        bookmarked = false;
        return {
          ...current,
          bookmarks: current.bookmarks.filter(
            (b: BookmarkItem) => !(b.id === id && b.type === type)
          ),
        };
      }
      bookmarked = true;
      return {
        ...current,
        bookmarks: [
          {
            id: String(id),
            type: (type === 'donghua' ? 'donghua' : 'anime') as 'anime' | 'donghua',
            title: String(title),
            poster: String(poster || ''),
            rating: String(rating || '8.0'),
            status: String(status || 'Ongoing'),
            addedAt: new Date().toISOString(),
          },
          ...current.bookmarks,
        ].slice(0, 100),
      };
    });

    if (!updated) {
      return res.status(404).json({ error: 'Akun tidak ditemukan' });
    }
    return res.json({ ok: true, bookmarked, user: sanitizeUser(updated) });
  } catch (err) {
    console.error('[Bookmark Error]', err);
    return res.status(500).json({ error: 'Gagal menyimpan bookmark' });
  }
});

// Toggle episode bookmark (Watch Later)
router.post('/episode-bookmark', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const { id, type, title, poster, episodeId, episodeTitle, episodeNumber } = req.body || {};
    if (!episodeId || !title) {
      return res.status(400).json({ error: 'Data episode bookmark tidak lengkap' });
    }

    let bookmarked = false;
    const updated = await updateUserByUid(uid, (current: any) => {
      const eps = current.episodeBookmarks || [];
      const exists = eps.some((b: any) => b.episodeId === episodeId);
      if (exists) {
        bookmarked = false;
        return {
          ...current,
          episodeBookmarks: eps.filter((b: any) => b.episodeId !== episodeId),
        };
      }
      bookmarked = true;
      return {
        ...current,
        episodeBookmarks: [
          {
            id: String(id),
            type: (type === 'donghua' ? 'donghua' : 'anime') as 'anime' | 'donghua',
            title: String(title),
            poster: String(poster || ''),
            episodeId: String(episodeId),
            episodeTitle: String(episodeTitle || ''),
            episodeNumber: String(episodeNumber || '1'),
            addedAt: new Date().toISOString(),
          },
          ...eps,
        ].slice(0, 100),
      };
    });

    if (!updated) {
      return res.status(404).json({ error: 'Akun tidak ditemukan' });
    }
    return res.json({ ok: true, bookmarked, user: sanitizeUser(updated) });
  } catch (err) {
    console.error('[Episode Bookmark Error]', err);
    return res.status(500).json({ error: 'Gagal menyimpan episode bookmark' });
  }
});

export default router;
