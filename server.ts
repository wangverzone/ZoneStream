import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/app.ts';
import { connectDB } from './server/db.ts';
import { attachChatWebSocketServer } from './server/wsChat.ts';

dotenv.config();

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const app = createApp();
  const httpServer = http.createServer(app);
  attachChatWebSocketServer(httpServer);

  await connectDB();

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[ZoneStream] Server + Chat WebSocket listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[ZoneStream] Fatal server startup error:', err);
  process.exit(1);
});
