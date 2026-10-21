from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field

# --- Stage Definitions ---
class StageMetadata(BaseModel):
    number: int
    name: str
    purpose: str
    they_may_say: List[str]
    what_happened_options: List[str]
    action_label: str

# --- Transcript Schemas ---
class TranscriptTurn(BaseModel):
    turn_index: int
    speaker: str # CALLER, PROSPECT, RECEPTION
    text: str
    stage_number: Optional[int] = None
    stage_name: Optional[str] = None

class TranscriptSummary(BaseModel):
    id: str
    call_id: Optional[str] = None
    duration_seconds: int
    outcome: str
    prospect_role: str
    company_kind: str
    company: str
    caller: str
    turns: int

class TranscriptDetail(TranscriptSummary):
    raw_text: str
    turns_list: List[TranscriptTurn]

class CustomTranscriptInput(BaseModel):
    raw_text: str
    caller_name: Optional[str] = "Caller"
    prospect_name: Optional[str] = None
    company_name: Optional[str] = None

# --- Analysis & Extraction Schemas ---
class StageBlockData(BaseModel):
    stage_number: int
    stage_name: str
    reached: bool = False
    selected_preset: Optional[str] = None
    prospect_words: Optional[str] = None
    summary: Optional[str] = None
    start_turn: Optional[int] = None
    end_turn: Optional[int] = None

class StageChunk(BaseModel):
    stage_number: int
    stage_name: str
    start_turn: int
    end_turn: int
    summary: str
    dialogue_excerpt: str

class TurnClassification(BaseModel):
    turn_index: int
    speaker: str
    text: str
    stage_number: int
    stage_name: str
    note: Optional[str] = None

class BattlecardResponse(BaseModel):
    objection: str
    root_cause: str
    core_talk_track: str
    quick_counter_points: List[str]
    question_to_ask_next: str

class CallAnalysisResult(BaseModel):
    transcript_id: Optional[str] = None
    call_id: Optional[str] = None
    call_id_status: str = "ACTIVE"
    attempt_count: int = 1
    last_turn_index: Optional[int] = None
    company_name: str
    company_kind: str
    prospect_name: str
    prospect_role: str
    caller_name: str
    duration_seconds: int
    start_stage_number: int = 1
    max_stage_number: int
    max_stage_name: str
    outcome: str
    stage_5_need_verbatim: Optional[str] = None
    objection_category: Optional[str] = None
    objection_summary: Optional[str] = None
    next_step_action: Optional[str] = None
    next_step_date_time: Optional[str] = None
    next_step_channel: Optional[str] = None
    where_you_left_off_summary: Optional[str] = None
    suggested_callback_bridge: Optional[str] = None
    caller_last_ask: Optional[str] = None
    prospect_final_response: Optional[str] = None
    is_continuation: bool = False
    previous_stage_number: Optional[int] = None
    previous_call_timestamp: Optional[datetime] = None
    summary: str
    stage_chunks: List[StageChunk] = []
    turn_classifications: List[TurnClassification] = []
    stage_blocks: Dict[str, StageBlockData] = Field(default_factory=dict)
    battlecard: Optional[BattlecardResponse] = None

class AnalyzeRequest(BaseModel):
    transcript_id: Optional[str] = None
    raw_transcript: Optional[str] = None
    call_id: Optional[str] = None
    last_turn_index: Optional[int] = None
    force_new_call: bool = False
    save_to_database: bool = True

class SaveReviewedCallRequest(BaseModel):
    transcript_id: Optional[str] = None
    call_id: Optional[str] = None
    company_name: str
    company_kind: Optional[str] = "mid-size private company"
    prospect_name: str
    prospect_role: Optional[str] = "Executive"
    caller_name: str = "Priya"
    duration_seconds: int = 0
    start_stage_number: int = 1
    max_stage_number: int = 1
    max_stage_name: str = "Opening"
    outcome: str = "not_logged"
    stage_5_need_verbatim: Optional[str] = None
    objection_summary: Optional[str] = None
    next_step_action: Optional[str] = None
    next_step_date_time: Optional[str] = None
    next_step_channel: Optional[str] = None
    where_you_left_off_summary: Optional[str] = None
    suggested_callback_bridge: Optional[str] = None
    caller_last_ask: Optional[str] = None
    prospect_final_response: Optional[str] = None
    stage_blocks: Optional[Dict[str, Any]] = None
    selected_taps: Optional[Dict[str, str]] = None
    stage_words: Optional[Dict[str, str]] = None
    raw_transcript: Optional[str] = None
    last_turn_index: Optional[int] = None

class ReviseAnalysisRequest(BaseModel):
    call_id: Optional[str] = None
    raw_transcript: str
    user_feedback: str
    current_max_stage: int = 1
    company_name: Optional[str] = None
    prospect_name: Optional[str] = None

class WhatsAppTemplateRequest(BaseModel):
    prospect_name: str
    prospect_phone: Optional[str] = None
    company_name: str
    caller_name: str
    stage_5_need: Optional[str] = None
    next_step_action: Optional[str] = None
    next_step_date_time: Optional[str] = None

class WhatsAppTemplateResponse(BaseModel):
    message: str
    direct_link: str

# --- Database Record Schemas ---
class ContactBrief(BaseModel):
    id: str
    full_name: str
    role_title: str
    phone_number: Optional[str] = None
    email: Optional[str] = None

class CompanyBrief(BaseModel):
    id: str
    name: str
    company_kind: str
    industry: Optional[str] = None
    total_calls: int = 0

class CallRecordResponse(BaseModel):
    id: str
    call_id: Optional[str] = None
    call_id_status: str = "ACTIVE"
    attempt_count: int = 1
    last_turn_index: Optional[int] = None
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    contact_id: Optional[str] = None
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None
    transcript_id: Optional[str] = None
    caller_name: str
    duration_seconds: int
    start_stage_number: int = 1
    max_stage_number: int
    max_stage_name: str
    outcome: str
    stage_5_need_verbatim: Optional[str] = None
    objection_summary: Optional[str] = None
    next_step_action: Optional[str] = None
    next_step_date_time: Optional[str] = None
    next_step_channel: Optional[str] = None
    where_you_left_off_summary: Optional[str] = None
    suggested_callback_bridge: Optional[str] = None
    caller_last_ask: Optional[str] = None
    prospect_final_response: Optional[str] = None
    stage_analysis: Union[List[Any], Dict[str, Any]] = []
    call_timestamp: datetime
    created_at: datetime

    class Config:
        from_attributes = True

# --- Analytics Schemas ---
class FunnelStageStat(BaseModel):
    stage_number: int
    stage_name: str
    count: int
    percentage: float
    drop_off_count: int

class AnalyticsOverview(BaseModel):
    total_calls_analyzed: int
    outcomes_breakdown: Dict[str, int]
    stage_funnel: List[FunnelStageStat]
    company_kinds_breakdown: Dict[str, int]
    avg_call_duration_seconds: float
