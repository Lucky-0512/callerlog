import React from 'react';
import { PhoneCall, FileText, BarChart3, Settings, Play, Sparkles, Database } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenSettings, onOpenCustomModal }) {
  return (
    <header className="navbar glass-panel" style={{ margin: '16px 20px', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          borderRadius: '10px', 
          background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 0 15px rgba(79, 70, 229, 0.4)'
        }}>
          <PhoneCall size={20} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
              CallerLog <span style={{ color: '#818cf8', fontWeight: 600, fontSize: '0.9rem' }}>AI</span>
            </h1>
            <span className="badge badge-primary" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
              Meridian Cold Calling
            </span>
          </div>
        </div>
      </div>

      {/* Nav Tabs */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.25)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
        <button
          onClick={() => setActiveTab('companion')}
          className={`btn ${activeTab === 'companion' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '7px 16px', fontSize: '0.82rem', borderRadius: '7px' }}
        >
          <PhoneCall size={15} />
          Active Companion
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`btn ${activeTab === 'ledger' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '7px 16px', fontSize: '0.82rem', borderRadius: '7px' }}
        >
          <FileText size={15} />
          Call Ledger
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '7px 16px', fontSize: '0.82rem', borderRadius: '7px' }}
        >
          <BarChart3 size={15} />
          Funnel Analytics
        </button>
      </nav>

      {/* Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

        <button
          onClick={onOpenCustomModal}
          className="btn btn-secondary"
          style={{ padding: '7px 12px', fontSize: '0.8rem', borderRadius: '8px' }}
          title="Paste custom cold call transcript"
        >
          <Sparkles size={14} color="#818cf8" />
          Paste Call
        </button>

        <button
          onClick={onOpenSettings}
          className="btn btn-outline"
          style={{ padding: '7px 10px', borderRadius: '8px' }}
          title="Settings & API Key"
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}
