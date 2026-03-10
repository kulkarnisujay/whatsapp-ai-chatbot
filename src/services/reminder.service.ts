// ──────────────────────────────────────────────────────────────────────────────
// Reminder Service — Automated Follow-ups & Cron Jobs
// Periodically checks for inactive leads and uses Gemini to send context-aware
// check-in messages.
// ──────────────────────────────────────────────────────────────────────────────

import cron from 'node-cron';
import leadService from './lead.service';
import whatsappService from './whatsapp.service';
import aiService from './ai.service';
import { notificationService } from './notification.service';
import { createLogger } from '../utils/logger';

const log = createLogger('ReminderService');

class ReminderService {
  constructor() {
    log.info('Reminder Service initialized');
  }

  /**
   * Scans the database for leads that have been inactive for >24 hours,
   * drafts a context-aware follow-up message using Gemini, and sends it via WhatsApp.
   */
  async processFollowUps(): Promise<void> {
    log.info('Starting scheduled follow-up process...');

    try {
      // Find leads that haven't been spoken to in 24 hours
      const inactiveLeads = leadService.getLeadsNeedingFollowUp(24);
      log.info(`Found ${inactiveLeads.length} leads requiring follow-up.`);

      for (const lead of inactiveLeads) {
        try {
          // 1. Get recent context
          const recentMessages = leadService.getConversationHistory(lead.id, 3);
          const recentContext = recentMessages
            .map((msg) => `[${msg.direction.toUpperCase()}] ${msg.content}`)
            .join(' | ');

          // 2. Draft AI Follow-up
          log.debug(`Drafting follow-up for lead ID ${lead.id} (${lead.phone_number})...`);
          const followUpMessage = await aiService.generateFollowUpMessage(
            lead.profile_name,
            recentContext || 'No previous context available.'
          );

          // Feature 5: Decay score before follow up (inactive > 24h)
          leadService.addLeadScore(lead.phone_number, -10, 'inactive_24h');

          // If they were already unresponsive before, decay more
          if (lead.status === 'unresponsive') {
             leadService.addLeadScore(lead.phone_number, -15, 'still_unresponsive_48h');
          }

          // 3. Send via WhatsApp
          const success = await whatsappService.sendTextMessage(
            lead.phone_number,
            followUpMessage
          );

          if (success) {
            // 4. Track in database
            leadService.saveMessage(lead.id, 'outbound', 'text', followUpMessage);
            leadService.recordReminder(lead.id, 'follow_up', followUpMessage, 'sent');
            
            // Mark last contact as now, so they don't get spammed tomorrow immediately unless 24 hrs pass again.
            // Option 2: change status to 'unresponsive' to avoid endless generic loops. 
            // We'll update the notes to track follow-ups and update the activity.
            const updatedNotes = lead.notes ? `${lead.notes} | Sent automated follow-up.` : 'Sent automated follow-up.';
            leadService.updateLeadInfo(lead.phone_number, { 
              notes: updatedNotes,
              status: 'unresponsive'
            });

            log.info(`Successfully sent follow-up to ${lead.phone_number}`);
          } else {
            leadService.recordReminder(lead.id, 'follow_up', followUpMessage, 'failed');
            log.warn(`Failed to send follow-up to ${lead.phone_number}`);
            
            // Feature 4: Webhook Error Notification
            notificationService.notifyHighIntent(lead.profile_name, 'Follow-up Delivery Failed', lead.phone_number);
          }

          // 5. Rate limit protection (Wait 5 seconds between leads)
          await new Promise((resolve) => setTimeout(resolve, 5000));
        } catch (leadError) {
          log.error(`Failed to process follow-up for lead ID ${lead.id}:`, leadError);
          // Feature 4: Webhook Error Notification
          notificationService.notifyHighIntent(lead.profile_name, `Follow-up Error: ${(leadError as Error).message}`, lead.phone_number);
          // Continue to next lead instead of crashing the batch
        }
      }
    } catch (error) {
      log.error('Failed to run follow-up process:', error);
    }

    log.info('Follow-up process completed.');
  }

  /**
   * Registers all background cron jobs for the application.
   */
  startCronJobs(): void {
    // Run at minute 0 of every hour (e.g., 10:00, 11:00, 12:00)
    cron.schedule('0 * * * *', () => {
      this.processFollowUps();
    });

    log.info('Reminder cron jobs scheduled successfully (Runs every hour).');
  }
}

// Export a singleton instance
export const reminderService = new ReminderService();
export default reminderService;
