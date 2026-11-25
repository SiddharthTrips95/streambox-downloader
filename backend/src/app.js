import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiRouter from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  const allowedOrigins = corsOrigin && corsOrigin !== '*'
    ? corsOrigin.split(',').map((o) => o.trim())
    : true;

  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiRouter);

  // Serve built frontend static assets in production / single-container deployments
  const distPath = path.resolve(__dirname, '../../frontend/dist');
  const shouldServeStatic =
    process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC === 'true';

  if (shouldServeStatic && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      return res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}
