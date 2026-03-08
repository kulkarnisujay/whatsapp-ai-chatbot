// ──────────────────────────────────────────────────────────────────────────────
// AI Configuration — Groq (Free Tier)
// Separated from env.ts to keep the core env config untouched.
// ──────────────────────────────────────────────────────────────────────────────

import { createLogger } from '../utils/logger';

const log = createLogger('AIConfig');

/**
 * Retrieves and validates the Groq API key from environment variables.
 * Get a free key at: https://console.groq.com/keys
 */
function getGroqApiKey(): string {
  const apiKey = process.env['GROQ_API_KEY'];
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_groq_api_key_here') {
    throw new Error(
      '❌ Missing required environment variable: GROQ_API_KEY. ' +
      'Get a FREE API key at: https://console.groq.com/keys'
    );
  }
  return apiKey;
}

/** AI configuration for Groq */
const aiConfig = {
  /** Groq API key */
  apiKey: getGroqApiKey(),

  /** Model to use */
  model: 'llama-3.1-8b-instant',

  /** Maximum output tokens — keep WhatsApp replies concise */
  maxTokens: 1024,

  /** Temperature — 0.7 is conversational but grounded */
  temperature: 0.7,

  /**
   * Top-P sampling — controls diversity of responses.
   * 0.9 allows some creativity while staying relevant.
   */
  topP: 0.9,

  /** Rate limit — free tier allows 15 requests per minute */
  rateLimitRPM: 15,

  /** Conversation TTL in milliseconds (30 minutes) */
  conversationTTL: 30 * 60 * 1000,

  /** Interval for TTL cleanup checks in milliseconds (5 minutes) */
  cleanupInterval: 5 * 60 * 1000,
};

log.info(`Loaded AI config: model=${aiConfig.model}, maxTokens=${aiConfig.maxTokens}, temp=${aiConfig.temperature}`);

export default aiConfig;
