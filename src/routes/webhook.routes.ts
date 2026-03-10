// ──────────────────────────────────────────────────────────────────────────────
// Webhook Routes — Maps HTTP endpoints to webhook controller handlers
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyWebhook, handleIncomingWebhook } from '../controllers/webhook.controller';

// ─── Webhook Security: DDoS Protection ─────────────────
// Allows maximum of 200 webhook events per minute per IP
// (Meta sends bursts during busy times, but this blocks abuse)
const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 200, 
  standardHeaders: true, 
  legacyHeaders: false,
  message: 'Too many webhook requests from this IP, please try again after a minute',
});

const webhookRouter = Router();

/**
 * GET /webhook
 * Meta sends a GET request to verify webhook ownership during setup.
 * Must return the challenge value with HTTP 200 if the verify token matches.
 */
webhookRouter.get('/webhook', verifyWebhook);

/**
 * POST /webhook
 * Meta sends a POST request for every WhatsApp event:
 * - Incoming messages (text, media, location, etc.)
 * - Message status updates (sent, delivered, read, failed)
 * - Errors
 */
webhookRouter.post('/webhook', webhookRateLimiter, handleIncomingWebhook);

export default webhookRouter;
