import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import webhookRouter from './routes/webhook.routes';
import leadsRouter from './routes/leads.routes';
import { globalErrorHandler } from './middlewares/errorHandler';

import path from 'path';

const app = express();

// ─── Security Middleware ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors());

// ─── Body Parsing Middleware ──────────────────────────────────────────
// Custom JSON parser to capture raw request body for webhook signature verification
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ─────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env['NODE_ENV'] || 'development',
  });
});

// ─── Security Auth Middleware for Dashboard ──────────────────────────────
const requireAuth = (req: Request, res: Response, next: express.NextFunction) => {
  const token = req.headers['x-admin-key'];
  const expectedPassword = process.env.ADMIN_PASSWORD || 'ariadmin'; // fallback
  if (!token || token !== expectedPassword) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid admin password' });
    return;
  }
  next();
};

// ─── API Routes ───────────────────────────────────────────────────────
app.use('/api', webhookRouter); // Webhooks must be public for Meta
app.use('/api', requireAuth, leadsRouter); // Leads API is fully protected

// ─── Static Frontend Serving (Dashboard) ─────────────────────────────
const dashboardPath = path.join(process.cwd(), 'dashboard/dist');
app.use(express.static(dashboardPath));

// ─── Catch-All Handler (React Router & 404) ───────────────────────────
app.use((_req: Request, res: Response) => {
  if (!_req.originalUrl.startsWith('/api')) {
    res.sendFile(path.join(dashboardPath, 'index.html'));
  } else {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${_req.method} ${_req.originalUrl} does not exist.`,
    });
  }
});

// ─── Global Error Handler (must be AFTER all routes) ─────────────────
app.use(globalErrorHandler);

export default app;
