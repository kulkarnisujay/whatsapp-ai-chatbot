import { useState, useEffect, useRef } from 'react';
import {
  Bot, MessageSquare, Users, Activity, Phone, Search,
  Send, Settings, Bell, ChevronRight, Calendar,
  Mail, Tag, RefreshCw, Zap,
} from 'lucide-react';
import type { Lead, LeadStats, Message } from './types';

function App() {
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'conversations'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStats();
    fetchLeads();
    const interval = setInterval(() => { fetchStats(); fetchLeads(); }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedLead) {
      fetchMessages(selectedLead.id);
      const interval = setInterval(() => fetchMessages(selectedLead.id), 3000);
      return () => clearInterval(interval);
    } else {
      setMessages([]);
    }
  }, [selectedLead]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/leads/stats');
      if (res.ok) { const data = await res.json(); setStats(data.data); }
    } catch (err) { console.error('Failed to fetch stats', err); }
  };

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads');
      if (res.ok) { const data = await res.json(); setLeads(data.data || []); }
    } catch (err) { console.error('Failed to fetch leads', err); }
  };

  const fetchMessages = async (leadId: string) => {
    try {
      const res = await fetch(`/api/leads/id/${leadId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.messages) {
          setMessages(data.data.messages);
        }
      }
    } catch (err) { console.error('Failed to fetch messages', err); }
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/leads/id/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchLeads();
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead({ ...selectedLead, status: newStatus as Lead['status'] });
        }
      }
    } catch (err) { console.error('Failed to update lead', err); }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Just now';
    const validDateStr = dateStr.includes(' ') && !dateStr.includes('T')
      ? dateStr.replace(' ', 'T') + 'Z' : dateStr;
    const date = new Date(validDateStr);
    if (isNaN(date.getTime())) return 'Recently';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatFullDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    const validDateStr = dateStr.includes(' ') && !dateStr.includes('T')
      ? dateStr.replace(' ', 'T') + 'Z' : dateStr;
    const date = new Date(validDateStr);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = searchQuery === '' ||
      lead.profile_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone_number.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, string> = {
    new: '#60a5fa', engaged: '#34d399', converted: '#fbbf24', unresponsive: '#f87171', qualified: '#a78bfa',
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1><Bot size={28} style={{ color: '#10b981' }} /> Aria CRM</h1>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            AI Marketing Assistant
          </p>
        </div>
        <div className="nav-links">
          <div
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Activity size={20} /> Dashboard
          </div>
          <div
            className={`nav-item ${activeTab === 'conversations' ? 'active' : ''}`}
            onClick={() => setActiveTab('conversations')}
          >
            <MessageSquare size={20} /> Conversations
            {leads.length > 0 && (
              <span style={{
                marginLeft: 'auto', background: 'var(--primary)', color: '#fff',
                borderRadius: '999px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700,
              }}>
                {leads.length}
              </span>
            )}
          </div>
          <div className="nav-item">
            <Users size={20} /> Audience
          </div>
          <div className="nav-item" style={{ marginTop: 'auto' }}>
            <Settings size={20} /> Settings
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-header">
          <h2>{activeTab === 'dashboard' ? '📊 Overview' : '💬 Live Conversations'}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => { fetchStats(); fetchLeads(); }} style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: '8px',
              color: 'var(--text-muted)', padding: '6px 12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem',
            }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <Bell size={20} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} />
          </div>
        </header>

        {activeTab === 'dashboard' ? (
          <DashboardView stats={stats} leads={leads} formatFullDate={formatFullDate} setActiveTab={setActiveTab} />
        ) : (
          <div className="dashboard-view animate-fade" style={{ padding: '1.5rem 2rem' }}>
            <div className="split-view">
              {/* Leads List */}
              <div className="leads-list glass">
                <div className="list-header" style={{ flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <h3 style={{ margin: 0 }}>Inbox</h3>
                    <span className="badge badge-new">{filteredLeads.length} Leads</span>
                  </div>
                  {/* Search */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    background: 'var(--bg-dark)', borderRadius: '8px', padding: '8px 12px', width: '100%',
                  }}>
                    <Search size={14} style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search name or phone..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{
                        background: 'none', border: 'none', outline: 'none', color: 'var(--text-main)',
                        fontSize: '0.85rem', width: '100%', fontFamily: 'Inter, sans-serif',
                      }}
                    />
                  </div>
                  {/* Status Filters */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {['all', 'new', 'engaged', 'converted', 'unresponsive'].map(s => (
                      <button key={s} onClick={() => setStatusFilter(s)} style={{
                        background: statusFilter === s ? 'var(--primary)' : 'var(--bg-dark)',
                        border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px',
                        color: statusFilter === s ? '#fff' : 'var(--text-muted)', fontSize: '0.7rem',
                        cursor: 'pointer', textTransform: 'capitalize', fontWeight: 600,
                      }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="list-body">
                  {filteredLeads.map(lead => (
                    <div
                      key={lead.id}
                      className={`lead-row ${selectedLead?.id === lead.id ? 'selected' : ''}`}
                      onClick={() => setSelectedLead(lead)}
                    >
                      <div className="lead-avatar" style={{
                        background: `linear-gradient(135deg, ${statusColors[lead.status] || '#555'}33, ${statusColors[lead.status] || '#555'}66)`,
                        color: statusColors[lead.status],
                      }}>
                        {lead.profile_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="lead-info">
                        <div className="lead-info-top">
                          <span className="lead-name">{lead.profile_name}</span>
                          <span className="lead-time">{formatDate(lead.last_contact_at || lead.last_contacted_at)}</span>
                        </div>
                        <div className="lead-info-bottom">
                          <span className="lead-phone">
                            <Phone size={12} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} />
                            {lead.phone_number}
                          </span>
                          <span className={`badge badge-${lead.status}`}>{lead.status}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  ))}
                  {filteredLeads.length === 0 && (
                    <div className="chat-empty">
                      <Search size={32} />
                      <p>No leads match your filter.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Area */}
              <div className="chat-area glass">
                {selectedLead ? (
                  <>
                    <div className="chat-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="lead-avatar" style={{
                          width: '36px', height: '36px', fontSize: '0.85rem',
                          background: `linear-gradient(135deg, ${statusColors[selectedLead.status]}33, ${statusColors[selectedLead.status]}66)`,
                          color: statusColors[selectedLead.status],
                        }}>
                          {selectedLead.profile_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1rem' }}>{selectedLead.profile_name}</h3>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedLead.phone_number}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {['new', 'engaged', 'converted'].map(s => (
                          <button key={s} onClick={() => updateLeadStatus(selectedLead.id, s)} style={{
                            background: selectedLead.status === s ? statusColors[s] + '33' : 'var(--bg-dark)',
                            border: `1px solid ${selectedLead.status === s ? statusColors[s] : 'var(--border)'}`,
                            borderRadius: '6px', padding: '4px 10px', color: statusColors[s],
                            fontSize: '0.7rem', cursor: 'pointer', textTransform: 'capitalize', fontWeight: 600,
                          }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="chat-messages">
                      {[...messages].reverse().map(msg => (
                        <div key={msg.id} className={`message ${msg.direction}`}>
                          {msg.content}
                          <div className="message-meta">
                            {formatDate(msg.timestamp)}
                          </div>
                        </div>
                      ))}
                      {messages.length === 0 && (
                        <div className="chat-empty">
                          <MessageSquare size={32} />
                          <p>No messages yet.</p>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    {/* Lead Detail Footer */}
                    <div style={{
                      padding: '1rem 1.5rem', borderTop: '1px solid var(--border)',
                      display: 'flex', gap: '2rem', fontSize: '0.8rem', color: 'var(--text-muted)',
                    }}>
                      <span><Calendar size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />First: {formatFullDate(selectedLead.first_contact_at || selectedLead.first_contacted_at)}</span>
                      <span><Mail size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Messages: {selectedLead.total_messages ?? selectedLead.message_count}</span>
                      <span><Tag size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Status: {selectedLead.status}</span>
                    </div>
                  </>
                ) : (
                  <div className="chat-empty">
                    <MessageSquare size={48} />
                    <h3>Select a conversation</h3>
                    <p>Click on a lead from the inbox to view their chat history with Aria.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ─── Dashboard View ────────────────────────────────────────────────── */

function DashboardView({ stats, leads, formatFullDate, setActiveTab }: {
  stats: LeadStats | null;
  leads: Lead[];
  formatFullDate: (d: string | null | undefined) => string;
  setActiveTab: (tab: 'dashboard' | 'conversations') => void;
}) {
  if (!stats) return <div className="spinner" />;

  const statCards = [
    { label: 'Total Leads', value: stats.total ?? stats.totalLeads ?? 0, icon: <Users size={18} />, cls: 'total' },
    { label: 'New', value: stats.new ?? stats.newLeads ?? 0, icon: <Zap size={18} />, cls: 'new' },
    { label: 'Engaged', value: stats.engaged ?? stats.engagedLeads ?? 0, icon: <MessageSquare size={18} />, cls: 'engaged' },
    { label: 'Converted', value: stats.converted ?? stats.convertedLeads ?? 0, icon: <Send size={18} />, cls: 'converted' },
  ];

  return (
    <div className="dashboard-view animate-fade">
      <div className="stats-grid">
        {statCards.map(card => (
          <div key={card.cls} className={`stat-card glass ${card.cls}`}>
            <div className="stat-title">{card.label} {card.icon}</div>
            <h3 className="stat-value">{card.value}</h3>
          </div>
        ))}
      </div>

      {/* Recent Leads Table */}
      <div className="glass" style={{ padding: '1.5rem', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Recent Leads</h3>
          <button onClick={() => setActiveTab('conversations')} style={{
            background: 'var(--primary)', border: 'none', borderRadius: '8px',
            color: '#fff', padding: '8px 16px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
          }}>
            View All →
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.8rem' }}>Name</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.8rem' }}>Phone</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.8rem' }}>Status</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.8rem' }}>Messages</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.8rem' }}>Last Active</th>
            </tr>
          </thead>
          <tbody>
            {leads.slice(0, 8).map(lead => (
              <tr key={lead.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => setActiveTab('conversations')}>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{lead.profile_name}</td>
                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{lead.phone_number}</td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <span className={`badge badge-${lead.status}`}>{lead.status}</span>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{lead.total_messages ?? lead.message_count}</td>
                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {formatFullDate(lead.last_contact_at || lead.last_contacted_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
            No leads yet. Send a WhatsApp message to the bot to create your first lead!
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
