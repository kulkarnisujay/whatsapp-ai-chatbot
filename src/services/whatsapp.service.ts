// ──────────────────────────────────────────────────────────────────────────────
// WhatsApp Service — Core Business Logic
// Handles message processing, sending replies, and read receipts.
// ──────────────────────────────────────────────────────────────────────────────

import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import whatsappConfig from '../config/whatsapp.config';

// ─── Global Axios Configuration for Meta API Reliability ──────────────
// Automatically retries failed API calls (like 5xx errors or network timeouts) 
// up to 3 times before finally failing, using an exponential backoff strategy.
axiosRetry(axios, { 
  retries: 3, 
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on network errors or 5xx server errors
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
  }
});
import aiService from './ai.service';
import leadService from './lead.service';
import emailService from './email.service';
import notificationService from './notification.service';
import { createLogger } from '../utils/logger';
import {
  WhatsAppMessage,
  SenderInfo,
  SendTextMessageBody,
  SendButtonMessageBody,
  SendListMessageBody,
  MarkAsReadBody,
  SendTypingIndicatorBody,
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
   * Main entry point for processing incoming messages.
   * Tracks the message in the database, extracts essential details,
   * handles different message types, and logs actions.
   */
  async processIncomingMessage(
    message: WhatsAppMessage,
    senderInfo: SenderInfo
  ): Promise<void> {
    const { type, id } = message;

    console.log(`📨 Processing ${type} message from ${senderInfo.profileName} (${senderInfo.phoneNumber})`);

    // Track this contact as a lead in the database
    const lead = leadService.findOrCreateLead(senderInfo.phoneNumber, senderInfo.profileName);

    // Show "typing..." indicator so the bot feels human while processing/generating response
    await this.sendTypingIndicator(senderInfo.phoneNumber);

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
    if (!lead) return; // Should never happen since handled in processIncomingMessage

    // Slack/Discord Notification and Scoring for brand new lead
    if (lead.total_messages === 1) {
      notificationService.notifyNewLead(senderInfo.profileName, senderInfo.phoneNumber);
      leadService.addLeadScore(senderInfo.phoneNumber, 10, 'first_message');
    } else {
      leadService.addLeadScore(senderInfo.phoneNumber, 3, 'message_sent');
    }

    if (lead.status === 'new' && lead.total_messages >= 2) {
      leadService.updateLeadInfo(senderInfo.phoneNumber, { status: 'engaged' });
      leadService.addLeadScore(senderInfo.phoneNumber, 10, 'status_engaged');
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

    // ─── Welcome Sequence (Forced for New Users) ───────────────────────
    // If this is their very first message, always send the welcome menu regardless of what they said.
    const greetings = ['hi', 'hello', 'hey', 'start', 'menu', 'hola', 'help', 'get started'];
    const isGreeting = greetings.includes(lowerText);
    
    if (lead && lead.total_messages === 1) {
      log.info(`👋 First-time user detected. Forcing Welcome Sequence for ${senderInfo.profileName}`);
      await this.sendWelcomeMenu(senderInfo.phoneNumber, senderInfo.profileName);
      return;
    }

    // They are not brand new, but specifically asked for the menu
    if (isGreeting) {
      log.info(`🔄 Greeting received from ${senderInfo.profileName}. Clearing AI conversation history for a fresh start.`);
      aiService.clearConversation(senderInfo.phoneNumber);
      await this.sendWelcomeMenu(senderInfo.phoneNumber, senderInfo.profileName);
      return;
    }

    // Quick keyword triggers for menus
    if (lowerText === 'pricing' || lowerText === 'prices' || lowerText === 'cost' || lowerText === 'packages') {
      notificationService.notifyHighIntent(senderInfo.profileName, 'Checked Pricing', senderInfo.phoneNumber);
      leadService.addLeadScore(senderInfo.phoneNumber, 15, 'pricing_inquiry');
      await this.sendPricingList(senderInfo.phoneNumber);
      return;
    }
    if (lowerText === 'services' || lowerText === 'what do you do' || lowerText === 'offerings') {
      await this.sendServicesMenu(senderInfo.phoneNumber);
      return;
    }
    if (lowerText === 'book' || lowerText === 'call' || lowerText === 'schedule' || lowerText === 'demo') {
      notificationService.notifyHighIntent(senderInfo.profileName, 'Requested Call', senderInfo.phoneNumber);
      leadService.addLeadScore(senderInfo.phoneNumber, 20, 'requested_call');
      await this.sendBookingInfo(senderInfo.phoneNumber, senderInfo.profileName);
      return;
    }

    // ─── Email Detection & Brochure Sending ──────────────────────────
    // IMPORTANT: This runs BEFORE the AI so the LLM never sees email messages
    const detectedEmail = emailService.extractEmail(textBody);
    if (detectedEmail) {
      log.info(`📧 Email detected from ${senderInfo.profileName}: ${detectedEmail}`);

      // Save email to the lead record
      leadService.updateLeadInfo(senderInfo.phoneNumber, { email: detectedEmail, status: 'qualified' });
      leadService.addLeadScore(senderInfo.phoneNumber, 25, 'email_shared');
      leadService.addLeadScore(senderInfo.phoneNumber, 15, 'status_qualified');

      // Trigger Webhook Notification
      notificationService.notifyEmailCaptured(senderInfo.profileName, detectedEmail, senderInfo.phoneNumber);

      // IMMEDIATELY respond to the user so they don't have to wait for SMTP connection
      await this.sendTextMessage(
        senderInfo.phoneNumber,
        `📧 Thanks for sharing your email (*${detectedEmail}*)!\n\nI'm sending over our detailed services and packages right now. 🚀`
      );

      // Send company brochure email asynchronously in the background
      emailService.sendCompanyBrochure(detectedEmail, senderInfo.profileName)
        .then(async (emailSent) => {
          if (emailSent) {
            await this.sendTextMessage(
              senderInfo.phoneNumber,
              `✅ The email has been sent successfully!\nPlease check your inbox (and spam folder, just in case). 😊\n\nIs there anything specific you'd like to discuss?`
            );
          } else {
            log.error(`❌ Email service returned false for ${detectedEmail}`);
            await this.sendTextMessage(
              senderInfo.phoneNumber,
              `⚠️ I wasn't able to send the email right now due to a temporary issue. Our team has been notified and will send it to you manually shortly. Sorry about that!`
            );
          }
        })
        .catch(async (emailError) => {
          log.error(`❌ Email sending crashed for ${detectedEmail}:`, emailError);
          await this.sendTextMessage(
            senderInfo.phoneNumber,
            `⚠️ I wasn't able to send the email right now due to a temporary issue. Our team has been notified and will send it to you manually shortly. Sorry about that!`
          );
        });

      // ALWAYS return here — never let email messages reach the AI
      return;
    }

    // ─── Generate AI-powered response ────────────────────────────────
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
   * Routes button/list selections to the appropriate response flow.
   */
  private async handleInteractiveMessage(
    message: WhatsAppMessage,
    senderInfo: SenderInfo
  ): Promise<void> {
    const interactive = message.interactive;
    const buttonId = interactive?.button_reply?.id;
    const listId = interactive?.list_reply?.id;
    const selectionId = buttonId || listId;
    const selectionTitle = interactive?.button_reply?.title || interactive?.list_reply?.title || 'your selection';

    log.info(`🔘 Interactive from ${senderInfo.profileName}: ${selectionId} ("${selectionTitle}")`);

    if (buttonId) {
      leadService.addLeadScore(senderInfo.phoneNumber, 5, 'button_click');
    } else if (listId) {
      leadService.addLeadScore(senderInfo.phoneNumber, 5, 'list_selection');
    }

    switch (selectionId) {
      // ─── Main Menu Buttons ─────────────────────────────────────────
      case 'menu_services':
        await this.sendServicesMenu(senderInfo.phoneNumber);
        break;

      case 'menu_pricing':
        await this.sendPricingList(senderInfo.phoneNumber);
        break;

      case 'menu_call':
        await this.sendBookingInfo(senderInfo.phoneNumber, senderInfo.profileName);
        break;

      // ─── Pricing Package Selections ────────────────────────────────
      case 'pkg_basic':
        await this.sendTextMessage(senderInfo.phoneNumber,
          `🟢 *Basic Package — $499*\n\n` +
          `Perfect for startups and small businesses!\n\n` +
          `• Simple AI chatbot or landing page\n` +
          `• 1 round of revisions\n` +
          `• 2-week delivery\n` +
          `• Basic analytics dashboard\n\n` +
          `_Want to get started?_ Share your email and we'll send you the full proposal! 📧`
        );
        break;

      case 'pkg_pro':
        await this.sendTextMessage(senderInfo.phoneNumber,
          `⭐ *Pro Package — $999* (Most Popular!)\n\n` +
          `Our best value for growing businesses!\n\n` +
          `• AI chatbot + CRM dashboard\n` +
          `• 3 rounds of revisions\n` +
          `• Priority support channel\n` +
          `• 3-week delivery\n` +
          `• Advanced analytics & lead scoring\n\n` +
          `_Ready to level up?_ Drop your email and I'll send the full breakdown! 📧`
        );
        break;

      case 'pkg_enterprise':
        await this.sendTextMessage(senderInfo.phoneNumber,
          `🏆 *Enterprise Package — Custom Pricing*\n\n` +
          `Built for scale and complexity!\n\n` +
          `• Full-stack SaaS platform\n` +
          `• Dedicated project manager\n` +
          `• Unlimited revisions\n` +
          `• Custom timeline & integrations\n` +
          `• 24/7 priority support\n\n` +
          `_Let's discuss your vision!_ Book a free call or share your email to get started. 🚀`
        );
        break;

      // ─── Service Selections ────────────────────────────────────────
      case 'svc_chatbots':
        await this.sendTextMessage(senderInfo.phoneNumber,
          `🤖 *AI Chatbot Development*\n\n` +
          `We build intelligent chatbots for:\n\n` +
          `• WhatsApp Business automation\n` +
          `• Customer support & FAQ bots\n` +
          `• Lead generation & qualification\n` +
          `• E-commerce order tracking\n` +
          `• Multi-language support\n\n` +
          `Powered by GPT, Gemini, or LLaMA — your choice!\n\n` +
          `Would you like to see pricing or book a free consultation? 💬`
        );
        break;

      case 'svc_webapps':
        await this.sendTextMessage(senderInfo.phoneNumber,
          `🌐 *Web Application Development*\n\n` +
          `We craft modern web experiences:\n\n` +
          `• React / Next.js frontends\n` +
          `• Node.js / Python backends\n` +
          `• SaaS platforms & dashboards\n` +
          `• Landing pages that convert\n` +
          `• Mobile-responsive design\n\n` +
          `Recent project: Increased a client's leads by *40%* with a new landing page! 📈\n\n` +
          `Want to discuss your project? 🚀`
        );
        break;

      case 'svc_automation':
        await this.sendTextMessage(senderInfo.phoneNumber,
          `⚡ *Business Automation Systems*\n\n` +
          `We automate the boring stuff:\n\n` +
          `• CRM & workflow automation\n` +
          `• Email marketing sequences\n` +
          `• Data pipeline & reporting\n` +
          `• Payment & invoicing systems\n` +
          `• API integrations\n\n` +
          `_Save 10+ hours/week_ with smart automation!\n\n` +
          `Ready to automate? Let's chat! ⚙️`
        );
        break;

      // ─── Back to Menu ──────────────────────────────────────────────
      case 'back_menu':
        await this.sendWelcomeMenu(senderInfo.phoneNumber, senderInfo.profileName);
        break;

      // ─── Default: Send to AI ───────────────────────────────────────
      default:
        log.info(`Unknown interactive selection: ${selectionId} — routing to AI`);
        const aiResponse = await aiService.generateResponse(
          `I selected: ${selectionTitle}`,
          senderInfo.phoneNumber,
          senderInfo.profileName
        );
        await this.sendTextMessage(senderInfo.phoneNumber, aiResponse);
        break;
    }
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

  // ─── Outbound API Calls & Actions ──────────────────────────────────────────

  /**
   * Turns on the WhatsApp "typing..." indicator for the user.
   */
  async sendTypingIndicator(to: string): Promise<boolean> {
    const body: SendTypingIndicatorBody = {
      messaging_product: 'whatsapp',
      to,
      type: 'system',
      system: { action: 'typing_on' }
    };

    try {
      await axios.post(this.apiUrl, body, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });
      return true;
    } catch {
      // Silent catch, typing indicators are non-critical
      return false;
    }
  }

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
    } catch (error: unknown) {
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

  // ─── Interactive Message Methods ──────────────────────────────────────────

  /**
   * Sends an interactive button message (max 3 reply buttons).
   *
   * @param to - Recipient phone number
   * @param bodyText - Main message body text
   * @param buttons - Array of {id, title} (max 3, title max 20 chars)
   * @param headerText - Optional header text
   * @param footerText - Optional footer text
   */
  async sendButtonMessage(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    headerText?: string,
    footerText?: string
  ): Promise<boolean> {
    const body: SendButtonMessageBody = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        ...(headerText && { header: { type: 'text' as const, text: headerText } }),
        body: { text: bodyText },
        ...(footerText && { footer: { text: footerText } }),
        action: {
          buttons: buttons.slice(0, 3).map(btn => ({
            type: 'reply' as const,
            reply: { id: btn.id, title: btn.title.substring(0, 20) },
          })),
        },
      },
    };

    try {
      const response = await axios.post(this.apiUrl, body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
      });

      log.info(`📋 Button message sent to ${to} | ID: ${response.data?.messages?.[0]?.id}`);

      // Save outbound message to database
      try {
        const lead = leadService.getLeadByPhone(to);
        if (lead) {
          const btnLabels = buttons.map(b => b.title).join(', ');
          leadService.saveMessage(lead.id, 'outbound', 'interactive', `[Buttons: ${btnLabels}] ${bodyText}`, response.data?.messages?.[0]?.id);
        }
      } catch (dbError) {
        log.warn('Failed to save button message to database:', dbError);
      }

      return true;
    } catch (error) {
      this.handleApiError('sendButtonMessage', error);
      return false;
    }
  }

  /**
   * Sends an interactive list message (scrollable menu).
   *
   * @param to - Recipient phone number
   * @param bodyText - Main message body text
   * @param buttonLabel - Label for the menu button (max 20 chars)
   * @param sections - Array of sections with rows
   * @param headerText - Optional header text
   * @param footerText - Optional footer text
   */
  async sendListMessage(
    to: string,
    bodyText: string,
    buttonLabel: string,
    sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>,
    headerText?: string,
    footerText?: string
  ): Promise<boolean> {
    const body: SendListMessageBody = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        ...(headerText && { header: { type: 'text' as const, text: headerText } }),
        body: { text: bodyText },
        ...(footerText && { footer: { text: footerText } }),
        action: {
          button: buttonLabel.substring(0, 20),
          sections: sections.map(section => ({
            title: section.title,
            rows: section.rows.map(row => ({
              id: row.id,
              title: row.title.substring(0, 24),
              ...(row.description && { description: row.description.substring(0, 72) }),
            })),
          })),
        },
      },
    };

    try {
      const response = await axios.post(this.apiUrl, body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
      });

      log.info(`📜 List message sent to ${to} | ID: ${response.data?.messages?.[0]?.id}`);

      // Save outbound message to database
      try {
        const lead = leadService.getLeadByPhone(to);
        if (lead) {
          leadService.saveMessage(lead.id, 'outbound', 'interactive', `[List: ${buttonLabel}] ${bodyText}`, response.data?.messages?.[0]?.id);
        }
      } catch (dbError) {
        log.warn('Failed to save list message to database:', dbError);
      }

      return true;
    } catch (error) {
      this.handleApiError('sendListMessage', error);
      return false;
    }
  }

  /**
   * Sends the main welcome menu with quick-action buttons.
   */
  async sendWelcomeMenu(to: string, profileName: string): Promise<boolean> {
    return this.sendButtonMessage(
      to,
      `Hey ${profileName}! 👋 I'm *Aria*, your AI assistant.\n\nI can help you with:\n\n• Explore our *services*\n• Check out *pricing* & packages\n• Book a *free discovery call*\n\nTap a button below to get started! 👇`,
      [
        { id: 'menu_services', title: '📋 Our Services' },
        { id: 'menu_pricing', title: '💰 View Pricing' },
        { id: 'menu_call', title: '📞 Book Free Call' },
      ],
      '🤖 Welcome to Aria!',
      'Powered by AI • Available 24/7'
    );
  }

  /**
   * Sends the pricing packages as a scrollable list.
   */
  async sendPricingList(to: string): Promise<boolean> {
    return this.sendListMessage(
      to,
      `Here are our packages tailored for businesses of all sizes! 🎯\n\nEach package includes a *free consultation* to understand your needs.`,
      '📦 View Packages',
      [
        {
          title: '💼 Service Packages',
          rows: [
            { id: 'pkg_basic', title: '🟢 Basic — $499', description: 'Chatbot or landing page • 2-week delivery' },
            { id: 'pkg_pro', title: '⭐ Pro — $999', description: 'AI chatbot + CRM • Priority support • 3 weeks' },
            { id: 'pkg_enterprise', title: '🏆 Enterprise', description: 'Custom pricing • Full SaaS • Dedicated PM' },
          ],
        },
      ],
      '💰 Our Pricing',
      'All packages include free discovery call'
    );
  }

  /**
   * Sends the services overview as a scrollable list.
   */
  async sendServicesMenu(to: string): Promise<boolean> {
    return this.sendListMessage(
      to,
      `We specialize in *AI-powered software solutions* that help businesses grow! 🚀\n\nTap below to learn more about each service.`,
      '🔍 Explore Services',
      [
        {
          title: '🛠️ What We Build',
          rows: [
            { id: 'svc_chatbots', title: '🤖 AI Chatbots', description: 'WhatsApp, Telegram & web bots with smart AI' },
            { id: 'svc_webapps', title: '🌐 Web Applications', description: 'React, Node.js, SaaS platforms & dashboards' },
            { id: 'svc_automation', title: '⚡ Automation', description: 'CRM, email workflows & data pipelines' },
          ],
        },
      ],
      '📋 Our Services',
      'Tap a service to learn more'
    );
  }

  /**
   * Sends booking/call information with action buttons.
   */
  async sendBookingInfo(to: string, profileName: string): Promise<boolean> {
    let calendlyUrl = process.env['CALENDLY_URL'] || '';
    if (calendlyUrl.includes('/app/')) calendlyUrl = '';

    if (calendlyUrl) {
      // Send text with the actual booking link
      await this.sendTextMessage(
        to,
        `🎉 Great choice, ${profileName}!\n\n` +
        `Here's your *free 30-minute discovery call* link:\n\n` +
        `🔗 ${calendlyUrl}\n\n` +
        `🕐 Duration: 30 minutes\n` +
        `💰 Cost: Absolutely *FREE*\n` +
        `📍 Format: Google Meet / Zoom\n\n` +
        `Pick any slot that works for you! We currently have *2 slots open* this week. ⏰`
      );
    } else {
      await this.sendTextMessage(
        to,
        `📞 I'd love to set up a call for you, ${profileName}!\n\n` +
        `Here's what to expect:\n\n` +
        `🕐 Duration: 30 minutes\n` +
        `💰 Cost: Absolutely *FREE*\n` +
        `📍 Format: Google Meet / Zoom\n\n` +
        `What day and time works best for you this week? I'll get it scheduled! 📅`
      );
    }

    return this.sendButtonMessage(
      to,
      `Need anything else while I set this up?`,
      [
        { id: 'menu_pricing', title: '💰 See Pricing' },
        { id: 'back_menu', title: '🏠 Main Menu' },
      ]
    );
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
