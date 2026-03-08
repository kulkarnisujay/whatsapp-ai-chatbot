export interface LeadStats {
  total: number;
  totalLeads: number;
  new: number;
  newLeads: number;
  engaged: number;
  engagedLeads: number;
  converted: number;
  convertedLeads: number;
  unresponsive: number;
  unresponsiveLeads: number;
  qualified: number;
}

export interface Lead {
  id: string;
  phone_number: string;
  profile_name: string;
  email: string | null;
  interest: string | null;
  status: 'new' | 'engaged' | 'qualified' | 'converted' | 'unresponsive';
  source: string;
  notes: string | null;
  first_contact_at: string;
  first_contacted_at: string;
  last_contact_at: string;
  last_contacted_at: string;
  total_messages: number;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  lead_id: number;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content: string;
  whatsapp_message_id: string | null;
  timestamp: string;
  created_at: string;
}
