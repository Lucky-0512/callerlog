import React, { useState } from 'react';
import { X, Key, Database, Check, Copy, Sparkles, ExternalLink } from 'lucide-react';

export default function SettingsModal({ onClose }) {
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('callerlog_gemini_key') || '');
  const [saved, setSaved] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleSave = () => {
    localStorage.setItem('callerlog_gemini_key', geminiKey.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  const handleClear = () => {
    localStorage.removeItem('callerlog_gemini_key');
    setGeminiKey('');
  };

  const copySupabaseSql = () => {
    const sql = `-- CallerLog: Supabase PostgreSQL Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    company_kind VARCHAR(100) DEFAULT 'not known',
    industry VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    role_title VARCHAR(255) DEFAULT 'not known',
    phone_number VARCHAR(50),
    email VARCHAR(255),
    personal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    transcript_id VARCHAR(50),
    caller_name VARCHAR(100) NOT NULL,
    duration_seconds INTEGER DEFAULT 0,
    max_stage_number INTEGER NOT NULL DEFAULT 1,
    max_stage_name VARCHAR(50) NOT NULL,
    outcome VARCHAR(50) NOT NULL DEFAULT 'not_logged',
    stage_5_need_verbatim TEXT,
    objection_summary TEXT,
    next_step_action VARCHAR(255),
    next_step_date_time VARCHAR(100),
    next_step_channel VARCHAR(50),
    raw_transcript TEXT NOT NULL,
    stage_analysis JSONB DEFAULT '[]'::jsonb,
    call_timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read/write access for companies" ON companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read/write access for contacts" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read/write access for calls" ON calls FOR ALL USING (true) WITH CHECK (true);`;

    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
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
        maxWidth: '560px',
        padding: '24px',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        animation: 'slideIn 0.2s ease'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} color="#818cf8" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
              Engine & Database Settings
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Gemini API Key Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={15} color="#818cf8" />
              Google Gemini API Key
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '0.75rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
            >
              Get Free Key <ExternalLink size={12} />
            </a>
          </div>

          <input
            type="password"
            placeholder="AIzaSy..."
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-color)',
              color: '#ffffff',
              fontSize: '0.9rem'
            }}
          />

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Optional. When set, CallerLog uses <strong>Gemini 2.0 Flash</strong> for transcript extraction. If left blank, the app seamlessly runs on the built-in 8-stage heuristic intelligence engine.
          </p>
        </div>

        {/* Supabase Postgres Schema Section */}
        <div className="glass-panel-subtle" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Database size={15} color="#34d399" />
              Supabase Postgres Migration
            </span>
            <button
              onClick={copySupabaseSql}
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              {copiedSql ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
              {copiedSql ? 'Copied SQL!' : 'Copy SQL Script'}
            </button>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Currently using <strong>Local SQLite (callerlog.db)</strong> with zero setup required. Whenever you create a Supabase project, paste this SQL in Supabase's SQL Editor and put your connection URL into <code>backend/.env</code>.
          </p>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
          {geminiKey && (
            <button
              onClick={handleClear}
              className="btn btn-outline"
              style={{ padding: '8px 14px', fontSize: '0.85rem' }}
            >
              Clear Key
            </button>
          )}
          <button
            onClick={handleSave}
            className="btn btn-primary"
            style={{ padding: '8px 20px', fontSize: '0.85rem' }}
          >
            {saved ? <Check size={16} /> : null}
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
