import { Router } from 'express';
import { getAllLeads, getLeadStats, getLeadByPhone, getLeadById, updateLead, deleteLeadById } from '../controllers/leads.controller';

const leadsRouter = Router();

/**
 * GET /api/leads
 * GET /api/leads?status=new
 */
leadsRouter.get('/leads', getAllLeads);

/**
 * GET /api/leads/stats
 */
leadsRouter.get('/leads/stats', getLeadStats);

/**
 * GET /api/leads/id/:id — fetch lead by ID (for dashboard)
 * PATCH /api/leads/id/:id — update lead status/notes (for dashboard)
 * DELETE /api/leads/id/:id — hard delete lead
 */
leadsRouter.get('/leads/id/:id', getLeadById);
leadsRouter.patch('/leads/id/:id', updateLead);
leadsRouter.delete('/leads/id/:id', deleteLeadById);

/**
 * GET /api/leads/:phone
 */
leadsRouter.get('/leads/:phone', getLeadByPhone);

export default leadsRouter;
