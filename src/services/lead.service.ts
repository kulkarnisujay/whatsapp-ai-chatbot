// ──────────────────────────────────────────────────────────────────────────────
// Lead Service — Lead Management & Conversation Persistence
// All database operations use parameterized queries for security.
// better-sqlite3 is synchronous by design, so all methods return directly.
// ──────────────────────────────────────────────────────────────────────────────

import db from '../config/database';
import { createLogger } from '../utils/logger';
import {
  Lead,
  LeadStatus,
  LeadUpdateFields,
  LeadStats,
  ConversationMessage,
} from '../types/database.types';

const log = createLogger('LeadService');

class LeadService {
  // ─── Prepared Statements (cached for performance) ───────────────────────

  private readonly stmtFindByPhone = db.prepare(
    'SELECT * FROM leads WHERE phone_number = ?'
  );

  private readonly stmtInsertLead = db.prepare(`
    INSERT INTO leads (phone_number, profile_name, status, source, first_contact_at, last_contact_at, total_messages)
    VALUES (?, ?, 'new', 'whatsapp', ?, ?, 0)
  `);

  private readonly stmtUpdateActivity = db.prepare(`
    UPDATE leads
    SET last_contact_at = ?, total_messages = total_messages + 1, profile_name = ?, updated_at = ?
    WHERE phone_number = ?
  `);

