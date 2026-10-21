import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, Clock, PhoneCall, PhoneOff, ArrowRight, 
  RotateCcw, CheckCircle2, ChevronRight, ChevronDown, ChevronUp, Check,
  Play, Pause, SkipForward, Volume2, VolumeX, Mic, MicOff, Sparkles, Tag, Headphones
} from 'lucide-react';
import { api } from '../api';

export const MERIDIAN_STAGES = [
  {
    num: 1,
    name: 'Opening',
    purpose: 'Reach the right person and say who you are. The prospect decides in the first ten seconds whether this call is worth a minute.',
    theyMaySay: [
      'Who is speaking?',
      'I am driving / in a meeting / at lunch.',
      'This number belongs to someone who left the company.'
    ],
    whatHappened: [
      'Reached right person',
      'Gatekeeper / Switchboard answered',
      'Busy / Call back later',
      'Wrong person / Left company'
    ],
    nextLabel: 'NEXT: PURPOSE'
  },
  {
    num: 2,
    name: 'Purpose',
    purpose: 'Say in one or two sentences why you called, in words the prospect can repeat to a colleague.',
    theyMaySay: [
      'Accounting for what? We have a CA.',
      'Who gave you this number?',
      'I am with a client, is this a sales call?'
    ],
    whatHappened: [
      'Asked what we do',
      'Asked where we got the number',
      'Said it is a sales call',
      'Let me explain purpose'
    ],
    nextLabel: 'NEXT: PERMISSION'
  },
  {
    num: 3,
    name: 'Permission',
    purpose: 'Find out whether they are willing to talk now. A clear yes, a clear no, or a time to call back are all good outcomes.',
    theyMaySay: [
      'Call me after two, call me tomorrow.',
      'Send it on WhatsApp first.',
      'Haan, boliye / Go ahead (short yes).'
    ],
    whatHappened: [
      'Agreed to talk now',
      'Requested callback at specific time',
      'Demanded WhatsApp / Email first',
      'Polite brush-off / Line busy'
    ],
    nextLabel: 'NEXT: THEIR BUSINESS'
  },
  {
    num: 4,
    name: 'Their business',
    purpose: 'Ask about their company and their work before saying anything about yours. People talk about what they do.',
    theyMaySay: [
      'We do precision engineering / chemical formulation.',
      'You have the wrong division, we do not make that.',
      'Tell me about your firm first.'
    ],
    whatHappened: [
      'Described core operations',
      'Corrected company size / division',
      'Asked caller to pitch first',
      'One-line curt response'
    ],
    nextLabel: 'NEXT: THEIR NEED'
  },
  {
    num: 5,
    name: 'Their need, in their words',
    purpose: 'Hear what they are trying to do or struggling with, in their own words. This is the one stage where the caller writes down exactly what was said.',
    theyMaySay: [
      'Trying new approaches is the only way to see what works.',
      'Our plant scrap rate is 18%, looking for higher margins.',
      'Everything is fine, we do not need external consultants.'
    ],
    whatHappened: [
      'Named growth / margin goal',
      'Stated capacity / scrap bottleneck',
      'Claimed no current need',
      'Asked what we can do for their size'
    ],
    nextLabel: 'NEXT: OBJECTION'
  },
  {
    num: 6,
    name: 'Objection',
    purpose: 'Hear the reason for a no and understand it. A reason you understand can be answered on this call or the next.',
    theyMaySay: [
      'We already have an in-house team / CA who files everything.',
      'Not the right person; speak to the owner or marketing.',
      'Send something in writing and we will see.'
    ],
    whatHappened: [
      'Already have in-house team/agency',
      'Wrong person / Referred to director',
      'Polite dismissal: Send in writing',
      'Firm no / Do not call'
    ],
    nextLabel: 'NEXT: NEXT STEP'
  },
  {
    num: 7,
    name: 'Next step',
    purpose: 'Agree one concrete thing: a document on WhatsApp or email, a call at a named time, a meeting.',
    theyMaySay: [
      'Send the report on WhatsApp to this number.',
      'Call me next Tuesday after 2 PM.',
      'Speak to Mr. Suresh on this number.'
    ],
    whatHappened: [
      'Agreed to receive WhatsApp report',
      'Scheduled fixed day/time follow-up',
      'Confirmed Google Meet / Discussion',
      'Referral contact obtained'
    ],
    nextLabel: 'NEXT: CLOSE'
  },
  {
    num: 8,
    name: 'Close',
    purpose: 'End the call clearly and record what happened: the outcome, next step, and the prospect\'s words from stage 5.',
    theyMaySay: [
      'Okay Priya / Arjun, thank you.',
      'Looking forward to the WhatsApp document.',
      '[Call disconnected / line dropped]'
    ],
    whatHappened: [
      'Clear confirmation & warm close',
      'Abrupt line drop / hung up',
      'Polite non-committal goodbye',
      'Next step locked in calendar'
    ],
    nextLabel: 'COMPLETE & LOG CALL'
  }
];

const badgeColor = {
  'NEXT STEP': '#10b981',
  'OPENING': '#818cf8',
  'OBJECTION': '#f87171',
  'THEIR NEED': '#fbbf24',
  'PURPOSE': '#a78bfa',
  'PERMISSION': '#60a5fa',
  'BUSINESS': '#34d399',
  'CLOSE': '#6ee7b7'
};

