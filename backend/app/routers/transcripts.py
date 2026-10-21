from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.schemas import TranscriptSummary, TranscriptDetail, CustomTranscriptInput, StageMetadata
from app.services.transcript_service import transcript_service
from app.services.stages_data import STAGES_DICT

router = APIRouter(prefix="/transcripts", tags=["Transcripts"])

@router.get("/stages", response_model=List[StageMetadata])
def get_all_stages():
    """Returns the authoritative 8 stages, their purpose, 'they may say' cues, and 1-tap options."""
    return [STAGES_DICT[i] for i in range(1, 9)]

@router.get("", response_model=List[TranscriptSummary])
def list_transcripts(
    outcome: Optional[str] = Query(None, description="Filter by outcome"),
    company_kind: Optional[str] = Query(None, description="Filter by company kind"),
    search: Optional[str] = Query(None, description="Search company or prospect role")
):
    """Retrieve all available cold-call transcripts from the 100-transcripts repository."""
    all_items = transcript_service.get_all_summaries()
    
    filtered = all_items
    if outcome:
        filtered = [t for t in filtered if t.outcome.lower() == outcome.lower()]
    if company_kind:
        filtered = [t for t in filtered if t.company_kind.lower() == company_kind.lower()]
    if search:
        s = search.lower()
        filtered = [t for t in filtered if s in t.company.lower() or s in t.prospect_role.lower() or s in t.id.lower()]
        
    return filtered

@router.get("/{transcript_id}", response_model=TranscriptDetail)
def get_transcript(transcript_id: str):
    """Get full dialogue turns and metadata for a specific transcript."""
    detail = transcript_service.get_transcript_by_id(transcript_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Transcript '{transcript_id}' not found.")
    return detail

@router.post("/parse-custom", response_model=TranscriptDetail)
def parse_custom_transcript(payload: CustomTranscriptInput):
    """Parse custom pasted transcript text into structured turns."""
    turns = transcript_service.parse_raw_turns(payload.raw_text)
    headers = transcript_service.extract_headers_from_raw(payload.raw_text)
    
    company = payload.company_name or headers.get("company", "Custom Prospect Company")
    caller = payload.caller_name or headers.get("caller", "Caller")
    
    return TranscriptDetail(
        id="CUSTOM",
        duration_seconds=int(headers.get("duration_seconds", len(turns) * 6)),
        outcome=headers.get("outcome", "not_logged"),
        prospect_role=headers.get("prospect_role", "Executive"),
        company_kind=headers.get("company_kind", "mid-size private company"),
        company=company,
        caller=caller,
        turns=len(turns),
        raw_text=payload.raw_text,
        turns_list=turns
    )
