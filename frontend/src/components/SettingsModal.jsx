import React, { useState, useEffect } from 'react';
import { X, Key, Database, Check, Copy, Sparkles, ExternalLink, Globe, Wifi, AlertTriangle } from 'lucide-react';
import { api, getApiBaseUrl } from '../api';

export default function SettingsModal({ onClose, onConfigSaved }) {
  const [apiUrl, setApiUrl] = useState(
    localStorage.getItem('callerlog_api_url') || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
  );
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('callerlog_gemini_key') || '');
  const [saved, setSaved] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  
  // Connection testing state
  const [testStatus, setTestStatus] = useState(null); // 'testing', 'success', 'error'
  const [testMessage, setTestMessage] = useState('');

  const testConnection = async () => {
    setTestStatus('testing');
    setTestMessage('Pinging backend server...');
    try {
      let cleanUrl = apiUrl.trim().replace(/\/+$/, '');
      if (cleanUrl.endsWith('/api')) {
        cleanUrl = cleanUrl.replace(/\/api$/, '');
      }
      
      const res = await fetch(`${cleanUrl}/`, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      
      setTestStatus('success');
      setTestMessage(`Connected to ${data.service || 'CallerLog'} | DB: ${data.database || 'Connected'}`);
    } catch (err) {
      setTestStatus('error');
      setTestMessage(`Failed to reach server: ${err.message}. Make sure Render service is live and CORS is set to *`);
    }
  };

  const handleSave = () => {
    let cleanApi = apiUrl.trim().replace(/\/+$/, '');
    if (cleanApi && !cleanApi.endsWith('/api') && cleanApi.startsWith('http')) {
      cleanApi = `${cleanApi}/api`;
    }
    
    if (cleanApi) {
      localStorage.setItem('callerlog_api_url', cleanApi);
    } else {
      localStorage.removeItem('callerlog_api_url');
    }

    if (geminiKey.trim()) {
      localStorage.setItem('callerlog_gemini_key', geminiKey.trim());
    } else {
      localStorage.removeItem('callerlog_gemini_key');
    }

    setSaved(true);
    if (onConfigSaved) onConfigSaved();
    setTimeout(() => {
      setSaved(false);
      onClose();
      window.location.reload();
    }, 1000);
  };

  const handleResetApi = () => {
    localStorage.removeItem('callerlog_api_url');
    setApiUrl(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api');
    setTestStatus(null);
    setTestMessage('');
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
        maxWidth: '600px',
        maxHeight: '90vh',
        overflowY: 'auto',
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
              Engine & Cloud Deployment Settings
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Backend API Server URL (RENDER) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Globe size={15} color="#06b6d4" />
              Backend API Base URL (Render)
            </label>
            <button
              onClick={handleResetApi}
              style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Reset to Default
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="https://callerlog-backend.onrender.com/api"
              value={apiUrl}
              onChange={(e) => {
                setApiUrl(e.target.value);
                setTestStatus(null);
              }}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-color)',
                color: '#ffffff',
                fontSize: '0.88rem'
              }}
            />
            <button
              onClick={testConnection}
              className="btn btn-secondary"
              style={{ padding: '0 14px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              disabled={testStatus === 'testing'}
            >
              <Wifi size={14} />
              {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {testStatus && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: testStatus === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${testStatus === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: testStatus === 'success' ? '#34d399' : '#f87171'
            }}>
              {testStatus === 'success' ? <Check size={15} /> : <AlertTriangle size={15} />}
              <span>{testMessage}</span>
            </div>
          )}

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
            Paste your Render Web Service URL here (e.g. <code>https://callerlog-backend.onrender.com/api</code>). This connects Vercel directly to your live backend and Supabase database.
          </p>
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

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
            Optional client key override. When configured, AI synthesis and battlecards run using your key.
          </p>
        </div>

        {/* Supabase Postgres Schema Section */}
        <div className="glass-panel-subtle" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Database size={15} color="#34d399" />
              Supabase PostgreSQL Database
            </span>
            <button
              onClick={copySupabaseSql}
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              {copiedSql ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
              {copiedSql ? 'Copied SQL!' : 'Copy SQL Schema'}
            </button>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
            CallerLog backend is configured with Supabase PostgreSQL. Tables: <code>companies</code>, <code>contacts</code>, and <code>calls</code>.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
          <button
            onClick={onClose}
            className="btn btn-outline"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary"
            style={{ padding: '8px 22px', fontSize: '0.85rem' }}
          >
            {saved ? <Check size={16} /> : null}
            {saved ? 'Saved!' : 'Save & Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
