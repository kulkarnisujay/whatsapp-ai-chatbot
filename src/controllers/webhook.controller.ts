// ──────────────────────────────────────────────────────────────────────────────
// Webhook Controller — Handles Meta WhatsApp Cloud API webhook events
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import whatsappConfig from '../config/whatsapp.config';
import whatsAppService from '../services/whatsapp.service';
import {
  WhatsAppWebhookPayload,
  WhatsAppMessage,
  WhatsAppContact,
  WhatsAppStatus,
  SenderInfo,
} from '../types/whatsapp.types';

/**
 * Handles GET requests for Meta's webhook verification challenge.
 *
 * When you configure a webhook URL in the Meta Developer Dashboard,
 * Meta sends a GET request with three query parameters to verify ownership.
 * You must respond with the challenge value if the verify token matches.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks
 *
 * @param req - Express request with query params: hub.mode, hub.verify_token, hub.challenge
 * @param res - Express response — returns challenge as plain text on success, 403 on failure
 */
export function verifyWebhook(req: Request, res: Response): void {
  const mode = req.query['hub.mode'] as string | undefined;
  const token = req.query['hub.verify_token'] as string | undefined;
  const challenge = req.query['hub.challenge'] as string | undefined;

  console.log('🔐 Webhook verification attempt:');
  console.log(`   Mode:      ${mode}`);
  console.log(`   Token:     ${token ? '***' + token.slice(-4) : 'missing'}`);
  console.log(`   Challenge: ${challenge ? challenge.slice(0, 10) + '...' : 'missing'}`);

  if (mode === 'subscribe' && token === whatsappConfig.verifyToken) {
    console.log('✅ Webhook verification SUCCESSFUL');
    // Meta requires the challenge to be returned as plain text, NOT JSON
    res.status(200).send(challenge);
    return;
  }

  console.warn('❌ Webhook verification FAILED — token mismatch or invalid mode');
  res.status(403).json({
    error: 'Forbidden',
    message: 'Webhook verification failed. Invalid verify token.',
  });
}

/**
 * Handles POST requests from Meta's WhatsApp Cloud API webhook.
 *
 * CRITICAL: This handler IMMEDIATELY responds with HTTP 200 before processing.
 * Meta will retry the webhook call if it doesn't receive a 200 within ~15 seconds,
 * which can cause duplicate message processing.
 *
 * The payload structure is deeply nested:
 * body.entry[] → changes[] → value → { messages[], contacts[], statuses[] }
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
 *
 * @param req - Express request containing the webhook payload
 * @param res - Express response — immediately returns 200
 */
export function handleIncomingWebhook(req: Request, res: Response): void {
  // ⚡ IMMEDIATELY acknowledge receipt — Meta requires fast 200 response
  res.status(200).send('EVENT_RECEIVED');

  // Process asynchronously after responding
  try {
    const payload = req.body as WhatsAppWebhookPayload;

    // Validate this is a WhatsApp webhook event
    if (payload.object !== 'whatsapp_business_account') {
      console.log(`⚠️ Ignoring non-WhatsApp webhook event: object="${payload.object}"`);
      return;
    }

    // Guard: no entries
    if (!payload.entry || !Array.isArray(payload.entry) || payload.entry.length === 0) {
      console.log('⚠️ Webhook payload has no entries — ignoring');
      return;
    }

    // Process each entry
    for (const entry of payload.entry) {
      if (!entry.changes || !Array.isArray(entry.changes)) {
        console.log(`⚠️ Entry ${entry.id} has no changes — skipping`);
        continue;
      }

      for (const change of entry.changes) {
        if (change.field !== 'messages') {
          console.log(`ℹ️ Ignoring non-message change field: "${change.field}"`);
          continue;
        }

        const value = change.value;

        // Handle status updates (sent, delivered, read, failed)
        if (value.statuses && Array.isArray(value.statuses)) {
          handleStatusUpdates(value.statuses);
        }

        // Handle errors reported by Meta
        if (value.errors && Array.isArray(value.errors)) {
          for (const error of value.errors) {
            console.error(`🚨 WhatsApp Error [${error.code}]: ${error.title} — ${error.message}`);
          }
        }

        // Guard: no messages array (this is a status-only update)
        if (!value.messages || !Array.isArray(value.messages) || value.messages.length === 0) {
          continue;
        }

        // Build contact lookup map for sender info
        const contactMap = buildContactMap(value.contacts || []);

        // Process each message
        for (const message of value.messages) {
          const senderInfo: SenderInfo = {
            phoneNumber: message.from,
            profileName: contactMap.get(message.from) || 'Unknown',
          };

          console.log('');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`📩 New ${message.type} message`);
          console.log(`   From: ${senderInfo.profileName} (${senderInfo.phoneNumber})`);
          console.log(`   ID:   ${message.id}`);
          console.log(`   Time: ${new Date(parseInt(message.timestamp) * 1000).toISOString()}`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

          // Delegate to service for business logic processing
          processMessageAsync(message, senderInfo);
        }
      }
    }
  } catch (error) {
    // NEVER let an error crash the webhook handler
    console.error('🔥 Critical error processing webhook payload:', error);
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Processes a message asynchronously.
 * Wrapped to ensure errors are caught and logged without crashing the server.
 */
function processMessageAsync(message: WhatsAppMessage, senderInfo: SenderInfo): void {
  whatsAppService
    .processIncomingMessage(message, senderInfo)
    .catch((error: unknown) => {
      console.error(`🔥 Error processing message ${message.id}:`, error);
    });
}

/**
 * Handles message status updates (sent, delivered, read, failed).
 * Useful for tracking message delivery and engagement metrics.
 *
 * @param statuses - Array of status update objects from the webhook
 */
function handleStatusUpdates(statuses: WhatsAppStatus[]): void {
  for (const status of statuses) {
    const emoji =
      status.status === 'sent'
        ? '📤'
        : status.status === 'delivered'
          ? '📬'
          : status.status === 'read'
            ? '👁️'
            : '❌';

    console.log(
      `${emoji} Status update: message ${status.id} → ${status.status} (to: ${status.recipient_id})`
    );

    // Log delivery failures with error details
    if (status.status === 'failed' && status.errors) {
      for (const error of status.errors) {
        console.error(`   ❌ Delivery failure [${error.code}]: ${error.title} — ${error.message}`);
      }
    }
  }
}

/**
 * Builds a lookup map from WhatsApp contact array for quick sender name resolution.
 *
 * @param contacts - Array of WhatsApp contact objects from the webhook
 * @returns Map of wa_id → profile name
 */
function buildContactMap(contacts: WhatsAppContact[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const contact of contacts) {
    map.set(contact.wa_id, contact.profile.name);
  }
  return map;
}
