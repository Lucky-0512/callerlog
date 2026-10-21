import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.schemas import (
    AnalyzeRequest, CallAnalysisResult, WhatsAppTemplateRequest, 
    WhatsAppTemplateResponse, BattlecardResponse, ReviseAnalysisRequest
)
from app.services.transcript_service import transcript_service
from app.services.gemini_service import gemini_service
from app.services.battlecard_service import battlecard_service
from app.models import Company, Contact, CallRecord

from datetime import datetime, timezone
from app.services.stages_data import STAGES_DICT

def generate_next_call_id(db: Session) -> str:
    """Generate sequential, clean call IDs like CALL-1001, CALL-1002."""
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

router = APIRouter(prefix="/analysis", tags=["Analysis"])

@router.post("/analyze", response_model=CallAnalysisResult)
async def analyze_call(
    payload: AnalyzeRequest,
    x_gemini_key: Optional[str] = Header(None, alias="X-Gemini-Key"),
    db: Session = Depends(get_db)
):
    """Run 8-stage cold-call analysis via Gemini (or Heuristics engine fallback) and optionally persist."""
    raw_text = payload.raw_transcript
    transcript_id = payload.transcript_id

    if not raw_text and transcript_id:
        detail = transcript_service.get_transcript_by_id(transcript_id)
        if not detail:
            raise HTTPException(status_code=404, detail=f"Transcript '{transcript_id}' not found.")
        raw_text = detail.raw_text

    if not raw_text:
        raise HTTPException(status_code=400, detail="Must provide either 'transcript_id' or 'raw_transcript'.")

    # Run analysis
    analysis: CallAnalysisResult = await gemini_service.analyze_transcript(
        raw_text=raw_text,
        transcript_id=transcript_id,
        custom_api_key=x_gemini_key
    )

    if payload.save_to_database:
        # 1. Find or create company
        comp_name_clean = analysis.company_name.strip()
        company = db.query(Company).filter(Company.name.ilike(comp_name_clean)).first()
        if not company:
            company = Company(
                name=comp_name_clean,
                company_kind=analysis.company_kind or "not known"
            )
            db.add(company)
            db.flush()

        # 2. Find or create contact
        contact_name_clean = analysis.prospect_name.strip()
        contact = db.query(Contact).filter(
            Contact.company_id == company.id,
            Contact.full_name.ilike(contact_name_clean)
        ).first()
        if not contact:
            contact = Contact(
                company_id=company.id,
                full_name=contact_name_clean,
                role_title=analysis.prospect_role or "not known"
            )
            db.add(contact)
            db.flush()

        # 3. Determine target call_id and check for existing call record (Strict Deduplication!)
        target_call_id = payload.call_id
        if not target_call_id and transcript_id and transcript_id.startswith("T") and transcript_id[1:].isdigit():
            target_call_id = f"CALL-{1000 + int(transcript_id[1:])}"

        call_record = None
        if target_call_id:
            call_record = db.query(CallRecord).filter(CallRecord.call_id == target_call_id).first()

        if not call_record and transcript_id and not payload.force_new_call:
            call_record = db.query(CallRecord).filter(CallRecord.transcript_id == transcript_id).first()

        if not call_record and not payload.force_new_call:
            # Look for an ACTIVE call for this company/contact that has not reached Stage 8
            call_record = db.query(CallRecord).filter(
                CallRecord.call_id_status == "ACTIVE",
                CallRecord.max_stage_number < 8,
                (
                    (CallRecord.contact_id == contact.id) |
                    (CallRecord.company_id == company.id)
                )
            ).order_by(CallRecord.call_timestamp.desc()).first()

        # 4. Save or Update in place
        hard_terminal_outcomes = {"do_not_call", "wrong_person", "moved_company"}

        if call_record:
            # === RESUMPTION OF EXISTING CALL (DEDUPLICATED) ===
            prev_stage = call_record.max_stage_number
            prev_timestamp = call_record.call_timestamp
            new_attempts = (call_record.attempt_count or 1) + 1

            call_record.attempt_count = new_attempts
            call_record.max_stage_number = max(call_record.max_stage_number, analysis.max_stage_number)
            call_record.max_stage_name = STAGES_DICT.get(call_record.max_stage_number, STAGES_DICT[1]).name
            call_record.outcome = analysis.outcome
            if analysis.caller_name:
                call_record.caller_name = analysis.caller_name
            call_record.duration_seconds = (call_record.duration_seconds or 0) + analysis.duration_seconds

            if analysis.stage_5_need_verbatim:
                call_record.stage_5_need_verbatim = analysis.stage_5_need_verbatim
            if analysis.objection_summary:
                call_record.objection_summary = analysis.objection_summary
            if analysis.next_step_action:
                call_record.next_step_action = analysis.next_step_action
            if analysis.next_step_date_time:
                call_record.next_step_date_time = analysis.next_step_date_time
            if analysis.next_step_channel:
                call_record.next_step_channel = analysis.next_step_channel
            if analysis.where_you_left_off_summary:
                call_record.where_you_left_off_summary = analysis.where_you_left_off_summary
            if analysis.suggested_callback_bridge:
                call_record.suggested_callback_bridge = analysis.suggested_callback_bridge
            if analysis.caller_last_ask:
                call_record.caller_last_ask = analysis.caller_last_ask
            if analysis.prospect_final_response:
                call_record.prospect_final_response = analysis.prospect_final_response

            # Strict rule: Tag closed only when Stage 8 Close is reached (or hard terminal reject)
            if call_record.max_stage_number >= 8 or analysis.outcome in hard_terminal_outcomes:
                call_record.call_id_status = "CLOSED"
            else:
                call_record.call_id_status = "ACTIVE"

            # CRITICAL: Bumping call_timestamp to now moves this call upwards in the ledger without creating a duplicate!
            call_record.call_timestamp = datetime.now(timezone.utc)
            call_record.stage_analysis = [c.model_dump() for c in analysis.stage_chunks]
            db.commit()

            # Attach continuity metadata to returned analysis
            analysis.call_id = call_record.call_id
            analysis.call_id_status = call_record.call_id_status
            analysis.attempt_count = call_record.attempt_count
            analysis.is_continuation = True
            analysis.previous_stage_number = prev_stage
            analysis.previous_call_timestamp = prev_timestamp
            analysis.where_you_left_off_summary = call_record.where_you_left_off_summary
            analysis.suggested_callback_bridge = call_record.suggested_callback_bridge

        else:
            # === BRAND NEW CALL THREAD ===
            assigned_call_id = target_call_id or payload.call_id or generate_next_call_id(db)
            status = "CLOSED" if (analysis.max_stage_number >= 8 or analysis.outcome in hard_terminal_outcomes) else "ACTIVE"

            new_record = CallRecord(
                call_id=assigned_call_id,
                call_id_status=status,
                attempt_count=1,
                company_id=company.id,
                contact_id=contact.id,
                transcript_id=transcript_id,
                caller_name=analysis.caller_name,
                duration_seconds=analysis.duration_seconds,
                max_stage_number=analysis.max_stage_number,
                max_stage_name=analysis.max_stage_name,
                outcome=analysis.outcome,
                stage_5_need_verbatim=analysis.stage_5_need_verbatim,
                objection_summary=analysis.objection_summary,
                next_step_action=analysis.next_step_action,
                next_step_date_time=analysis.next_step_date_time,
                next_step_channel=analysis.next_step_channel,
                where_you_left_off_summary=analysis.where_you_left_off_summary,
                suggested_callback_bridge=analysis.suggested_callback_bridge,
                caller_last_ask=analysis.caller_last_ask,
                prospect_final_response=analysis.prospect_final_response,
                raw_transcript=raw_text,
                stage_analysis=[c.model_dump() for c in analysis.stage_chunks],
                call_timestamp=datetime.now(timezone.utc)
            )
            db.add(new_record)
            db.commit()

            analysis.call_id = assigned_call_id
            analysis.call_id_status = status
            analysis.attempt_count = 1
            analysis.is_continuation = False

    return analysis

