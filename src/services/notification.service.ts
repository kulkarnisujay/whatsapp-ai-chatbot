import axios from 'axios';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationService');

/**
 * Handles real-time alerts to Slack or Discord via Webhooks.
 * Completely optional — if no webhook is configured, it fails gracefully
 * without breaking the main bot flow.
 */
export class NotificationService {
  private readonly webhookUrl: string;
  private readonly platform: 'slack' | 'discord';

  constructor() {
    this.webhookUrl = process.env['NOTIFICATION_WEBHOOK_URL'] || '';
    this.platform = (process.env['NOTIFICATION_PLATFORM'] || 'slack').toLowerCase() as 'slack' | 'discord';
  }

  /** Gets whether notifications are actively configured */
  public isConfigured(): boolean {
    return this.webhookUrl.trim().length > 0;
  }

  /**
   * Alert when a brand new lead starts a conversation.
   */
  async notifyNewLead(name: string, phone: string): Promise<void> {
    const title = `🚨 New Lead: ${name}`;
    const message = `A new user just started chatting with Aria!\n\n📞 **Phone:** ${phone}\n⏰ **Time:** ${new Date().toLocaleTimeString()}`;
    await this.sendNotification(title, message, '#3b82f6'); // Blue
  }

  /**
   * Alert when a lead provides their email address.
   */
  async notifyEmailCaptured(name: string, email: string, phone: string): Promise<void> {
    const title = `📧 Email Captured!`;
    const message = `🔥 **${name}** just shared their email address.\n\n✉️ **Email:** ${email}\n📞 **Phone:** ${phone}\n\nThe company brochure was automatically sent to them.`;
    await this.sendNotification(title, message, '#10b981'); // Green
  }

  /**
   * Alert when a lead is highly engaged (e.g. asked about pricing).
   */
  async notifyHighIntent(name: string, intent: string, phone: string): Promise<void> {
    const title = `🔥 High Intent Detected`;
    const message = `**${name}** just triggered a high-intent action: **${intent}**\n\n📞 **Phone:** ${phone}\n\nYou might want to jump into this conversation manually!`;
    await this.sendNotification(title, message, '#fbbf24'); // Yellow
  }

  /**
   * Internal method to format and send the webhook based on the platform.
   */
  private async sendNotification(title: string, message: string, colorHex: string): Promise<void> {
    if (!this.isConfigured()) {
      log.debug('Notification skipped: No Webhook URL configured.');
      return;
    }

    try {
      let payload: any = {};

      if (this.platform === 'slack') {
        // Slack Block Kit Format
        payload = {
          text: title, // Fallback text
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: title,
                emoji: true
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: message.replace(/\*\*/g, '*') // Slack uses single asterisks for bold
              }
            }
          ]
        };
      } else {
        // Discord Embed Format
        const colorInt = parseInt(colorHex.replace('#', ''), 16);
        payload = {
          embeds: [
            {
              title: title,
              description: message,
              color: isNaN(colorInt) ? 3447003 : colorInt,
              timestamp: new Date().toISOString()
            }
          ]
        };
      }

      await axios.post(this.webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000 // Ensure these fires quickly and don't hang
      });

      log.info(`Notification sent to ${this.platform}: ${title}`);

    } catch (error: any) {
      // We explicitly catch all errors so it never halts the user's WhatsApp flow
      log.warn(`Failed to send ${this.platform} notification:`, error.message);
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
