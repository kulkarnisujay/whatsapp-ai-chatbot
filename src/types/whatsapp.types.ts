// ──────────────────────────────────────────────────────────────────────────────
// WhatsApp Cloud API — Webhook Payload Type Definitions
// Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
// ──────────────────────────────────────────────────────────────────────────────

// ─── Message Content Types ────────────────────────────────────────────────────

/** Text message content */
export interface TextMessage {
  body: string;
}

/** Media message content (images, audio, video, documents, stickers) */
export interface MediaMessage {
  id: string;
  mime_type: string;
  sha256: string;
  caption?: string;
  filename?: string;
}

/** Location message content */
export interface LocationMessage {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

/** Interactive message reply (list replies, button replies) */
export interface InteractiveMessage {
  type: 'button_reply' | 'list_reply';
  button_reply?: {
    id: string;
    title: string;
  };
  list_reply?: {
    id: string;
    title: string;
    description?: string;
  };
}

/** Quick reply button message */
export interface ButtonMessage {
  payload: string;
  text: string;
}

/** Reaction message content */
export interface ReactionMessage {
  message_id: string;
  emoji: string;
}

/** Contact card message */
export interface ContactMessage {
  name: {
    formatted_name: string;
    first_name?: string;
    last_name?: string;
  };
  phones?: Array<{
    phone: string;
    type: string;
    wa_id?: string;
  }>;
}

/** Referral info (when message comes from an ad click) */
export interface ReferralMessage {
  source_url: string;
  source_type: string;
  source_id: string;
  headline: string;
  body?: string;
  media_type?: string;
  image_url?: string;
  video_url?: string;
}

// ─── Core Message Types ───────────────────────────────────────────────────────

/** Supported WhatsApp message types */
export type WhatsAppMessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'interactive'
  | 'button'
  | 'reaction'
  | 'order'
  | 'unknown';

/**
 * An individual WhatsApp message received via webhook.
 * The type field determines which optional content field is populated.
 */
export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: WhatsAppMessageType;
  text?: TextMessage;
  image?: MediaMessage;
  audio?: MediaMessage;
  video?: MediaMessage;
  document?: MediaMessage;
  sticker?: MediaMessage;
  location?: LocationMessage;
  contacts?: ContactMessage[];
  interactive?: InteractiveMessage;
  button?: ButtonMessage;
  reaction?: ReactionMessage;
  referral?: ReferralMessage;
  context?: {
    message_id: string;
    from: string;
  };
  errors?: Array<{
    code: number;
    title: string;
    message: string;
    error_data?: {
      details: string;
    };
  }>;
}

// ─── Contact Info ─────────────────────────────────────────────────────────────

/** Contact information for the message sender */
export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

// ─── Status Updates ───────────────────────────────────────────────────────────

/** Possible message delivery statuses */
export type WhatsAppStatusType = 'sent' | 'delivered' | 'read' | 'failed';

/** Message status update from WhatsApp */
export interface WhatsAppStatus {
  id: string;
  status: WhatsAppStatusType;
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin: {
      type: string;
    };
    expiration_timestamp?: string;
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: Array<{
    code: number;
    title: string;
    message: string;
    error_data?: {
      details: string;
    };
  }>;
}

// ─── Webhook Payload Structure ────────────────────────────────────────────────

/** The value object inside each change — contains messages, statuses, or both */
export interface WhatsAppValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
  errors?: Array<{
    code: number;
    title: string;
    message: string;
    error_data?: {
      details: string;
    };
  }>;
}

/** Each change within an entry */
export interface WhatsAppChange {
  field: string;
  value: WhatsAppValue;
}

/** Each entry in the webhook payload */
export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

/**
 * Top-level webhook payload from Meta's WhatsApp Cloud API.
 * Every webhook POST from Meta follows this structure.
 */
export interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppEntry[];
}

// ─── Outbound Message Types ───────────────────────────────────────────────────

/** Outbound text message request body */
export interface SendTextMessageBody {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: {
    preview_url: boolean;
    body: string;
  };
}

/** Mark-as-read request body */
export interface MarkAsReadBody {
  messaging_product: 'whatsapp';
  status: 'read';
  message_id: string;
}

/** Sender info extracted from webhook for convenience */
export interface SenderInfo {
  phoneNumber: string;
  profileName: string;
}