@router.post("/whatsapp-template", response_model=WhatsAppTemplateResponse)
def generate_whatsapp_template(payload: WhatsAppTemplateRequest):
    """Generate high-converting, personalized WhatsApp follow-up copy."""
    lines = [
        f"Hi {payload.prospect_name} ji,",
        f"This is {payload.caller_name} from Meridian Growth Partners following up on our call regarding {payload.company_name}."
    ]

    if payload.stage_5_need:
        lines.append(f"\nAs you mentioned, \"{payload.stage_5_need.strip()}\"—we've put together a concise 2-page growth analysis with specific margin and volume levers tailored to your industry.")

    if payload.next_step_action:
        lines.append(f"\nAs agreed, I'm sharing the research document here. Let's touch base on {payload.next_step_date_time or 'our scheduled follow-up'} to review key findings.")
    else:
        lines.append(f"\nSharing the document below for your review. Would love to hear your thoughts when you have 5 minutes.")

    lines.append("\nBest regards,\n" + f"{payload.caller_name}\nMeridian Growth Partners, Hyderabad")

    message = "\n".join(lines)
    encoded = urllib.parse.quote(message)
    phone_clean = "".join(filter(str.isdigit, payload.prospect_phone or ""))
    
    if phone_clean:
        direct_link = f"https://wa.me/{phone_clean}?text={encoded}"
    else:
        direct_link = f"https://api.whatsapp.com/send?text={encoded}"

    return WhatsAppTemplateResponse(message=message, direct_link=direct_link)

