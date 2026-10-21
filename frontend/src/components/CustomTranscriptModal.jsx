import React, { useState } from 'react';
import { X, Sparkles, FileText, ArrowRight } from 'lucide-react';
import { api } from '../api';

export default function CustomTranscriptModal({ onClose, onTranscriptLoaded }) {
  const [rawText, setRawText] = useState(`CALLER: Hello.
PROSPECT: Hello.
CALLER: Am I speaking with Mr. Rajesh?
PROSPECT: Yes, tell me.
CALLER: Hi Rajesh ji, this is Arjun calling from Meridian Growth Partners. We work with precision engineering firms on their operational challenges. Is this the right time to speak?
PROSPECT: Haan, boliye.
CALLER: We prepared a 2-page growth analysis looking at capacity bottlenecks in manufacturing. Would you be interested to see what we found?
PROSPECT: Look, we already have an operations consultant visiting next month.
CALLER: Completely understand sir. Our report is purely a competitive benchmark of the top 3 players in your space. Can I share it on WhatsApp?
PROSPECT: Okay, send it on WhatsApp to this number.
CALLER: Perfect. Can I touch base with you next Wednesday afternoon?
PROSPECT: Yes, after 3 PM is fine.
CALLER: Thank you Rajesh ji.`);

  const [companyName, setCompanyName] = useState('Rajesh Precision Tools');
  const [callerName, setCallerName] = useState('Arjun, Meridian Growth Partners');
  const [loading, setLoading] = useState(false);

  const handleParseAndLoad = async () => {
    if (!rawText.trim()) return;
    setLoading(true);
    try {
      const parsed = await api.parseCustomTranscript({
        raw_text: rawText,
        company_name: companyName,
        caller_name: callerName
      });
      onTranscriptLoaded(parsed);
      onClose();
    } catch (err) {
      alert('Failed to parse: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '680px',
        padding: '24px',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        animation: 'slideIn 0.2s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="#818cf8" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
              Paste Custom Cold Call Transcript
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Company Name:
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-color)',
                color: '#ffffff',
                fontSize: '0.85rem'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Caller:
            </label>
            <input
              type="text"
              value={callerName}
              onChange={(e) => setCallerName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-color)',
                color: '#ffffff',
                fontSize: '0.85rem'
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
            Dialogue Turns (CALLER: ... / PROSPECT: ...):
          </label>
          <textarea
            rows={10}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-mono)',
              lineHeight: '1.5'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <button onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
          <button
            onClick={handleParseAndLoad}
            disabled={loading}
            className="btn btn-primary"
            style={{ padding: '8px 20px' }}
          >
            <Sparkles size={15} />
            {loading ? 'Processing...' : 'Load into Companion'}
          </button>
        </div>
      </div>
    </div>
  );
}
