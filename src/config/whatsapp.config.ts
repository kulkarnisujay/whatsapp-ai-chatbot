// ──────────────────────────────────────────────────────────────────────────────
// WhatsApp Cloud API — Configuration
// Separated from env.ts to keep the core env config untouched.
// ──────────────────────────────────────────────────────────────────────────────

import env from './env';

/**
 * Retrieves and validates the WhatsApp Phone Number ID from environment.
 * This is the ID of your WhatsApp Business phone number, NOT the phone number itself.
 * Found in: Meta Developer Dashboard → WhatsApp → API Setup → Phone number ID
 */
function getPhoneNumberId(): string {
  const phoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'];
  if (!phoneNumberId || phoneNumberId.trim() === '') {
    throw new Error(
      '❌ Missing required environment variable: WHATSAPP_PHONE_NUMBER_ID. ' +
      'Get this from Meta Developer Dashboard → WhatsApp → API Setup.'
    );
  }
  return phoneNumberId;
}

/** WhatsApp Cloud API configuration */
const whatsappConfig = {
  /** The permanent access token for WhatsApp Cloud API */
  token: env.WHATSAPP_TOKEN,

  /** The webhook verification token (must match what you set in Meta Dashboard) */
  verifyToken: env.VERIFY_TOKEN,

  /** Your WhatsApp Business phone number ID */
  phoneNumberId: getPhoneNumberId(),

  /** Base URL for WhatsApp Cloud API */
  apiBaseUrl: 'https://graph.facebook.com/v21.0',

  /**
   * Full messages endpoint URL.
   * Used for sending messages and marking as read.
   */
  get messagesEndpoint(): string {
    return `${this.apiBaseUrl}/${this.phoneNumberId}/messages`;
  },
} as const;

export default whatsappConfig;