@router.get("/battlecard", response_model=BattlecardResponse)
def get_battlecard(objection: Optional[str] = None):
    """Retrieve battlecard and talk track countering a specific objection."""
    return battlecard_service.get_battlecard_for_objection(objection)

@router.post("/revise", response_model=CallAnalysisResult)
async def revise_analysis(
    payload: ReviseAnalysisRequest,
    x_gemini_key: Optional[str] = Header(None, alias="X-Gemini-Key"),
    db: Session = Depends(get_db)
):
    """Re-synthesize call analysis incorporating caller's explicit feedback and corrections."""
    revised_prompt_text = f"""Transcript to evaluate:
---
{payload.raw_transcript}
---

CALLER'S MANDATORY FEEDBACK & CORRECTIONS:
The cold caller reviewed the call draft and specified the following correction. You MUST incorporate this correction into your stage extraction, presets, and verbatim quotes:
"{payload.user_feedback}"
"""
    analysis: CallAnalysisResult = await gemini_service.analyze_transcript(
        raw_text=revised_prompt_text,
        transcript_id=None,
        custom_api_key=x_gemini_key
    )
    if payload.call_id:
        analysis.call_id = payload.call_id

    # If call exists in DB, update record in-place
    if payload.call_id:
        call_record = db.query(CallRecord).filter(CallRecord.call_id == payload.call_id).first()
        if call_record:
            call_record.max_stage_number = analysis.max_stage_number
            call_record.max_stage_name = analysis.max_stage_name
            call_record.outcome = analysis.outcome
            call_record.stage_5_need_verbatim = analysis.stage_5_need_verbatim
            call_record.objection_summary = analysis.objection_summary
            call_record.next_step_action = analysis.next_step_action
            call_record.next_step_date_time = analysis.next_step_date_time
            call_record.next_step_channel = analysis.next_step_channel
            if analysis.stage_blocks:
                call_record.stage_analysis = {k: v.model_dump() for k, v in analysis.stage_blocks.items()}
            db.commit()

    return analysis

