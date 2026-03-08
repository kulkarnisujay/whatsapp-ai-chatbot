// ──────────────────────────────────────────────────────────────────────────────
// Webhook Routes — Maps HTTP endpoints to webhook controller handlers
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { verifyWebhook, handleIncomingWebhook } from '../controllers/webhook.controller';

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
webhookRouter.post('/webhook', handleIncomingWebhook);

export default webhookRouter;
