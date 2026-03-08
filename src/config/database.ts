// ──────────────────────────────────────────────────────────────────────────────
// Database Configuration — SQLite via better-sqlite3
// Embedded, zero-cost database for lead management and conversation storage.
// ──────────────────────────────────────────────────────────────────────────────

import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { createLogger } from '../utils/logger';

const log = createLogger('Database');

// ─── Database Path ────────────────────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'chatbot.db');

// ─── Initialization ──────────────────────────────────────────────────────────

/**
 * Initializes the SQLite database.
 * Creates the data directory and database file if they don't exist.
 * Sets up all tables, indexes, and pragma settings.
 */
function initializeDatabase(): Database.Database {
  // Ensure the data/ directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    log.info(`Created data directory: ${DATA_DIR}`);
  }

  // Open (or create) the database
  const db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  log.info(`SQLite database opened at: ${DB_PATH}`);

  // Create tables
  createTables(db);

  // Create indexes
  createIndexes(db);

  log.info('Database initialization complete — all tables and indexes ready');

  return db;
}

// ─── Schema Definition ───────────────────────────────────────────────────────

/**
 * Creates all database tables if they don't already exist.
 */
function createTables(db: Database.Database): void {
  db.exec(`
    -- ──────────────────────────────────────────────────────────
    -- Leads Table — Potential customers from WhatsApp
    -- ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS leads (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number      TEXT    NOT NULL UNIQUE,
      profile_name      TEXT    NOT NULL,
      email             TEXT    DEFAULT NULL,
      interest          TEXT    DEFAULT NULL,
      status            TEXT    NOT NULL DEFAULT 'new'
                                CHECK(status IN ('new', 'engaged', 'qualified', 'converted', 'unresponsive')),
      source            TEXT    NOT NULL DEFAULT 'whatsapp',
      first_contact_at  TEXT    NOT NULL,
      last_contact_at   TEXT    NOT NULL,
      total_messages    INTEGER NOT NULL DEFAULT 0,
      notes             TEXT    DEFAULT NULL,
      created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ──────────────────────────────────────────────────────────
    -- Conversation Messages — Full message audit trail
    -- ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id               INTEGER NOT NULL,
      direction             TEXT    NOT NULL CHECK(direction IN ('inbound', 'outbound')),
      message_type          TEXT    NOT NULL,
      content               TEXT    NOT NULL,
      whatsapp_message_id   TEXT    DEFAULT NULL,
      timestamp             TEXT    NOT NULL,
      created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );

    -- ──────────────────────────────────────────────────────────
    -- Reminders — Scheduled follow-up messages
    -- ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS reminders (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id         INTEGER NOT NULL,
      reminder_type   TEXT    NOT NULL DEFAULT 'follow_up'
                              CHECK(reminder_type IN ('follow_up', 'check_in', 'promotion', 'custom')),
      message         TEXT    NOT NULL,
      scheduled_at    TEXT    NOT NULL,
      sent_at         TEXT    DEFAULT NULL,
      status          TEXT    NOT NULL DEFAULT 'pending'
                              CHECK(status IN ('pending', 'sent', 'cancelled', 'failed')),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );
  `);

  log.debug('Tables created/verified: leads, conversation_messages, reminders');
}

/**
 * Creates database indexes for optimized query performance.
 */
function createIndexes(db: Database.Database): void {
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_phone
      ON leads(phone_number);

    CREATE INDEX IF NOT EXISTS idx_leads_status
      ON leads(status);

    CREATE INDEX IF NOT EXISTS idx_leads_last_contact
      ON leads(last_contact_at);

    CREATE INDEX IF NOT EXISTS idx_messages_lead_id
      ON conversation_messages(lead_id);

    CREATE INDEX IF NOT EXISTS idx_messages_timestamp
      ON conversation_messages(timestamp);

    CREATE INDEX IF NOT EXISTS idx_reminders_scheduled
      ON reminders(scheduled_at);

    CREATE INDEX IF NOT EXISTS idx_reminders_status
      ON reminders(status);

    CREATE INDEX IF NOT EXISTS idx_reminders_lead_id
      ON reminders(lead_id);
  `);

  log.debug('Indexes created/verified');
}

// ─── Export Singleton ─────────────────────────────────────────────────────────

/** The singleton database instance — used throughout the application */
const db: DatabaseType = initializeDatabase();

export default db;
