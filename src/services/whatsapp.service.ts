// ──────────────────────────────────────────────────────────────────────────────
// WhatsApp Service — Core Business Logic
// Handles message processing, sending replies, and read receipts.
// ──────────────────────────────────────────────────────────────────────────────

import axios, { AxiosError } from 'axios';
import whatsappConfig from '../config/whatsapp.config';
import aiService from './ai.service';
import leadService from './lead.service';
import { createLogger } from '../utils/logger';
import {
  WhatsAppMessage,
  SenderInfo,
  SendTextMessageBody,
  MarkAsReadBody,
} from '../types/whatsapp.types';

const log = createLogger('WhatsAppService');

class WhatsAppService {
  private readonly apiUrl: string;
  private readonly token: string;

  constructor() {
    this.apiUrl = whatsappConfig.messagesEndpoint;
    this.token = whatsappConfig.token;
  }

  /**
   * Routes an incoming WhatsApp message to the appropriate handler based on its type.
   * This is the primary entry point called by the webhook controller for each message.
   *
   * @param message - The parsed WhatsApp message object
   * @param senderInfo - Extracted sender details (phone number, profile name)
   */
  async processIncomingMessage(
    message: WhatsAppMessage,
    senderInfo: SenderInfo
  ): Promise<void> {
    const { type, id } = message;

    console.log(`📨 Processing ${type} message from ${senderInfo.profileName} (${senderInfo.phoneNumber})`);

    // Track this contact as a lead in the database
    const lead = leadService.findOrCreateLead(senderInfo.phoneNumber, senderInfo.profileName);

    // Extract message content for storage
    const messageContent = this.extractMessageContent(message);
    leadService.saveMessage(lead.id, 'inbound', type, messageContent, id);

    // Mark message as read immediately
    await this.markMessageAsRead(id);

    switch (type) {
      case 'text':
        await this.handleTextMessage(message, senderInfo);
        break;

      case 'image':
        await this.handleMediaMessage(message, senderInfo, 'image');
        break;

      case 'audio':
        await this.handleMediaMessage(message, senderInfo, 'audio');
        break;

      case 'video':
        await this.handleMediaMessage(message, senderInfo, 'video');
        break;

      case 'document':
        await this.handleMediaMessage(message, senderInfo, 'document');
        break;

      case 'sticker':
        await this.handleMediaMessage(message, senderInfo, 'sticker');
        break;

      case 'location':
        await this.handleLocationMessage(message, senderInfo);
        break;

      case 'contacts':
        await this.handleContactMessage(message, senderInfo);
        break;

      case 'interactive':
        await this.handleInteractiveMessage(message, senderInfo);
        break;

      case 'button':
        await this.handleButtonMessage(message, senderInfo);
        break;

      case 'reaction':
        console.log(`  😀 Reaction from ${senderInfo.phoneNumber}: ${message.reaction?.emoji}`);
        // Reactions don't typically require a response
        break;

      default:
        console.log(`  ⚠️ Unsupported message type: ${type}`);
        await this.sendTextMessage(
          senderInfo.phoneNumber,
          'Thanks for your message! We received it but this message type is not yet supported. Please send a text message.'
        );
        break;
    }
  }

  // ─── Message Type Handlers ────────────────────────────────────────────────

  /**
   * Handles incoming text messages using the AI-powered response engine.
   * Routes the message through Google Gemini for intelligent, context-aware replies.
   * Supports special commands: "reset" clears conversation history.
   */
  private async handleTextMessage(
    message: WhatsAppMessage,
    senderInfo: SenderInfo
  ): Promise<void> {
    const textBody = message.text?.body || '';
    log.info(`Text from ${senderInfo.profileName}: "${textBody}"`);

    // Auto-upgrade lead status from 'new' to 'engaged' after their 2nd message
    const lead = leadService.getLeadByPhone(senderInfo.phoneNumber);
    if (lead && lead.status === 'new' && lead.total_messages >= 2) {
      leadService.updateLeadInfo(senderInfo.phoneNumber, { status: 'engaged' });
      log.info(`Lead ${senderInfo.phoneNumber} upgraded: new → engaged`);
    }

    // Handle special commands
    const lowerText = textBody.toLowerCase().trim();
    if (lowerText === 'reset' || lowerText === 'start over' || lowerText === 'clear') {
      aiService.clearConversation(senderInfo.phoneNumber);
      await this.sendTextMessage(
        senderInfo.phoneNumber,
        '🔄 Conversation reset! Feel free to start fresh. How can I help you today?'
      );
      return;
    }

    // Generate AI-powered response
    const aiResponse = await aiService.generateResponse(
      textBody,
      senderInfo.phoneNumber,
      senderInfo.profileName
    );

    log.debug(`AI response (${aiResponse.length} chars): "${aiResponse.substring(0, 80)}..."`);

    await this.sendTextMessage(senderInfo.phoneNumber, aiResponse);
  }

  /**
   * Handles incoming media messages (image, audio, video, document, sticker).
   * Logs the media details and sends an acknowledgment.
   */
  private async handleMediaMessage(
    message: WhatsAppMessage,
    senderInfo: SenderInfo,
    mediaType: string
  ): Promise<void> {
    const media = message[mediaType as keyof WhatsAppMessage] as
      | { id: string; mime_type: string; caption?: string }
      | undefined;

    console.log(`  📎 ${mediaType}: id=${media?.id}, mime=${media?.mime_type}`);
    if (media && 'caption' in media && media.caption) {
      console.log(`     Caption: "${media.caption}"`);
    }

    await this.sendTextMessage(
      senderInfo.phoneNumber,
      `✅ We received your ${mediaType}. Thanks for sharing!`
    );
  }

