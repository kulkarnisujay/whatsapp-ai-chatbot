// ──────────────────────────────────────────────────────────────────────────────
// Database Type Definitions — Lead Management & Conversation Storage
// ──────────────────────────────────────────────────────────────────────────────

// ─── Enums ────────────────────────────────────────────────────────────────────

/** Lead lifecycle status — tracks progression through the sales funnel */
export type LeadStatus =
  | 'new'           // First contact, no engagement yet
  | 'engaged'       // Has had a conversation (2+ messages)
  | 'qualified'     // Expressed clear interest, provided contact info
  | 'converted'     // Took desired action (booked demo, signed up, etc.)
  | 'unresponsive'; // No response after follow-ups

/** Direction of a message in a conversation */
export type MessageDirection = 'inbound' | 'outbound';

/** Types of reminders that can be scheduled */
export type ReminderType = 'follow_up' | 'check_in' | 'promotion' | 'custom';

/** Status of a scheduled reminder */
export type ReminderStatus = 'pending' | 'sent' | 'cancelled' | 'failed';

// ─── Core Entities ────────────────────────────────────────────────────────────

/**
 * A potential customer captured from WhatsApp.
 * Tracks their journey through the lead pipeline.
 */
export interface Lead {
  id: number;
  phone_number: string;
  profile_name: string;
  email: string | null;
  interest: string | null;
  status: LeadStatus;
  source: string;
  first_contact_at: string;
  last_contact_at: string;
  total_messages: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lead_score: number;
}

/**
 * A stored message — captures both inbound (from user) and outbound (from bot) messages.
 * Provides a full audit trail of every conversation.
 */
export interface ConversationMessage {
  id: number;
  lead_id: number;
  direction: MessageDirection;
  message_type: string;
  content: string;
  whatsapp_message_id: string | null;
  timestamp: string;
  created_at: string;
}

/**
 * A scheduled follow-up reminder.
 * Used by the reminder engine to re-engage leads.
 */
export interface Reminder {
  id: number;
  lead_id: number;
  reminder_type: ReminderType;
  message: string;
  scheduled_at: string;
  sent_at: string | null;
  status: ReminderStatus;
  created_at: string;
}

// ─── Utility Types ────────────────────────────────────────────────────────────

/** Fields that can be updated on a lead */
export interface LeadUpdateFields {
  profile_name?: string;
  email?: string | null;
  interest?: string | null;
  status?: LeadStatus;
  notes?: string | null;
}

/** Lead statistics for dashboard/monitoring */
export interface LeadStats {
  total: number;
  new: number;
  engaged: number;
  qualified: number;
  converted: number;
  unresponsive: number;
  hotLeads?: number;
  warmLeads?: number;
  coldLeads?: number;
}

/** Lead with their recent conversation messages */
export interface LeadWithConversation extends Lead {
  messages: ConversationMessage[];
}
