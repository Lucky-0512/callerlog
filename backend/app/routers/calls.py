from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import CallRecord, Company, Contact
from app.schemas import CallRecordResponse, SaveReviewedCallRequest
from app.services.stages_data import STAGES_DICT

router = APIRouter(prefix="/calls", tags=["Calls"])

def generate_next_call_id(db: Session) -> str:
    highest_num = 1000
    existing = db.query(CallRecord.call_id).filter(CallRecord.call_id.isnot(None)).all()
    for (cid,) in existing:
        if cid and cid.startswith("CALL-"):
            try:
                num = int(cid.split("-")[1])
                if num > highest_num:
                    highest_num = num
            except (ValueError, IndexError):
                pass
    return f"CALL-{highest_num + 1}"

def serialize_call_record(r: CallRecord) -> CallRecordResponse:
    cid = r.call_id or f"CALL-{r.id[:6].upper()}"
    status = r.call_id_status or ("CLOSED" if r.max_stage_number >= 8 else "ACTIVE")
    return CallRecordResponse(
        id=r.id,
        call_id=cid,
        call_id_status=status,
        attempt_count=r.attempt_count or 1,
        last_turn_index=r.last_turn_index,
        company_id=r.company_id,
        company_name=r.company.name if r.company else "Unknown Company",
        contact_id=r.contact_id,
        contact_name=r.contact.full_name if r.contact else "Prospect",
        contact_role=r.contact.role_title if r.contact else "not known",
        transcript_id=r.transcript_id,
        caller_name=r.caller_name,
        duration_seconds=r.duration_seconds,
        max_stage_number=r.max_stage_number,
        max_stage_name=r.max_stage_name,
        outcome=r.outcome,
        stage_5_need_verbatim=r.stage_5_need_verbatim,
        objection_summary=r.objection_summary,
        next_step_action=r.next_step_action,
        next_step_date_time=r.next_step_date_time,
        next_step_channel=r.next_step_channel,
        where_you_left_off_summary=r.where_you_left_off_summary,
        suggested_callback_bridge=r.suggested_callback_bridge,
        caller_last_ask=r.caller_last_ask,
        prospect_final_response=r.prospect_final_response,
        stage_analysis=r.stage_analysis or [],
        call_timestamp=r.call_timestamp,
        created_at=r.created_at
    )

