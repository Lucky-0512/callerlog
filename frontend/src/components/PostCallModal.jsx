import React, { useState } from 'react';
import {
  X, Check, Copy, ExternalLink,
  ShieldAlert, ArrowRight, Share2, Phone, Calendar
} from 'lucide-react';
import { api } from '../api';

export default function PostCallModal({ analysis, onClose, onViewLedger }) {
  if (!analysis) return null;

  const [currentData, setCurrentData] = useState(analysis);
  const [copied, setCopied] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [showChunks, setShowChunks] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [showRevisionPanel, setShowRevisionPanel] = useState(false);
  const [userFeedback, setUserFeedback] = useState('');
  const [revisionSuccess, setRevisionSuccess] = useState(null);

  const outcomeConfig = {
    next_step_agreed:         { cls: 'badge-success', label: 'Next Step Agreed' },
    agreed_to_receive_report: { cls: 'badge-success', label: 'Agreed to Receive Report' },
    interested:               { cls: 'badge-primary', label: 'Interested' },
    follow_up:                { cls: 'badge-warning', label: 'Follow Up' },
    call_again:               { cls: 'badge-neutral', label: 'Call Again' },
    not_interested:           { cls: 'badge-danger',  label: 'Not Interested' },
    do_not_call:              { cls: 'badge-danger',  label: 'Do Not Call' },
    wrong_person:             { cls: 'badge-warning', label: 'Wrong Person' },
    moved_company:            { cls: 'badge-warning', label: 'Moved Company' },
    not_logged:               { cls: 'badge-neutral', label: 'Not Logged' },
  };

  const oc = outcomeConfig[currentData.outcome] || { cls: 'badge-neutral', label: currentData.outcome ? currentData.outcome.replace(/_/g, ' ') : 'Unknown' };

  const ALL_STAGES = [
    { num: 1, name: 'Opening' },
    { num: 2, name: 'Purpose' },
    { num: 3, name: 'Permission' },
    { num: 4, name: 'Business' },
    { num: 5, name: 'Their Need' },
    { num: 6, name: 'Objection' },
    { num: 7, name: 'Next Step' },
    { num: 8, name: 'Close' },
  ];

  const stageColors = {
    1: '#818cf8', 2: '#a78bfa', 3: '#60a5fa', 4: '#34d399',
    5: '#fbbf24', 6: '#f87171', 7: '#10b981', 8: '#6ee7b7',
  };

  const maxStageNum = Number(currentData.max_stage_number || 1);
  const [selectedStageTab, setSelectedStageTab] = useState(maxStageNum);
  const reachedNums = new Set(
    currentData.stage_chunks && currentData.stage_chunks.length > 0
      ? currentData.stage_chunks.map(c => Number(c.stage_number))
      : Array.from({ length: maxStageNum }, (_, i) => i + 1)
  );

  // STRICT REQUIREMENT: WhatsApp follow-up ONLY when call reached Stage 7 or 8 AND agreed on next step / report
  const showWhatsApp = maxStageNum >= 7 && ['next_step_agreed', 'agreed_to_receive_report'].includes(currentData.outcome);

  const buildWhatsAppText = () => {
    const lines = [
      `Hi ${currentData.prospect_name || 'there'} ji,`,
      `This is ${currentData.caller_name || 'Meridian Growth Partners'} following up on our call regarding ${currentData.company_name || 'your company'}.`
    ];

    if (currentData.stage_5_need_verbatim) {
      lines.push(`\nAs you mentioned: "${currentData.stage_5_need_verbatim.trim()}" - we have put together a concise 2-page growth analysis with specific margin and volume levers tailored to your industry.`);
    }

    if (currentData.next_step_action) {
      lines.push(`\nAs agreed, sharing the document here. Let's connect on ${currentData.next_step_date_time || 'our scheduled follow-up'} to review key findings.`);
    } else {
      lines.push(`\nSharing the document below for your review. Would love to hear your thoughts when you have 5 minutes.`);
    }

    lines.push(`\nBest regards,\n${currentData.caller_name || 'Arjun'}\nMeridian Growth Partners, Hyderabad`);
    return lines.join('\n');
  };

  const whatsappMessage = buildWhatsAppText();

  const handleCopy = () => {
    navigator.clipboard.writeText(whatsappMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(whatsappMessage);
    const cleanPhone = phoneInput.replace(/\D/g, '');
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleReSynthesize = async () => {
    if (!userFeedback.trim()) return;
    setIsRevising(true);
    setRevisionSuccess(null);
    try {
      const revised = await api.reviseAnalysis({
        call_id: currentData.call_id,
        raw_transcript: currentData.raw_transcript || currentData.summary || '',
        user_feedback: userFeedback,
        current_max_stage: maxStageNum,
        company_name: currentData.company_name,
        prospect_name: currentData.prospect_name
      });
      setCurrentData(revised);
      setSelectedStageTab(revised.max_stage_number || 1);
      setRevisionSuccess('AI re-synthesized the call analysis with your feedback!');
      setShowRevisionPanel(false);
      setUserFeedback('');
    } catch (err) {
      console.error('Re-synthesis failed:', err);
      alert('Revision failed: ' + err.message);
    } finally {
      setIsRevising(false);
    }
  };

  const handleDone = async () => {
    setIsSaving(true);
    try {
      const payload = {
        transcript_id: currentData.transcript_id,
        call_id: currentData.call_id,
        company_name: currentData.company_name,
        prospect_name: currentData.prospect_name || 'Prospect',
        prospect_role: currentData.prospect_role || 'Executive',
        caller_name: currentData.caller_name || 'Priya',
        duration_seconds: currentData.duration_seconds || 0,
        max_stage_number: currentData.max_stage_number || 1,
        max_stage_name: currentData.max_stage_name || 'Opening',
        outcome: currentData.outcome || 'not_logged',
        stage_5_need_verbatim: currentData.stage_5_need_verbatim,
        objection_summary: currentData.objection_summary,
        next_step_action: currentData.next_step_action,
        next_step_date_time: currentData.next_step_date_time,
        next_step_channel: currentData.next_step_channel,
        where_you_left_off_summary: currentData.where_you_left_off_summary,
        suggested_callback_bridge: currentData.suggested_callback_bridge,
        stage_blocks: currentData.stage_blocks || {},
        selected_taps: currentData.selected_taps,
        stage_words: currentData.stage_words,
        raw_transcript: currentData.raw_transcript
      };
      await api.saveReviewedCall(payload);
    } catch (e) {
      console.warn('Auto-save on modal done:', e);
    } finally {
      setIsSaving(false);
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, sans-serif'
        }}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 22px',
          borderBottom: '1px solid #1e293b',
          backgroundColor: '#1e293b'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: maxStageNum >= 7 ? '#34d399' : '#94a3b8', fontWeight: 700 }}>
                {maxStageNum >= 7 ? '✓ Post-Call Intelligence & Deliverable' : 'Post-Call Stage Log (No Deliverable · Active Call)'}
              </span>
              <span className={`badge ${oc.cls}`} style={{ fontSize: '0.7rem' }}>
                {oc.label}
              </span>
              <span style={{
                fontFamily: 'monospace',
                fontSize: '0.72rem',
                fontWeight: 800,
                color: '#a5b4fc',
                background: 'rgba(99, 102, 241, 0.2)',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(99, 102, 241, 0.4)'
              }}>
                {currentData.call_id || 'CALL-1001'}
              </span>
              {currentData.call_id_status === 'ACTIVE' || (currentData.max_stage_number < 8) ? (
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: '#92400e',
                  background: '#fef3c7',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid #fde68a'
                }}>
                  ● ACTIVE · ATTEMPT #{currentData.attempt_count || 1}
                </span>
              ) : (
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: '#166534',
                  background: '#dcfce7',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid #bbf7d0'
                }}>
                  ✓ CLOSED (STAGE 8)
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: '3px 0 0 0' }}>
              {currentData.company_name} · Stage {currentData.max_stage_number}: {currentData.max_stage_name}
            </h2>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '6px',
              border: '1px solid #334155',
              background: '#0f172a',
              color: '#94a3b8',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content Scroll */}
        <div style={{ padding: '22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* AI Re-synthesis Success Alert */}
          {revisionSuccess && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '8px',
              color: '#6ee7b7',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600
            }}>
              <Check size={18} color="#10b981" />
              <span>{revisionSuccess}</span>
            </div>
          )}

          {/* AI Re-Synthesis / Feedback Drawer */}
          {showRevisionPanel && (
            <div style={{
              padding: '16px 18px',
              background: '#0a0f1d',
              border: '1px solid #3b82f6',
              borderRadius: '10px',
              boxShadow: '0 4px 20px rgba(59, 130, 246, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚡ AI Re-Synthesis & Clarification Gate
                </span>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Step 5 Active Loop</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                Review spoken dialogue and submit corrections. AI will re-synthesize stage classifications, verbatim quotes, and WhatsApp follow-up instantly.
              </p>
              
              <textarea
                rows={3}
                value={userFeedback}
                onChange={(e) => setUserFeedback(e.target.value)}
                placeholder="e.g. Prospect agreed to review proposal on Friday 3pm. Update next step to agreed_to_receive_report and refine their need quote."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => setShowRevisionPanel(false)}
                  disabled={isRevising}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    background: 'transparent',
                    border: '1px solid #334155',
                    color: '#94a3b8',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReSynthesize}
                  disabled={isRevising || !userFeedback.trim()}
                  style={{
                    padding: '7px 18px',
                    borderRadius: '6px',
                    background: isRevising || !userFeedback.trim() ? '#334155' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: isRevising || !userFeedback.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isRevising ? (
                    <>
                      <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
                      Re-synthesizing Analysis...
                    </>
                  ) : (
                    <>
                      ⚡ Re-synthesize with AI
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Continuity Persistence Notice for Active Calls */}
          {(currentData.call_id_status === 'ACTIVE' || currentData.max_stage_number < 8) && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '8px',
              fontSize: '0.82rem',
              color: '#fde68a',
              lineHeight: '1.45'
            }}>
              <strong style={{ color: '#fbbf24' }}>Persistent Call ID Assigned: {currentData.call_id || 'CALL-ACTIVE'}</strong>
              <div style={{ marginTop: '3px', color: '#cbd5e1' }}>
                This call has not reached Stage 8 Close yet and remains <strong>ACTIVE</strong>. When you ring back in 5-7 days and reinitiate this target, the system will reuse this exact Call ID and update it in-place without creating duplicate entries in your past calls ledger.
              </div>
              {currentData.suggested_callback_bridge && (
                <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px dashed rgba(245, 158, 11, 0.4)' }}>
                  <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase' }}>Suggested Callback Bridge: </span>
                  <span style={{ color: '#ffffff', fontStyle: 'italic' }}>"{currentData.suggested_callback_bridge}"</span>
                </div>
              )}
              {maxStageNum < 7 && (
                <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(30, 58, 138, 0.25)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.35)', color: '#bfdbfe', fontSize: '0.76rem' }}>
                  <strong>ℹ️ Deliverable Policy:</strong> No external deliverable exists for this call. Deliverables (such as WhatsApp briefs) are strictly generated only when calls reach Stage 7 (Next Step Agreed) or Stage 8 (Closed).
                </div>
              )}
            </div>
          )}
          
          {/* Key Call Metadata */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid #1e293b',
            fontSize: '0.8rem'
          }}>
            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem' }}>PROSPECT</span>
              <strong style={{ color: '#ffffff' }}>{currentData.prospect_name || 'Executive'}</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem' }}>ROLE</span>
              <strong style={{ color: '#ffffff' }}>{currentData.prospect_role || 'Director'}</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem' }}>DURATION</span>
              <strong style={{ color: '#ffffff' }}>{currentData.duration_seconds || 0} seconds</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem' }}>CALLER</span>
              <strong style={{ color: '#ffffff' }}>{currentData.caller_name ? currentData.caller_name.split(',')[0] : 'Arjun'}</strong>
            </div>
          </div>

          {/* 8-Stage Progression Journey (Interactive Tabs) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', fontWeight: 700 }}>
                8-Stage Call Progression (Highest: Stage {currentData.max_stage_number})
              </div>
              <span style={{ fontSize: '0.68rem', color: '#60a5fa' }}>Click any stage pill to inspect preset & words</span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${ALL_STAGES.slice(0, maxStageNum).length}, 1fr)`,
              gap: '6px'
            }}>
              {ALL_STAGES.slice(0, maxStageNum).map((s) => {
                const reached = reachedNums.has(s.num) || s.num <= maxStageNum;
                const isSelected = selectedStageTab === s.num;
                return (
                  <button
                    key={s.num}
                    onClick={() => setSelectedStageTab(s.num)}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '6px',
                      textAlign: 'center',
                      background: isSelected ? '#2563eb' : (reached ? 'rgba(37, 99, 235, 0.2)' : '#1e293b'),
                      border: isSelected ? '2px solid #93c5fd' : (reached ? '1px solid rgba(37, 99, 235, 0.4)' : '1px solid #334155'),
                      color: reached || isSelected ? '#ffffff' : '#64748b',
                      cursor: 'pointer',
                      outline: 'none',
                      boxShadow: isSelected ? '0 0 10px rgba(37, 99, 235, 0.5)' : 'none',
                      transition: 'all 0.12s ease'
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', fontWeight: 800 }}>{s.num}</div>
                    <div style={{ fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Stage Inspection Card */}
          {selectedStageTab && (
            <div style={{
              padding: '14px 18px',
              borderRadius: '8px',
              background: '#0a0f1d',
              border: '1px solid #334155',
              borderLeft: `4px solid ${stageColors[selectedStageTab] || '#3b82f6'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff' }}>
                  Stage {selectedStageTab}: {ALL_STAGES.find(s => s.num === selectedStageTab)?.name}
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: (reachedNums.has(selectedStageTab) || selectedStageTab <= maxStageNum) ? '#10b981' : '#94a3b8',
                  background: (reachedNums.has(selectedStageTab) || selectedStageTab <= maxStageNum) ? 'rgba(16, 185, 129, 0.1)' : '#1e293b',
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}>
                  {(reachedNums.has(selectedStageTab) || selectedStageTab <= maxStageNum) ? '✓ Reached in Call' : 'Not Reached'}
                </span>
              </div>

              {/* Selected Preset */}
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, display: 'block' }}>
                  Predefined Preset Selected:
                </span>
                <div style={{
                  marginTop: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}>
                  <Check size={13} />
                  {currentData.stage_blocks?.[selectedStageTab]?.selected_preset || currentData.selected_taps?.[selectedStageTab] || (selectedStageTab <= maxStageNum ? 'Option Logged' : 'None')}
                </div>
              </div>

              {/* Prospect Words */}
              <div>
                <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, display: 'block' }}>
                  Prospect's Words / Verbatim:
                </span>
                <p style={{
                  fontSize: '0.85rem',
                  color: '#e2e8f0',
                  margin: '4px 0 0 0',
                  fontStyle: 'italic',
                  lineHeight: '1.4',
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #1e293b'
                }}>
                  "{currentData.stage_blocks?.[selectedStageTab]?.prospect_words || currentData.stage_words?.[selectedStageTab] || (selectedStageTab === 5 ? (currentData.stage_5_need_verbatim || 'No verbatim need quote') : (selectedStageTab === 6 ? (currentData.objection_summary || 'No objection quote') : 'Discussed stage topics.'))}"
                </p>
              </div>
            </div>
          )}

          {/* Stage 5: Their Need In Their Words (Crucial Ground Truth) */}
          {currentData.stage_5_need_verbatim && (
            <div style={{
              padding: '14px 18px',
              borderRadius: '8px',
              background: 'rgba(251, 191, 36, 0.08)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderLeft: '4px solid #fbbf24'
            }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fbbf24', fontWeight: 700, marginBottom: '4px' }}>
                STAGE 5 · THEIR NEED, IN THEIR WORDS
              </div>
              <p style={{ fontSize: '0.92rem', color: '#fef3c7', margin: 0, fontStyle: 'italic', lineHeight: '1.45' }}>
                "{currentData.stage_5_need_verbatim}"
              </p>
            </div>
          )}

          {/* Stage 6: Objection Logged */}
          {currentData.objection_summary && (
            <div style={{
              padding: '14px 18px',
              borderRadius: '8px',
              background: 'rgba(248, 113, 113, 0.08)',
              border: '1px solid rgba(248, 113, 113, 0.3)',
              borderLeft: '4px solid #f87171'
            }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#f87171', fontWeight: 700, marginBottom: '4px' }}>
                STAGE 6 · OBJECTION ENCOUNTERED
              </div>
              <p style={{ fontSize: '0.9rem', color: '#fee2e2', margin: 0, lineHeight: '1.45' }}>
                {currentData.objection_summary}
              </p>
            </div>
          )}

          {/* Stage 7/8: Next Step Agreed */}
          {currentData.next_step_action && (
            <div style={{
              padding: '14px 18px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderLeft: '4px solid #10b981'
            }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#34d399', fontWeight: 700, marginBottom: '4px' }}>
                STAGE 7 · NEXT STEP AGREED
              </div>
              <p style={{ fontSize: '0.9rem', color: '#d1fae5', margin: 0, fontWeight: 600 }}>
                {currentData.next_step_action}
              </p>
              {currentData.next_step_date_time && (
                <div style={{ fontSize: '0.78rem', color: '#6ee7b7', marginTop: '4px' }}>
                  Scheduled: {currentData.next_step_date_time} (Channel: {currentData.next_step_channel || 'WhatsApp'})
                </div>
              )}
            </div>
          )}

          {/* CONDITIONAL WHATSAPP FOLLOW-UP: Only shown if Stage 7/8 reached with agreement */}
          {showWhatsApp && (
            <div style={{
              padding: '16px 18px',
              borderRadius: '8px',
              background: 'rgba(37, 211, 102, 0.06)',
              border: '1px solid rgba(37, 211, 102, 0.3)',
              borderLeft: '4px solid #25d366'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Share2 size={16} color="#25d366" />
                  <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#25d366', fontWeight: 700 }}>
                    WhatsApp Follow-up (Agreed on Call)
                  </span>
                </div>
                <button
                  onClick={handleCopy}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy Text'}
                </button>
              </div>

              <textarea
                readOnly
                value={whatsappMessage}
                rows={4}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: '#0a0f1d',
                  border: '1px solid #1e293b',
                  color: '#e2e8f0',
                  fontSize: '0.82rem',
                  fontFamily: 'monospace',
                  resize: 'none',
                  boxSizing: 'border-box'
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                <input
                  type="text"
                  placeholder="Optional prospect phone (e.g. 9876543210)"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '7px 12px',
                    borderRadius: '6px',
                    background: '#0a0f1d',
                    border: '1px solid #334155',
                    color: '#ffffff',
                    fontSize: '0.8rem'
                  }}
                />
                <button
                  onClick={handleOpenWhatsApp}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#25d366',
                    color: '#0f172a',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <ExternalLink size={14} />
                  Open WhatsApp
                </button>
              </div>
            </div>
          )}

          {/* Sequential Stage Chunks Toggle */}
          {currentData.stage_chunks && currentData.stage_chunks.length > 0 && (
            <div>
              <button
                onClick={() => setShowChunks(!showChunks)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1px solid #1e293b',
                  background: 'rgba(255, 255, 255, 0.02)',
                  color: '#94a3b8',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>Chronological Stage Partitioning ({currentData.stage_chunks.length} blocks)</span>
                <span>{showChunks ? 'Hide' : 'Show'}</span>
              </button>

              {showChunks && (
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {currentData.stage_chunks.map((chunk, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        background: '#0a0f1d',
                        border: '1px solid #1e293b',
                        borderLeft: `3px solid ${stageColors[chunk.stage_number] || '#818cf8'}`
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff' }}>
                          Stage {chunk.stage_number}: {chunk.stage_name}
                        </span>
                        {chunk.start_turn !== undefined && (
                          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                            Turns {chunk.start_turn + 1}-{chunk.end_turn + 1}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.82rem', color: '#cbd5e1', margin: 0 }}>
                        {chunk.summary}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 22px',
          borderTop: '1px solid #1e293b',
          backgroundColor: '#1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setShowRevisionPanel(!showRevisionPanel)}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #3b82f6',
                background: showRevisionPanel ? '#1e3a8a' : 'rgba(59, 130, 246, 0.15)',
                color: '#93c5fd',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              ✏️ Request AI Revision
            </button>

            <button
              onClick={() => {
                onClose();
                if (onViewLedger) onViewLedger();
              }}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #334155',
                background: '#0f172a',
                color: '#cbd5e1',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              📂 View in Past Calls
            </button>
          </div>

          <button
            onClick={handleDone}
            disabled={isSaving}
            style={{
              padding: '8px 22px',
              borderRadius: '6px',
              border: 'none',
              background: '#10b981',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isSaving ? (
              <>
                <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
                Approving...
              </>
            ) : (
              <>
                <Check size={16} />
                {maxStageNum >= 7 ? 'Approve Deliverable' : 'Approve Call Log'}
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