export default function ActiveCompanion({
  selectedTranscript,
  onSelectTranscript,
  transcriptsList = [],
  onCallEnded,
  onViewLedger,
  initialCallToResume,
  onClearResumeCall
}) {
  // Navigation & stage tracking
  const [activeStage, setActiveStage] = useState(1);
  const [selectedTaps, setSelectedTaps] = useState({});
  const [stageWords, setStageWords] = useState({}); // Per-stage prospect words
  const [stageBoundaries, setStageBoundaries] = useState({}); // The user's timestamped boundary tags
  
  // Background Audio Recording Buffer (Triggers when user advances past Stage 4 into Stage 5)
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [recordedBuffer, setRecordedBuffer] = useState([]);
  const [recordingTriggerInfo, setRecordingTriggerInfo] = useState(null);
  const isRecordingRef = useRef(false);

  // Call metadata
  const [prospectName, setProspectName] = useState('Dr. Anjali Menon');
  const [prospectRole, setProspectRole] = useState('Owner');
  const [companyName, setCompanyName] = useState('Menon Family Clinic');
  const [callId, setCallId] = useState('CALL-1001');
  const [callDuration, setCallDuration] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  
  // Audio Playback & Teleprompter state
  const [turnsList, setTurnsList] = useState([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(-1);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);

  // Past calls ledger list
  const [pastCalls, setPastCalls] = useState([]);
  const [loadingPastCalls, setLoadingPastCalls] = useState(false);

  // Post-Call AI Extraction & Review States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [activeAnalysisResult, setActiveAnalysisResult] = useState(null);
  const [isSavingCall, setIsSavingCall] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(null);
  const [resumeBannerInfo, setResumeBannerInfo] = useState(null);
  const [resumedCallContext, setResumedCallContext] = useState(null);
  const [isCallSavedState, setIsCallSavedState] = useState(false);
  const [expandedCallId, setExpandedCallId] = useState(null);

  // Auto-resume if navigated from Call Ledger
  useEffect(() => {
    if (initialCallToResume) {
      handleResumeCallFromLedger(initialCallToResume);
      if (onClearResumeCall) onClearResumeCall();
    }
  }, [initialCallToResume]);

  const handleResumeCallFromLedger = async (call) => {
    if (!call) return;
    setIsCallSavedState(false);
    setIsReviewMode(false);
    setActiveAnalysisResult(null);
    setSaveSuccessMessage(null);

    // Stop any ongoing speech
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsPlayingAudio(false);
    isSpeakingRef.current = false;
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);

    // Determine target transcript ID
    let targetId = call.transcript_id;
    if (!targetId && call.call_id?.startsWith('CALL-')) {
      const callNum = parseInt(call.call_id.slice(5));
      if (!isNaN(callNum) && callNum >= 1000) {
        targetId = `T${String(callNum - 1000).padStart(3, '0')}`;
      }
    }
    if (!targetId) targetId = 'T001';

    try {
      const detail = await api.getTranscript(targetId);
      if (onSelectTranscript && detail?.id) {
        onSelectTranscript(detail.id);
      }

      const fullTurns = detail?.turns_list || [];

      // Determine where caller cut off
      let cutOffIndex = -1;
      if (typeof call.last_turn_index === 'number' && call.last_turn_index >= 0) {
        cutOffIndex = call.last_turn_index;
      } else if (call.raw_transcript) {
        const spokenLines = call.raw_transcript.split('\n').filter(l => l.startsWith('CALLER:') || l.startsWith('PROSPECT:'));
        if (spokenLines.length > 0) {
          cutOffIndex = Math.min(spokenLines.length - 1, fullTurns.length - 1);
        }
      }

      // Slice turns strictly past the cutOffIndex
      const startTurnOffset = cutOffIndex >= 0 ? cutOffIndex + 1 : 0;
      const remainingTurns = startTurnOffset < fullTurns.length ? fullTurns.slice(startTurnOffset) : fullTurns;
      const effectiveOffset = startTurnOffset < fullTurns.length ? startTurnOffset : 0;

      setResumedCallContext({
        callRecord: call,
        startTurnOffset: effectiveOffset,
        previousDuration: call.duration_seconds || 0,
        previousAttemptCount: call.attempt_count || 1,
        previousMaxStage: call.max_stage_number || 1,
        fullTurns: fullTurns,
        transcriptId: detail.id
      });

      setTurnsList(remainingTurns);
      setCurrentTurnIndex(-1);

      if (call.company_name) setCompanyName(call.company_name);
      else if (detail?.company) setCompanyName(detail.company.replace('(fictional)', '').trim());

      if (call.contact_name) setProspectName(call.contact_name);
      if (call.contact_role) setProspectRole(call.contact_role);
      if (call.call_id) setCallId(call.call_id);

      // Pre-fill previously recorded stage presets and words so earlier stages are retained!
      const initialTaps = {};
      const initialWords = {};
      if (call.stage_analysis && typeof call.stage_analysis === 'object' && !Array.isArray(call.stage_analysis)) {
        Object.entries(call.stage_analysis).forEach(([k, block]) => {
          if (block && block.reached) {
            if (block.selected_preset) initialTaps[Number(k)] = block.selected_preset;
            if (block.prospect_words) initialWords[Number(k)] = block.prospect_words;
          }
        });
      }
      if (call.selected_taps) Object.assign(initialTaps, call.selected_taps);
      if (call.stage_words) Object.assign(initialWords, call.stage_words);
      if (call.stage_5_need_verbatim) initialWords[5] = call.stage_5_need_verbatim;
      if (call.objection_summary) initialWords[6] = call.objection_summary;
      if (call.next_step_action) initialWords[7] = call.next_step_action;

      setSelectedTaps(initialTaps);
      setStageWords(initialWords);

      // Advance activeStage to the next stage to continue smoothly (e.g. from 5 to 6)
      const nextResumeStage = Math.min(8, (call.max_stage_number || 1) + 1);
      setActiveStage(nextResumeStage);
      setCallDuration(0);
      setIsTimerRunning(false);

      setResumeBannerInfo({
        callId: call.call_id,
        companyName: call.company_name || detail.company,
        attemptCount: (call.attempt_count || 1) + 1,
        startTurnNumber: effectiveOffset + 1,
        totalTurns: fullTurns.length,
        lastStage: call.max_stage_number || 1,
        lastStageName: call.max_stage_name || 'Opening',
        bridge: call.suggested_callback_bridge || call.where_you_left_off_summary,
        prospectNeed: call.stage_5_need_verbatim
      });

    } catch (err) {
      console.error('Error resuming call from ledger:', err);
    }
  };

  const isSpeakingRef = useRef(false);
  const playTimeoutRef = useRef(null);
  const dialogueStreamRef = useRef(null);

  useEffect(() => {
    if (dialogueStreamRef.current) {
      dialogueStreamRef.current.scrollTop = dialogueStreamRef.current.scrollHeight;
    }
  }, [currentTurnIndex]);

  // Load past calls from backend
  const loadPastCalls = async () => {
    setLoadingPastCalls(true);
    try {
      const data = await api.getCalls({ limit: 30 });
      setPastCalls(data || []);
    } catch (err) {
      console.error('Failed to load past calls:', err);
    } finally {
      setLoadingPastCalls(false);
    }
  };

  useEffect(() => {
    loadPastCalls();
  }, []);

  // Timer effect
  useEffect(() => {
    let interval = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Format seconds to MM:SS
  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Clean up speech synthesis on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
    };
  }, []);

  // Handle switching transcript target
  const handleSelectTranscriptTarget = async (id) => {
    if (!id) return;
    
    // Stop any ongoing speech
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsPlayingAudio(false);
    isSpeakingRef.current = false;

    try {
      const detail = await api.getTranscript(id);
      onSelectTranscript(detail.id);
      setCompanyName(detail.company.replace('(fictional)', '').trim());
      setProspectRole(detail.prospect_role || 'Executive');
      setProspectName(detail.prospect_role === 'Owner' ? 'Business Owner' : (detail.prospect_role || 'Director'));
      setCallId(detail.call_id || `CALL-${1000 + parseInt(detail.id.slice(1) || '1')}`);
      setTurnsList(detail.turns_list || []);
      setCurrentTurnIndex(-1);

      // Reset stage flow
      setActiveStage(1);
      setSelectedTaps({});
      setStageWords({});
      setStageBoundaries({
        1: {
          stage_number: 1,
          stage_name: 'Opening',
          timestamp_seconds: 0,
          timestamp_formatted: '00:00',
          turn_index: 0
        }
      });
      setIsRecordingActive(false);
      isRecordingRef.current = false;
      setRecordedBuffer([]);
      setRecordingTriggerInfo(null);
      setCallDuration(0);
      setIsTimerRunning(false);
      setIsReviewMode(false);
      setIsAnalyzing(false);
      setActiveAnalysisResult(null);
      setSaveSuccessMessage(null);
      setResumedCallContext(null);
      setResumeBannerInfo(null);
    } catch (err) {
      console.error('Error fetching transcript detail:', err);
    }
  };

  // Trigger Background Recording (Fires when user advances into Stage 5 or beyond)
  const checkAndTriggerRecording = (targetStage) => {
    if (targetStage >= 5 && !isRecordingRef.current) {
      isRecordingRef.current = true;
      setIsRecordingActive(true);
      const meta = {
        triggered_at_stage: targetStage,
        timestamp: formatTimer(callDuration),
        turn_index: currentTurnIndex >= 0 ? currentTurnIndex : 0
      };
      setRecordingTriggerInfo(meta);
      console.log('🔴 Background Audio Recording Triggered:', meta);
    }
  };

  // Pre-load and store available browser voices
  const [availableVoices, setAvailableVoices] = useState([]);

  useEffect(() => {
    const updateVoices = () => {
      if ('speechSynthesis' in window) {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) setAvailableVoices(v);
      }
    };
    updateVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Web Audio chime generator to unlock browser audio and provide distinct speaker tones
  const playSpeakerChime = (speaker) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!window._callerlogAudioCtx) {
        window._callerlogAudioCtx = new AudioCtx();
      }
      if (window._callerlogAudioCtx.state === 'suspended') {
        window._callerlogAudioCtx.resume();
      }
      const ctx = window._callerlogAudioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const isProspect = speaker === 'PROSPECT';
      const now = ctx.currentTime;
      
      if (isProspect) {
        // Deep warm tone for Prospect (280 Hz) - audible volume
        osc.frequency.setValueAtTime(280, now);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.17);
      } else {
        // Crisp, confident tone for Caller (540 Hz) - audible volume
        osc.frequency.setValueAtTime(540, now);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch (err) {
      // AudioContext fallback
    }
  };

  // Audio Playback Engine (SpeechSynthesis + Web Audio Pipeline)
  const speakTurn = (turnIndex, turns) => {
    if (!turns || turnIndex >= turns.length) {
      setIsPlayingAudio(false);
      isSpeakingRef.current = false;
      handleEndCall();
      return;
    }

    const turn = turns[turnIndex];
    setCurrentTurnIndex(turnIndex);

    // If background recording is active, accumulate into recordedBuffer
    if (isRecordingRef.current) {
      setRecordedBuffer((prev) => {
        if (prev.some((t) => t.turn_index === turnIndex)) return prev;
        return [
          ...prev,
          {
            turn_index: turnIndex,
            speaker: turn.speaker,
            text: turn.text,
            timestamp: formatTimer(callDuration),
            stage_number: activeStage
          }
        ];
      });

      // Hands-Free Auto-Capture:
      // At Stage 5: If PROSPECT speaks, automatically extract their verbatim need into stageWords[5]!
      if (activeStage === 5 && turn.speaker === 'PROSPECT') {
        const cleanedQuote = turn.text.replace(/\[.*?\]/g, '').trim();
        if (cleanedQuote) {
          setStageWords((prev) => ({
            ...prev,
            5: cleanedQuote
          }));
        }
      }

      // At Stage 6: If PROSPECT speaks an objection, automatically populate stageWords[6]!
      if (activeStage === 6 && turn.speaker === 'PROSPECT') {
        const cleanedQuote = turn.text.replace(/\[.*?\]/g, '').trim();
        if (cleanedQuote) {
          setStageWords((prev) => ({
            ...prev,
            6: cleanedQuote
          }));
        }
      }
    }

    // Play subtle audio cue indicating speaker
    if (!isMuted) {
      playSpeakerChime(turn.speaker);
    }

    if (isMuted || !('speechSynthesis' in window)) {
      // If muted, simulate delay by word length
      const delay = Math.max(1200, (turn.text.split(' ').length * 280) / playbackSpeed);
      playTimeoutRef.current = setTimeout(() => {
        if (isSpeakingRef.current) {
          speakTurn(turnIndex + 1, turns);
        }
      }, delay);
      return;
    }

    // Clean text for speech (strip brackets like [Call disconnected])
    const cleanSpeech = turn.text.replace(/\[.*?\]/g, '').trim();
    if (!cleanSpeech) {
      speakTurn(turnIndex + 1, turns);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.lang = 'en-US';
    const isProspect = turn.speaker === 'PROSPECT';

    // Distinct Voice & Pitch setup:
    // CALLER: slightly higher pitch, confident rate
    // PROSPECT: slightly deeper pitch, measured tone
    utterance.pitch = isProspect ? 0.82 : 1.12;
    utterance.rate = playbackSpeed;

    const voices = availableVoices.length > 0 ? availableVoices : (('speechSynthesis' in window) ? window.speechSynthesis.getVoices() : []);
    if (voices.length > 0) {
      if (isProspect) {
        const deeper = voices.find(v => 
          v.name.toLowerCase().includes('david') || 
          v.name.toLowerCase().includes('george') || 
          v.name.toLowerCase().includes('ravi') ||
          v.name.toLowerCase().includes('male')
        ) || voices[1] || voices[0];
        if (deeper) utterance.voice = deeper;
      } else {
        const callerVoice = voices.find(v => 
          v.name.toLowerCase().includes('zira') || 
          v.name.toLowerCase().includes('heera') || 
          v.name.toLowerCase().includes('susan') || 
          v.name.toLowerCase().includes('female')
        ) || voices[0];
        if (callerVoice) utterance.voice = callerVoice;
      }
    }

    utterance.onend = () => {
      window._activeUtterance = null;
      if (isSpeakingRef.current) {
        // Natural conversational pause between turns
        playTimeoutRef.current = setTimeout(() => {
          speakTurn(turnIndex + 1, turns);
        }, 450 / playbackSpeed);
      }
    };

    utterance.onerror = (e) => {
      window._activeUtterance = null;
      console.warn('TTS event:', e.error);
      // Only advance if it was not intentionally canceled by pause/stop
      if (e.error !== 'canceled' && e.error !== 'interrupted' && isSpeakingRef.current) {
        playTimeoutRef.current = setTimeout(() => {
          speakTurn(turnIndex + 1, turns);
        }, 500 / playbackSpeed);
      }
    };

    // CRITICAL CHROME FIXES:
    // 1. Store reference on window to prevent Chrome Garbage Collector from killing audio mid-sentence
    window._activeUtterance = utterance;

    // 2. Resume in case Chrome paused the audio thread
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    // 3. Speak cleanly without calling cancel() right before it
    window.speechSynthesis.speak(utterance);
  };

  const handleTogglePlayAudio = () => {
    if (turnsList.length === 0) {
      alert('Please select a transcript from the dropdown above to simulate audio.');
      return;
    }

    if (isPlayingAudio) {
      // Pause
      setIsPlayingAudio(false);
      isSpeakingRef.current = false;
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } else {
      // Play
      setIsPlayingAudio(true);
      setIsTimerRunning(true);
      isSpeakingRef.current = true;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
      }
      const nextIndex = currentTurnIndex < 0 ? 0 : currentTurnIndex;
      // 50ms buffer after cancel before launching first speech
      setTimeout(() => {
        if (isSpeakingRef.current) {
          speakTurn(nextIndex, turnsList);
        }
      }, 50);
    }
  };

  const handleSkipNextTurn = () => {
    if (currentTurnIndex < turnsList.length - 1) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
      const nextIdx = currentTurnIndex + 1;
      setCurrentTurnIndex(nextIdx);
      if (isPlayingAudio) {
        speakTurn(nextIdx, turnsList);
      }
    }
  };

  // Handle stage tap selection
  const handleSelectTap = (stageNum, optionText) => {
    setSelectedTaps((prev) => ({
      ...prev,
      [stageNum]: optionText
    }));
  };

  // Stage Boundary Tagging (The User's Ground-Truth timestamp anchor)
  const tagCurrentStageBoundary = (targetStageNum) => {
    const sData = MERIDIAN_STAGES[targetStageNum - 1];
    const boundary = {
      stage_number: targetStageNum,
      stage_name: sData.name,
      timestamp_seconds: callDuration,
      timestamp_formatted: formatTimer(callDuration),
      turn_index: currentTurnIndex >= 0 ? currentTurnIndex : 0,
      tapped_preset: selectedTaps[targetStageNum] || sData.whatHappened[0],
      prospect_words: stageWords[targetStageNum] || ''
    };

    setStageBoundaries((prev) => ({
      ...prev,
      [targetStageNum]: boundary
    }));
  };

  // Next stage transition (Records boundary ground truth & triggers background capture at Stage 5)
  const handleNextStage = () => {
    tagCurrentStageBoundary(activeStage);
    if (activeStage < 8) {
      const nextStage = activeStage + 1;
      checkAndTriggerRecording(nextStage);
      setActiveStage(nextStage);
      tagCurrentStageBoundary(nextStage);
    } else {
      handleEndCall();
    }
  };

  // Jump to specific stage
  const handleSelectStagePill = (stageNum) => {
    tagCurrentStageBoundary(activeStage);
    checkAndTriggerRecording(stageNum);
    setActiveStage(stageNum);
    tagCurrentStageBoundary(stageNum);
  };

  // End Call trigger: Stops call, triggers LLM 8-stage breakdown, auto-fills presets & prospect words
  const handleEndCall = async () => {
    setIsTimerRunning(false);
    setIsPlayingAudio(false);
    isSpeakingRef.current = false;
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    // Finalize all boundary tags
    tagCurrentStageBoundary(activeStage);

    // CRITICAL: Slice turns and compute cumulative spoken dialogue across attempts
    const newAttemptTurns = (currentTurnIndex >= 0 && turnsList.length > 0)
      ? turnsList.slice(0, currentTurnIndex + 1)
      : (turnsList.length > 0 ? turnsList : []);

    let newLastTurnIndex = currentTurnIndex;
    let cumulativeSpokenTurns = newAttemptTurns;

    if (resumedCallContext && resumedCallContext.fullTurns?.length > 0) {
      newLastTurnIndex = currentTurnIndex >= 0
        ? (resumedCallContext.startTurnOffset + currentTurnIndex)
        : (resumedCallContext.startTurnOffset > 0 ? resumedCallContext.startTurnOffset - 1 : 0);
      cumulativeSpokenTurns = resumedCallContext.fullTurns.slice(0, newLastTurnIndex + 1);
    }

    const rawTranscript = cumulativeSpokenTurns.length > 0
      ? cumulativeSpokenTurns.map(t => `${t.speaker}: ${t.text}`).join('\n')
      : (selectedTranscript?.raw_text || '');

    if (!rawTranscript || !rawTranscript.trim()) {
      setIsReviewMode(true);
      return;
    }

    setIsAnalyzing(true);
    setSaveSuccessMessage(null);

    try {
      const result = await api.analyzeCall({
        raw_transcript: rawTranscript,
        transcript_id: selectedTranscript?.id || resumedCallContext?.transcriptId,
        call_id: callId,
        save_to_database: false
      });

      // Pre-fill presets and prospect words for every reached block!
      const updatedTaps = { ...selectedTaps };
      const updatedWords = { ...stageWords };

      if (result.stage_blocks) {
        Object.entries(result.stage_blocks).forEach(([sKey, block]) => {
          const sNum = Number(sKey);
          if (block.reached) {
            if (block.selected_preset) {
              updatedTaps[sNum] = block.selected_preset;
            }
            if (block.prospect_words) {
              updatedWords[sNum] = block.prospect_words;
            }
          }
        });
      }

      if (result.stage_5_need_verbatim && !updatedWords[5]) {
        updatedWords[5] = result.stage_5_need_verbatim;
      }
      if (result.objection_summary && !updatedWords[6]) {
        updatedWords[6] = result.objection_summary;
      }

      // Check if all turns in the transcript were spoken / reached
      const isCompletedTranscript = 
        (turnsList.length > 0 && currentTurnIndex >= turnsList.length - 1) ||
        (resumedCallContext?.fullTurns && newLastTurnIndex >= resumedCallContext.fullTurns.length - 1);

      const terminalStageNum = isCompletedTranscript
        ? 8
        : Math.max(result.max_stage_number || 1, activeStage || 1, resumedCallContext?.previousMaxStage || 1);
      const stageData = MERIDIAN_STAGES[terminalStageNum - 1] || MERIDIAN_STAGES[0];

      // Build a complete 8-stage dictionary ensuring all reached stages up to terminalStageNum are reached: true
      const completeStageBlocks = {};
      const prevBlocks = resumedCallContext?.callRecord?.stage_analysis || {};

      for (let s = 1; s <= 8; s++) {
        const sKey = String(s);
        const stageMeta = MERIDIAN_STAGES[s - 1];
        const isReached = (s <= terminalStageNum);

        if (isReached) {
          const preset = 
            updatedTaps[s] ||
            result.stage_blocks?.[sKey]?.selected_preset ||
            (prevBlocks[sKey]?.reached ? prevBlocks[sKey]?.selected_preset : null) ||
            stageMeta.whatHappened[0];

          const pWords = 
            updatedWords[s] ||
            result.stage_blocks?.[sKey]?.prospect_words ||
            (prevBlocks[sKey]?.reached ? prevBlocks[sKey]?.prospect_words : null) ||
            (s === 5 ? (updatedWords[5] || result.stage_5_need_verbatim) : "") ||
            (s === 6 ? (updatedWords[6] || result.objection_summary) : "") ||
            (s === 7 ? (updatedWords[7] || result.next_step_action) : "");

          completeStageBlocks[sKey] = {
            stage_number: s,
            stage_name: stageMeta.name,
            reached: true,
            selected_preset: preset,
            prospect_words: pWords,
            summary: `Stage ${s}: ${stageMeta.name} completed.`
          };
          updatedTaps[s] = preset;
          if (pWords) updatedWords[s] = pWords;
        } else {
          completeStageBlocks[sKey] = {
            stage_number: s,
            stage_name: stageMeta.name,
            reached: false,
            selected_preset: null,
            prospect_words: null,
            summary: "Stage not reached before call termination."
          };
        }
      }

      setSelectedTaps(updatedTaps);
      setStageWords(updatedWords);

      // AUTO-SAVE TO PAST CALLS DATABASE (Single Source of Truth)
      const savePayload = {
        transcript_id: selectedTranscript?.id || resumedCallContext?.transcriptId,
        call_id: callId,
        last_turn_index: newLastTurnIndex,
        company_name: companyName || result.company_name,
        prospect_name: prospectName || result.prospect_name,
        prospect_role: prospectRole || result.prospect_role,
        caller_name: 'Priya',
        duration_seconds: callDuration,
        max_stage_number: terminalStageNum,
        max_stage_name: stageData.name,
        outcome: terminalStageNum >= 8 ? (result.outcome !== 'not_logged' ? result.outcome : 'next_step_agreed') : (result.outcome || (terminalStageNum >= 7 ? 'next_step_agreed' : (terminalStageNum >= 3 ? 'follow_up' : 'call_again'))),
        stage_5_need_verbatim: updatedWords[5] || result.stage_5_need_verbatim || null,
        objection_summary: updatedWords[6] || result.objection_summary || null,
        next_step_action: updatedWords[7] || result.next_step_action || (terminalStageNum >= 7 ? 'Send 2-page brief on WhatsApp' : null),
        next_step_date_time: result.next_step_date_time || null,
        next_step_channel: result.next_step_channel || 'WhatsApp',
        where_you_left_off_summary: result.where_you_left_off_summary || null,
        suggested_callback_bridge: result.suggested_callback_bridge || null,
        stage_blocks: completeStageBlocks,
        selected_taps: updatedTaps,
        stage_words: updatedWords,
        raw_transcript: rawTranscript
      };

      let savedCall = null;
      try {
        savedCall = await api.saveReviewedCall(savePayload);
      } catch (saveErr) {
        console.warn('saveReviewedCall fallback:', saveErr);
        savedCall = { ...result, ...savePayload, id: result.id || `CALL-${Date.now()}` };
      }

      // PREPEND IMMEDIATELY to pastCalls so it appears #1 in the second screen
      setPastCalls((prev) => [
        savedCall,
        ...prev.filter(c => c.id !== savedCall.id && c.call_id !== savedCall.call_id)
      ]);

      const fullAnalysisPayload = {
        ...result,
        ...savedCall,
        stage_blocks: completeStageBlocks,
        stage_5_need_verbatim: updatedWords[5] || savedCall.stage_5_need_verbatim,
        objection_summary: updatedWords[6] || savedCall.objection_summary,
        next_step_action: updatedWords[7] || savedCall.next_step_action,
        selected_taps: updatedTaps,
        stage_words: updatedWords
      };

      setActiveAnalysisResult(fullAnalysisPayload);

      // WIPE OFF DASHBOARD: Transition immediately to the saved deliverable state
      setIsCallSavedState(true);
      setIsReviewMode(false);
      setResumedCallContext(null);

    } catch (err) {
      console.error('Call analysis and auto-save failed:', err);
      setIsCallSavedState(true);
      setResumedCallContext(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Caller approves the reviewed/altered call -> persists to database & prepends to past calls ledger
  const handleSaveReviewedCall = async () => {
    setIsSavingCall(true);
    setSaveSuccessMessage(null);

    try {
      const terminalStageNum = activeAnalysisResult?.max_stage_number || activeStage;
      const stageData = MERIDIAN_STAGES[terminalStageNum - 1] || MERIDIAN_STAGES[0];

      const payload = {
        transcript_id: selectedTranscript?.id,
        call_id: callId,
        company_name: companyName,
        prospect_name: prospectName,
        prospect_role: prospectRole,
        caller_name: 'Priya',
        duration_seconds: callDuration,
        max_stage_number: terminalStageNum,
        max_stage_name: stageData.name,
        outcome: activeAnalysisResult?.outcome || (terminalStageNum >= 7 ? 'next_step_agreed' : (terminalStageNum >= 3 ? 'follow_up' : 'call_again')),
        stage_5_need_verbatim: stageWords[5] || activeAnalysisResult?.stage_5_need_verbatim || null,
        objection_summary: stageWords[6] || activeAnalysisResult?.objection_summary || null,
        next_step_action: stageWords[7] || activeAnalysisResult?.next_step_action || (terminalStageNum >= 7 ? 'Send 2-page brief on WhatsApp' : null),
        next_step_date_time: activeAnalysisResult?.next_step_date_time || null,
        next_step_channel: activeAnalysisResult?.next_step_channel || 'WhatsApp',
        where_you_left_off_summary: activeAnalysisResult?.where_you_left_off_summary || null,
        suggested_callback_bridge: activeAnalysisResult?.suggested_callback_bridge || null,
        stage_blocks: activeAnalysisResult?.stage_blocks || {},
        selected_taps: selectedTaps,
        stage_words: stageWords,
        raw_transcript: selectedTranscript?.raw_text
      };

      const savedCall = await api.saveReviewedCall(payload);

      // PREPEND immediately to the top of pastCalls so it appears #1 in the second screen
      setPastCalls((prev) => [
        savedCall,
        ...prev.filter(c => c.id !== savedCall.id && c.call_id !== savedCall.call_id)
      ]);

      setSaveSuccessMessage('Call approved and prepended to the top of Past Calls!');
      setIsCallSavedState(true);

      if (onCallEnded) {
        onCallEnded({
          ...activeAnalysisResult,
          ...savedCall,
          stage_5_need_verbatim: stageWords[5] || savedCall.stage_5_need_verbatim,
          objection_summary: stageWords[6] || savedCall.objection_summary,
          next_step_action: stageWords[7] || savedCall.next_step_action,
          selected_taps: selectedTaps,
          stage_words: stageWords
        });
      }
    } catch (err) {
      console.error('Failed to save reviewed call:', err);
      alert('Error saving reviewed call: ' + err.message);
    } finally {
      setIsSavingCall(false);
    }
  };

  const currentStage = MERIDIAN_STAGES[activeStage - 1];
  const activeTap = selectedTaps[activeStage] || currentStage.whatHappened[0];
  const currentTurn = currentTurnIndex >= 0 && turnsList[currentTurnIndex] ? turnsList[currentTurnIndex] : null;

  return (
    <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '10px 18px 60px 18px' }}>
      
      {/* DUAL SCREEN LAYOUT: Left (Controls + Teleprompter + Call Guide) + Right (Past Calls Ledger pushed to the top) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.62fr) minmax(310px, 0.88fr)',
        gap: '22px',
        alignItems: 'start'
      }}>

        {/* ======================================================== */}
        {/* LEFT COLUMN: Controls + Teleprompter + Call Guide Screen */}
        {/* ======================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Target Selector & Minimal Call Control Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '12px 18px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '10px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={16} color="#818cf8" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Select Prospect Call:
                </span>
                <select
                  value={selectedTranscript?.id || ''}
                  onChange={(e) => handleSelectTranscriptTarget(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: '#0d111d',
                    border: '1px solid var(--border-color)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    minWidth: '260px',
                    maxWidth: '400px'
                  }}
                >
                  <option value="">-- Choose from 100 Transcripts --</option>
                  {transcriptsList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id} · {t.company.replace('(fictional)', '')} ({t.prospect_role})
                    </option>
                  ))}
                </select>
              </div>

              <span style={{
                fontFamily: 'monospace',
                fontSize: '0.78rem',
                padding: '4px 10px',
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '6px',
                color: '#c7d2fe',
                fontWeight: 700
              }}>
                {callId}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => {
                  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                  setIsPlayingAudio(false);
                  isSpeakingRef.current = false;
                  setCurrentTurnIndex(-1);
                  setActiveStage(1);
                  setSelectedTaps({});
                  setStageWords({});
                  setStageBoundaries({});
                  setCallDuration(0);
                  setIsTimerRunning(false);
                }}
                className="btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.78rem', borderRadius: '6px' }}
              >
                <RotateCcw size={13} />
                Reset Call
              </button>
            </div>
          </div>

          {/* Resumed Call Context Banner */}
          {resumeBannerInfo && (
            <div style={{
              padding: '10px 16px',
              background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.16), rgba(139, 92, 246, 0.12))',
              border: '1px solid rgba(99, 102, 241, 0.45)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: '#6366f1',
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase'
                }}>
                  RESUMING ATTEMPT #{resumeBannerInfo.attemptCount}
                </span>
                <div style={{ fontSize: '0.82rem', color: '#e0e7ff' }}>
                  <strong>{resumeBannerInfo.companyName}</strong> · Starting from <strong>Turn {resumeBannerInfo.startTurnNumber} of {resumeBannerInfo.totalTurns}</strong> (Prior turns excluded)
                  {resumeBannerInfo.bridge && (
                    <div style={{ fontSize: '0.74rem', color: '#c7d2fe', fontStyle: 'italic', marginTop: '2px' }}>
                      Suggested Callback Bridge: "{resumeBannerInfo.bridge}"
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setResumeBannerInfo(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}
                title="Dismiss banner"
              >
                ✕
              </button>
            </div>
          )}

          {/* DUAL-VOICE AUDIO SIMULATOR & TELEPROMPTER BAR */}
          <div style={{
            padding: '12px 18px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
            borderRadius: '10px',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            {/* Controls row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={handleTogglePlayAudio}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '6px',
                    background: isPlayingAudio ? '#ef4444' : '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: isPlayingAudio ? '0 0 12px rgba(239, 68, 68, 0.4)' : '0 0 12px rgba(37, 99, 235, 0.4)'
                  }}
                >
                  {isPlayingAudio ? <Pause size={14} /> : <Play size={14} />}
                  <span>{isPlayingAudio ? 'Pause Audio' : 'Play Live Call Simulation'}</span>
                </button>

                <button
                  onClick={handleSkipNextTurn}
                  disabled={turnsList.length === 0}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', borderRadius: '6px' }}
                  title="Skip to next dialogue turn"
                >
                  <SkipForward size={13} />
                  <span>Next Turn</span>
                </button>

                {/* Speed toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
                  {[1.0, 1.25, 1.5].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: 'none',
                        background: playbackSpeed === speed ? 'rgba(99, 102, 241, 0.5)' : 'transparent',
                        color: playbackSpeed === speed ? '#ffffff' : '#94a3b8',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setIsMuted(!isMuted)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isMuted ? '#f87171' : '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                  title={isMuted ? 'Unmute speech' : 'Mute speech (fast visual simulation)'}
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>

                <button
                  onClick={() => {
                    playSpeakerChime('CALLER');
                    setTimeout(() => playSpeakerChime('PROSPECT'), 220);
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '5px 10px', fontSize: '0.72rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)' }}
                  title="Play a test tone to confirm your speakers are receiving sound"
                >
                  🔔 Test Sound
                </button>
              </div>

              {/* Dual Voice Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.74rem', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#c7d2fe' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#818cf8', display: 'inline-block' }} />
                  <strong>CALLER</strong> (1.1x)
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#86efac' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                  <strong>PROSPECT</strong> (0.85x)
                </span>
              </div>

            </div>

            {/* Live Voice Altitude Grid (Wavy Flowing Voice Spectrum) */}
            {(isPlayingAudio || currentTurnIndex >= 0) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 14px',
                background: 'rgba(10, 15, 29, 0.75)',
                borderRadius: '6px',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: isPlayingAudio ? (currentTurn?.speaker === 'PROSPECT' ? '#22c55e' : '#6366f1') : '#64748b',
                    boxShadow: isPlayingAudio ? (currentTurn?.speaker === 'PROSPECT' ? '0 0 8px #22c55e' : '0 0 8px #6366f1') : 'none'
                  }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#cbd5e1' }}>
                    {isPlayingAudio ? `${currentTurn?.speaker || 'LIVE'} VOICE ALTITUDE FLOW` : 'VOICE STREAM STANDBY'}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'monospace', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '3px' }}>
                    {currentTurn?.speaker === 'PROSPECT' ? '280 Hz Warm' : '540 Hz Crisp'}
                  </span>
                </div>

                {/* Flowing Altitude Sound Waves */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '22px' }}>
                  {[18, 40, 72, 30, 85, 55, 38, 78, 96, 62, 34, 82, 50, 92, 68, 38, 58, 82, 28, 72, 88, 48, 68, 32, 58, 78, 42, 88, 62, 28, 48, 82].map((val, idx) => {
                    const isEven = idx % 2 === 0;
                    const gradient = currentTurn?.speaker === 'PROSPECT'
                      ? (isEven ? 'linear-gradient(to top, #16a34a, #4ade80)' : 'linear-gradient(to top, #059669, #34d399)')
                      : (isEven ? 'linear-gradient(to top, #3b82f6, #06b6d4)' : 'linear-gradient(to top, #6366f1, #a855f7)');
                    return (
                      <span
                        key={idx}
                        className={isPlayingAudio ? 'voice-altitude-bar' : ''}
                        style={{
                          width: '2.5px',
                          height: isPlayingAudio ? `${Math.max(4, Math.round(val * 0.22))}px` : '4px',
                          background: gradient,
                          borderRadius: '2px',
                          display: 'inline-block',
                          animation: isPlayingAudio ? 'voiceAltitudeWave 1.1s ease-in-out infinite alternate' : 'none',
                          animationDelay: `${(idx * 0.035).toFixed(2)}s`
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Live Teleprompter / Dialogue Stream Highlight */}
            <div style={{
              padding: '8px 12px',
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '2px 6px',
                borderRadius: '4px',
                background: currentTurn ? (currentTurn.speaker === 'PROSPECT' ? '#22c55e' : '#6366f1') : '#475569',
                color: '#000000'
              }}>
                {currentTurn ? `${currentTurn.speaker} (Turn ${currentTurnIndex + 1}/${turnsList.length})` : 'TELEPROMPTER READY'}
              </span>

              <span style={{
                fontSize: '0.86rem',
                color: '#f8fafc',
                fontStyle: currentTurn ? 'normal' : 'italic',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1
              }}>
                {currentTurn ? `"${currentTurn.text}"` : 'Select a call and hit "Play Live Call Simulation" to listen.'}
              </span>
            </div>

          </div>

          {/* ======================================================== */}
          {/* SCREEN 1: MID-CALL COMPANION (Exact Reference Layout)    */}
          {/* ======================================================== */}
          <div style={{
            background: '#ffffff',
            color: '#0f172a',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
          }}>
          
          {/* Top Title Bar & Timer */}
          <div style={{
            padding: '12px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff'
          }}>
            {((isPlayingAudio || currentTurnIndex >= 0) && !isReviewMode && !isCallSavedState) ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: '0 0 10px #ef4444',
                  display: 'inline-block'
                }} />
                <span style={{
                  fontSize: '0.86rem',
                  fontWeight: 900,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: '#dc2626'
                }}>
                  Call Recording
                </span>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                  · {prospectName} ({companyName})
                </span>
              </div>
            ) : (
              <div style={{
                fontSize: '0.74rem',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#2563eb'
              }}>
                MERIDIAN GROWTH PARTNERS · CALL GUIDE
              </div>
            )}
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'monospace',
              fontSize: '0.92rem',
              fontWeight: 700,
              color: '#1e293b'
            }}>
              <Clock size={15} color={((isPlayingAudio || currentTurnIndex >= 0) && !isReviewMode && !isCallSavedState) ? '#dc2626' : '#64748b'} />
              {formatTimer(callDuration)}
            </div>
          </div>

          {isCallSavedState ? (
            <div style={{
              padding: '64px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              background: '#ffffff'
            }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: '#dcfce7',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(22, 163, 74, 0.25)'
              }}>
                <CheckCircle2 size={30} />
              </div>

              <div>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  background: '#dcfce7',
                  color: '#166534',
                  display: 'inline-block',
                  marginBottom: '8px'
                }}>
                  CALL ENDED & LOGGED TO PAST CALLS
                </span>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0' }}>
                  {activeAnalysisResult?.contact_name || prospectName} · {activeAnalysisResult?.company_name || companyName}
                </h3>
                <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
                  Caller ID: <strong style={{ color: '#2563eb' }}>{activeAnalysisResult?.call_id || callId}</strong> · Reached Stage {activeAnalysisResult?.max_stage_number || 1}: {activeAnalysisResult?.max_stage_name || 'Opening'}
                </p>
              </div>

              {/* Deliverable Attachment Box */}
              <div style={{
                width: '100%',
                maxWidth: '480px',
                padding: '16px 18px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: (activeAnalysisResult?.max_stage_number >= 7) ? '#16a34a' : '#64748b', letterSpacing: '0.06em' }}>
                  {activeAnalysisResult?.max_stage_number >= 7 ? '✓ LOGGED DELIVERABLE ATTACHMENT' : 'CALL LOG SUMMARY (NO DELIVERABLE · INCOMPLETE CALL)'}
                </div>

                <div style={{ fontSize: '0.88rem', color: '#1e293b', fontStyle: 'italic', lineHeight: '1.4' }}>
                  "{activeAnalysisResult?.stage_5_need_verbatim || activeAnalysisResult?.next_step_action || activeAnalysisResult?.where_you_left_off_summary || 'Spoken turns analyzed and indexed in ledger.'}"
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.76rem', color: '#64748b' }}>
                  <span>Outcome: <strong style={{ textTransform: 'capitalize', color: '#0f172a' }}>{activeAnalysisResult?.outcome?.replace(/_/g, ' ') || 'Logged'}</strong></span>
                  <span>Duration: <strong>{formatTimer(callDuration)}</strong></span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '6px' }}>
                <button
                  onClick={() => {
                    if (onCallEnded && activeAnalysisResult) {
                      onCallEnded(activeAnalysisResult);
                    }
                  }}
                  className="btn btn-primary"
                  style={{
                    padding: '10px 20px',
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: activeAnalysisResult?.max_stage_number >= 7 ? '#16a34a' : '#2563eb',
                    border: 'none',
                    boxShadow: activeAnalysisResult?.max_stage_number >= 7 ? '0 2px 8px rgba(22, 163, 74, 0.3)' : '0 2px 8px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  <Sparkles size={15} />
                  <span>{activeAnalysisResult?.max_stage_number >= 7 ? 'View Deliverable & Report' : 'View Call Log & Stages'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsCallSavedState(false);
                    setIsReviewMode(false);
                    setActiveAnalysisResult(null);
                    setCurrentTurnIndex(-1);
                    setActiveStage(1);
                    setSelectedTaps({});
                    setStageWords({});
                    setCallDuration(0);
                  }}
                  className="btn btn-secondary"
                  style={{
                    padding: '10px 18px',
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <PhoneCall size={15} />
                  <span>Start Next Call</span>
                </button>
              </div>
            </div>
          ) : (!isPlayingAudio && currentTurnIndex < 0 && !isReviewMode) ? (
            /* DEFAULT IDLE DEMO GUIDANCE SCREEN */
            <div style={{
              padding: '52px 28px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              background: '#ffffff',
              color: '#0f172a'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.1)',
                color: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.15)'
              }}>
                <Headphones size={28} />
              </div>

              <div>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '3px 12px',
                  borderRadius: '20px',
                  background: '#e0e7ff',
                  color: '#3730a3',
                  display: 'inline-block',
                  marginBottom: '8px'
                }}>
                  {resumeBannerInfo ? 'CALL RESUMED · READY TO CONTINUE' : 'DEMO READY · SELECT & SIMULATE'}
                </span>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '0 0 8px 0' }}>
                  {resumeBannerInfo ? `Resume Call with ${resumeBannerInfo.companyName}` : 'Pick a Call · Choose a Transcript to Simulate'}
                </h3>
                <p style={{ fontSize: '0.86rem', color: '#64748b', maxWidth: '440px', lineHeight: 1.5, margin: '0 auto' }}>
                  {resumeBannerInfo 
                    ? `Attempt #${resumeBannerInfo.attemptCount} will begin directly from Turn ${resumeBannerInfo.startTurnNumber} where the caller previously left off. Click "Play Live Call Simulation" to continue.`
                    : 'Select any target transcript from the dropdown above, then click "Play Live Call Simulation" to start.'}
                </p>
              </div>

              <div style={{
                width: '100%',
                maxWidth: '440px',
                padding: '16px 18px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                fontSize: '0.82rem',
                color: '#475569'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#2563eb', fontWeight: 800 }}>1.</span>
                  <span>Select any of <strong>100 transcripts</strong> from the selector above</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#2563eb', fontWeight: 800 }}>2.</span>
                  <span>Listen to realistic <strong>dual-voice audio simulation</strong> with live teleprompter</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#2563eb', fontWeight: 800 }}>3.</span>
                  <span>Click <strong>"End Call"</strong> at any point to log the call and review the 8 stages</span>
                </div>
              </div>

              <button
                onClick={handleTogglePlayAudio}
                style={{
                  marginTop: '4px',
                  padding: '10px 24px',
                  borderRadius: '6px',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                }}
              >
                <Play size={15} />
                <span>Simulate Call Now</span>
              </button>
            </div>
          ) : isAnalyzing ? (
            <div style={{
              padding: '70px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '16px',
              background: '#ffffff'
            }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                border: '4px solid rgba(37, 99, 235, 0.2)',
                borderTopColor: '#2563eb',
                animation: 'spin 0.8s linear infinite'
              }} />
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
                  AI Analyzing 8-Stage Structure & Extracting Verbatim...
                </h3>
                <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0, maxWidth: '440px', lineHeight: '1.45' }}>
                  Partitioning call into stages, selecting the most accurate predefined preset, and extracting prospect verbatim quotes for every traversed block.
                </p>
              </div>
            </div>
          ) : ((isPlayingAudio || currentTurnIndex >= 0) && !isReviewMode) ? (
            /* ======================================================== */
            /* SIMPLIFIED LIVE CALL RECORDING SCREEN                   */
            /* Top: Call Recording | Middle: Dialogue Flow | Bottom: End */
            /* ======================================================== */
            <div style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: '#ffffff',
              minHeight: '420px'
            }}>
              {/* Dynamic Flowing Voice Altitude Waves ("that wavy thing") */}
              <div style={{
                padding: '12px 18px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: currentTurn?.speaker === 'PROSPECT' ? '#16a34a' : '#2563eb',
                    boxShadow: currentTurn?.speaker === 'PROSPECT' ? '0 0 8px #16a34a' : '0 0 8px #2563eb'
                  }} />
                  <span style={{
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: currentTurn?.speaker === 'PROSPECT' ? '#166534' : '#1e40af'
                  }}>
                    {currentTurn ? `${currentTurn.speaker} SPEAKING` : 'AI LISTENING & RECORDING'}
                  </span>
                  <span style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'monospace' }}>
                    Turn {currentTurnIndex + 1} of {turnsList.length}
                  </span>
                </div>

                {/* Animated sound waves */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '26px' }}>
                  {[22, 48, 85, 36, 95, 60, 42, 88, 100, 70, 40, 92, 58, 96, 75, 42, 65, 90, 32, 80, 95, 54, 75, 38, 65, 85, 48, 95, 68, 34, 54, 90].map((val, idx) => {
                    const isEven = idx % 2 === 0;
                    const gradient = currentTurn?.speaker === 'PROSPECT'
                      ? (isEven ? 'linear-gradient(to top, #16a34a, #4ade80)' : 'linear-gradient(to top, #059669, #34d399)')
                      : (isEven ? 'linear-gradient(to top, #2563eb, #60a5fa)' : 'linear-gradient(to top, #1d4ed8, #93c5fd)');
                    return (
                      <span
                        key={idx}
                        className={isPlayingAudio ? 'voice-altitude-bar' : ''}
                        style={{
                          width: '3px',
                          height: isPlayingAudio ? `${Math.max(5, Math.round(val * 0.24))}px` : '4px',
                          background: gradient,
                          borderRadius: '2px',
                          display: 'inline-block',
                          animation: isPlayingAudio ? 'voiceAltitudeWave 1.0s ease-in-out infinite alternate' : 'none',
                          animationDelay: `${(idx * 0.03).toFixed(2)}s`
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Conversation Dialogue Flow Stream */}
              <div
                ref={dialogueStreamRef}
                style={{
                  flex: 1,
                  minHeight: '260px',
                  maxHeight: '340px',
                  overflowY: 'auto',
                  padding: '14px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                {turnsList.slice(0, Math.max(1, currentTurnIndex + 1)).map((turn, tIdx) => {
                  const isCurrent = tIdx === currentTurnIndex;
                  const isProspect = turn.speaker === 'PROSPECT';
                  return (
                    <div
                      key={tIdx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isProspect ? 'flex-start' : 'flex-end',
                        opacity: isCurrent ? 1 : 0.75,
                        transition: 'opacity 0.2s ease'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '3px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: isProspect ? '#15803d' : '#2563eb'
                      }}>
                        <span>{isProspect ? prospectName || 'PROSPECT' : 'YOU (CALLER)'}</span>
                        {isCurrent && (
                          <span style={{
                            background: isProspect ? '#dcfce7' : '#dbeafe',
                            color: isProspect ? '#166534' : '#1d4ed8',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontSize: '0.64rem',
                            fontWeight: 800
                          }}>
                            NOW SPEAKING
                          </span>
                        )}
                      </div>
                      <div style={{
                        maxWidth: '85%',
                        padding: '10px 14px',
                        borderRadius: isProspect ? '2px 10px 10px 10px' : '10px 2px 10px 10px',
                        background: isProspect ? '#ffffff' : '#eff6ff',
                        border: isCurrent 
                          ? (isProspect ? '1.5px solid #22c55e' : '1.5px solid #3b82f6')
                          : '1px solid #e2e8f0',
                        boxShadow: isCurrent ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                        fontSize: '0.88rem',
                        lineHeight: 1.45,
                        color: '#1e293b',
                        fontWeight: isCurrent ? 600 : 400
                      }}>
                        "{turn.text}"
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom End Call Button: Clean & Simple */}
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4px' }}>
                <button
                  onClick={handleEndCall}
                  style={{
                    padding: '11px 36px',
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#b91c1c'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#dc2626'}
                >
                  <PhoneOff size={16} />
                  <span>End Call</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Prospect Contact Card */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {prospectName}
                </h2>
                <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '4px 0 0 0' }}>
                  {prospectRole}, {companyName} · first call
                </p>
              </div>

              {/* Stage Pill Navigation Bar - strictly clamped to reached stages in Review Mode */}
              {(() => {
                const maxVisibleStage = isReviewMode 
                  ? (activeAnalysisResult?.max_stage_number || activeStage)
                  : 8;
                const visibleStages = MERIDIAN_STAGES.slice(0, maxVisibleStage);
                return (
                  <div style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'grid',
                    gridTemplateColumns: `repeat(${visibleStages.length}, 1fr)`,
                    gap: '6px',
                    background: '#ffffff'
                  }}>
                    {visibleStages.map((s) => {
                      const isActive = s.num === activeStage;
                      const hasBoundary = Boolean(stageBoundaries[s.num]);
                      return (
                        <button
                          key={s.num}
                          onClick={() => handleSelectStagePill(s.num)}
                          style={{
                            padding: '8px 0',
                            textAlign: 'center',
                            borderRadius: '4px',
                            fontSize: '0.9rem',
                            fontWeight: 800,
                            border: isActive ? '1px solid #2563eb' : (hasBoundary ? '1px solid #93c5fd' : '1px solid #cbd5e1'),
                            background: isActive ? '#2563eb' : (hasBoundary ? '#eff6ff' : '#ffffff'),
                            color: isActive ? '#ffffff' : (hasBoundary ? '#1d4ed8' : '#64748b'),
                            cursor: 'pointer',
                            transition: 'all 0.1s ease',
                            position: 'relative'
                          }}
                          title={`Stage ${s.num}: ${s.name}${hasBoundary ? ` (Tagged at ${stageBoundaries[s.num]?.timestamp_formatted})` : ''}`}
                        >
                          {s.num}
                          {hasBoundary && !isActive && (
                            <span style={{
                              position: 'absolute',
                              top: '2px',
                              right: '3px',
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              background: '#2563eb'
                            }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Resume Banner Notification if continuing previous call thread */}
              {resumeBannerInfo && (
                <div style={{
                  margin: '12px 20px 0 20px',
                  padding: '10px 14px',
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <strong>Continuing {resumeBannerInfo.callId} · Follow-up Attempt #{resumeBannerInfo.attemptCount}</strong> (Last reached Stage {resumeBannerInfo.lastStage}: {resumeBannerInfo.lastStageName})
                    {resumeBannerInfo.bridge && (
                      <div style={{ fontSize: '0.76rem', color: '#b45309', marginTop: '3px' }}>
                        Suggested Bridge: "{resumeBannerInfo.bridge}"
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setResumeBannerInfo(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontWeight: 800, fontSize: '1.1rem' }}
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Current Stage Body for Review Mode */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <>
                {/* Review Mode Banner */}
                {isReviewMode && (
                  <div style={{
                    padding: '12px 16px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={16} color="#2563eb" />
                        AI 8-Stage Extraction Complete · Review & Alter Mode
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#3b82f6', marginTop: '2px' }}>
                        Click any stage pill [1]-[8] above to inspect or alter the pre-filled preset or prospect's words.
                      </div>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, background: '#dbeafe', color: '#1d4ed8', padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                      Review Mode
                    </span>
                  </div>
                )}

                {/* Stage Title, 1-line Purpose & Boundary Tag Pill */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
                      STAGE {activeStage} OF 8
                    </div>

                    {stageBoundaries[activeStage] && (
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: '#2563eb',
                        background: '#eff6ff',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Tag size={10} />
                        Boundary Anchor: {stageBoundaries[activeStage].timestamp_formatted} (Turn {stageBoundaries[activeStage].turn_index + 1})
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0' }}>
                    {currentStage.name}
                  </h3>
                  <p style={{ fontSize: '0.92rem', color: '#334155', margin: 0, lineHeight: '1.4' }}>
                    {currentStage.purpose}
                  </p>
                </div>

                {/* Section: THEY MAY SAY (3 Clean bordered quote cards) */}
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b', marginBottom: '8px' }}>
                    THEY MAY SAY
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {currentStage.theyMaySay.map((phrase, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 14px',
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderLeft: '3px solid #2563eb',
                          borderRadius: '4px',
                          fontSize: '0.88rem',
                          color: '#1e293b',
                          fontStyle: 'italic',
                          lineHeight: '1.35'
                        }}
                      >
                        "{phrase}"
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: WHAT HAPPENED (2x2 Grid of 4 Tap Buttons) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
                      WHAT HAPPENED (OPTIONAL PRESETS)
                    </div>
                    {isReviewMode && (
                      <span style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 700 }}>
                        Click any button to alter preset
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {currentStage.whatHappened.map((option, idx) => {
                      const isSelected = activeTap === option;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSelectTap(activeStage, option)}
                          style={{
                            padding: '14px 12px',
                            borderRadius: '4px',
                            border: isSelected ? '1px solid #2563eb' : '1px solid #cbd5e1',
                            background: isSelected ? '#2563eb' : '#ffffff',
                            color: isSelected ? '#ffffff' : '#0f172a',
                            fontSize: '0.86rem',
                            fontWeight: 700,
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '52px',
                            boxShadow: isSelected ? '0 2px 4px rgba(37, 99, 235, 0.25)' : 'none'
                          }}
                        >
                          {isSelected && <Check size={16} style={{ marginRight: '6px', flexShrink: 0 }} />}
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section: PROSPECT'S WORDS (Per-Stage Free-text Box) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
                        PROSPECT'S WORDS AT STAGE {activeStage}
                      </div>
                      {isReviewMode ? (
                        <span style={{
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          color: '#2563eb',
                          background: 'rgba(37, 99, 235, 0.1)',
                          border: '1px solid rgba(37, 99, 235, 0.3)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Sparkles size={11} color="#2563eb" />
                          AI Extracted · Editable
                        </span>
                      ) : isRecordingActive && activeStage >= 5 ? (
                        <span style={{
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          color: '#10b981',
                          background: 'rgba(16, 185, 129, 0.12)',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Sparkles size={11} color="#10b981" />
                          Hands-Free Auto-Capture Active
                        </span>
                      ) : null}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {isReviewMode ? 'Click to modify prospect words' : 'The only free text on the screen'}
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={stageWords[activeStage] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStageWords((prev) => ({
                        ...prev,
                        [activeStage]: val
                      }));
                    }}
                    placeholder={
                      activeStage === 5 
                        ? "Writes down exact challenge/need verbatim (e.g. 'scrap rate is 18% in the plant')..."
                        : "e.g. 'accounting for what, we already have a CA who files everything'..."
                    }
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '4px',
                      border: isReviewMode ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '0.88rem',
                      fontFamily: 'inherit',
                      lineHeight: '1.45',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Save Success Banner */}
                {saveSuccessMessage && (
                  <div style={{
                    padding: '12px 16px',
                    background: '#dcfce7',
                    border: '1px solid #86efac',
                    borderRadius: '6px',
                    color: '#166534',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <CheckCircle2 size={18} color="#16a34a" />
                    <span>{saveSuccessMessage}</span>
                  </div>
                )}

                {/* Bottom Action Bar */}
                {isReviewMode ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '12px', marginTop: '6px' }}>
                    <button
                      onClick={handleSaveReviewedCall}
                      disabled={isSavingCall}
                      style={{
                        padding: '14px 18px',
                        background: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                        fontWeight: 900,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        cursor: isSavingCall ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 2px 4px rgba(22, 163, 74, 0.3)'
                      }}
                    >
                      <CheckCircle2 size={18} />
                      <span>{isSavingCall ? 'SAVING TO PAST CALLS...' : 'APPROVE & SAVE CALL'}</span>
                    </button>

                    <button
                      onClick={() => {
                        if (onCallEnded && activeAnalysisResult) {
                          onCallEnded({
                            ...activeAnalysisResult,
                            stage_5_need_verbatim: stageWords[5] || activeAnalysisResult.stage_5_need_verbatim,
                            objection_summary: stageWords[6] || activeAnalysisResult.objection_summary,
                            next_step_action: stageWords[7] || activeAnalysisResult.next_step_action,
                            selected_taps: selectedTaps,
                            stage_words: stageWords
                          });
                        }
                      }}
                      style={{
                        padding: '14px 16px',
                        background: '#ffffff',
                        color: '#0f172a',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontSize: '0.86rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      VIEW REPORT
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '12px', marginTop: '6px' }}>
                    <button
                      onClick={handleNextStage}
                      style={{
                        padding: '14px 18px',
                        background: '#0f172a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.88rem',
                        fontWeight: 900,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <span>{currentStage.nextLabel}</span>
                      <ArrowRight size={15} />
                    </button>

                    <button
                      onClick={handleEndCall}
                      style={{
                        padding: '14px 16px',
                        background: '#ffffff',
                        color: '#0f172a',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      END CALL
                    </button>
                  </div>
                )}
              </>

          </div>
          </>
        )}

        </div> {/* closes SCREEN 1: MID-CALL COMPANION */}

        </div> {/* closes LEFT COLUMN */}

        {/* ======================================================== */}
        {/* RIGHT COLUMN: PAST CALLS (Aligned to top, compact & expandable) */}
        {/* ======================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              fontSize: '0.74rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--primary-color)'
            }}>
              THE SECOND SCREEN: PAST CALLS
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
              Saved calls & reached stages. Tap any call to inspect details.
            </p>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '430px',
            overflowY: 'auto',
            paddingRight: '4px'
          }}>
            {loadingPastCalls ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Loading past calls...
              </div>
            ) : pastCalls.length === 0 ? (
              <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No past calls saved yet. Complete a call to see it appear here.
              </div>
            ) : (
              pastCalls.map((call, idx) => {
                const stageNameUpper = call.max_stage_name ? call.max_stage_name.toUpperCase() : 'OPENING';
                const color = badgeColor[stageNameUpper] || '#818cf8';
                const dateObj = new Date(call.call_timestamp || Date.now());
                const formattedDate = dateObj.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                });
                const formattedTime = dateObj.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                });
                const fullDateTime = `${formattedDate} · ${formattedTime}`;
                const callKey = call.call_id || call.id || idx;
                const isExpanded = expandedCallId === callKey;

                return (
                  <div
                    key={callKey}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: isExpanded ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Compact Header: Clickable to expand */}
                    <div 
                      onClick={() => setExpandedCallId(isExpanded ? null : callKey)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <strong style={{ fontSize: '0.86rem', fontWeight: 800, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                          {call.company_name}
                        </strong>

                        <span style={{
                          fontSize: '0.66rem',
                          fontWeight: 900,
                          letterSpacing: '0.05em',
                          color: color,
                          textTransform: 'uppercase',
                          padding: '1px 6px',
                          background: 'rgba(255,255,255,0.04)',
                          borderRadius: '4px'
                        }}>
                          {stageNameUpper}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '145px', fontWeight: 600 }}>
                          {call.contact_name || 'Prospect'} · {call.contact_role || 'Executive'}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>
                          {fullDateTime}
                        </span>
                      </div>
                    </div>

                    {/* Expanded Details Drawer (Shown on tapping) */}
                    {isExpanded && (
                      <div style={{
                        marginTop: '8px',
                        paddingTop: '8px',
                        borderTop: '1px dashed rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        fontSize: '0.74rem',
                        color: '#cbd5e1'
                      }}>
                        {call.stage_5_need_verbatim && (
                          <div>
                            <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase' }}>Need: </span>
                            <span style={{ fontStyle: 'italic', color: '#fef3c7' }}>"{call.stage_5_need_verbatim}"</span>
                          </div>
                        )}
                        {call.objection_summary && (
                          <div>
                            <span style={{ color: '#f87171', fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase' }}>Objection: </span>
                            <span style={{ color: '#fee2e2' }}>{call.objection_summary}</span>
                          </div>
                        )}
                        {call.next_step_action && (
                          <div>
                            <span style={{ color: '#34d399', fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase' }}>Next Step: </span>
                            <span style={{ color: '#d1fae5' }}>{call.next_step_action}</span>
                          </div>
                        )}
                        {call.suggested_callback_bridge && (
                          <div>
                            <span style={{ color: '#818cf8', fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase' }}>Bridge: </span>
                            <span style={{ color: '#e0e7ff', fontStyle: 'italic' }}>"{call.suggested_callback_bridge}"</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.68rem', marginTop: '2px', fontWeight: 600 }}>
                          <span>Outcome: {call.outcome?.replace(/_/g, ' ')}</span>
                          <span>Attempt #{call.attempt_count || 1} · {call.duration_seconds || 0}s</span>
                        </div>
                      </div>
                    )}

                    {/* Compact Action Bar */}
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                      <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700, color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.15)', padding: '2px 5px', borderRadius: '3px' }}>
                        {call.call_id || 'CALL-LOG'}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          onClick={() => onCallEnded && onCallEnded(call)}
                          style={{
                            padding: '2px 7px',
                            background: call.max_stage_number >= 7 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                            color: call.max_stage_number >= 7 ? '#34d399' : '#93c5fd',
                            border: call.max_stage_number >= 7 ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(59, 130, 246, 0.35)',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title={call.max_stage_number >= 7 ? "Open attached call deliverable report" : "View call stage log"}
                        >
                          <Sparkles size={10} />
                          <span>{call.max_stage_number >= 7 ? 'Deliverable' : 'Log'}</span>
                        </button>

                        {call.max_stage_number < 8 && (
                          <button
                            onClick={() => handleResumeCallFromLedger(call)}
                            style={{
                              padding: '2px 7px',
                              background: 'rgba(99, 102, 241, 0.12)',
                              color: '#818cf8',
                              border: '1px solid rgba(99, 102, 241, 0.35)',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <RotateCcw size={10} />
                            <span>Resume</span>
                          </button>
                        )}

                        <button
                          onClick={() => setExpandedCallId(isExpanded ? null : callKey)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            padding: '2px'
                          }}
                          title={isExpanded ? 'Collapse info' : 'Tap to expand info'}
                        >
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Small Link to Call Ledger */}
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 4px' }}>
            <button
              onClick={onViewLedger}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#818cf8',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 6px',
                borderRadius: '4px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#a5b4fc'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#818cf8'; }}
            >
              <span>Go to Call Ledger</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Reference Quote Footer */}
          <div style={{
            marginTop: '24px',
            padding: '14px',
            borderLeft: '3px solid #818cf8',
            background: 'rgba(99, 102, 241, 0.05)',
            borderRadius: '4px',
            fontSize: '0.78rem',
            lineHeight: '1.45',
            color: '#cbd5e1'
          }}>
            <em>
              "This is one stage for one made-up trade. Your caller is from the transcripts: selling growth work to the people who run Indian companies. What they say at each stage is in those hundred files, and your screen is built from that."
            </em>
          </div>

        </div>

      </div>

    </div>
  );
}
