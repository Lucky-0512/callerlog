import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingDown, Clock, CheckCircle2, AlertOctagon, 
  Layers, ArrowDownRight, RefreshCw, Building 
} from 'lucide-react';
import { api } from '../api';

export default function FunnelAnalytics() {
  const [source, setSource] = useState('all'); // all, benchmark_100, db
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.getAnalyticsOverview(source);
      setData(res);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [source]);

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
        Calculating 8-stage drop-off analytics...
      </div>
    );
  }

  const stageColors = [
    '#6366f1', '#4f46e5', '#3b82f6', '#0ea5e9',
    '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'
  ];

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 20px 40px 20px' }}>
      
      {/* Header Bar */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0' }}>
            8-Stage Funnel & Drop-off Intelligence
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            {source === 'all' 
              ? `Real-time drop-off funnel from your ${data?.total_calls_analyzed || 0} logged calls in the database`
              : 'Benchmark reference funnel from the 100 pre-loaded Meridian cold-call transcripts'}
          </p>
        </div>

        {/* Source Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setSource('all')}
            className={`btn ${source === 'all' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '6px 14px', fontSize: '0.78rem', borderRadius: '6px', fontWeight: source === 'all' ? 800 : 600 }}
          >
            Live Logged Calls {data && source === 'all' ? `(${data.total_calls_analyzed})` : ''}
          </button>
          <button
            onClick={() => setSource('benchmark_100')}
            className={`btn ${source === 'benchmark_100' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '6px 14px', fontSize: '0.78rem', borderRadius: '6px', fontWeight: source === 'benchmark_100' ? 800 : 600 }}
          >
            100 Baseline Transcripts
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        
        {/* Card 1: Total Calls */}
        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
              Calls Analyzed
            </span>
            <Layers size={18} color="#818cf8" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>
            {data?.total_calls_analyzed || 0}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
            Real B2B conversations
          </span>
        </div>

        {/* Card 2: Avg Call Duration */}
        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
              Avg Duration
            </span>
            <Clock size={18} color="#06b6d4" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>
            {data?.avg_call_duration_seconds ? `${Math.round(data.avg_call_duration_seconds)}s` : '0s'}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
            Average cold decision window
          </span>
        </div>

        {/* Card 3: Stage 7 Next Step Rate */}
        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
              Next Step Conversion
            </span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34d399' }}>
            {data?.stage_funnel?.[6]?.percentage || 0}%
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
            Agreed report or meeting
          </span>
        </div>

        {/* Card 4: Top Drop-off Stage */}
        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
              Primary Friction Point
            </span>
            <AlertOctagon size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24', marginTop: '6px' }}>
            Stage 3: Permission
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
            Where most calls exit early
          </span>
        </div>
      </div>

      {/* Main 8-Stage Funnel Visualizer */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', marginBottom: '16px' }}>
          8-Stage Progression Funnel
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data?.stage_funnel?.map((stage, idx) => {
            const barWidth = Math.max(8, stage.percentage);
            const color = stageColors[idx % stageColors.length];

            return (
              <div key={stage.stage_number} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: color,
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {stage.stage_number}
                    </span>
                    <strong style={{ color: '#ffffff' }}>{stage.stage_name}</strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {stage.count} calls ({stage.percentage}%)
                    </span>
                    {stage.drop_off_count > 0 && (
                      <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.75rem' }}>
                        <ArrowDownRight size={13} />
                        -{stage.drop_off_count} dropped
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: '14px', width: '100%', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${barWidth}%`,
                    background: `linear-gradient(90deg, ${color} 0%, rgba(255,255,255,0.4) 100%)`,
                    borderRadius: '6px',
                    transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Outcomes Distribution */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', marginBottom: '16px' }}>
          Standard Cold Call Outcomes Breakdown
        </h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {data?.outcomes_breakdown && Object.entries(data.outcomes_breakdown).map(([outcome, count]) => (
            <div
              key={outcome}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <span style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
                {outcome.replace(/_/g, ' ')}
              </span>
              <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
