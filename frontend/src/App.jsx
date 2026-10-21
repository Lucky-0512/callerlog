import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import ActiveCompanion from './components/ActiveCompanion';
import CallLedger from './components/CallLedger';
import FunnelAnalytics from './components/FunnelAnalytics';
import PostCallModal from './components/PostCallModal';
import SettingsModal from './components/SettingsModal';
import CustomTranscriptModal from './components/CustomTranscriptModal';
import { api } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('companion'); // companion, ledger, analytics
  const [stages, setStages] = useState([]);
  const [transcriptsList, setTranscriptsList] = useState([]);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  
  // Modals and selection state
  const [activeDossier, setActiveDossier] = useState(null);
  const [activeCallToResume, setActiveCallToResume] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initial data loading
  useEffect(() => {
    async function initData() {
      try {
        setLoading(true);
        const [stagesData, summaries] = await Promise.all([
          api.getStages(),
          api.getTranscripts()
        ]);
        setStages(stagesData);
        setTranscriptsList(summaries);
        // Initially keep selectedTranscript null so the left screen starts completely blank!
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  // Handle transcript switch
  const handleSelectTranscript = async (id) => {
    try {
      const detail = await api.getTranscript(id);
      setSelectedTranscript(detail);
    } catch (err) {
      console.error('Error loading transcript:', err);
    }
  };

  // Handle call ended / analyzed
  const handleCallEnded = (analysisResult) => {
    setActiveDossier(analysisResult);
  };

  // Handle inspecting call from ledger
  const handleSelectCallForInspection = (callRecord) => {
    // Map callRecord to analysis dossier format
    const mapped = {
      transcript_id: callRecord.transcript_id,
      call_id: callRecord.call_id,
      call_id_status: callRecord.call_id_status,
      attempt_count: callRecord.attempt_count,
      company_name: callRecord.company_name,
      company_kind: 'mid-size private company',
      prospect_name: callRecord.contact_name,
      prospect_role: callRecord.contact_role,
      caller_name: callRecord.caller_name,
      duration_seconds: callRecord.duration_seconds,
      max_stage_number: callRecord.max_stage_number,
      max_stage_name: callRecord.max_stage_name,
      outcome: callRecord.outcome,
      stage_5_need_verbatim: callRecord.stage_5_need_verbatim,
      objection_summary: callRecord.objection_summary,
      next_step_action: callRecord.next_step_action,
      next_step_date_time: callRecord.next_step_date_time,
      next_step_channel: callRecord.next_step_channel,
      where_you_left_off_summary: callRecord.where_you_left_off_summary,
      suggested_callback_bridge: callRecord.suggested_callback_bridge,
      caller_last_ask: callRecord.caller_last_ask,
      prospect_final_response: callRecord.prospect_final_response,
      summary: `Logged call with ${callRecord.company_name}. Reached Stage ${callRecord.max_stage_number} (${callRecord.max_stage_name}).`,
      stage_chunks: callRecord.stage_analysis || [],
      turn_classifications: [],
      battlecard: callRecord.objection_summary ? {
        objection: callRecord.objection_summary,
        root_cause: "Prospect raised hesitation regarding timing, vendor lock-in, or division authority.",
        core_talk_track: "Completely understand. We don't replace your existing systems—we provide outside-in benchmark data for leadership.",
        quick_counter_points: [
          "Validate their stability and current operations.",
          "Keep commitment low: 2-page brief on WhatsApp."
        ],
        question_to_ask_next: "When you look at next quarter's growth targets, what is the #1 operational friction point?"
      } : null
    };
    setActiveDossier(mapped);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-main)',
        color: '#ffffff',
        fontFamily: 'var(--font-sans)',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(99, 102, 241, 0.2)', borderTopColor: '#818cf8', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
          Initializing Meridian CallerLog Intelligence...
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenCustomModal={() => setIsCustomModalOpen(true)}
      />

      {/* Main View Router */}
      <main style={{ flex: 1 }}>
        {activeTab === 'companion' && (
          <ActiveCompanion
            selectedTranscript={selectedTranscript}
            onSelectTranscript={handleSelectTranscript}
            transcriptsList={transcriptsList}
            onCallEnded={handleCallEnded}
            onViewLedger={() => setActiveTab('ledger')}
            initialCallToResume={activeCallToResume}
            onClearResumeCall={() => setActiveCallToResume(null)}
          />
        )}

        {activeTab === 'ledger' && (
          <CallLedger
            onSelectCallForInspection={handleSelectCallForInspection}
            onResumeCall={(call) => {
              setActiveCallToResume(call);
              setActiveTab('companion');
            }}
          />
        )}

        {activeTab === 'analytics' && (
          <FunnelAnalytics />
        )}
      </main>

      {/* Post Call Intelligence Modal */}
      {activeDossier && (
        <PostCallModal
          analysis={activeDossier}
          onClose={() => setActiveDossier(null)}
          onViewLedger={() => {
            setActiveDossier(null);
            setActiveTab('ledger');
          }}
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* Custom Transcript Ingestion Modal */}
      {isCustomModalOpen && (
        <CustomTranscriptModal
          onClose={() => setIsCustomModalOpen(false)}
          onTranscriptLoaded={(parsedDetail) => {
            setSelectedTranscript(parsedDetail);
            setActiveTab('companion');
          }}
        />
      )}
    </div>
  );
}
