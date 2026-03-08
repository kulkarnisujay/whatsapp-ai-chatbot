// ──────────────────────────────────────────────────────────────────────────────
// Leads Controller — REST API handlers for lead management
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import leadService from '../services/lead.service';
import { LeadStatus } from '../types/database.types';
import { createLogger } from '../utils/logger';

const log = createLogger('LeadsController');

/** Valid lead statuses for validation */
const VALID_STATUSES: LeadStatus[] = ['new', 'engaged', 'qualified', 'converted', 'unresponsive'];

/**
 * GET /api/leads
 * Lists all leads with optional status filtering.
 *
 * Query params:
 *   - status: Filter by lead status (new, engaged, qualified, converted, unresponsive)
 */
export function getAllLeads(req: Request, res: Response): void {
  try {
    const statusFilter = req.query['status'] as string | undefined;

    // Validate status filter if provided
    if (statusFilter && !VALID_STATUSES.includes(statusFilter as LeadStatus)) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Invalid status filter: "${statusFilter}". Valid values: ${VALID_STATUSES.join(', ')}`,
      });
      return;
    }

    const leads = leadService.getAllLeads(statusFilter as LeadStatus | undefined);

    res.status(200).json({
      success: true,
      count: leads.length,
      data: leads,
    });
  } catch (error) {
    log.error('Failed to fetch leads:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/**
 * GET /api/leads/stats
 * Returns lead statistics grouped by status.
 */
export function getLeadStats(_req: Request, res: Response): void {
  try {
    const stats = leadService.getLeadStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    log.error('Failed to fetch lead stats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/**
 * GET /api/leads/:phone
 * Retrieves a specific lead by phone number, including their conversation history.
 */
export function getLeadByPhone(req: Request, res: Response): void {
  try {
    let phoneParam = req.params['phone'];
    const phone = Array.isArray(phoneParam) ? phoneParam[0] : phoneParam;
    
    if (!phone) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Phone number parameter is required.',
      });
      return;
    }

    const lead = leadService.getLeadByPhone(phone);

    if (!lead) {
      res.status(404).json({
        error: 'Not Found',
        message: `No lead found with phone number: ${phone}`,
      });
      return;
    }

    // Include conversation history
    const messages = leadService.getConversationHistory(lead.id, 50);

    res.status(200).json({
      success: true,
      data: {
        ...lead,
        messages,
      },
    });
  } catch (error) {
    log.error('Failed to fetch lead:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/**
 * GET /api/leads/id/:id
 * Retrieves a specific lead by database ID, including their conversation history.
 */
export function getLeadById(req: Request, res: Response): void {
  try {
    const idParam = req.params['id'];
    const id = Number(idParam);
    
    if (isNaN(id)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Lead ID must be a number.',
      });
      return;
    }

    const lead = leadService.getLeadById(id);

    if (!lead) {
      res.status(404).json({
        error: 'Not Found',
        message: `No lead found with ID: ${id}`,
      });
      return;
    }

    const messages = leadService.getConversationHistory(lead.id, 50);

    res.status(200).json({
      success: true,
      data: {
        ...lead,
        messages,
      },
    });
  } catch (error) {
    log.error('Failed to fetch lead by ID:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/**
 * PATCH /api/leads/id/:id
 * Updates a lead's status or notes from the dashboard.
 */
export function updateLead(req: Request, res: Response): void {
  try {
    const idParam = req.params['id'];
    const id = Number(idParam);
    
    if (isNaN(id)) {
      res.status(400).json({ error: 'Bad Request', message: 'Lead ID must be a number.' });
      return;
    }

    const lead = leadService.getLeadById(id);
    if (!lead) {
      res.status(404).json({ error: 'Not Found', message: `No lead found with ID: ${id}` });
      return;
    }

    const { status, notes } = req.body;
    const updates: any = {};
    if (status && VALID_STATUSES.includes(status)) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    const updated = leadService.updateLeadInfo(lead.phone_number, updates);

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    log.error('Failed to update lead:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
