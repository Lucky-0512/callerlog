import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Eye, Trash2, Building2, User, Clock, 
  CheckCircle2, AlertCircle, ArrowUpRight, Share2, Calendar, PhoneCall 
} from 'lucide-react';
import { api } from '../api';

export default function CallLedger({ onSelectCallForInspection, onResumeCall }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [callToDelete, setCallToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [fetchError, setFetchError] = useState(null);

  const fetchCalls = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (selectedOutcome) params.outcome = selectedOutcome;
      if (selectedStage) params.max_stage = selectedStage;
      if (selectedStatus) params.status = selectedStatus;
      
      const data = await api.getCalls(params);
      setCalls(data || []);
      setFetchError(null);
    } catch (err) {
      console.error('Failed to fetch calls:', err);
      setFetchError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, [selectedOutcome, selectedStage, selectedStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCalls();
  };

  const confirmDelete = async () => {
    if (!callToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteCall(callToDelete.id);
      setCalls(prev => prev.filter(c => c.id !== callToDelete.id));
      setDeleteMessage(`Call ${callToDelete.call_id || 'record'} deleted successfully.`);
      setTimeout(() => setDeleteMessage(''), 4000);
      setCallToDelete(null);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const outcomeColors = {
    next_step_agreed: 'badge-success',
    agreed_to_receive_report: 'badge-success',
    interested: 'badge-primary',
    follow_up: 'badge-warning',
    call_again: 'badge-neutral',
    not_interested: 'badge-danger',
    do_not_call: 'badge-danger',
    wrong_person: 'badge-warning',
    moved_company: 'badge-warning',
    not_logged: 'badge-neutral'
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 20px 40px 20px' }}>
      {fetchError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#fca5a5',
          fontSize: '0.85rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} color="#ef4444" />
            <span>
              <strong>Backend Offline:</strong> Could not load calls from Supabase ({fetchError}). Check your Render service URL in Settings.
            </span>
          </div>
          <button onClick={fetchCalls} className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '0.78rem' }}>
            Retry
          </button>
        </div>
      )}
      
      {/* Header & Filter Controls */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff' }}>
              Call Intelligence Ledger
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Historical records, stage classifications, and prospect verbatim needs
            </p>
          </div>

          <span className="badge badge-primary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
            {calls.length} Calls Logged
          </span>
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <form onSubmit={handleSearchSubmit} style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by company, contact, or next action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 38px',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-color)',
                color: '#ffffff',
                fontSize: '0.85rem'
              }}
            />
          </form>

          {/* Outcome Filter */}
          <select
            value={selectedOutcome}
            onChange={(e) => setSelectedOutcome(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
              color: '#ffffff',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <option value="">All Outcomes</option>
            <option value="next_step_agreed">Next Step Agreed</option>
            <option value="agreed_to_receive_report">Agreed to Receive Report</option>
            <option value="interested">Interested</option>
            <option value="follow_up">Follow Up</option>
            <option value="not_interested">Not Interested</option>
            <option value="wrong_person">Wrong Person</option>
            <option value="do_not_call">Do Not Call</option>
          </select>

          {/* Stage Filter */}
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
              color: '#ffffff',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <option value="">All Stages</option>
            <option value="1">Stage 1: Opening</option>
            <option value="2">Stage 2: Purpose</option>
            <option value="3">Stage 3: Permission</option>
            <option value="4">Stage 4: Their Business</option>
            <option value="5">Stage 5: Need (Verbatim)</option>
            <option value="6">Stage 6: Objection</option>
            <option value="7">Stage 7: Next Step</option>
            <option value="8">Stage 8: Close</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
              color: '#ffffff',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active (Incomplete / Persistent Call ID)</option>
            <option value="CLOSED">Closed (Stage 8 Reached)</option>
          </select>

          <button
            onClick={fetchCalls}
            className="btn btn-primary"
            style={{ padding: '9px 16px', fontSize: '0.85rem' }}
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Calls Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading logged calls...
          </div>
        ) : calls.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Building2 size={36} color="var(--text-subtle)" style={{ margin: '0 auto 12px auto' }} />
            <h4 style={{ fontSize: '1.1rem', color: '#ffffff', marginBottom: '6px' }}>No calls logged yet</h4>
            <p style={{ fontSize: '0.85rem' }}>Simulate or log a cold call from the Active Companion to populate the ledger.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '14px 20px' }}>Call ID & Attempts</th>
                <th style={{ padding: '14px 20px' }}>Company & Contact</th>
                <th style={{ padding: '14px 20px' }}>Stage Reached</th>
                <th style={{ padding: '14px 20px' }}>Status & Outcome</th>
                <th style={{ padding: '14px 20px' }}>Next Action / Where Left Off</th>
                <th style={{ padding: '14px 20px' }}>Duration</th>
                <th style={{ padding: '14px 20px' }}>Caller</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => {
                const badge = outcomeColors[call.outcome] || 'badge-neutral';
                const formattedDate = new Date(call.call_timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                return (
                  <tr
                    key={call.id}
                    onClick={() => onSelectCallForInspection(call)}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Call ID & Attempts */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          color: '#a5b4fc',
                          background: 'rgba(99, 102, 241, 0.12)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          display: 'inline-block',
                          width: 'fit-content'
                        }}>
                          {call.call_id || `CALL-${call.id.slice(0, 6).toUpperCase()}`}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Attempt #{call.attempt_count || 1} · {formattedDate}
                        </span>
                      </div>
                    </td>

                    {/* Company & Contact */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontWeight: 700, color: '#ffffff' }}>
                        {call.company_name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {call.contact_name} ({call.contact_role})
                      </div>
                    </td>

                    {/* Stage Reached */}
                    <td style={{ padding: '14px 20px' }}>
                      <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                        Stage {call.max_stage_number}: {call.max_stage_name}
                      </span>
                    </td>

                    {/* Status & Outcome */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {call.call_id_status === 'ACTIVE' ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#fef3c7',
                            color: '#92400e',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            width: 'fit-content'
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
                            ACTIVE
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#dcfce7',
                            color: '#166534',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            width: 'fit-content'
                          }}>
                            ✓ CLOSED
                          </span>
                        )}
                        <span className={`badge ${badge}`} style={{ fontSize: '0.68rem', width: 'fit-content' }}>
                          {call.outcome.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>

                    {/* Next Action / Where Left Off */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ color: '#cbd5e1', fontSize: '0.82rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {call.call_id_status === 'ACTIVE' && call.where_you_left_off_summary ? (
                          <span title={call.where_you_left_off_summary} style={{ color: '#fbbf24' }}>
                            {call.where_you_left_off_summary}
                          </span>
                        ) : (
                          call.next_step_action || call.stage_5_need_verbatim || 'No next step'
                        )}
                      </div>
                      {call.next_step_date_time && (
                        <div style={{ fontSize: '0.72rem', color: '#818cf8', marginTop: '2px' }}>
                          📅 {call.next_step_date_time} ({call.next_step_channel || 'WhatsApp'})
                        </div>
                      )}
                    </td>

                    {/* Duration */}
                    <td style={{ padding: '14px 20px', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s
                    </td>

                    {/* Caller */}
                    <td style={{ padding: '14px 20px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {call.caller_name}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        {call.call_id_status === 'ACTIVE' && onResumeCall && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onResumeCall(call);
                            }}
                            className="btn btn-secondary"
                            style={{
                              padding: '5px 10px',
                              fontSize: '0.74rem',
                              borderRadius: '5px',
                              background: 'rgba(245, 158, 11, 0.15)',
                              borderColor: 'rgba(245, 158, 11, 0.4)',
                              color: '#fbbf24',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                            title="Pick up or Callback this active call"
                          >
                            <PhoneCall size={12} />
                            Pick Up / Callback
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCallForInspection(call);
                          }}
                          className="btn btn-outline"
                          style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                          title="View Dossier"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCallToDelete(call);
                          }}
                          className="btn btn-outline"
                          style={{ padding: '6px 10px', fontSize: '0.75rem', color: '#ef4444' }}
                          title="Delete call"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* In-App Delete Confirmation Modal */}
      {callToDelete && (
        <div 
          onClick={() => setCallToDelete(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="glass-panel" 
            style={{
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              background: '#0f172a',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                  Delete Call Record?
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  This call will be permanently deleted from the database.
                </span>
              </div>
            </div>

            <div style={{
              padding: '12px 14px',
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '20px',
              fontSize: '0.84rem',
              color: '#e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div><strong>Call ID:</strong> <span style={{ fontFamily: 'monospace', color: '#818cf8' }}>{callToDelete.call_id || callToDelete.id}</span></div>
              <div><strong>Company:</strong> {callToDelete.company_name}</div>
              <div><strong>Contact:</strong> {callToDelete.contact_name}</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setCallToDelete(null)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.84rem' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="btn btn-primary"
                style={{
                  padding: '8px 18px',
                  fontSize: '0.84rem',
                  background: '#dc2626',
                  borderColor: '#ef4444',
                  fontWeight: 800
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
