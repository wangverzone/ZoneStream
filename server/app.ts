import express from 'express';
import userRoutes from './routes/user.ts';
import streamRoutes from './routes/stream.ts';
import commentRoutes from './routes/comments.ts';
import paymentRoutes from './routes/payment.ts';
import socialRoutes from './routes/social.ts';
import telegramRoutes from './routes/telegram.ts';
import coinsRoutes from './routes/coins.ts';
import { connectDB } from './db.ts';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // Public CORS for API & Pakasir Webhook routes
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Secret, X-Pakasir-Signature, X-Webhook-Secret, X-Api-Key'
    );
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  });

  // Ensure DB connects lazily on database-backed API routes (keeps /api/stream & /api/health instant)
  const ensureDb = async (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    await connectDB();
    next();
  };

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'ZoneStream API' });
  });

  app.use('/api/user', ensureDb, userRoutes);
  app.use('/api/stream', streamRoutes);
  app.use('/api/comments', ensureDb, commentRoutes);
  app.use('/api/payment', ensureDb, paymentRoutes);
  app.use('/api/social', ensureDb, socialRoutes);
  app.use('/api/telegram', ensureDb, telegramRoutes);
  app.use('/api/coins', ensureDb, coinsRoutes);

  return app;
}