  /**
   * Handles incoming location messages.
   */
  private async handleLocationMessage(
    message: WhatsAppMessage,
    senderInfo: SenderInfo
  ): Promise<void> {
    const loc = message.location;
    console.log(`  📍 Location: ${loc?.latitude}, ${loc?.longitude} — ${loc?.name || 'unnamed'}`);

    await this.sendTextMessage(
      senderInfo.phoneNumber,
      `📍 We received your location. Thanks for sharing!`
    );
  }

  /**
   * Handles incoming contact card messages.
   */
  private async handleContactMessage(
    message: WhatsAppMessage,
    senderInfo: SenderInfo
  ): Promise<void> {
    const contacts = message.contacts;
    console.log(`  👤 Contact card(s) received: ${contacts?.length || 0}`);

    await this.sendTextMessage(
      senderInfo.phoneNumber,
      `👤 We received your contact. Thanks for sharing!`
    );
  }

  /**
   * Handles interactive message replies (list selections, button clicks).
   */
  private async handleInteractiveMessage(
    message: WhatsAppMessage,
    senderInfo: SenderInfo
  ): Promise<void> {
    const interactive = message.interactive;
    console.log(`  🔘 Interactive (${interactive?.type}):`,
      interactive?.button_reply || interactive?.list_reply
    );

    const selection =
      interactive?.button_reply?.title ||
      interactive?.list_reply?.title ||
      'your selection';

    await this.sendTextMessage(
      senderInfo.phoneNumber,
      `✅ Got it! You selected: "${selection}". We'll process that for you.`
    );
  }

  /**
   * Handles quick reply button responses.
   */
  private async handleButtonMessage(
    message: WhatsAppMessage,
    senderInfo: SenderInfo
  ): Promise<void> {
    const button = message.button;
    console.log(`  🔲 Button reply: "${button?.text}" (payload: ${button?.payload})`);

    await this.sendTextMessage(
      senderInfo.phoneNumber,
      `✅ Got your response: "${button?.text}". Processing...`
    );
  }

  // ─── Outbound API Calls ───────────────────────────────────────────────────

  /**
   * Sends a text message to a WhatsApp user via the Cloud API.
   *
   * @param to - The recipient's phone number in international format (e.g., "919876543210")
   * @param message - The text content to send
   * @returns True if the message was sent successfully, false otherwise
   */
  async sendTextMessage(to: string, message: string): Promise<boolean> {
    const body: SendTextMessageBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    };

    try {
      const response = await axios.post(this.apiUrl, body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
      });

      console.log(`  ✅ Message sent to ${to} | Message ID: ${response.data?.messages?.[0]?.id}`);

      // Save outbound message to database
      try {
        const lead = leadService.getLeadByPhone(to);
        if (lead) {
          leadService.saveMessage(lead.id, 'outbound', 'text', message, response.data?.messages?.[0]?.id);
        }
      } catch (dbError) {
        log.warn('Failed to save outbound message to database:', dbError);
      }

      return true;
    } catch (error) {
      this.handleApiError('sendTextMessage', error);
      return false;
    }
  }

  /**
   * Marks a received message as "read" in WhatsApp (sends blue ticks).
   *
   * @param messageId - The ID of the message to mark as read
   */
  async markMessageAsRead(messageId: string): Promise<void> {
    const body: MarkAsReadBody = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };

    try {
      await axios.post(this.apiUrl, body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
      });
      console.log(`  👁️ Message ${messageId} marked as read`);
    } catch (error) {
      // Read receipts failing is non-critical — log but don't throw
      this.handleApiError('markMessageAsRead', error);
    }
  }

  // ─── Error Handling ───────────────────────────────────────────────────────

  /**
   * Handles and logs WhatsApp Cloud API errors with detailed context.
   *
   * @param method - Name of the method where the error occurred
   * @param error - The caught error object
   */
  private handleApiError(method: string, error: unknown): void {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const data = error.response?.data;
      console.error(`  ❌ WhatsApp API Error in ${method}:`);
      console.error(`     Status: ${status}`);
      console.error(`     Response:`, JSON.stringify(data, null, 2));

      // Log specific Meta error codes for debugging
      const metaError = data?.error;
      if (metaError) {
        console.error(`     Meta Error Code: ${metaError.code}`);
        console.error(`     Meta Error Type: ${metaError.type}`);
        console.error(`     Meta Error Message: ${metaError.message}`);
      }
    } else if (error instanceof Error) {
      console.error(`  ❌ Error in ${method}: ${error.message}`);
    } else {
      console.error(`  ❌ Unknown error in ${method}:`, error);
    }
  }

  // ─── Utility Methods ───────────────────────────────────────────────────────

  /**
   * Extracts a human-readable content string from any message type.
   * Used for storing messages in the conversation history.
   */
  private extractMessageContent(message: WhatsAppMessage): string {
    switch (message.type) {
      case 'text':
        return message.text?.body || '';
      case 'image':
        return message.image?.caption || '[Image]';
      case 'audio':
        return '[Audio message]';
      case 'video':
        return message.video?.caption || '[Video]';
      case 'document':
        return message.document?.filename || '[Document]';
      case 'sticker':
        return '[Sticker]';
      case 'location':
        return `[Location: ${message.location?.latitude}, ${message.location?.longitude}]`;
      case 'contacts':
        return `[Contact: ${message.contacts?.[0]?.name?.formatted_name || 'Unknown'}]`;
      case 'interactive':
        return message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '[Interactive]';
      case 'button':
        return message.button?.text || '[Button reply]';
      case 'reaction':
        return message.reaction?.emoji || '[Reaction]';
      default:
        return `[${message.type}]`;
    }
  }
}

// Export a singleton instance
export const whatsAppService = new WhatsAppService();
export default whatsAppService;