  private readonly stmtInsertMessage = db.prepare(`
    INSERT INTO conversation_messages (lead_id, direction, message_type, content, whatsapp_message_id, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  private readonly stmtGetMessages = db.prepare(`
    SELECT * FROM conversation_messages
    WHERE lead_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  private readonly stmtCountByStatus = db.prepare(
    'SELECT COUNT(*) as count FROM leads WHERE status = ?'
  );

  private readonly stmtCountAll = db.prepare(
    'SELECT COUNT(*) as count FROM leads'
  );

  private readonly stmtGetFollowUps = db.prepare(`
    SELECT * FROM leads
    WHERE status IN ('new', 'engaged')
      AND last_contact_at <= datetime('now', ?)
  `);

  private readonly stmtInsertReminder = db.prepare(`
    INSERT INTO reminders (lead_id, reminder_type, message, scheduled_at, sent_at, status)
    VALUES (?, ?, ?, datetime('now'), datetime('now'), ?)
  `);

  private readonly stmtUpdateScore = db.prepare(
    'UPDATE leads SET lead_score = lead_score + ?, updated_at = ? WHERE phone_number = ?'
  );
  private readonly stmtGetScore = db.prepare(
    'SELECT lead_score FROM leads WHERE phone_number = ?'
  );
  private readonly stmtSetScore = db.prepare(
    'UPDATE leads SET lead_score = ?, updated_at = ? WHERE phone_number = ?'
  );

  constructor() {
    log.info('Lead Service initialized');
  }

  // ─── Lead Management ────────────────────────────────────────────────────

  /**
   * Finds an existing lead by phone number or creates a new one.
   * If the lead exists, updates their last contact timestamp and increments message count.
   *
   * @param phoneNumber - The WhatsApp phone number
   * @param profileName - The WhatsApp display name
   * @returns The lead record (existing or newly created)
   */
  findOrCreateLead(phoneNumber: string, profileName: string): Lead {
    const now = new Date().toISOString();

    const existing = this.stmtFindByPhone.get(phoneNumber) as Lead | undefined;

    if (existing) {
      this.stmtUpdateActivity.run(now, profileName, now, phoneNumber);
      log.debug(`Lead activity updated: ${phoneNumber} (${profileName})`);

      // Return the updated lead
      return this.stmtFindByPhone.get(phoneNumber) as Lead;
    }

    // Create new lead
    this.stmtInsertLead.run(phoneNumber, profileName, now, now);
    const newLead = this.stmtFindByPhone.get(phoneNumber) as Lead;

    log.info(`🆕 New lead created: ${profileName} (${phoneNumber}) | ID: ${newLead.id}`);

    return newLead;
  }

  /**
   * Updates specific fields on a lead record.
   * Only the provided fields will be updated — others remain unchanged.
   *
   * @param phoneNumber - The lead's phone number
   * @param updates - An object containing the fields to update
   * @returns The updated lead, or null if not found
   */
  updateLeadInfo(phoneNumber: string, updates: LeadUpdateFields): Lead | null {
    const existing = this.stmtFindByPhone.get(phoneNumber) as Lead | undefined;
    if (!existing) {
      log.warn(`Cannot update — lead not found: ${phoneNumber}`);
      return null;
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.profile_name !== undefined) {
      fields.push('profile_name = ?');
      values.push(updates.profile_name);
    }
    if (updates.email !== undefined) {
      fields.push('email = ?');
      values.push(updates.email);
    }
    if (updates.interest !== undefined) {
      fields.push('interest = ?');
      values.push(updates.interest);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }

    if (fields.length === 0) {
      return existing;
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(phoneNumber);

    const sql = `UPDATE leads SET ${fields.join(', ')} WHERE phone_number = ?`;
    db.prepare(sql).run(...values);

    const updated = this.stmtFindByPhone.get(phoneNumber) as Lead;
    log.info(`Lead updated: ${phoneNumber} — fields: ${Object.keys(updates).join(', ')}`);

    return updated;
  }

  /**
   * Retrieves a lead by their phone number.
   *
   * @param phoneNumber - The WhatsApp phone number
   * @returns The lead record, or null if not found
   */
  getLeadByPhone(phoneNumber: string): Lead | null {
    const lead = this.stmtFindByPhone.get(phoneNumber) as Lead | undefined;
    return lead || null;
  }

  /**
   * Retrieves a lead by their database ID.
   *
   * @param id - The lead's numeric database ID
   * @returns The lead record, or null if not found
   */
  getLeadById(id: number): Lead | null {
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as Lead | undefined;
    return lead || null;
  }

  /**
   * Retrieves all leads, optionally filtered by status.
   * Results are ordered by most recent contact first.
   *
   * @param status - Optional status filter
   * @returns Array of lead records
   */
  getAllLeads(status?: LeadStatus): Lead[] {
    if (status) {
      return db
        .prepare('SELECT * FROM leads WHERE status = ? ORDER BY last_contact_at DESC')
        .all(status) as Lead[];
    }

    return db
      .prepare('SELECT * FROM leads ORDER BY last_contact_at DESC')
      .all() as Lead[];
  }

  /**
   * Returns lead counts grouped by status — useful for dashboards and monitoring.
   *
   * @returns An object with total count and per-status counts
   */
  getLeadStats(): LeadStats {
    const total = (this.stmtCountAll.get() as { count: number }).count;
    const statuses: LeadStatus[] = ['new', 'engaged', 'qualified', 'converted', 'unresponsive'];

    const stats: LeadStats = {
      total,
      new: 0,
      engaged: 0,
      qualified: 0,
      converted: 0,
      unresponsive: 0,
      hotLeads: 0,
      warmLeads: 0,
      coldLeads: 0,
    };

    for (const status of statuses) {
      const result = this.stmtCountByStatus.get(status) as { count: number };
      stats[status] = result.count;
    }

    // Scoring Distribution
    const hotResult = db.prepare('SELECT COUNT(*) as count FROM leads WHERE lead_score >= 60').get() as { count: number };
    const warmResult = db.prepare('SELECT COUNT(*) as count FROM leads WHERE lead_score >= 30 AND lead_score < 60').get() as { count: number };
    const coldResult = db.prepare('SELECT COUNT(*) as count FROM leads WHERE lead_score < 30').get() as { count: number };
    
    stats.hotLeads = hotResult.count;
    stats.warmLeads = warmResult.count;
    stats.coldLeads = coldResult.count;

    return stats;
  }

  // ─── Lead Scoring ─────────────────────────────────────────────────────────

  /**
   * Adds points to a lead's score for performing meaningful actions.
   * Can accept negative points for score decay (e.g. going silent).
   * 
   * @param phoneNumber The lead's phone number
   * @param points The number of points to add (can be negative)
   * @param reason The reason for the score change (for logging)
   */
  addLeadScore(phoneNumber: string, points: number, reason: string): void {
    const now = new Date().toISOString();
    this.stmtUpdateScore.run(points, now, phoneNumber);
    
    // Safety check - we don't strictly enforce >0 in DB to allow negative scores 
    // for completely dead leads, but it's good to log the current score.
    const current = this.getLeadScore(phoneNumber);
    log.info(`Scoring: Lead ${phoneNumber} +${points} (${reason}) → new score: ${current}`);
  }

  /**
   * Gets the current score of a lead.
   */
  getLeadScore(phoneNumber: string): number {
    const result = this.stmtGetScore.get(phoneNumber) as { lead_score: number } | undefined;
    return result ? result.lead_score : 0;
  }

  /**
   * Sets the score of a lead to an exact value.
   */
  setLeadScore(phoneNumber: string, score: number): void {
    const now = new Date().toISOString();
    this.stmtSetScore.run(score, now, phoneNumber);
    log.info(`Scoring: Lead ${phoneNumber} manually set to score: ${score}`);
  }

  /**
   * Returns the classification tier of a lead based on their score.
   */
  getLeadTier(score: number): 'hot' | 'warm' | 'cold' {
    if (score >= 60) return 'hot';
    if (score >= 30) return 'warm';
    return 'cold';
  }

  // ─── Conversation Messages ──────────────────────────────────────────────

  /**
   * Saves a message to the conversation history.
   *
   * @param leadId - The lead's database ID
   * @param direction - 'inbound' (from user) or 'outbound' (from bot)
   * @param messageType - The message type (text, image, audio, etc.)
   * @param content - The message content/body
   * @param whatsappMessageId - Optional WhatsApp message ID for tracking
   * @returns The saved message record
   */
  saveMessage(
    leadId: number,
    direction: 'inbound' | 'outbound',
    messageType: string,
    content: string,
    whatsappMessageId?: string
  ): ConversationMessage {
    const now = new Date().toISOString();

    const result = this.stmtInsertMessage.run(
      leadId,
      direction,
      messageType,
      content,
      whatsappMessageId || null,
      now
    );

    log.debug(`Message saved: lead=${leadId}, dir=${direction}, type=${messageType}, id=${result.lastInsertRowid}`);

    return {
      id: Number(result.lastInsertRowid),
      lead_id: leadId,
      direction,
      message_type: messageType,
      content,
      whatsapp_message_id: whatsappMessageId || null,
      timestamp: now,
      created_at: now,
    };
  }

  /**
   * Retrieves the conversation history for a lead.
   * Returns messages in reverse chronological order (newest first).
   *
   * @param leadId - The lead's database ID
   * @param limit - Maximum number of messages to return (default: 50)
   * @returns Array of conversation messages
   */
  getConversationHistory(leadId: number, limit: number = 50): ConversationMessage[] {
    return this.stmtGetMessages.all(leadId, limit) as ConversationMessage[];
  }

  // ─── Reminder Engine ────────────────────────────────────────────────────

  /**
   * Finds leads that haven't been contacted in a certain number of hours
   * and are still in a 'new' or 'engaged' state.
   *
   * @param hoursInactive - Number of hours since last contact
   * @returns Array of leads needing follow-up
   */
  getLeadsNeedingFollowUp(hoursInactive: number): Lead[] {
    // SQLite modifier format: '-24 hours'
    const timeModifier = `-${hoursInactive} hours`;
    return this.stmtGetFollowUps.all(timeModifier) as Lead[];
  }

  /**
   * Logs a sent reminder to the database.
   *
   * @param leadId - The lead's database ID
   * @param type - The reminder type
   * @param message - The content of the reminder sent
   * @param status - 'sent' or 'failed'
   */
  recordReminder(leadId: number, type: string, message: string, status: string): void {
    const result = this.stmtInsertReminder.run(leadId, type, message, status);
    log.debug(`Recorded reminder for lead ${leadId} | ID: ${result.lastInsertRowid}`);
  }
}

// Export a singleton instance
export const leadService = new LeadService();
export default leadService;
