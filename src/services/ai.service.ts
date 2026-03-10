// ──────────────────────────────────────────────────────────────────────────────
// AI Service — Google Gemini-Powered Conversational Engine
// Handles conversation memory, rate limiting, and graceful error fallbacks.
// ──────────────────────────────────────────────────────────────────────────────

import Groq from 'groq-sdk';
import aiConfig from '../config/ai.config';
import { createLogger } from '../utils/logger';

const log = createLogger('AIService');

// ─── Types ────────────────────────────────────────────────────────────────────

/** Stored conversation data for a user */
interface ConversationEntry {
  /** The message history */
  messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }>;
  /** Timestamp of the last interaction */
  lastActivity: number;
  /** The sender's display name */
  senderName: string;
  /** Number of messages exchanged in this session */
  messageCount: number;
}

// ─── System Prompt ────────────────────────────────────────────────────────────

/**
 * The system prompt that defines the AI assistant's persona.
 * Designed for lead engagement and marketing — customize for your business.
 */
const SYSTEM_PROMPT = `You are a friendly, professional marketing and customer engagement assistant for a business. Your name is "Aria" and you communicate via WhatsApp.

## ABSOLUTE RULES (VIOLATION = FAILURE):
1. NEVER claim you sent an email, PDF, document, or file. You CANNOT send emails.
2. NEVER claim you booked a call or scheduled anything. You CANNOT access calendars.
3. NEVER say "I'll send you" or "Let me email that". Instead say "Please share your email and I'll have our team send it!"
4. NEVER make up information. If you don't know, say "Let me connect you with our team for that!"
5. NEVER write paragraphs. Every response must be 1 to 3 short sentences MAX.
6. ALWAYS use bullet points (•) if listing 2 or more items.
7. ALWAYS use 2 to 4 emojis per message.
8. Use *bold* for important keywords (prices, names, services).
9. NEVER exceed 80 words in a single response.
10. NEVER use headers (#), tables, or complex markdown — WhatsApp won't render them.

## Your Personality:
- Warm, approachable, and energetic!
- Professional but conversational.
- Direct to the point. No fluff.

## Your Primary Goals:
1. Greet warmly and make them feel valued.
2. Ask ONE relevant question to understand their need.
3. Naturally ask for their email: "Would you like me to have our team email you the details? Just share your email! 📧"
4. Suggest a *free 30-minute discovery call*.

## COMPANY KNOWLEDGE BASE:
- We build AI chatbots, stunning web apps, and automated systems.
- Packages: *Basic ($499)*, *Pro ($999)*, *Enterprise (Custom Pricing)*.
- Hours: 9 AM to 5 PM EST, Mon - Fri.
- No refunds once development begins.
- Average project delivery: 2-4 weeks.

If asked something outside this knowledge base, say: "Great question! Let me have a specialist follow up with you on that. 🙌"`;

// ─── AI Service Class ─────────────────────────────────────────────────────────

class AIService {
  private readonly groq: Groq;
  private readonly conversations: Map<string, ConversationEntry>;
  private readonly requestTimestamps: number[];
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.groq = new Groq({ apiKey: aiConfig.apiKey });

    this.conversations = new Map();
    this.requestTimestamps = [];

    // Start the TTL cleanup timer
    this.startCleanupTimer();