@router.get("", response_model=List[CallRecordResponse])
def get_call_records(
    outcome: Optional[str] = Query(None),
    max_stage: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    company_name: Optional[str] = Query(None),
    call_id: Optional[str] = Query(None),
    transcript_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Retrieve logged call records with associated company and contact details."""
    query = db.query(CallRecord).outerjoin(Company, CallRecord.company_id == Company.id).outerjoin(Contact, CallRecord.contact_id == Contact.id)
    
    if call_id:
        query = query.filter(CallRecord.call_id == call_id)
    if transcript_id:
        query = query.filter(CallRecord.transcript_id == transcript_id)
    if status:
        query = query.filter(CallRecord.call_id_status == status.upper())
    if outcome:
        query = query.filter(CallRecord.outcome == outcome)
    if max_stage:
        query = query.filter(CallRecord.max_stage_number == max_stage)
    if company_name:
        query = query.filter(Company.name.ilike(f"%{company_name}%"))
    if search:
        s = f"%{search}%"
        query = query.filter(
            (Company.name.ilike(s)) | 
            (Contact.full_name.ilike(s)) | 
            (CallRecord.caller_name.ilike(s)) |
            (CallRecord.call_id.ilike(s)) |
            (CallRecord.next_step_action.ilike(s))
        )
        
    records = query.order_by(CallRecord.call_timestamp.desc()).limit(limit).all()
    return [serialize_call_record(r) for r in records]

@router.get("/target-active", response_model=Optional[CallRecordResponse])
def get_target_active_call(
    transcript_id: Optional[str] = Query(None),
    company_name: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Check if an active (unclosed) call exists for this transcript or company."""
    query = db.query(CallRecord).outerjoin(Company, CallRecord.company_id == Company.id)
    query = query.filter(CallRecord.call_id_status == "ACTIVE", CallRecord.max_stage_number < 8)

    if transcript_id:
        record = query.filter(CallRecord.transcript_id == transcript_id).order_by(CallRecord.call_timestamp.desc()).first()
        if record:
            return serialize_call_record(record)

    if company_name:
        record = query.filter(Company.name.ilike(company_name.strip())).order_by(CallRecord.call_timestamp.desc()).first()
        if record:
            return serialize_call_record(record)

    return None

@router.get("/{call_id}", response_model=CallRecordResponse)
def get_call_detail(call_id: str, db: Session = Depends(get_db)):
    """Retrieve full details of a specific logged call by record ID or human-readable Call ID."""
    r = db.query(CallRecord).filter((CallRecord.id == call_id) | (CallRecord.call_id == call_id)).first()
    if not r:
        raise HTTPException(status_code=404, detail="Call record not found")
        
    return serialize_call_record(r)

@router.delete("/{call_id}")
def delete_call_record(call_id: str, db: Session = Depends(get_db)):
    """Delete a logged call record."""
    r = db.query(CallRecord).filter((CallRecord.id == call_id) | (CallRecord.call_id == call_id)).first()
    if not r:
        raise HTTPException(status_code=404, detail="Call record not found")
    db.delete(r)
    db.commit()
    return {"message": "Call record deleted successfully"}

@router.post("/save-reviewed", response_model=CallRecordResponse)
def save_reviewed_call(payload: SaveReviewedCallRequest, db: Session = Depends(get_db)):
    """Persist or update a reviewed call record with caller-verified presets and verbatim quotes."""
    comp_name_clean = payload.company_name.strip()
    company = db.query(Company).filter(Company.name.ilike(comp_name_clean)).first()
    if not company:
        company = Company(
            name=comp_name_clean,
            company_kind=payload.company_kind or "mid-size private company"
        )
        db.add(company)
        db.flush()

    contact_name_clean = payload.prospect_name.strip()
    contact = db.query(Contact).filter(
        Contact.company_id == company.id,
        Contact.full_name.ilike(contact_name_clean)
    ).first()
    if not contact:
        contact = Contact(
            company_id=company.id,
            full_name=contact_name_clean,
            role_title=payload.prospect_role or "not known"
        )
        db.add(contact)
        db.flush()

    # Locate existing call or create new
    call_record = None
    if payload.call_id:
        call_record = db.query(CallRecord).filter(CallRecord.call_id == payload.call_id).first()
    if not call_record and payload.transcript_id:
        call_record = db.query(CallRecord).filter(CallRecord.transcript_id == payload.transcript_id).first()
    if not call_record and company:
        # Match active unclosed call for this company to continue stages seamlessly
        call_record = db.query(CallRecord).filter(
            CallRecord.company_id == company.id,
            CallRecord.call_id_status == "ACTIVE"
        ).order_by(CallRecord.call_timestamp.desc()).first()

    hard_terminal_outcomes = {"do_not_call", "wrong_person", "moved_company"}

    stage_analysis_data = payload.stage_blocks or {
        "selected_taps": payload.selected_taps or {},
        "stage_words": payload.stage_words or {}
    }

    if call_record:
        # Merge existing stage blocks with new attempt so full 8-stage history is retained
        merged_stage_analysis = {}
        if isinstance(call_record.stage_analysis, dict):
            merged_stage_analysis.update(call_record.stage_analysis)
        elif isinstance(call_record.stage_analysis, list):
            for chunk in call_record.stage_analysis:
                s_num = chunk.get("stage_number")
                if s_num:
                    merged_stage_analysis[str(s_num)] = {
                        "stage_number": s_num,
                        "stage_name": chunk.get("stage_name", STAGES_DICT.get(s_num, STAGES_DICT[1]).name),
                        "reached": True,
                        "summary": chunk.get("summary", "")
                    }
        
        if isinstance(stage_analysis_data, dict):
            for k, v in stage_analysis_data.items():
                if isinstance(v, dict) and v.get("reached"):
                    merged_stage_analysis[k] = v
                elif k not in merged_stage_analysis:
                    merged_stage_analysis[k] = v
        else:
            merged_stage_analysis = stage_analysis_data

        new_max_stage = max(call_record.max_stage_number or 1, payload.max_stage_number or 1)
        # Ensure all stages up to new_max_stage are marked reached: true
        for s_num in range(1, new_max_stage + 1):
            s_key = str(s_num)
            if s_key in merged_stage_analysis and isinstance(merged_stage_analysis[s_key], dict):
                merged_stage_analysis[s_key]["reached"] = True
                if not merged_stage_analysis[s_key].get("selected_preset"):
                    meta = STAGES_DICT.get(s_num, STAGES_DICT[1])
                    merged_stage_analysis[s_key]["selected_preset"] = meta.what_happened_options[0] if meta.what_happened_options else "Completed"

        status = "CLOSED" if (new_max_stage >= 8 or payload.outcome in hard_terminal_outcomes) else "ACTIVE"

        call_record.caller_name = payload.caller_name
        call_record.duration_seconds = (call_record.duration_seconds or 0) + payload.duration_seconds
        call_record.attempt_count = (call_record.attempt_count or 1) + 1
        call_record.max_stage_number = new_max_stage
        call_record.max_stage_name = STAGES_DICT.get(new_max_stage, STAGES_DICT[1]).name
        call_record.outcome = payload.outcome if payload.outcome != "not_logged" else call_record.outcome
        call_record.stage_5_need_verbatim = payload.stage_5_need_verbatim or call_record.stage_5_need_verbatim
        call_record.objection_summary = payload.objection_summary or call_record.objection_summary
        call_record.next_step_action = payload.next_step_action or call_record.next_step_action
        call_record.next_step_date_time = payload.next_step_date_time or call_record.next_step_date_time
        call_record.next_step_channel = payload.next_step_channel or call_record.next_step_channel
        call_record.where_you_left_off_summary = payload.where_you_left_off_summary or call_record.where_you_left_off_summary
        call_record.suggested_callback_bridge = payload.suggested_callback_bridge or call_record.suggested_callback_bridge
        call_record.caller_last_ask = payload.caller_last_ask or call_record.caller_last_ask
        call_record.prospect_final_response = payload.prospect_final_response or call_record.prospect_final_response
        call_record.stage_analysis = merged_stage_analysis
        call_record.call_id_status = status
        if payload.last_turn_index is not None:
            call_record.last_turn_index = payload.last_turn_index
        # Update timestamp to now so it immediately surfaces to the top of Past Calls!
        call_record.call_timestamp = datetime.now(timezone.utc)
        if payload.raw_transcript:
            call_record.raw_transcript = payload.raw_transcript
    else:
        assigned_call_id = payload.call_id
        if not assigned_call_id and payload.transcript_id and payload.transcript_id.startswith("T") and payload.transcript_id[1:].isdigit():
            assigned_call_id = f"CALL-{1000 + int(payload.transcript_id[1:])}"
        if not assigned_call_id:
            assigned_call_id = generate_next_call_id(db)

        call_record = CallRecord(
            call_id=assigned_call_id,
            call_id_status=status,
            attempt_count=1,
            last_turn_index=payload.last_turn_index if payload.last_turn_index is not None else -1,
            company_id=company.id,
            contact_id=contact.id,
            transcript_id=payload.transcript_id,
            caller_name=payload.caller_name,
            duration_seconds=payload.duration_seconds,
            max_stage_number=payload.max_stage_number,
            max_stage_name=payload.max_stage_name,
            outcome=payload.outcome,
            stage_5_need_verbatim=payload.stage_5_need_verbatim,
            objection_summary=payload.objection_summary,
            next_step_action=payload.next_step_action,
            next_step_date_time=payload.next_step_date_time,
            next_step_channel=payload.next_step_channel,
            where_you_left_off_summary=payload.where_you_left_off_summary,
            suggested_callback_bridge=payload.suggested_callback_bridge,
            caller_last_ask=payload.caller_last_ask,
            prospect_final_response=payload.prospect_final_response,
            raw_transcript=payload.raw_transcript or f"Call logged for {payload.company_name}",
            stage_analysis=stage_analysis_data,
            call_timestamp=datetime.now(timezone.utc)
        )
        db.add(call_record)

    db.commit()
    db.refresh(call_record)
    return serialize_call_record(call_record)