    log.info('AI Service initialized with Groq (free tier)');
    log.info(`Model: ${aiConfig.model} | Max Tokens: ${aiConfig.maxTokens} | Rate Limit: ${aiConfig.rateLimitRPM} RPM`);
  }

  // ─── Public Methods ─────────────────────────────────────────────────────

  /**
   * Generates an AI response for a user's message, maintaining conversation context.
   *
   * This method:
   * 1. Checks rate limits (stays within free tier)
   * 2. Retrieves or creates a chat session for the user
   * 3. Sends the message to Gemini and gets a response
   * 4. Returns the response text, or a fallback on failure
   *
   * @param userMessage - The text message from the user
   * @param senderPhone - The sender's phone number (used as session key)
   * @param senderName - The sender's WhatsApp profile name
   * @returns The AI-generated response text
   */
  async generateResponse(
    userMessage: string,
    senderPhone: string,
    senderName: string
  ): Promise<string> {
    try {
      // Check rate limit before making the API call
      await this.enforceRateLimit();

      // Get or create conversation session
      const conversation = this.getOrCreateConversation(senderPhone, senderName);

      log.debug(`Sending message to Groq for ${senderPhone} (session messages: ${conversation.messageCount})`);

      // Send message to Groq
      conversation.messages.push({ role: 'user', content: userMessage });

      const completion = await this.groq.chat.completions.create({
        messages: conversation.messages as any,
        model: aiConfig.model,
        temperature: aiConfig.temperature,
        top_p: aiConfig.topP,
        max_tokens: aiConfig.maxTokens,
      });

      const responseText = completion.choices[0]?.message?.content || this.getFallbackResponse(senderName);

      // Update conversation metadata
      conversation.messages.push({ role: 'assistant', content: responseText });
      conversation.lastActivity = Date.now();
      conversation.messageCount += 1;

      // Track this request for rate limiting
      this.requestTimestamps.push(Date.now());

      log.info(`AI response generated for ${senderPhone} (${responseText.length} chars)`);
      log.debug(`Response preview: "${responseText.substring(0, 100)}..."`);

      return responseText;
    } catch (error) {
      log.error(`Failed to generate AI response for ${senderPhone}:`, error);
      return this.getFallbackResponse(senderName);
    }
  }

  /**
   * Generates an automated, context-aware follow-up message for a "cold" lead.
   * Bypasses the active chat history to prevent context pollution.
   *
   * @param leadName - The lead's profile name
   * @param recentContext - A summary or list of recent messages
   * @returns The generated follow-up text
   */
  async generateFollowUpMessage(leadName: string, recentContext: string): Promise<string> {
    try {
      await this.enforceRateLimit();

      const prompt = `You are Aria, a friendly assistant. Draft a short, 1-2 sentence maximum, friendly WhatsApp follow-up message for a lead named ${leadName}. They stopped replying. Recent context of conversation: ${recentContext}. End with an engaging question. No emojis, keep it professional but warm.`;

      log.debug(`Drafting follow-up via Groq for lead: ${leadName}`);
      
      const completion = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        model: aiConfig.model,
        temperature: aiConfig.temperature,
        max_tokens: aiConfig.maxTokens,
      });
      
      this.requestTimestamps.push(Date.now());
      
      const responseText = completion.choices[0]?.message?.content || this.getFallbackResponse(leadName);
      log.info(`Follow-up generated for ${leadName} (${responseText.length} chars)`);
      return responseText.replace(/"/g, '').trim(); // Remove potential quotes
    } catch (error) {
      log.error(`Failed to generate follow-up message for ${leadName}:`, error);
      return `Hi ${leadName}! Just bubbling this up to the top of your inbox. Let me know if you still need help!`;
    }
  }

  /**
   * Clears the conversation history for a specific user.
   * Useful when the user says "start over" or after a long inactivity.
   *
   * @param senderPhone - The phone number of the user whose conversation to clear
   */
  clearConversation(senderPhone: string): void {
    if (this.conversations.has(senderPhone)) {
      this.conversations.delete(senderPhone);
      log.info(`Conversation cleared for ${senderPhone}`);
    }
  }

  /**
   * Returns the number of currently active conversation sessions.
   * Useful for monitoring and health checks.
   *
   * @returns The count of active conversations in memory
   */
  getConversationCount(): number {
    return this.conversations.size;
  }

  /**
   * Gracefully shuts down the AI service, clearing all timers and memory.
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.conversations.clear();
    log.info('AI Service shut down — all conversations cleared');
  }

  // ─── Private Methods ────────────────────────────────────────────────────

  /**
   * Retrieves an existing conversation or creates a new one for the given phone number.
   * New conversations start with a fresh Gemini chat session.
   */
  private getOrCreateConversation(senderPhone: string, senderName: string): ConversationEntry {
    const existing = this.conversations.get(senderPhone);

    if (existing) {
      existing.lastActivity = Date.now();
      log.debug(`Resuming conversation for ${senderPhone} (${existing.messageCount} prior messages)`);
      return existing;
    }

    // Create a new chat session array
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `My name is ${senderName}. I'm reaching out via WhatsApp.` },
      { role: 'assistant', content: `Hi ${senderName}! 👋 Welcome! I'm Aria, here to help you out. What can I assist you with today?` }
    ];

    const entry: ConversationEntry = {
      messages: messages as any[],
      lastActivity: Date.now(),
      senderName,
      messageCount: 0,
    };

    this.conversations.set(senderPhone, entry);
    log.info(`New conversation started for ${senderName} (${senderPhone}) | Active: ${this.conversations.size}`);

    return entry;
  }

  /**
   * Enforces rate limiting to stay within the Gemini free tier (15 RPM).
   * If we're at the limit, waits until the oldest request falls outside the 1-minute window.
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    // Remove timestamps older than 1 minute
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0]! < oneMinuteAgo) {
      this.requestTimestamps.shift();
    }

    // If we've hit the rate limit, wait
    if (this.requestTimestamps.length >= aiConfig.rateLimitRPM) {
      const oldestTimestamp = this.requestTimestamps[0]!;
      const waitTime = oldestTimestamp + 60_000 - now + 100; // +100ms buffer

      log.warn(`Rate limit approaching (${this.requestTimestamps.length}/${aiConfig.rateLimitRPM} RPM). Waiting ${waitTime}ms...`);

      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // Clean up again after waiting
      const afterWait = Date.now() - 60_000;
      while (this.requestTimestamps.length > 0 && this.requestTimestamps[0]! < afterWait) {
        this.requestTimestamps.shift();
      }
    }

    log.debug(`Rate limiter: ${this.requestTimestamps.length}/${aiConfig.rateLimitRPM} requests in last minute`);
  }

  /**
   * Returns a human-sounding fallback message when the AI service is unavailable.
   * This ensures the user always gets a response, even if Gemini is down.
   */
  private getFallbackResponse(senderName: string): string {
    const fallbacks = [
      `Thanks for your message, ${senderName}! 😊 Our team will get back to you shortly.`,
      `Hi ${senderName}! We received your message and someone from our team will respond soon. Thanks for reaching out! 🙏`,
      `Hey ${senderName}! Thanks for contacting us. We're on it and will get back to you as soon as possible! ✨`,
      `Thanks for getting in touch, ${senderName}! We appreciate your patience — our team will follow up shortly. 😊`,
    ];

    return fallbacks[Math.floor(Math.random() * fallbacks.length)]!;
  }

  /**
   * Starts a periodic timer that cleans up expired conversations.
   * Conversations inactive for longer than the TTL (30 min) are removed.
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [phone, entry] of this.conversations) {
        if (now - entry.lastActivity > aiConfig.conversationTTL) {
          this.conversations.delete(phone);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        log.info(`TTL cleanup: removed ${cleaned} expired conversation(s) | Active: ${this.conversations.size}`);
      }
    }, aiConfig.cleanupInterval);

    // Allow the Node.js process to exit even if this timer is still running
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }

    log.debug(`TTL cleanup timer started (interval: ${aiConfig.cleanupInterval / 1000}s, TTL: ${aiConfig.conversationTTL / 60000}min)`);
  }
}

// Export a singleton instance
export const aiService = new AIService();
export default aiService;
